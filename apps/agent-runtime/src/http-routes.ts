import type { IncomingMessage, ServerResponse } from 'node:http'

import { resolveAuthMode, runSkill, sandboxPath, type AuthMode, type CliRun } from './claude-cli'
import { TicketRejected, TicketVerifier } from './auth-ticket'
import { AgentRunError, type AgentFailureReason } from './errors'
import { JobQueue, QueueDeadlineError } from './job-queue'
import { LoginSessionController, LoginSessionError, clearStoredCredential } from './login-session'
import { requireSkill, type Skill } from './skill-registry'

/**
 * Every route this container answers, in one place, behind a factory instead of module side
 * effects — `main.ts` used to own this and could only be exercised by starting the process, which
 * meant the one property that matters most here had no test at all: that `/run/*` still demands
 * `Bearer $AGENT_TOKEN` after somebody adds a route next to it.
 *
 * TWO FAMILIES OF ROUTES, TWO GUARDS, AND THEY MUST NOT BLUR:
 *
 *   `/run/*`         `Bearer $AGENT_TOKEN`   server-to-server only, NOT forwarded by Caddy
 *   `/agent-auth/*`  `Ticket <vé>`           reached from a browser, IS forwarded by Caddy
 *
 * The prefixes are separate so that the Caddyfile can name one of them and not the other. Serving
 * a login route under `/run` would put the quota-spending endpoint behind the public prefix with a
 * single line of config and nobody noticing.
 */

export interface RouterDeps {
  /** False when `AGENT_TOKEN` is unset: the feature is off, not broken (ADR-0041). */
  enabled: boolean
  token: string | undefined
  skills: Map<string, Skill>
  queue: JobQueue
  login: LoginSessionController
  tickets: TicketVerifier
  /**
   * Injected only so a test can produce an outcome without a real subprocess. Production leaves
   * it out and gets `runSkill`; the alternative — mocking the module — would let the router's own
   * bookkeeping drift away from the call it is supposed to be recording.
   */
  runner?: (skill: Skill, userPrompt: string) => Promise<CliRun>
}

/**
 * The outcome of the MOST RECENT run, whatever it was. `/health` serves it so the question
 * "is Claude Code actually working" has an answer outside a container log.
 *
 * WHY THIS EXISTS AT ALL: `resolveAuthMode()` answers whether a credential is PRESENT, and
 * `claude-cli.ts` is explicit that an expired session is indistinguishable from a live one at
 * that layer — correctly, because judging a credential is not its job. The cost was that four
 * different failures (credential expired, token revoked, quota gone, binary missing) all
 * presented as the same green badge. This is the field that tells them apart.
 *
 * WHY EVERY RUN AND NOT A DEDICATED PROBE: a business run that just succeeded is stronger
 * evidence than a synthetic ping, and one that just died of `quota_exhausted` is the single
 * thing an operator most needs to see. The `health-check` skill is only the cheapest way to
 * FORCE a run when none has happened yet — it is not the source of truth, this is.
 *
 * In memory, never persisted. It dies with the container, and that is the honest answer: a
 * freshly built container genuinely has not run anything yet. Writing it to the database would
 * manufacture "verified three days ago" for a container that no longer exists, and ADR-0041
 * settled that this process does not write audit rows.
 */
export interface LastRun {
  at: number
  skill: string
  /** The credential that ACTUALLY ran, resolved at run time — not the one that is configured. */
  authMode: AuthMode | null
  ok: boolean
  text?: string
  elapsedMs?: number
  apiMs?: number
  inputTokens?: number
  outputTokens?: number
  sessionId?: string
  reason?: AgentFailureReason
  message?: string
}

/** Enough to prove a round trip happened; `/health` is not a place to dump content. */
const TEXT_LIMIT = 200

interface RunRequest {
  userPrompt?: unknown
}

interface CodeRequest {
  code?: unknown
}

export function createRouter(deps: RouterDeps) {
  /**
   * Held in the router's closure rather than at module scope so that two routers built in one
   * process — which is every test file here — cannot see each other's runs.
   */
  let lastRun: LastRun | undefined

  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://localhost')

    if (req.method === 'GET' && url.pathname === '/health') {
      /**
       * Unauthenticated on purpose: compose's healthcheck has no token, and everything here is a
       * count or a name. The `authMode` field answers "which credential is this actually running
       * on" from the outside, which ADR-0014 established must never be a guess.
       */
      return send(res, 200, {
        ok: deps.enabled,
        enabled: deps.enabled,
        skills: [...deps.skills.keys()],
        /**
         * The autonomy ceiling, readable from OUTSIDE the container.
         *
         * Which tools each skill may reach for is otherwise only knowable by reading a
         * `policy.json` inside the image, and "nobody can widen a skill's reach without anyone
         * noticing" is a claim worth being able to check rather than assert. Added ALONGSIDE
         * `skills` rather than replacing it — `agent-runtime-client.ts` types that field as
         * `string[]`, and a breaking change to a shape the API already reads is not a thing to
         * do for a diagnostic.
         */
        grants: Object.fromEntries(
          [...deps.skills].map(([name, skill]) => [name, skill.policy.allowedTools]),
        ),
        /**
         * Asked of `claude-cli.ts` rather than re-derived from the environment here. Two copies of
         * "which credential are we on" drift the moment a third path appears — which is exactly
         * what happened: a login performed INSIDE the container leaves no variable behind, and
         * this line used to answer `api_key` for it while the run itself was refused outright.
         *
         * `null` is reported as such. "No credential" is a state an operator has to be able to
         * read off /health, and it is not the same state as "running on a key".
         */
        authMode: resolveAuthMode(),
        /**
         * The login state machine, so the panel can redraw after a reload without holding a
         * ticket. Carries the authorisation URL and never the code or the token — see
         * `LoginSessionController.status()`.
         */
        login: deps.login.status(),
        /**
         * Absent until something has actually run. "Chưa kiểm tra lần nào" is a third state, and
         * the panel must be able to draw it as neither pass nor fail — an unknown rendered in red
         * is the same lie in the other direction.
         */
        ...(lastRun ? { lastRun } : {}),
        sandbox: sandboxPath(),
        queue: deps.queue.stats(),
      })
    }

    const runMatch = url.pathname.match(/^\/run\/([a-z0-9-]+)$/)
    if (req.method === 'POST' && runMatch) {
      if (!deps.enabled) {
        return send(res, 503, {
          reason: 'disabled',
          message: 'AGENT_TOKEN chưa đặt — agent-runtime đang tắt, không nhận lượt chạy nào',
        })
      }
      /**
       * `Bearer $AGENT_TOKEN`, unchanged and not to be relaxed. This endpoint spends a real
       * person's Claude quota; the ticket scheme below exists precisely so that this line never
       * has to accept anything a browser could hold.
       */
      if (req.headers.authorization !== `Bearer ${deps.token}`) {
        return send(res, 401, { reason: 'unauthorized', message: 'Thiếu hoặc sai AGENT_TOKEN' })
      }
      return runOne(res, deps, runMatch[1] as string, await readJson<RunRequest>(req), (run) => {
        lastRun = run
      })
    }

    if (url.pathname.startsWith('/agent-auth/')) {
      return handleAgentAuth(req, res, deps, url)
    }

    send(res, 404, { reason: 'not_found', message: `Không có route ${req.method} ${url.pathname}` })
  }
}

/**
 * The browser-facing family. Every route in here is gated by the same ticket check up front, so
 * adding a route below cannot accidentally add an unguarded one.
 */
async function handleAgentAuth(
  req: IncomingMessage,
  res: ServerResponse,
  deps: RouterDeps,
  url: URL,
): Promise<void> {
  if (!deps.enabled) {
    return send(res, 503, {
      reason: 'disabled',
      message: 'AGENT_TOKEN chưa đặt — tính năng đăng nhập đang tắt',
    })
  }

  try {
    deps.tickets.verify(TicketVerifier.fromHeader(req.headers.authorization))
  } catch (error) {
    if (error instanceof TicketRejected) {
      return send(res, 401, { reason: 'unauthorized', message: error.message })
    }
    throw error
  }

  if (req.method === 'POST' && url.pathname === '/agent-auth/login/start') {
    try {
      const { loginId, url: authorizeUrl } = await deps.login.start()
      /**
       * The URL is logged and the code never is. An OAuth authorize URL is not a secret — it is
       * the thing we are about to show a person on screen — and having it in the container log is
       * what lets somebody finish a login when the browser tab is lost.
       */
      console.log(`[agent] mở phiên đăng nhập ${loginId}`)
      return send(res, 200, { loginId, url: authorizeUrl })
    } catch (error) {
      return sendLoginFailure(res, error)
    }
  }

  const codeMatch = url.pathname.match(/^\/agent-auth\/login\/([0-9a-f-]+)\/code$/)
  if (req.method === 'POST' && codeMatch) {
    const body = await readJson<CodeRequest>(req)
    if (typeof body.code !== 'string' || body.code.trim() === '') {
      return send(res, 400, { reason: 'parse_failed', message: 'Thiếu trường code' })
    }
    try {
      /** `body.code` goes straight into the child's stdin and is never held, logged or echoed. */
      const result = await deps.login.submitCode(codeMatch[1] as string, body.code)
      console.log(`[agent] phiên đăng nhập xong · authMode: ${result.authMode ?? 'null'}`)
      return send(res, 200, result)
    } catch (error) {
      return sendLoginFailure(res, error)
    }
  }

  if (req.method === 'DELETE' && url.pathname === '/agent-auth/credential') {
    const result = clearStoredCredential()
    console.log(`[agent] đã xoá credential · authMode: ${result.authMode ?? 'null'}`)
    return send(res, 200, result)
  }

  if (req.method === 'POST' && url.pathname === '/agent-auth/login/abort') {
    deps.login.abort()
    return send(res, 200, { state: deps.login.status().state })
  }

  send(res, 404, { reason: 'not_found', message: `Không có route ${req.method} ${url.pathname}` })
}

/**
 * `409` for "a session is already open" and `410` for one that has gone — both are states the panel
 * recovers from by itself, and neither is a server fault. A blanket 500 here would send the panel
 * to its generic error text and lose the only instruction that helps ("start again").
 */
function sendLoginFailure(res: ServerResponse, error: unknown): void {
  if (!(error instanceof LoginSessionError)) throw error

  const status =
    error.reason === 'busy'
      ? 409
      : error.reason === 'no_session' || error.reason === 'aborted'
        ? 410
        : /** A refused code is bad INPUT, not an upstream fault — the panel repeats it verbatim. */
          error.reason === 'code_rejected'
          ? 400
          : 502
  console.warn(`[agent] phiên đăng nhập hỏng (${error.reason})`)
  send(res, status, { reason: error.reason, message: error.message })
}

async function runOne(
  res: ServerResponse,
  deps: RouterDeps,
  skillName: string,
  body: RunRequest,
  record: (run: LastRun) => void,
): Promise<void> {
  if (typeof body.userPrompt !== 'string' || body.userPrompt.trim() === '') {
    /**
     * Not recorded: a malformed request never reached the model, so it says nothing about whether
     * Claude Code works. Recording it would answer a question it was never asked.
     */
    return send(res, 400, { reason: 'parse_failed', message: 'Thiếu trường userPrompt' })
  }
  const userPrompt = body.userPrompt

  try {
    const skill = requireSkill(deps.skills, skillName)
    const run = await deps.queue.run(() =>
      deps.runner
        ? deps.runner(skill, userPrompt)
        : runSkill(skill.policy, skill.systemPrompt, userPrompt),
    )

    record({
      at: Date.now(),
      skill: skillName,
      authMode: resolveAuthMode(),
      ok: true,
      text: run.text.slice(0, TEXT_LIMIT),
      elapsedMs: run.elapsedMs,
      apiMs: run.apiMs,
      inputTokens: run.inputTokens,
      outputTokens: run.outputTokens,
      sessionId: run.sessionId,
    })

    /**
     * One line per run, and `elapsedMs` is kept apart from `apiMs` because the difference IS
     * the process startup cost — the number that decides whether this transport is viable for
     * a given flow. Collapsing them into one figure hides the only thing worth watching.
     */
    console.log(
      `[agent] ${skillName}: ${run.elapsedMs}ms tổng (${run.apiMs}ms gọi model, ` +
        `${run.elapsedMs - run.apiMs}ms khởi động) · ${run.inputTokens} token vào / ` +
        `${run.outputTokens} ra · session ${run.sessionId}`,
    )

    send(res, 200, {
      text: run.text,
      telemetry: {
        skill: skillName,
        elapsedMs: run.elapsedMs,
        apiMs: run.apiMs,
        inputTokens: run.inputTokens,
        outputTokens: run.outputTokens,
        sessionId: run.sessionId,
      },
    })
  } catch (error) {
    /**
     * A FAILED run is recorded too, and that is the half that matters. "Có credential" and
     * "credential dùng được" only become different states here — without this branch, running out
     * of quota and having a revoked token stay the same green badge they have always been.
     */
    const failed = (reason: AgentFailureReason, message: string): void =>
      record({ at: Date.now(), skill: skillName, authMode: resolveAuthMode(), ok: false, reason, message })

    if (error instanceof QueueDeadlineError) {
      console.warn(`[agent] ${skillName}: ${error.message}`)
      failed('timeout', error.message)
      return send(res, 503, { reason: 'timeout', message: error.message })
    }
    if (error instanceof AgentRunError) {
      console.warn(`[agent] ${skillName} thất bại (${error.reason}): ${error.message}`)
      failed(error.reason, error.message)
      /**
       * 200-with-a-reason would make a failure indistinguishable from an answer at the HTTP
       * layer. `502` says the upstream did not produce one; the caller turns that into an
       * empty finding list, which is what rule 4 asks for.
       */
      return send(res, 502, { reason: error.reason, message: error.message })
    }
    throw error
  }
}

function readJson<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.setEncoding('utf8')
    req.on('data', (chunk: string) => (raw += chunk))
    req.on('error', reject)
    req.on('end', () => {
      try {
        resolve(raw.trim() === '' ? ({} as T) : (JSON.parse(raw) as T))
      } catch {
        resolve({} as T)
      }
    })
  })
}

function send(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(payload)
}

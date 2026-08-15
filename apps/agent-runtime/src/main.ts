import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { join } from 'node:path'

import { resolveAuthMode, runSkill, sandboxPath } from './claude-cli'
import { AgentRunError } from './errors'
import { JobQueue, QueueDeadlineError } from './job-queue'
import { loadSkills, requireSkill } from './skill-registry'
import { SKILL_TEMPLATE_VARS } from './skill-template-vars'

/**
 * The agent runtime: a small HTTP surface in front of `claude -p`.
 *
 * It exists as its own container for ONE reason, and every other property follows from it —
 * this process holds the Claude credential and NO database credential, while `api` holds the
 * database credentials and no Claude credential. Neither can do the other's damage. Put the
 * CLI inside `api` instead and a subprocess spawned by a model would be sharing an environment
 * with `DATABASE_URL_SYSTEM`.
 *
 * Deliberately NOT NestJS. There are two routes, no dependency injection worth the name, and a
 * framework here would mean a second build pipeline to maintain for no behaviour.
 *
 * WHAT THIS SERVICE DOES NOT DO: parse the model's answer, or judge it. It returns text. Every
 * gate — I-1, I-2, the verbatim quote check, the proposal whitelist — lives on the `api` side
 * next to the domain that owns those rules. A gate in this process would be a gate the AI
 * branch could reach, and rule 1 of CLAUDE.md wants it in front of the writer instead.
 */

const PORT = Number(process.env.AGENT_PORT ?? 4700)
const TOKEN = process.env.AGENT_TOKEN?.trim()
const SKILLS_DIR = process.env.AGENT_SKILLS_DIR?.trim() || join(__dirname, '..', 'skills')

const queue = new JobQueue(Number(process.env.AGENT_QUEUE_DEADLINE_MS ?? 120_000))

/**
 * Boot fails loudly on a bad skill directory rather than starting and failing on first use.
 * A runtime with no usable skills that answers `/health` with `ok` is worse than one that
 * never came up: the API would keep routing to it and every call would return empty findings,
 * which looks exactly like "the model found nothing".
 */
const skills = loadSkills(SKILLS_DIR, SKILL_TEMPLATE_VARS)

/**
 * No token means DISABLED, not dead — and that distinction is the whole reason this is not a
 * `throw`.
 *
 * The feature ships off: `.env.example` leaves all three variables empty, so the default state
 * of every checkout, including a judge's, has no `AGENT_TOKEN`. A process that exits at boot
 * under `restart: unless-stopped` becomes a restart loop, and `docker compose ps` then shows a
 * container flapping next to five healthy ones — which reads as "their stack is broken", not as
 * "that feature is switched off". Exactly the trap `watch-cycle-service.ts` documents for the
 * unref'd timer: almost right in the log is worse than plainly wrong.
 *
 * So it stays up, says so on /health, and refuses every run. Serving without a token is the one
 * thing it must not do — /run would be an open endpoint spending a real person's quota.
 */
const ENABLED = Boolean(TOKEN)

/**
 * Boot log only. Says which of the three credentials won AND, for the last one, where it came
 * from — a login inside the container leaves nothing in `.env`, so somebody reading the compose
 * file has no other way to find out why calls are working.
 *
 * `none` is spelled out instead of omitted: the container is up and holds a token, so every
 * other line of this log looks healthy right up until the first run is refused.
 */
const AUTH_LABEL: Record<'oauth' | 'api_key' | 'cli_login' | 'none', string> = {
  oauth: 'OAuth subscription (CLAUDE_CODE_OAUTH_TOKEN)',
  api_key: 'API key (ANTHROPIC_API_KEY)',
  cli_login: 'phiên `claude /login` trong container ($HOME/.claude)',
  none: 'CHƯA CÓ — mọi lượt chạy sẽ trả not_authenticated',
}

interface RunRequest {
  userPrompt?: unknown
}

const server = createServer((req, res) => {
  void handle(req, res).catch((error: Error) => {
    send(res, 500, { reason: 'spawn_failed', message: error.message })
  })
})

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost')

  if (req.method === 'GET' && url.pathname === '/health') {
    /**
     * Unauthenticated on purpose: compose's healthcheck has no token, and everything here is a
     * count or a name. The `authMode` field answers "which credential is this actually running
     * on" from the outside, which ADR-0014 established must never be a guess.
     */
    return send(res, 200, {
      ok: ENABLED,
      enabled: ENABLED,
      skills: [...skills.keys()],
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
      grants: Object.fromEntries([...skills].map(([name, skill]) => [name, skill.policy.allowedTools])),
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
      sandbox: sandboxPath(),
      queue: queue.stats(),
    })
  }

  const runMatch = url.pathname.match(/^\/run\/([a-z0-9-]+)$/)
  if (req.method === 'POST' && runMatch) {
    if (!ENABLED) {
      return send(res, 503, {
        reason: 'disabled',
        message: 'AGENT_TOKEN chưa đặt — agent-runtime đang tắt, không nhận lượt chạy nào',
      })
    }
    if (req.headers.authorization !== `Bearer ${TOKEN}`) {
      return send(res, 401, { reason: 'unauthorized', message: 'Thiếu hoặc sai AGENT_TOKEN' })
    }
    return runOne(res, runMatch[1] as string, await readJson(req))
  }

  send(res, 404, { reason: 'not_found', message: `Không có route ${req.method} ${url.pathname}` })
}

async function runOne(res: ServerResponse, skillName: string, body: RunRequest): Promise<void> {
  if (typeof body.userPrompt !== 'string' || body.userPrompt.trim() === '') {
    return send(res, 400, { reason: 'parse_failed', message: 'Thiếu trường userPrompt' })
  }
  const userPrompt = body.userPrompt

  try {
    const skill = requireSkill(skills, skillName)
    const run = await queue.run(() => runSkill(skill.policy, skill.systemPrompt, userPrompt))

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
    if (error instanceof QueueDeadlineError) {
      console.warn(`[agent] ${skillName}: ${error.message}`)
      return send(res, 503, { reason: 'timeout', message: error.message })
    }
    if (error instanceof AgentRunError) {
      console.warn(`[agent] ${skillName} thất bại (${error.reason}): ${error.message}`)
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

function readJson(req: IncomingMessage): Promise<RunRequest> {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.setEncoding('utf8')
    req.on('data', (chunk: string) => (raw += chunk))
    req.on('error', reject)
    req.on('end', () => {
      try {
        resolve(raw.trim() === '' ? {} : (JSON.parse(raw) as RunRequest))
      } catch {
        resolve({})
      }
    })
  })
}

function send(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(payload)
}

server.listen(PORT, () => {
  if (!ENABLED) {
    return console.warn(
      `[agent] nghe cổng ${PORT} nhưng ĐANG TẮT: chưa có AGENT_TOKEN. ` +
        'Mọi lượt chạy bị từ chối; api sẽ tự dùng SDK hoặc fixture.',
    )
  }
  console.log(
    `[agent] nghe cổng ${PORT} · skill: ${[...skills.keys()].join(', ')} · auth: ${AUTH_LABEL[resolveAuthMode() ?? 'none']}`,
  )
})

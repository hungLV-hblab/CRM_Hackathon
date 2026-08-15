import { createServer } from 'node:http'
import { join } from 'node:path'

import { resolveAuthMode } from './claude-cli'
import { TicketVerifier } from './auth-ticket'
import { createRouter } from './http-routes'
import { JobQueue } from './job-queue'
import { LoginSessionController, hydrateStoredOauthToken } from './login-session'
import { loadSkills } from './skill-registry'
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
 * Deliberately NOT NestJS. There are a handful of routes, no dependency injection worth the name,
 * and a framework here would mean a second build pipeline to maintain for no behaviour.
 *
 * This file is the COMPOSITION ROOT and nothing else: it reads the environment, builds the four
 * collaborators, and hands them to `http-routes.ts`. The routing moved out when the login endpoints
 * arrived, because the property that most needed a test — that `/run/*` still demands
 * `Bearer $AGENT_TOKEN` after a route is added beside it — could not be tested while it only
 * existed inside a module that starts a server on import.
 *
 * WHAT THIS SERVICE DOES NOT DO: parse the model's answer, or judge it. It returns text. Every
 * gate — I-1, I-2, the verbatim quote check, the proposal whitelist — lives on the `api` side
 * next to the domain that owns those rules. A gate in this process would be a gate the AI
 * branch could reach, and rule 1 of CLAUDE.md wants it in front of the writer instead.
 */

const PORT = Number(process.env.AGENT_PORT ?? 4700)
const TOKEN = process.env.AGENT_TOKEN?.trim()
const SKILLS_DIR = process.env.AGENT_SKILLS_DIR?.trim() || join(__dirname, '..', 'skills')

/**
 * BEFORE anything asks `resolveAuthMode()`. If a previous login through the panel produced a
 * printed token rather than a credential file, it lives on disk in the `agent-claude-home` volume
 * and has to be back in the environment before the first `/health` answers, or a restart reports
 * `null` for a container that is in fact authenticated.
 *
 * It never overwrites a variable that is already set — `.env` still decides (ADR-0042).
 */
hydrateStoredOauthToken()

const queue = new JobQueue(Number(process.env.AGENT_QUEUE_DEADLINE_MS ?? 120_000))
const login = new LoginSessionController()
const tickets = new TicketVerifier(TOKEN)

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
 * thing it must not do — /run would be an open endpoint spending a real person's quota, and
 * /agent-auth would be an open endpoint opening login sessions.
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

const router = createRouter({ enabled: ENABLED, token: TOKEN, skills, queue, login, tickets })

const server = createServer((req, res) => {
  void router(req, res).catch((error: Error) => {
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ reason: 'spawn_failed', message: error.message }))
  })
})

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

import { z } from 'zod'

/**
 * ontology 3.4 — the two system parameters, and the two shapes they are read through.
 *
 * There are TWO read contracts on purpose (ADR-0032). `SystemParametersDto` is the admin
 * payload of `GET /settings`; `AiStatusDto` is the ONE bit every logged-in account may read
 * from `GET /settings/ai-status`. Sales is the person T-9 requires to see that the machine
 * is off, and Sales gets a 403 on `/settings` — a status the product needs on every screen
 * cannot hang off an admin-only endpoint.
 *
 * Widening `GET /settings` to all roles was the alternative and was rejected: it deletes
 * acceptance check 2 of the walking skeleton ("Sales → 403 on an admin endpoint").
 */
export interface SystemParametersDto {
  aiEnabled: boolean
  watchCycleSeconds: number
}

/** Exactly one field. A payload that leaked `watchCycleSeconds` would hand Sales admin data. */
export interface AiStatusDto {
  aiEnabled: boolean
}

/**
 * The floor is 5 SECONDS, not 60, and that is load-bearing: `e2e/t8-watch-cycle-writes-timeline`
 * runs the cycle at 10s so two rounds fit inside a test instead of two minutes. A floor of 60
 * would make the admin screen unable to express the state the acceptance suite runs in.
 */
export const WATCH_CYCLE_SECONDS_MIN = 5
export const WATCH_CYCLE_SECONDS_MAX = 3600

export const updateSystemSettingsSchema = z
  .object({
    aiEnabled: z.boolean().optional(),
    watchCycleSeconds: z
      .number()
      .int('Chu kỳ quét là số nguyên giây')
      .min(WATCH_CYCLE_SECONDS_MIN, `Chu kỳ quét tối thiểu ${WATCH_CYCLE_SECONDS_MIN} giây`)
      .max(WATCH_CYCLE_SECONDS_MAX, `Chu kỳ quét tối đa ${WATCH_CYCLE_SECONDS_MAX} giây`)
      .optional(),
  })
  /** An empty PATCH would write nothing and record nothing while answering 200 — say so instead. */
  .refine((dto) => dto.aiEnabled !== undefined || dto.watchCycleSeconds !== undefined, {
    message: 'Phải gửi ít nhất một tham số cần đổi',
  })

export type UpdateSystemSettingsDto = z.infer<typeof updateSystemSettingsSchema>

/**
 * The short-lived ticket the admin panel carries to `agent-runtime` to open a Claude login.
 *
 * Note what is NOT in here: no code, no credential, no `AGENT_TOKEN`. The API signs this and takes
 * no further part — the browser posts it straight to `agent-runtime` through Caddy, so the process
 * holding `DATABASE_URL_SYSTEM` never touches a Claude secret (ADR-0038).
 *
 * `expiresAt` is epoch ms, and it is here for the panel to show a countdown. Nothing trusts the
 * client to honour it; the runtime checks the signed copy inside `ticket`.
 */
export interface AgentAuthTicketDto {
  ticket: string
  expiresAt: number
}

/**
 * What the admin login panel needs to draw itself, read from `agent-runtime`'s own `/health`.
 *
 * `reachable` and `enabled` are separate states and must stay separate: a container that is down
 * is not the same thing as one deliberately started without `AGENT_TOKEN`, and ADR-0041 turns on
 * being able to tell them apart. Collapsing them into one boolean makes "switched off" render as
 * "broken", which is the reading that costs a demo.
 *
 * `authMode` is nullable because "no credential at all" is a real state, distinct from all three
 * ways of being authenticated. Nothing secret is in here — a mode name, not a token.
 */
/**
 * The outcome of the most recent run, which is the ONLY thing that answers "is Claude Code
 * actually working".
 *
 * `authMode` on the status above says a credential EXISTS. It cannot say the credential still
 * works, that the subscription has quota left, or that the `claude` binary is in the image — so
 * four unrelated failures used to present as the same green badge. This is what tells them apart,
 * and `reason` is the field that does the telling: `not_authenticated` means log in again,
 * `quota_exhausted` means specifically do NOT press the button again.
 *
 * `reason` is a plain string rather than an imported union because this package is the contract
 * shared by `api` and `web`; pulling in a type owned by `agent-runtime` would make the browser
 * bundle depend on the process that holds the Claude credential. An unrecognised value must fall
 * through to a default message instead of breaking a screen.
 *
 * Nothing secret rides along: a mode name, some counters, and the model's own short reply.
 */
export interface AgentRunSummaryDto {
  /** Epoch ms. Always rendered as a clock time — "vừa xong" would age into a lie on a reload. */
  at: number
  skill: string
  ok: boolean
  /** The credential that ACTUALLY ran. Absent when the run never reached the runtime. */
  authMode?: 'oauth' | 'api_key' | 'cli_login' | null
  text?: string
  /**
   * Kept apart from `apiMs` deliberately: the difference IS the process startup cost, the one
   * number worth watching for this transport. One combined figure hides it.
   */
  elapsedMs?: number
  apiMs?: number
  inputTokens?: number
  outputTokens?: number
  sessionId?: string
  reason?: string
  message?: string
}

export interface AgentRuntimeStatusDto {
  reachable: boolean
  enabled: boolean
  authMode: 'oauth' | 'api_key' | 'cli_login' | null
  loginState: string
  /**
   * Absent until something has actually run — a third state, neither pass nor fail. A container
   * that was just rebuilt genuinely has not run anything, and drawing that unknown in red is the
   * same lie as drawing an expired credential in green.
   */
  lastRun?: AgentRunSummaryDto
  loginId?: string
  /**
   * The authorisation URL of a session already in progress, so a browser reload can rejoin it
   * instead of stranding the admin in front of a button that answers 409 for the next five
   * minutes. Not a secret — it is the address we are about to put on screen — and it carries no
   * code and no token.
   */
  loginUrl?: string
}

/** The audit actions the dashboard and round 2 read. Renaming one silently empties a trail. */
export const TOGGLE_AI_ACTION = 'toggle_ai'
export const UPDATE_WATCH_CYCLE_SECONDS_ACTION = 'update_watch_cycle_seconds'

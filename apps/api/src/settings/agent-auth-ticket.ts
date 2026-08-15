import { createHmac, randomBytes } from 'node:crypto'

/**
 * Minting the short-lived ticket a browser carries to `agent-runtime`, and NOTHING else.
 *
 * This is the entire extent of the API's involvement in logging Claude in. It never sees the
 * authorisation code, never sees the resulting credential, and never proxies either — the browser
 * talks to `agent-runtime` directly through Caddy. That is deliberate and it is what keeps
 * ADR-0038 standing: this process holds `DATABASE_URL_SYSTEM`, and a Claude credential passing
 * through it would put both secrets in one place for the first time.
 *
 * WHY A TICKET AND NOT `AGENT_TOKEN` ITSELF: the browser would then hold the key to `/run/*`, the
 * endpoint that spends a real person's Claude quota. A ticket proves only "the API checked a JWT
 * and found an admin, within the last five minutes", and it is SIGNED with `AGENT_TOKEN` rather
 * than being it — the two services already share that secret, so nothing new has to be stored,
 * rotated or leaked.
 *
 * The verifying half is `apps/agent-runtime/src/auth-ticket.ts`. The two are pinned together by a
 * frozen vector asserted in both test suites, because the format is written twice: `@crm/contracts`
 * is zod schemas and enums, not a place to put crypto, and `api` does not depend on
 * `@crm/agent-runtime`.
 */

/**
 * Five minutes: enough to open a tab, sign in with Anthropic, approve and paste the code back;
 * short enough that a ticket which escapes into a log or a browser history is not a lasting door.
 */
export const TICKET_TTL_MS = 300_000

export interface SignedTicket {
  ticket: string
  /** Epoch ms. The panel shows the countdown; nothing depends on the client honouring it. */
  expiresAt: number
}

/**
 * `<exp>.<nonce>.<hmac>` with `hmac = HMAC-SHA256(secret, "<exp>.<nonce>")` in hex.
 *
 * The nonce comes from `randomBytes`, not a counter or a timestamp: `agent-runtime` accepts each
 * one exactly once, so two tickets minted in the same millisecond must still differ or the second
 * login of a session is rejected as a replay.
 */
export function signTicket(
  secret: string,
  nowMs: number = Date.now(),
  /**
   * Injectable for ONE reason: without it the frozen vector that pins this format to the verifier
   * in `agent-runtime` cannot be reproduced, and the test that claims to check it collapses into
   * recomputing an HMAC inline — a tautology about `node:crypto` that stays green no matter what
   * this function does. Production never passes it.
   */
  nonce: string = randomBytes(16).toString('hex'),
): SignedTicket {
  const expiresAt = nowMs + TICKET_TTL_MS
  const payload = `${expiresAt}.${nonce}`
  const signature = createHmac('sha256', secret).update(payload).digest('hex')

  return { ticket: `${payload}.${signature}`, expiresAt }
}

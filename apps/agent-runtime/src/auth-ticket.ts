import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * The gate on `/agent-auth/*`, and the reason those routes can be exposed at all.
 *
 * Every other call into this container carries `Bearer $AGENT_TOKEN`, because every other call
 * comes from `apps/api` — one server process to another, over the compose network. These three
 * routes are different: the call comes FROM A BROWSER, and anything a browser holds is public.
 * Handing `AGENT_TOKEN` to a page would hand away `/run` too, which is the endpoint that spends a
 * real person's Claude quota.
 *
 * So the browser gets a ticket instead: proof that `api` checked a JWT and found an admin, valid
 * for five minutes, usable once. It is SIGNED with `AGENT_TOKEN` rather than being it — the two
 * processes already share that secret, so no new credential enters the system to be stored,
 * rotated or leaked.
 *
 * Format: `<exp>.<nonce>.<hmac>` where `hmac = HMAC-SHA256(AGENT_TOKEN, "<exp>.<nonce>")` in hex
 * and `exp` is epoch milliseconds. `apps/api/src/settings/agent-auth-ticket.ts` mints these; the
 * two implementations are pinned together by the frozen vector at the bottom of this file.
 */

/**
 * The longest life this side will honour, deliberately a little above the five minutes `api` mints
 * so a small clock difference between two containers is not a rejection. Both run on the same
 * Docker host today; this is the margin for the day they do not.
 */
const MAX_TICKET_TTL_MS = 360_000

export class TicketRejected extends Error {
  constructor() {
    /**
     * ONE message for every way a ticket can be bad — wrong signature, expired, replayed,
     * malformed, absent. Distinguishing them is free diagnostics for whoever is probing, and the
     * distinction they most want is "did my guessed secret verify", which a different message for
     * "expired" hands over immediately.
     */
    super('Vé không hợp lệ')
    this.name = 'TicketRejected'
  }
}

export class TicketVerifier {
  /**
   * Nonces already spent, kept until their own `exp` passes so the set cannot grow without bound.
   *
   * In process memory, which means a restart forgets them and a still-valid ticket could be used a
   * second time. Accepted for round 1 and written down rather than hidden: the window is five
   * minutes, the ticket only opens a login session, and a login session already requires the person
   * to complete a browser authorisation with Anthropic. Persisting this would mean giving this
   * container a datastore, which is the one thing ADR-0038 says it must not have.
   */
  private readonly spent = new Map<string, number>()

  constructor(
    private readonly secret: string | undefined,
    private readonly now: () => number = Date.now,
  ) {}

  /**
   * `Ticket <value>`, deliberately not `Bearer <value>`. `/run` uses `Bearer` and that one carries
   * `AGENT_TOKEN` itself; two schemes for two secrets with two blast radii, so that a copy-paste
   * between handlers does not quietly widen anything.
   */
  static fromHeader(header: string | undefined): string | undefined {
    const value = header?.trim()
    if (value === undefined || !value.startsWith('Ticket ')) return undefined
    const ticket = value.slice('Ticket '.length).trim()
    return ticket === '' ? undefined : ticket
  }

  /** Throws `TicketRejected` and nothing else. Returns nothing — there is no payload worth reading. */
  verify(ticket: string | undefined): void {
    const secret = this.secret?.trim()
    /**
     * No secret means the feature is switched off, and switched off means CLOSED. An empty HMAC key
     * is perfectly valid to Node, so the tempting `if (!secret) return` would turn a container
     * booted without `AGENT_TOKEN` into one that accepts tickets anybody could mint.
     */
    if (!secret) throw new TicketRejected()
    if (ticket === undefined) throw new TicketRejected()

    const parts = ticket.split('.')
    if (parts.length !== 3) throw new TicketRejected()

    const [exp, nonce, signature] = parts as [string, string, string]

    const expiresAt = Number(exp)
    if (!Number.isFinite(expiresAt)) throw new TicketRejected()

    const now = this.now()
    if (expiresAt <= now) throw new TicketRejected()
    /**
     * An upper bound as well as a lower one. Without it the "five minute" property depends entirely
     * on the remote signer: a ticket dated for the year 3000 verifies happily AND pins its nonce in
     * `spent` forever, because `forgetExpired` only evicts entries whose expiry has passed. Not
     * reachable by an outsider today — signing needs `AGENT_TOKEN` — but the lifetime of a
     * credential should be enforced by the side that honours it, not assumed of the side that
     * mints it.
     */
    if (expiresAt - now > MAX_TICKET_TTL_MS) throw new TicketRejected()

    const expected = createHmac('sha256', secret).update(`${exp}.${nonce}`).digest('hex')
    if (!equalConstantTime(signature, expected)) throw new TicketRejected()

    /** Signature checked BEFORE the replay check: an unsigned nonce must not be able to fill the map. */
    if (this.spent.has(nonce)) throw new TicketRejected()

    this.forgetExpired(now)
    this.spent.set(nonce, expiresAt)
  }

  private forgetExpired(now: number): void {
    for (const [nonce, expiresAt] of this.spent) {
      if (expiresAt <= now) this.spent.delete(nonce)
    }
  }
}

/**
 * Length is compared first and separately on purpose: `timingSafeEqual` THROWS on mismatched
 * buffers rather than returning false, so feeding it unvalidated input turns a bad ticket into a
 * 500. Both sides here are hex of a fixed width, so a length difference leaks nothing.
 */
function equalConstantTime(actual: string, expected: string): boolean {
  if (actual.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(actual, 'utf8'), Buffer.from(expected, 'utf8'))
}

/**
 * A frozen ticket, and the secret that produced it.
 *
 * The signing half lives in `apps/api` and cannot import from this package — `api` does not depend
 * on `@crm/agent-runtime`, and it should not start now just to share thirty lines of HMAC. The
 * algorithm is therefore written twice, and two copies drift silently unless something pins them.
 *
 * This constant is that pin. The identical literal is asserted in
 * `apps/api/src/settings/__tests__/agent-auth-ticket-admin-only.test.ts`; change the wire format on
 * either side and exactly one suite goes red, naming the file that moved.
 *
 * Not a secret: the "secret" below is a test string, and the ticket expired in 2027 by construction.
 */
export const GOLDEN_TICKET_SECRET = 'bi-mat-chung-cua-hai-goi-chi-de-test'
export const GOLDEN_TICKET =
  '1800000000000.a1b2c3d4e5f60718293a4b5c6d7e8f90.' +
  '5e223aec184a06bff47775855ca3671a312d529d559f36c89392000471d2d264'

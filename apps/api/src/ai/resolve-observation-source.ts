import { SEED_COMPANIES } from '@crm/db'

/**
 * Which source a single read is allowed to use — I-16 and I-17 in one place (ADR-0035).
 *
 * A PURE function, and that is the design rather than a convenience. The three gates below are
 * what buys the live-source switch the right to exist, and a gate that needs a database, a Nest
 * module and a network stack to observe is a gate nobody re-checks. This one is a table test.
 *
 * THE ORDER OF THE BRANCHES IS THE INVARIANT. Every early return lands on the safe side, so a
 * misconfiguration can only ever cost the live path — never open it. Reordering these lines
 * still compiles and still passes a "live crawl works" test; it fails only in
 * `resolve-observation-source.test.ts`, which is why that file asserts the negatives first.
 */

/**
 * I-16. Derived from the seed data itself rather than retyped: a hand-copied id list is a second
 * source of truth that goes stale the first time someone adds a demo company, and going stale
 * here means a seed company silently becomes crawlable.
 */
const SEED_COMPANY_IDS: ReadonlySet<string> = new Set(SEED_COMPANIES.map((company) => company.id))

/** The only value of `OBSERVATION_SOURCE` that opens the live path. Compared verbatim — see below. */
const LIVE_CRAWL = 'live_crawl'

export type ObservationSourceDecision = 'disabled' | 'demo_snapshot' | 'live_crawl'

export interface ObservationSourceInput {
  /** `SystemSetting.ai_enabled`, read fresh from the database by the caller (ADR-0009). */
  aiEnabled: boolean
  /** `process.env.OBSERVATION_SOURCE`. Absent, empty and misspelled are all normal inputs here. */
  configuredSource: string | undefined
  companyId: string
  /** `companies.live_source_enabled`. `crm_system` has no UPDATE on it, so the AI cannot set it. */
  liveSourceEnabled: boolean
}

export function resolveObservationSource(input: ObservationSourceInput): ObservationSourceDecision {
  /**
   * I-17, first half. The kill switch is not source-specific: it stops generation from EVERY
   * source, including the live one. Checked first so no later branch can talk past it.
   */
  if (!input.aiEnabled) return 'disabled'

  /**
   * I-17, second half. Compared VERBATIM — no trim, no lower-casing.
   *
   * That looks unhelpful until you name what the two failure directions cost. Being too strict
   * costs a demo that reads snapshots when someone meant to read live, and the boot log says so
   * in one line. Being too lenient means `LIVE_CRAWL`, `live-crawl` or a stray trailing space in
   * `.env` opens a write path nobody reviewed. Only one of those is recoverable by reading a log.
   */
  if (input.configuredSource !== LIVE_CRAWL) return 'demo_snapshot'

  /**
   * I-16. T-6 and T-8 are triggered by flipping a company's snapshot from `before` to `after`,
   * and that is the ONLY way a judge can replay those two scenarios. A source that changes
   * outside the judge's control makes two of the ten acceptance checks unrepeatable — so this
   * gate holds regardless of configuration, and regardless of the per-company switch below.
   */
  if (SEED_COMPANY_IDS.has(input.companyId)) return 'demo_snapshot'

  /** Off by default at the column level, so a company nobody opted in stays on the snapshot. */
  if (!input.liveSourceEnabled) return 'demo_snapshot'

  return 'live_crawl'
}

/** Exposed for the I-16 refusal path, which must answer "is this a seed company?" before writing. */
export function isSeedCompany(companyId: string): boolean {
  return SEED_COMPANY_IDS.has(companyId)
}

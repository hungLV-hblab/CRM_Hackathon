import { describe, expect, it } from 'vitest'

import { loadDefaultDataset } from '@crm/db'

import { resolveObservationSource } from '../resolve-observation-source'

const SEED_COMPANIES = loadDefaultDataset().companies

/**
 * I-16 and I-17 at the only layer that can hold them: the decision of WHICH source a read uses.
 *
 * This function is pure on purpose. The three gates it enforces are the reason the live-source
 * switch is allowed to exist at all (ADR-0035), and a gate that needs a database, a Nest module
 * and a network stack to be observed is a gate nobody re-checks. Everything here runs in
 * microseconds, so the whole table can be exhaustive rather than representative.
 *
 * The ordering of the branches is itself the invariant: EVERY early return lands on the safe
 * side. A caller that gets the order wrong still compiles and still passes a "live crawl works"
 * test — it only fails here, which is why the table below asserts the negative cases first.
 */

const SEED_COMPANY_ID = SEED_COMPANIES[0].id
const OUTSIDE_SEED_ID = 'eeeeeeee-0001-4000-8000-000000000001'

/** The one input combination that is supposed to reach the live crawler. */
const LIVE: Parameters<typeof resolveObservationSource>[0] = {
  aiEnabled: true,
  configuredSource: 'live_crawl',
  companyId: OUTSIDE_SEED_ID,
  liveSourceEnabled: true,
}

describe('the AI kill switch outranks every other input (I-17)', () => {
  it('1 · `ai_enabled = false` stops the read even when live crawl is fully configured', () => {
    expect(resolveObservationSource({ ...LIVE, aiEnabled: false })).toBe('disabled')
  })

  it('2 · `ai_enabled = false` stops the snapshot path too — the switch is not source-specific', () => {
    expect(
      resolveObservationSource({
        aiEnabled: false,
        configuredSource: undefined,
        companyId: SEED_COMPANY_ID,
        liveSourceEnabled: false,
      }),
    ).toBe('disabled')
  })
})

describe('a missing or malformed OBSERVATION_SOURCE falls back to the snapshot (I-17)', () => {
  /**
   * Every one of these is a real way to mistype an environment variable, and NOT ONE of them
   * may open the live path. The invariant is "the safe branch is the default branch" — so this
   * is a table, not a single happy-path assertion.
   */
  const malformed = [
    ['unset', undefined],
    ['empty', ''],
    ['whitespace', '   '],
    ['the other legal value', 'snapshot'],
    ['upper case', 'LIVE_CRAWL'],
    ['mixed case', 'Live_Crawl'],
    ['hyphen instead of underscore', 'live-crawl'],
    ['trailing space', 'live_crawl '],
    ['a truthy-looking value', 'true'],
    ['nonsense', 'yes please'],
  ] as const

  it.each(malformed)('3 · %s → demo_snapshot', (_label, configuredSource) => {
    expect(resolveObservationSource({ ...LIVE, configuredSource })).toBe('demo_snapshot')
  })
})

describe('a seed company only ever reads the stored snapshot (I-16)', () => {
  /**
   * The reason this invariant is absolute: T-6 and T-8 are triggered by flipping a company's
   * snapshot from `before` to `after`, and that is the ONLY way a judge can replay the scenario.
   * A source that changes outside the judge's control makes two of the ten acceptance checks
   * unrepeatable, so no combination of configuration may put a seed company on the live path.
   */
  it.each(SEED_COMPANIES.map((company) => [company.name, company.id] as const))(
    '4 · %s stays on demo_snapshot with live crawl enabled everywhere',
    (_name, companyId) => {
      expect(
        resolveObservationSource({ ...LIVE, companyId, liveSourceEnabled: true }),
      ).toBe('demo_snapshot')
    },
  )
})

describe('the per-company switch is the last gate, and it is off by default', () => {
  it('5 · outside the seed set but switch off → demo_snapshot', () => {
    expect(resolveObservationSource({ ...LIVE, liveSourceEnabled: false })).toBe('demo_snapshot')
  })

  it('6 · outside the seed set, switch on, source configured → live_crawl', () => {
    expect(resolveObservationSource(LIVE)).toBe('live_crawl')
  })
})

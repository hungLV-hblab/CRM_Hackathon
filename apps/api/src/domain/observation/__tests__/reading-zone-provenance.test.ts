import { Pool } from 'pg'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ClaimDraft, ClaimExtractor, ObservationInput } from '@crm/contracts'
import { createConnection, resetTestDatabase } from '@crm/db'

import { AuditEventService } from '../../../common/audit/audit-event-service'
import { AutoNextStepService } from '../../opportunity/auto-next-step-service'
import { ClaimReactionService } from '../../claim/claim-reaction-service'
import { ClaimService } from '../../claim/claim-service'
import { DemoSnapshotSource } from '../../../ai/demo-snapshots'
import { FixtureClaimExtractor } from '../../../ai/fixture-claim-extractor'
import { ObservationService } from '../observation-service'
import { ProposalService } from '../../proposal/proposal-service'
import { SystemSettingService } from '../../../settings/system-setting-service'
import { SystemTimelineEntryService } from '../../../watch/system-timeline-entry-service'
import { liveSourceThatMustNotRun } from '../../../ai/__tests__/live-crawl-source-doubles'

/**
 * Feature group 2 end to end, against a REAL database and with no network: the extractor is
 * always plugged in through the port (ADR-0014), so nothing here depends on an API key.
 *
 * Services are built with `new`, not through a Nest module. Same reason as the T-10 mini test:
 * the guarantees being proven are supposed to hold at the lowest layer a caller can reach, so
 * the test reaches that layer directly instead of through HTTP and a guard.
 */

const SALES_ID = '11111111-1111-4111-8111-111111111111'
const SAKURA = 'aaaaaaaa-0001-4000-8000-000000000001'
/** The company with no readable snapshot in either variant — the `failed` path. */
const OHARA = 'aaaaaaaa-0004-4000-8000-000000000004'
/** NOT watched. Where "no delegation, no timeline entry" is measured after ADR-0028. */
const MARLIN = 'aaaaaaaa-0005-4000-8000-000000000005'

const owner = new Pool({ connectionString: process.env.DATABASE_URL_TEST })
const appConnection = createConnection(process.env.DATABASE_URL_TEST_APP as string)
const systemConnection = createConnection(process.env.DATABASE_URL_TEST_SYSTEM as string)

const settings = new SystemSettingService(
  appConnection.db,
  systemConnection.db,
  new AuditEventService(appConnection.db, systemConnection.db),
)
const snapshots = new DemoSnapshotSource()

function buildService(extractor: ClaimExtractor): {
  observations: ObservationService
  claims: ClaimService
} {
  const claims = new ClaimService(systemConnection.db, appConnection.db)
  /**
   * The real reaction service, not a stub: reading a source now feeds feature group 3, and the
   * assertions below on "official data untouched" are only worth something if that path
   * actually runs (phase 5).
   */
  const reactions = new ClaimReactionService(
    new AutoNextStepService(
      systemConnection.db,
      appConnection.db,
      new AuditEventService(appConnection.db, systemConnection.db),
    ),
    new ProposalService(systemConnection.db, appConnection.db),
    new SystemTimelineEntryService(systemConnection.db),
  )
  const observations = new ObservationService(
    systemConnection.db,
    appConnection.db,
    extractor,
    claims,
    snapshots,
    settings,
    reactions,
    liveSourceThatMustNotRun(),
  )
  return { observations, claims }
}

/** An extractor that PARAPHRASES. This is the T-2b adversary, not a convenience stub. */
const paraphrasingExtractor: ClaimExtractor = {
  async extract(): Promise<ClaimDraft[]> {
    return [
      {
        statement: 'Công ty vừa gọi vốn',
        signalType: 'funding',
        confidence: 'likely',
        // Every word appears in the source; the SEQUENCE does not. Non-empty, so I-1 passes.
        quoteText: 'Sakura huy động 20 triệu USD vòng Series B',
      },
    ]
  },
}

async function setAiEnabled(enabled: boolean): Promise<void> {
  await owner.query(
    `INSERT INTO system_settings (key, value) VALUES ('ai_enabled', $1), ('watch_cycle_seconds', '60')
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [String(enabled)],
  )
}

beforeEach(async () => {
  await resetTestDatabase(owner)
  await owner.query(
    `INSERT INTO users (id, email, password_hash, name, role)
     VALUES ($1, 'sales@test.local', 'x', 'Sales', 'sales')`,
    [SALES_ID],
  )
  await owner.query(
    `INSERT INTO companies (id, name, industry, company_type, owner_id, is_watched) VALUES
       ($1, 'Sakura Manufacturing KK', 'Sản xuất', 'traditional', $4, true),
       ($2, 'Ohara Retail Group', 'Bán lẻ', 'traditional', $4, true),
       ($3, 'Marlin Product Labs', 'Phần mềm', 'it_product', $4, false)`,
    [SAKURA, OHARA, MARLIN, SALES_ID],
  )
  await setAiEnabled(true)
})

afterAll(async () => {
  await Promise.all([owner.end(), appConnection.close(), systemConnection.close()])
})

describe('T-2 · a finding with no verifiable quote cannot be stored', () => {
  it('1 · service path: a paraphrased quote drops the WHOLE finding, it is not softened', async () => {
    const { observations } = buildService(paraphrasingExtractor)

    const result = await observations.ingest(SAKURA, 'after', 'manual_ingest')

    // ADR-0014: do not repair the quote, do not keep it at a lower confidence. Drop it.
    expect(result.claimsProposed).toBe(1)
    expect(result.claimsSaved).toBe(0)
    expect(result.claimsDroppedNoVerbatimQuote).toBe(1)

    const { rows } = await owner.query('SELECT count(*)::int AS total FROM claims')
    expect(rows[0].total).toBe(0)
  })

  it('2 · the observation IS still stored — the source was read, that is a fact', async () => {
    const { observations } = buildService(paraphrasingExtractor)
    await observations.ingest(SAKURA, 'after', 'manual_ingest')

    const { rows } = await owner.query('SELECT count(*)::int AS total FROM observations')
    expect(rows[0].total).toBe(1)
  })

  it('3 · raw SQL path: the database refuses a claim with no quote at all', async () => {
    const { observations } = buildService(new FixtureClaimExtractor())
    const result = await observations.ingest(SAKURA, 'after', 'manual_ingest')

    await expect(
      owner.query(
        `INSERT INTO claims (company_id, observation_id, statement, signal_type, confidence,
                             quote_start, quote_end, trigger_context)
         VALUES ($1, $2, 'Không có câu trích', 'funding', 'certain', 0, 5, 'manual_ingest')`,
        [SAKURA, result.observationId],
      ),
    ).rejects.toThrow(/not-null constraint|violates not-null/i)
  })
})

describe('T-3 · a stored finding points back at the exact characters of its source', () => {
  it('4 · offsets slice out of raw_content to exactly the quote', async () => {
    const { observations } = buildService(new FixtureClaimExtractor())
    await observations.ingest(SAKURA, 'after', 'manual_ingest')

    const zone = await observations.readingZone(SAKURA)
    expect(zone).toHaveLength(1)
    expect(zone[0].claims.length).toBeGreaterThan(0)

    for (const claim of zone[0].claims) {
      // This is what the highlight in the UI does. If it disagrees, clicking a finding
      // highlights the wrong sentence — fake provenance that still looks like provenance.
      expect(zone[0].rawContent.slice(claim.quoteStart, claim.quoteEnd)).toBe(claim.quoteText)
    }
  })

  it('5 · every stored finding has a non-empty quote and a forward span', async () => {
    const { observations } = buildService(new FixtureClaimExtractor())
    await observations.ingest(SAKURA, 'after', 'manual_ingest')

    const { rows } = await owner.query(
      `SELECT quote_text, quote_start, quote_end FROM claims`,
    )
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(row.quote_text.trim().length).toBeGreaterThan(0)
      expect(row.quote_end).toBeGreaterThan(row.quote_start)
    }
  })
})

describe('I-3 · reading unchanged content costs no row and no LLM call', () => {
  it('6 · second read of identical content: no new observation, extractor NOT called again', async () => {
    const spy = { calls: 0 }
    const countingExtractor: ClaimExtractor = {
      async extract(input: ObservationInput) {
        spy.calls += 1
        return new FixtureClaimExtractor().extract(input)
      },
    }
    const { observations } = buildService(countingExtractor)

    const first = await observations.ingest(SAKURA, 'after', 'manual_ingest')
    const second = await observations.ingest(SAKURA, 'after', 'manual_ingest')

    expect(first.unchanged).toBe(false)
    expect(second.unchanged).toBe(true)
    expect(second.observationId).toBeNull()

    // The expensive half of I-3. Asserting only "one row" would pass a version that still
    // pays for an LLM call every 60 seconds.
    expect(spy.calls).toBe(1)

    const { rows } = await owner.query('SELECT count(*)::int AS total FROM observations')
    expect(rows[0].total).toBe(1)
  })

  it('7 · ADR-0017: before → after → before all store, because I-3 compares the LATEST', async () => {
    const { observations } = buildService(new FixtureClaimExtractor())

    await observations.ingest(SAKURA, 'before', 'manual_ingest')
    await observations.ingest(SAKURA, 'after', 'manual_ingest')
    const third = await observations.ingest(SAKURA, 'before', 'manual_ingest')

    // A unique index on (company_id, content_hash) would reject this third read. That is the
    // sequence a judge produces replaying the T-6/T-8 script a second time.
    expect(third.unchanged).toBe(false)
    expect(third.observationId).not.toBeNull()

    const { rows } = await owner.query('SELECT count(*)::int AS total FROM observations')
    expect(rows[0].total).toBe(3)
  })
})

describe('I-4 · group 2 never touches official data', () => {
  /**
   * ── This test's meaning was NARROWED on purpose by ADR-0028, it is not a regression ──────
   *
   * It used to read "a `manual_ingest` finding produces no timeline entry", measured on SAKURA.
   * Sakura is a WATCHED company, and ADR-0028 moved the condition for a system entry from
   * `trigger_context` onto `is_watched`: turning on Đang theo dõi delegates the writing of news
   * to the machine (ADR-0006), and who pressed the button is not part of that delegation. So the
   * honest expectation on Sakura is now the OPPOSITE — one system entry, labelled and quoted.
   *
   * The old expectation still holds where it always belonged: on a company nobody delegated.
   * MARLIN carries `is_watched = false`, so it is where "no delegation, no write" is measured.
   *
   * Both halves live here rather than one being deleted, because what I-4 is really about is
   * unchanged either way: GROUP 2 — reading a source and drawing findings — touches no official
   * data by itself. Whatever official data changes afterwards is group 5 acting under a
   * delegation a person switched on, and it is visible, labelled and removable.
   */
  it('8 · a watched company DOES get the entry, and nothing else about it changes', async () => {
    const { observations } = buildService(new FixtureClaimExtractor())
    const before = await owner.query('SELECT industry FROM companies WHERE id = $1', [SAKURA])

    const result = await observations.ingest(SAKURA, 'after', 'manual_ingest')

    expect(result.systemEntriesAdded).toBeGreaterThan(0)
    const timeline = await owner.query(
      `SELECT created_by, entry_type, source_claim_id FROM timeline_entries WHERE company_id = $1`,
      [SAKURA],
    )
    expect(timeline.rows).toHaveLength(result.systemEntriesAdded)
    for (const row of timeline.rows) {
      // Zone 4 is bought with the label and the quote, so both are part of the invariant.
      expect(row.created_by).toBe('system')
      expect(row.entry_type).toBe('system_entry')
      expect(row.source_claim_id).not.toBeNull()
    }

    // The PROFILE is still zone 2 territory — group 5 writes news, never a cell.
    const after = await owner.query('SELECT industry FROM companies WHERE id = $1', [SAKURA])
    expect(after.rows[0].industry).toBe(before.rows[0].industry)

    /**
     * Reading a source DOES now feed the review queue (phase 5) — that is feature group 3
     * doing its job, and it is not a write to official data. What must hold is that every
     * entry is still waiting: unchanged profile above, and not one decision recorded, so
     * nothing in the queue has taken effect.
     */
    const pending = await owner.query(
      `SELECT count(*)::int AS total FROM proposals WHERE status <> 'pending'`,
    )
    expect(pending.rows[0].total).toBe(0)

    const decisions = await owner.query('SELECT count(*)::int AS total FROM proposal_decisions')
    expect(decisions.rows[0].total).toBe(0)
  })

  it('8b · a company nobody watches gets no timeline entry, whoever read it', async () => {
    const { observations } = buildService(new FixtureClaimExtractor())

    await observations.ingest(MARLIN, 'after', 'manual_ingest')
    await observations.ingest(MARLIN, 'before', 'watch_cycle')

    const timeline = await owner.query(
      'SELECT count(*)::int AS total FROM timeline_entries WHERE company_id = $1',
      [MARLIN],
    )
    expect(timeline.rows[0].total).toBe(0)
  })
})

describe('an unreadable source is recorded, never guessed (ontology 3.5)', () => {
  it('9 · fetch_status = failed, zero findings', async () => {
    const { observations } = buildService(new FixtureClaimExtractor())

    const result = await observations.ingest(OHARA, 'after', 'manual_ingest')

    expect(result.fetchStatus).toBe('failed')
    expect(result.claimsSaved).toBe(0)

    const { rows } = await owner.query(
      `SELECT fetch_status, raw_html FROM observations WHERE company_id = $1`,
      [OHARA],
    )
    expect(rows[0].fetch_status).toBe('failed')
    expect(rows[0].raw_html).toBeNull()

    const claims = await owner.query('SELECT count(*)::int AS total FROM claims')
    expect(claims.rows[0].total).toBe(0)
  })
})

describe('ADR-0009 · the AI kill switch stops reading a source by hand too', () => {
  it('10 · switched off: nothing generated, nothing deleted', async () => {
    const { observations } = buildService(new FixtureClaimExtractor())
    await observations.ingest(SAKURA, 'after', 'manual_ingest')
    const beforeCount = await owner.query('SELECT count(*)::int AS total FROM claims')
    expect(beforeCount.rows[0].total).toBeGreaterThan(0)

    await setAiEnabled(false)
    const result = await observations.ingest(SAKURA, 'before', 'manual_ingest')

    expect(result.skippedReason).toBe('ai_disabled')
    expect(result.observationId).toBeNull()

    const observationCount = await owner.query('SELECT count(*)::int AS total FROM observations')
    expect(observationCount.rows[0].total).toBe(1)
    // ADR-0009: the switch stops NEW generation. What already exists stays.
    const afterCount = await owner.query('SELECT count(*)::int AS total FROM claims')
    expect(afterCount.rows[0].total).toBe(beforeCount.rows[0].total)
  })
})

describe('ADR-0007 · `certain` is the only level with a machine gate', () => {
  it('11 · a figure in the statement that the quote does not contain drops it to `likely`', async () => {
    const inventingExtractor: ClaimExtractor = {
      async extract(): Promise<ClaimDraft[]> {
        return [
          {
            // "35 triệu" is nowhere in the snapshot. This is the dangerous failure: a number
            // the model made up, wearing the label a reader acts on without checking.
            statement: 'Công ty vừa gọi vốn 35 triệu USD',
            signalType: 'funding',
            confidence: 'certain',
            quoteText: 'Sakura vừa hoàn tất vòng Series B huy động 20 triệu USD do Mizuho Capital dẫn dắt.',
          },
        ]
      },
    }
    const { observations } = buildService(inventingExtractor)

    const result = await observations.ingest(SAKURA, 'after', 'manual_ingest')

    expect(result.claimsSaved).toBe(1)
    expect(result.claimsDowngradedFromCertain).toBe(1)

    const { rows } = await owner.query('SELECT confidence FROM claims')
    expect(rows[0].confidence).toBe('likely')
  })

  it('12 · a statement whose figures all appear in the quote stays `certain`', async () => {
    const honestExtractor: ClaimExtractor = {
      async extract(): Promise<ClaimDraft[]> {
        return [
          {
            statement: 'Gọi vốn 20 triệu USD',
            signalType: 'funding',
            confidence: 'certain',
            quoteText: 'Sakura vừa hoàn tất vòng Series B huy động 20 triệu USD do Mizuho Capital dẫn dắt.',
          },
        ]
      },
    }
    const { observations } = buildService(honestExtractor)

    const result = await observations.ingest(SAKURA, 'after', 'manual_ingest')

    expect(result.claimsDowngradedFromCertain).toBe(0)
    const { rows } = await owner.query('SELECT confidence FROM claims')
    expect(rows[0].confidence).toBe('certain')
  })
})

describe('the fixture extractor earns its place', () => {
  it('13 · it reads the real snapshot and returns quotes that survive the I-2 check', async () => {
    const { observations } = buildService(new FixtureClaimExtractor())

    const result = await observations.ingest(SAKURA, 'after', 'manual_ingest')

    // Not a mock returning canned rows: it found the funding sentence in the actual snapshot.
    expect(result.claimsSaved).toBeGreaterThan(0)
    expect(result.claimsDroppedNoVerbatimQuote).toBe(0)

    const { rows } = await owner.query('SELECT signal_type FROM claims')
    expect(rows.map((row) => row.signal_type)).toContain('funding')
  })

  it('14 · the "before" snapshot carries no buying signal — only profile facts', async () => {
    const { observations } = buildService(new FixtureClaimExtractor())

    const result = await observations.ingest(SAKURA, 'before', 'manual_ingest')

    expect(result.observationId).not.toBeNull()

    /**
     * Rule 4: nothing to report is a valid answer, and the `before` page still reports no news.
     * Since ADR-0024 the page also carries a facts block, and reading `Ngành: …` off it IS a
     * finding — so the assertion is on the news branch specifically. `signal_type = 'other'`
     * is what keeps profile facts out of the timeline half of the queue.
     */
    const signals = await owner.query(
      `SELECT count(*)::int AS total FROM claims WHERE signal_type <> 'other'`,
    )
    expect(signals.rows[0].total).toBe(0)
  })
})

describe('read zone shape', () => {
  it('15 · snapshots come back newest first, each carrying its own findings', async () => {
    const { observations } = buildService(new FixtureClaimExtractor())
    await observations.ingest(SAKURA, 'before', 'manual_ingest')
    // Same millisecond would make the ordering assertion meaningless.
    await vi.waitFor(() => undefined)
    await observations.ingest(SAKURA, 'after', 'manual_ingest')

    const zone = await observations.readingZone(SAKURA)

    expect(zone).toHaveLength(2)
    expect(new Date(zone[0].capturedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(zone[1].capturedAt).getTime(),
    )
    // Re-reading a source does NOT delete the older findings: each snapshot keeps its own,
    // with its own timestamp, so a reader can see what was known when.
    expect(zone[0].claims.length).toBeGreaterThan(0)
    // The funding news belongs to the NEWER snapshot only. The older one carries just the
    // profile facts, which both pages state — so compare on the news, not on the count.
    expect(zone[0].claims.some((claim) => claim.signalType === 'funding')).toBe(true)
    expect(zone[1].claims.some((claim) => claim.signalType !== 'other')).toBe(false)
  })
})

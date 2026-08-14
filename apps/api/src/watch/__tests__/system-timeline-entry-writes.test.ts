import { Pool } from 'pg'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { createConnection, resetTestDatabase } from '@crm/db'

import { AuditEventService } from '../../common/audit/audit-event-service'
import { AutoNextStepService } from '../../domain/opportunity/auto-next-step-service'
import { ClaimReactionService } from '../../domain/claim/claim-reaction-service'
import { ClaimService } from '../../domain/claim/claim-service'
import { DemoSnapshotSource } from '../../ai/demo-snapshots'
import { FixtureClaimExtractor } from '../../ai/fixture-claim-extractor'
import { ObservationService } from '../../domain/observation/observation-service'
import { ProposalService } from '../../domain/proposal/proposal-service'
import { SystemSettingService } from '../../settings/system-setting-service'
import { SystemTimelineEntryService } from '../system-timeline-entry-service'

/**
 * Autonomy zone 4 — the watch cycle writing to the official timeline WITHOUT asking anyone.
 *
 * The two-by-two table below is the whole point of this file, and it is the shape ADR-0028
 * settled. Before that ADR the two halves disagreed: I-5 blocked the *suggestion* on
 * `is_watched` while I-4 blocked the *system entry* on `trigger_context`, so a watched company
 * whose source a PERSON re-read fell through both — no entry, no suggestion — and I-3 made that
 * permanent, because the next cycle finds the same hash and produces no findings at all. The
 * news was then unreachable forever. That was not hypothetical: `e2e/t6-t7` presses "Đọc bản
 * chụp sau" on Nimbus, which is watched.
 *
 * So the condition is `is_watched` on BOTH sides, and these four cells are what proves it:
 *
 *                   │ read by hand        │ read by the watch cycle
 *   ────────────────┼─────────────────────┼─────────────────────────
 *   watched         │ system entry        │ system entry
 *   not watched     │ suggestion          │ suggestion
 *
 * Exactly ONE of the two paths runs per finding, never both and never neither. Both halves are
 * asserted in the same test for each cell: asserting only the presence of one leaves the door
 * open to a version where a watched company gets the entry AND queues the same news for review,
 * which would put it on the timeline twice.
 */

const SALES_ID = '11111111-1111-4111-8111-111111111111'
/** Watched, and its "after" snapshot carries a funding item. */
const SAKURA = 'aaaaaaaa-0001-4000-8000-000000000001'
/** NOT watched — the company the "no delegation, no write" half of I-4 is measured on. */
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

/** The real chain, group 4 → group 3 → group 5. A stub anywhere here proves nothing about I-5. */
function buildService(): ObservationService {
  const claims = new ClaimService(systemConnection.db, appConnection.db)
  const reactions = new ClaimReactionService(
    new AutoNextStepService(
      systemConnection.db,
      appConnection.db,
      new AuditEventService(appConnection.db, systemConnection.db),
    ),
    new ProposalService(systemConnection.db, appConnection.db),
    new SystemTimelineEntryService(systemConnection.db),
  )
  return new ObservationService(
    systemConnection.db,
    appConnection.db,
    new FixtureClaimExtractor(),
    claims,
    snapshots,
    settings,
    reactions,
  )
}

async function systemEntries(companyId: string) {
  const { rows } = await owner.query(
    `SELECT entry_type, created_by, description, source_claim_id, occurred_at, contact_id
     FROM timeline_entries WHERE company_id = $1 AND created_by = 'system'`,
    [companyId],
  )
  return rows
}

async function timelineProposals(companyId: string) {
  const { rows } = await owner.query(
    `SELECT proposed_value FROM proposals
     WHERE company_id = $1 AND proposal_type = 'timeline_entry'`,
    [companyId],
  )
  return rows
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
       ($1, 'Sakura Manufacturing KK', 'Sản xuất', 'traditional', $3, true),
       ($2, 'Marlin Product Labs', 'Phần mềm', 'it_product', $3, false)`,
    [SAKURA, MARLIN, SALES_ID],
  )
  await owner.query(
    `INSERT INTO system_settings (key, value) VALUES ('ai_enabled', 'true'), ('watch_cycle_seconds', '60')
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
  )
})

afterAll(async () => {
  await Promise.all([owner.end(), appConnection.close(), systemConnection.close()])
})

describe('I-4 and I-5 · the delegation is a property of the COMPANY (ADR-0028)', () => {
  it('1 · watched + read by the watch cycle → system entry, no timeline suggestion', async () => {
    const result = await buildService().ingest(SAKURA, 'after', 'watch_cycle')

    expect(result.systemEntriesAdded).toBeGreaterThan(0)
    expect(await systemEntries(SAKURA)).toHaveLength(result.systemEntriesAdded)
    expect(await timelineProposals(SAKURA)).toHaveLength(0)
  })

  it('2 · watched + read BY HAND → system entry all the same (the hole ADR-0028 closes)', async () => {
    /**
     * The cell the old design lost. Turning on Đang theo dõi delegates the writing of news
     * (ADR-0006); who pressed the button is not part of that delegation, and a person pressing
     * "Đọc lại nguồn" is not a reason to throw the news away.
     */
    const result = await buildService().ingest(SAKURA, 'after', 'manual_ingest')

    expect(result.systemEntriesAdded).toBeGreaterThan(0)
    expect(await systemEntries(SAKURA)).toHaveLength(result.systemEntriesAdded)
    expect(await timelineProposals(SAKURA)).toHaveLength(0)
  })

  it('3 · NOT watched + read by hand → suggestion, and not one system entry', async () => {
    const result = await buildService().ingest(MARLIN, 'after', 'manual_ingest')

    expect(result.systemEntriesAdded).toBe(0)
    expect(await systemEntries(MARLIN)).toHaveLength(0)
    expect((await timelineProposals(MARLIN)).length).toBeGreaterThan(0)
  })

  it('4 · NOT watched + read by the watch cycle → suggestion too, never a write', async () => {
    /**
     * The cell that keeps zone 4 from spreading. A company nobody delegated stays in zone 2 no
     * matter who reads it — the watch cycle happening to be the reader is not authority.
     */
    const result = await buildService().ingest(MARLIN, 'after', 'watch_cycle')

    expect(result.systemEntriesAdded).toBe(0)
    expect(await systemEntries(MARLIN)).toHaveLength(0)
    expect((await timelineProposals(MARLIN)).length).toBeGreaterThan(0)
  })
})

describe('the label and the quote every zone-4 row must carry', () => {
  it('5 · every system entry is labelled, typed and traceable back to a quote', async () => {
    await buildService().ingest(SAKURA, 'after', 'watch_cycle')

    const rows = await systemEntries(SAKURA)
    expect(rows.length).toBeGreaterThan(0)

    for (const row of rows) {
      expect(row.created_by).toBe('system')
      expect(row.entry_type).toBe('system_entry')
      expect(row.source_claim_id).not.toBeNull()
      // `contact_id` is absent from the GRANT of 0007: the AI naming a person on an entry it
      // invented would be fabricating a meeting.
      expect(row.contact_id).toBeNull()
    }

    // The quote itself has to be reachable, not merely referenced — rule 1 of CLAUDE.md.
    const { rows: joined } = await owner.query(
      `SELECT c.quote_text, o.raw_content
       FROM timeline_entries t
       JOIN claims c ON c.id = t.source_claim_id
       JOIN observations o ON o.id = c.observation_id
       WHERE t.company_id = $1 AND t.created_by = 'system'`,
      [SAKURA],
    )
    expect(joined).toHaveLength(rows.length)
    for (const row of joined) {
      expect(row.quote_text.trim().length).toBeGreaterThan(0)
      expect(row.raw_content).toContain(row.quote_text)
    }
  })

  it('6 · occurred_at is the moment the SNAPSHOT was captured, not the moment of writing', async () => {
    /**
     * An entry dated "now" would tell a reader the news happened when the cycle happened to
     * come round, which is a different sentence from the one the source supports. The observation
     * row is the only timestamp with a source behind it.
     */
    await buildService().ingest(SAKURA, 'after', 'watch_cycle')

    const { rows } = await owner.query(
      `SELECT t.occurred_at, o.captured_at
       FROM timeline_entries t
       JOIN claims c ON c.id = t.source_claim_id
       JOIN observations o ON o.id = c.observation_id
       WHERE t.company_id = $1 AND t.created_by = 'system'`,
      [SAKURA],
    )
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(row.occurred_at.getTime()).toBe(row.captured_at.getTime())
    }
  })

  it('7 · a profile line never becomes news — `other` and low confidence stay out', async () => {
    /**
     * The filter has to stay IDENTICAL to `ProposalService.buildTimelineEntry`, or the two
     * halves of ADR-0028 disagree again and nobody sees it. `Ngành: …` is a fact about the
     * company, not something that happened to it.
     */
    await buildService().ingest(SAKURA, 'after', 'watch_cycle')

    const { rows } = await owner.query(
      `SELECT c.signal_type, c.confidence
       FROM timeline_entries t
       JOIN claims c ON c.id = t.source_claim_id
       WHERE t.company_id = $1 AND t.created_by = 'system'`,
      [SAKURA],
    )
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(row.signal_type).not.toBe('other')
      expect(['certain', 'likely']).toContain(row.confidence)
    }
  })

  it('8 · I-3 keeps a second read from adding the same entry twice', async () => {
    const observations = buildService()
    const first = await observations.ingest(SAKURA, 'after', 'watch_cycle')
    const second = await observations.ingest(SAKURA, 'after', 'watch_cycle')

    expect(second.unchanged).toBe(true)
    expect(second.systemEntriesAdded).toBe(0)
    // This is also why a deleted entry does not grow back: an unchanged page yields no findings
    // at all, so no write-once-at-claim-time path can revisit it (ADR-0028, rejected option).
    expect(await systemEntries(SAKURA)).toHaveLength(first.systemEntriesAdded)
  })
})

import { Pool } from 'pg'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import type { ClaimDraft, ClaimExtractor, ObservationInput } from '@crm/contracts'
import { createConnection, resetTestDatabase } from '@crm/db'

import { AuditEventService } from '../../../common/audit/audit-event-service'
import { AutoNextStepService } from '../../opportunity/auto-next-step-service'
import { ClaimReactionService } from '../../claim/claim-reaction-service'
import { ClaimService } from '../../claim/claim-service'
import { DemoSnapshotSource, type Snapshot, type SnapshotVariant } from '../../../ai/demo-snapshots'
import { ObservationService } from '../observation-service'
import { ProposalService } from '../../proposal/proposal-service'
import { SystemSettingService } from '../../../settings/system-setting-service'
import { SystemTimelineEntryService } from '../../../watch/system-timeline-entry-service'

/**
 * I-3 is scoped to ONE URL, not to the company (ADR-0036).
 *
 * The old form — "different from the company's most recent observation" — is indistinguishable
 * from this one while every company has exactly one source, which every snapshot company does.
 * That is exactly what makes the bug invisible: the existing I-3 tests stay green after the
 * feature breaks. Add a second URL and the two readings cross-check — URL A's hash is compared
 * against URL B's row, never matches, so every read stores a fresh row for every URL AND pays for
 * an LLM call on each one.
 *
 * The expensive half is the LLM call, so `extractorCalls` is asserted alongside the row count.
 * Asserting only "no new row" would pass on a version that still pays for the call every 60
 * seconds — which is the same reason `observation-service.ts:74-76` exists.
 */

const SALES_ID = '11111111-1111-4111-8111-111111111111'
const COMPANY_ID = 'eeeeeeee-0003-4000-8000-000000000003'

const URL_A = 'https://example.test/a'
const URL_B = 'https://example.test/b'
/** IDENTICAL text on both URLs: the point is that the URL separates them, not the content. */
const SAME_TEXT = '<html><body><p>Công ty vừa hoàn tất vòng Series B huy động 20 triệu USD.</p></body></html>'

const owner = new Pool({ connectionString: process.env.DATABASE_URL_TEST })
const appConnection = createConnection(process.env.DATABASE_URL_TEST_APP as string)
const systemConnection = createConnection(process.env.DATABASE_URL_TEST_SYSTEM as string)

const settings = new SystemSettingService(
  appConnection.db,
  systemConnection.db,
  new AuditEventService(appConnection.db, systemConnection.db),
)

/**
 * A source under the test's control, standing in for `DemoSnapshotSource`. `SNAPSHOTS` is keyed by
 * the five seed company ids and cannot express "two URLs for one company", which is the whole
 * subject here — so the port is swapped rather than the fixture edited.
 */
class TwoUrlSource extends DemoSnapshotSource {
  constructor(private page: { sourceUrl: string; rawHtml: string }) {
    super()
  }

  setPage(page: { sourceUrl: string; rawHtml: string }): void {
    this.page = page
  }

  override read(_companyId: string, _variant: SnapshotVariant): Snapshot | null {
    // Same contract as the base class: empty content means "this source cannot be read", and the
    // caller records `failed` rather than guessing. Diverging here would make test 5 measure a
    // stub's behaviour instead of the service's.
    if (this.page.rawHtml.trim().length === 0) return null
    return { sourceUrl: this.page.sourceUrl, rawHtml: this.page.rawHtml }
  }

  override sourceUrlFor(): string | null {
    return this.page.sourceUrl
  }
}

/** Counts calls so the LLM half of I-3 is measured, not assumed. */
class CountingExtractor implements ClaimExtractor {
  calls = 0

  async extract(observation: ObservationInput): Promise<ClaimDraft[]> {
    this.calls += 1
    const quote = 'Công ty vừa hoàn tất vòng Series B huy động 20 triệu USD.'
    if (!observation.rawContent.includes(quote)) return []
    return [
      {
        statement: 'Công ty vừa gọi vốn vòng Series B',
        signalType: 'funding',
        confidence: 'certain',
        quoteText: quote,
      },
    ]
  }
}

function buildService(source: TwoUrlSource, extractor: ClaimExtractor): ObservationService {
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
    extractor,
    new ClaimService(systemConnection.db, appConnection.db),
    source,
    settings,
    reactions,
  )
}

async function observationRows(): Promise<{ source_url: string; content_hash: string }[]> {
  const { rows } = await owner.query(
    'SELECT source_url, content_hash FROM observations WHERE company_id = $1 ORDER BY captured_at',
    [COMPANY_ID],
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
    `INSERT INTO companies (id, name, industry, company_type, owner_id, is_watched)
     VALUES ($1, 'Công ty hai nguồn', 'ITO', 'it_solution', $2, false)`,
    [COMPANY_ID, SALES_ID],
  )
  await owner.query(
    `INSERT INTO system_settings (key, value) VALUES ('ai_enabled', 'true'), ('watch_cycle_seconds', '60')
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
  )
})

afterAll(async () => {
  await Promise.all([owner.end(), appConnection.close(), systemConnection.close()])
})

describe('I-3 · the same URL read twice costs one row and one LLM call', () => {
  it('1 · unchanged content on the same URL → no second row, extractor called ONCE', async () => {
    const source = new TwoUrlSource({ sourceUrl: URL_A, rawHtml: SAME_TEXT })
    const extractor = new CountingExtractor()
    const service = buildService(source, extractor)

    const first = await service.ingest(COMPANY_ID, 'before', 'watch_cycle')
    const second = await service.ingest(COMPANY_ID, 'before', 'watch_cycle')

    expect(first.unchanged).toBe(false)
    expect(second.unchanged).toBe(true)
    expect(await observationRows()).toHaveLength(1)
    // The assertion that makes this test worth writing: a version that only skipped the INSERT
    // would still be paying for an extraction on every cycle.
    expect(extractor.calls).toBe(1)
  })
})

describe('I-3 · two URLs are two sources, even with byte-identical content', () => {
  it('2 · the same text on a different URL IS stored — one row per source', async () => {
    const source = new TwoUrlSource({ sourceUrl: URL_A, rawHtml: SAME_TEXT })
    const extractor = new CountingExtractor()
    const service = buildService(source, extractor)

    await service.ingest(COMPANY_ID, 'before', 'watch_cycle')
    source.setPage({ sourceUrl: URL_B, rawHtml: SAME_TEXT })
    const second = await service.ingest(COMPANY_ID, 'before', 'watch_cycle')

    /**
     * Under the per-company form this came back `unchanged` and URL B was never recorded — the
     * company's news page and its press page would collapse into whichever was read first.
     */
    expect(second.unchanged).toBe(false)
    const rows = await observationRows()
    expect(rows).toHaveLength(2)
    expect(rows.map((row) => row.source_url)).toEqual([URL_A, URL_B])
    // Identical text, so identical hash: the URL is what separates them, nothing else.
    expect(rows[0].content_hash).toBe(rows[1].content_hash)
    expect(extractor.calls).toBe(2)
  })

  it('3 · alternating between two URLs stays quiet after each has been seen once', async () => {
    const source = new TwoUrlSource({ sourceUrl: URL_A, rawHtml: SAME_TEXT })
    const extractor = new CountingExtractor()
    const service = buildService(source, extractor)

    await service.ingest(COMPANY_ID, 'before', 'watch_cycle')
    source.setPage({ sourceUrl: URL_B, rawHtml: SAME_TEXT })
    await service.ingest(COMPANY_ID, 'before', 'watch_cycle')

    // Round two: neither page changed, so neither should cost anything.
    source.setPage({ sourceUrl: URL_A, rawHtml: SAME_TEXT })
    expect((await service.ingest(COMPANY_ID, 'before', 'watch_cycle')).unchanged).toBe(true)
    source.setPage({ sourceUrl: URL_B, rawHtml: SAME_TEXT })
    expect((await service.ingest(COMPANY_ID, 'before', 'watch_cycle')).unchanged).toBe(true)

    expect(await observationRows()).toHaveLength(2)
    expect(extractor.calls).toBe(2)
  })

  it('4 · a real change on one URL is still detected while the other stays quiet', async () => {
    const source = new TwoUrlSource({ sourceUrl: URL_A, rawHtml: SAME_TEXT })
    const extractor = new CountingExtractor()
    const service = buildService(source, extractor)

    await service.ingest(COMPANY_ID, 'before', 'watch_cycle')
    source.setPage({ sourceUrl: URL_B, rawHtml: SAME_TEXT })
    await service.ingest(COMPANY_ID, 'before', 'watch_cycle')

    source.setPage({
      sourceUrl: URL_A,
      rawHtml: '<html><body><p>Công ty bổ nhiệm Giám đốc Công nghệ mới.</p></body></html>',
    })
    expect((await service.ingest(COMPANY_ID, 'before', 'watch_cycle')).unchanged).toBe(false)

    const rows = await observationRows()
    expect(rows).toHaveLength(3)
    expect(rows.filter((row) => row.source_url === URL_A)).toHaveLength(2)
    expect(rows.filter((row) => row.source_url === URL_B)).toHaveLength(1)
  })
})

describe('I-3 does not apply to a failed read', () => {
  it('5 · two consecutive failures are two rows — an outage must stay visible', async () => {
    // An empty page is how `DemoSnapshotSource` expresses "cannot be read", so the same source
    // class covers this case; no cast and no second stub needed.
    const source = new TwoUrlSource({ sourceUrl: URL_A, rawHtml: '' })
    const extractor = new CountingExtractor()
    const service = buildService(source, extractor)

    await service.ingest(COMPANY_ID, 'before', 'watch_cycle')
    await service.ingest(COMPANY_ID, 'before', 'watch_cycle')

    // Treating a repeated failure as "đã đọc, không đổi" would hide an ongoing outage behind a
    // reassuring log line — `recordUnreadableSource` says so, and this pins it.
    const { rows } = await owner.query(
      `SELECT count(*) FROM observations WHERE company_id = $1 AND fetch_status = 'failed'`,
      [COMPANY_ID],
    )
    expect(Number(rows[0].count)).toBe(2)
    expect(extractor.calls).toBe(0)
  })
})

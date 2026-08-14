import { Pool } from 'pg'
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { ClaimDraft, ClaimExtractor, ObservationInput } from '@crm/contracts'
import { SEED_COMPANIES, createConnection, resetTestDatabase } from '@crm/db'

import { AuditEventService } from '../../../common/audit/audit-event-service'
import { AutoNextStepService } from '../../opportunity/auto-next-step-service'
import { ClaimReactionService } from '../../claim/claim-reaction-service'
import { ClaimService } from '../../claim/claim-service'
import { DemoSnapshotSource } from '../../../ai/demo-snapshots'
import { LiveCrawlSource } from '../../../ai/live-crawl-source'
import { ObservationService } from '../observation-service'
import { ProposalService } from '../../proposal/proposal-service'
import { SystemSettingService } from '../../../settings/system-setting-service'
import { SystemTimelineEntryService } from '../../../watch/system-timeline-entry-service'
import type { FetchPage, FetchPageResult } from '../../../ai/fetch-page'

/**
 * The live path ON THE EXECUTION ROUTE, which is the half phase 1 could not reach.
 *
 * Phase 1 proved `resolveObservationSource` with a table test and then deliberately did NOT wire
 * it in: resolving to `live_crawl` with no crawler behind it would have stamped stored snapshot
 * content with `source_kind = 'live_crawl'` — a lie in the one column the autonomy ceiling is
 * computed from. This file is where the wiring itself is measured.
 *
 * The most valuable test here is 1, and it is the one that protects the SCORE rather than the
 * feature: with the live source switched on globally, a seed company must still read its stored
 * snapshot and the crawler must be called zero times. T-6 and T-8 are replayed by flipping a
 * company from `before` to `after`, so a seed company whose content could change underneath the
 * judge makes two of the ten acceptance checks unrepeatable.
 */

const SALES_ID = '11111111-1111-4111-8111-111111111111'
const OUTSIDE_SEED_ID = 'eeeeeeee-0007-4000-8000-000000000007'
const SEED_COMPANY = SEED_COMPANIES[0]

const LIVE_URL = 'https://ngoai-seed.example.com/tin-tuc'
const LIVE_PAGE =
  '<html><body><p>Công ty vừa hoàn tất vòng Series B huy động 20 triệu USD.</p></body></html>'

const owner = new Pool({ connectionString: process.env.DATABASE_URL_TEST })
const appConnection = createConnection(process.env.DATABASE_URL_TEST_APP as string)
const systemConnection = createConnection(process.env.DATABASE_URL_TEST_SYSTEM as string)

const settings = new SystemSettingService(
  appConnection.db,
  systemConnection.db,
  new AuditEventService(appConnection.db, systemConnection.db),
)

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

/** Counts every attempt to leave the machine, so "zero live reads" is a number, not a hope. */
function countingCrawler(result: FetchPageResult): { source: LiveCrawlSource; urls: string[] } {
  const urls: string[] = []
  const fetchPage = (async (url: string) => {
    urls.push(url)
    return result
  }) as unknown as FetchPage

  return {
    source: new LiveCrawlSource({ fetchPage, assertAllowed: () => {} }),
    urls,
  }
}

function buildService(live: LiveCrawlSource, extractor: ClaimExtractor): ObservationService {
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
    new DemoSnapshotSource(),
    settings,
    reactions,
    live,
  )
}

async function observationRows(companyId: string) {
  const { rows } = await owner.query(
    `SELECT source_url, source_kind, fetch_status, fetch_error_reason, raw_content
     FROM observations WHERE company_id = $1 ORDER BY captured_at`,
    [companyId],
  )
  return rows
}

async function claimCount(companyId: string): Promise<number> {
  const { rows } = await owner.query('SELECT count(*) FROM claims WHERE company_id = $1', [
    companyId,
  ])
  return Number(rows[0].count)
}

beforeEach(async () => {
  await resetTestDatabase(owner)
  process.env.OBSERVATION_SOURCE = 'live_crawl'

  await owner.query(
    `INSERT INTO users (id, email, password_hash, name, role)
     VALUES ($1, 'sales@test.local', 'x', 'Sales', 'sales')`,
    [SALES_ID],
  )
  /** Outside the seed set AND opted in — the only combination the live path accepts. */
  await owner.query(
    `INSERT INTO companies (id, name, industry, company_type, owner_id, is_watched, website, live_source_enabled)
     VALUES ($1, 'Công ty ngoài seed', 'ITO', 'it_solution', $2, false, $3, true)`,
    [OUTSIDE_SEED_ID, SALES_ID, LIVE_URL],
  )
  /** A real seed company, switched on as hard as the API allows, to prove I-16 outranks it. */
  await owner.query(
    `INSERT INTO companies (id, name, industry, company_type, owner_id, is_watched, website, live_source_enabled)
     VALUES ($1, $2, 'Sản xuất', 'traditional', $3, false, 'https://sakura-mfg.example.jp', true)`,
    [SEED_COMPANY.id, SEED_COMPANY.name, SALES_ID],
  )
  await owner.query(
    `INSERT INTO system_settings (key, value) VALUES ('ai_enabled', 'true'), ('watch_cycle_seconds', '60')
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
  )
})

afterEach(() => {
  delete process.env.OBSERVATION_SOURCE
})

afterAll(async () => {
  await Promise.all([owner.end(), appConnection.close(), systemConnection.close()])
})

describe('the acceptance suite cannot be reached by the live path (I-16)', () => {
  it('1 · a seed company reads its stored snapshot and the crawler is called ZERO times', async () => {
    const { source, urls } = countingCrawler({
      ok: true,
      html: LIVE_PAGE,
      finalUrl: 'https://sakura-mfg.example.jp',
    })
    const service = buildService(source, new CountingExtractor())

    const result = await service.ingest(SEED_COMPANY.id, 'before', 'manual_ingest')

    expect(result.fetchStatus).toBe('ok')
    const rows = await observationRows(SEED_COMPANY.id)
    expect(rows).toHaveLength(1)
    // The stored page, under the stored URL, labelled as what it is.
    expect(rows[0].source_kind).toBe('demo_snapshot')
    expect(rows[0].source_url).toBe('https://sakura-mfg.example.jp/news')
    /**
     * The assertion that protects the score. `source_kind` alone would still pass on a version
     * that fetched the page, threw the bytes away and wrote the snapshot anyway — the packet
     * would already have left, and a judge's T-6 replay would be racing a live website.
     */
    expect(urls).toHaveLength(0)
  })
})

describe('a company outside the seed set, opted in, reads for real', () => {
  it('2 · the page becomes an observation this codebase owns, byte for byte', async () => {
    const { source, urls } = countingCrawler({
      ok: true,
      html: LIVE_PAGE,
      finalUrl: LIVE_URL,
    })
    const extractor = new CountingExtractor()
    const service = buildService(source, extractor)

    const result = await service.ingest(OUTSIDE_SEED_ID, 'before', 'manual_ingest')

    expect(urls).toEqual([LIVE_URL])
    expect(result.sourcesAttempted).toBe(1)
    expect(result.sourcesFailed).toBe(0)

    const rows = await observationRows(OUTSIDE_SEED_ID)
    expect(rows).toHaveLength(1)
    expect(rows[0].source_kind).toBe('live_crawl')
    expect(rows[0].source_url).toBe(LIVE_URL)
    expect(rows[0].fetch_error_reason).toBeNull()
    /**
     * ADR-0012: the quote offsets and `content_hash` are measured against OUR normalisation of
     * OUR bytes. If this text ever came from a model summarising the page instead, I-2 would have
     * nothing left to check a quote against.
     */
    expect(rows[0].raw_content).toContain('Series B')
    expect(extractor.calls).toBe(1)
    expect(await claimCount(OUTSIDE_SEED_ID)).toBe(1)
  })

  it('3 · I-3 still holds per URL on the live path — a second read costs nothing', async () => {
    const { source } = countingCrawler({ ok: true, html: LIVE_PAGE, finalUrl: LIVE_URL })
    const extractor = new CountingExtractor()
    const service = buildService(source, extractor)

    await service.ingest(OUTSIDE_SEED_ID, 'before', 'manual_ingest')
    const second = await service.ingest(OUTSIDE_SEED_ID, 'before', 'manual_ingest')

    expect(second.unchanged).toBe(true)
    expect(await observationRows(OUTSIDE_SEED_ID)).toHaveLength(1)
    // Unchanged means the LLM is not paid for a second time, not merely that no row appeared.
    expect(extractor.calls).toBe(1)
  })
})

describe('a read that fails is recorded honestly and produces nothing', () => {
  it.each([
    ['the site refuses robots', 'http_4xx'],
    ['the page needs a browser', 'js_required'],
    ['the host cannot be reached', 'unreachable'],
  ] as const)('4 · %s → fetch_error_reason %s, and ZERO claims', async (_label, reason) => {
    const failing =
      reason === 'js_required'
        ? countingCrawler({
            ok: true,
            html: '<html><body><div id="root"></div><script>render()</script></body></html>',
            finalUrl: LIVE_URL,
          })
        : countingCrawler({ ok: false, reason })
    const extractor = new CountingExtractor()
    const service = buildService(failing.source, extractor)

    const result = await service.ingest(OUTSIDE_SEED_ID, 'before', 'manual_ingest')

    expect(result.fetchStatus).toBe('failed')
    expect(result.sourcesFailed).toBe(1)

    const rows = await observationRows(OUTSIDE_SEED_ID)
    expect(rows).toHaveLength(1)
    expect(rows[0].fetch_status).toBe('failed')
    expect(rows[0].source_kind).toBe('live_crawl')
    // The whole reason the column exists: nine ways to fail, nine different sentences on screen.
    expect(rows[0].fetch_error_reason).toBe(reason)
    /**
     * Rule 4, at the only place it can be enforced. A page that could not be read says NOTHING
     * about the company, and a single invented finding here would be worse than the blank row.
     */
    expect(await claimCount(OUTSIDE_SEED_ID)).toBe(0)
    expect(extractor.calls).toBe(0)
  })

  it('5 · a company with no website on file → invalid_url, and nothing is fetched', async () => {
    await owner.query('UPDATE companies SET website = NULL WHERE id = $1', [OUTSIDE_SEED_ID])
    const { source, urls } = countingCrawler({ ok: true, html: LIVE_PAGE, finalUrl: LIVE_URL })
    const service = buildService(source, new CountingExtractor())

    const result = await service.ingest(OUTSIDE_SEED_ID, 'before', 'manual_ingest')

    expect(result.fetchStatus).toBe('failed')
    const rows = await observationRows(OUTSIDE_SEED_ID)
    /**
     * A row, not a silent skip. "This company has no address on file" is a fact about the source
     * and it belongs on the read zone, where somebody can act on it — an empty list would leave
     * the screen looking as though the button had done nothing at all.
     */
    expect(rows).toHaveLength(1)
    expect(rows[0].fetch_error_reason).toBe('invalid_url')
    expect(urls).toHaveLength(0)
  })

  it('6 · two failed reads in a row are two rows — an outage stays visible', async () => {
    const { source } = countingCrawler({ ok: false, reason: 'unreachable' })
    const service = buildService(source, new CountingExtractor())

    await service.ingest(OUTSIDE_SEED_ID, 'before', 'manual_ingest')
    await service.ingest(OUTSIDE_SEED_ID, 'before', 'manual_ingest')

    // I-3 does not apply to failures: collapsing them would hide a week-long outage behind
    // "đã đọc, không đổi".
    expect(await observationRows(OUTSIDE_SEED_ID)).toHaveLength(2)
  })
})

describe('the per-company switch is what opens the path, not the environment variable', () => {
  it('7 · switch off → the stored snapshot is read and the crawler is never called', async () => {
    await owner.query('UPDATE companies SET live_source_enabled = false WHERE id = $1', [
      OUTSIDE_SEED_ID,
    ])
    const { source, urls } = countingCrawler({ ok: true, html: LIVE_PAGE, finalUrl: LIVE_URL })
    const service = buildService(source, new CountingExtractor())

    const result = await service.ingest(OUTSIDE_SEED_ID, 'before', 'manual_ingest')

    /**
     * This company has no stored snapshot — it is not one of the five — so the snapshot path
     * correctly reports a failed read. That is the SAFE outcome: an unopted company falls back to
     * a source that has nothing for it, never to the open internet.
     */
    expect(result.fetchStatus).toBe('failed')
    const rows = await observationRows(OUTSIDE_SEED_ID)
    expect(rows[0].source_kind).toBe('demo_snapshot')
    expect(urls).toHaveLength(0)
  })

  it('8 · OBSERVATION_SOURCE unset → the switch alone changes nothing (I-17)', async () => {
    delete process.env.OBSERVATION_SOURCE
    const { source, urls } = countingCrawler({ ok: true, html: LIVE_PAGE, finalUrl: LIVE_URL })
    const service = buildService(source, new CountingExtractor())

    await service.ingest(OUTSIDE_SEED_ID, 'before', 'manual_ingest')

    const rows = await observationRows(OUTSIDE_SEED_ID)
    expect(rows[0].source_kind).toBe('demo_snapshot')
    expect(urls).toHaveLength(0)
  })
})

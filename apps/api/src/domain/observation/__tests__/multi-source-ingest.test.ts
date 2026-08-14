import { Pool } from 'pg'
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { ClaimDraft, ClaimExtractor, ObservationInput } from '@crm/contracts'
import { createConnection, resetTestDatabase } from '@crm/db'

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
 * Several sources per company — the shape phase 2 built the loop for and could not exercise,
 * because its URL list always had exactly one element.
 *
 * Two things are measured here and nowhere else:
 *
 *   · ONE BAD SOURCE COSTS ONLY ITSELF. A company whose news page is down still has a press page
 *     worth reading; an implementation that abandons the loop on the first failure loses the
 *     others silently, and the read still reports a result.
 *   · WHICH LIST WINS. Two places now answer "where do we read" — `company_sources` and
 *     `companies.website` — which is the price of keeping the phase-2 behaviour working
 *     (decision V4). A second source of truth is only safe while the precedence is pinned, so it
 *     is pinned here.
 */

const SALES_ID = '11111111-1111-4111-8111-111111111111'
const COMPANY_ID = 'eeeeeeee-0011-4000-8000-000000000011'

const SITE = 'https://da-nguon.example.com/trang-chu'
const NEWS = 'https://baochi.example.com/bai-viet'
const SOCIAL = 'https://mang-xa-hoi.example.com/cong-ty'
const WEBSITE_FALLBACK = 'https://da-nguon.example.com'

const QUOTE = 'Công ty vừa hoàn tất vòng Series B huy động 20 triệu USD.'
const PAGE = `<html><body><p>${QUOTE}</p></body></html>`

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
    if (!observation.rawContent.includes(QUOTE)) return []
    return [
      {
        statement: 'Công ty vừa gọi vốn vòng Series B',
        signalType: 'funding',
        confidence: 'certain',
        quoteText: QUOTE,
      },
    ]
  }
}

/** A crawler whose answer depends on the URL, so per-source outcomes can differ in one read. */
function crawlerFor(pages: Record<string, FetchPageResult>): {
  source: LiveCrawlSource
  urls: string[]
} {
  const urls: string[] = []
  const fetchPage = (async (url: string) => {
    urls.push(url)
    return pages[url] ?? { ok: false, reason: 'unreachable' }
  }) as unknown as FetchPage

  return { source: new LiveCrawlSource({ fetchPage, assertAllowed: () => {} }), urls }
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

async function addSource(url: string, sourceTier: string): Promise<void> {
  await owner.query(
    `INSERT INTO company_sources (company_id, url, source_tier, discovered_via, added_by)
     VALUES ($1, $2, $3, 'web_search', $4)`,
    [COMPANY_ID, url, sourceTier, SALES_ID],
  )
}

async function observationRows() {
  const { rows } = await owner.query(
    `SELECT source_url, source_tier, fetch_status, fetch_error_reason
     FROM observations WHERE company_id = $1 ORDER BY source_url`,
    [COMPANY_ID],
  )
  return rows
}

async function claimCount(): Promise<number> {
  const { rows } = await owner.query('SELECT count(*) FROM claims WHERE company_id = $1', [
    COMPANY_ID,
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
  await owner.query(
    `INSERT INTO companies (id, name, industry, company_type, owner_id, is_watched, website, live_source_enabled)
     VALUES ($1, 'Công ty đa nguồn', 'ITO', 'it_solution', $2, false, $3, true)`,
    [COMPANY_ID, SALES_ID, WEBSITE_FALLBACK],
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

describe('every saved source becomes its own observation', () => {
  it('1 · three sources of three tiers → three rows, each keeping its own tier', async () => {
    await addSource(SITE, 'company_website')
    await addSource(NEWS, 'news')
    await addSource(SOCIAL, 'social')

    const { source, urls } = crawlerFor({
      [SITE]: { ok: true, html: PAGE, finalUrl: SITE },
      [NEWS]: { ok: true, html: PAGE, finalUrl: NEWS },
      [SOCIAL]: { ok: true, html: PAGE, finalUrl: SOCIAL },
    })
    const result = await buildService(source, new CountingExtractor()).ingest(
      COMPANY_ID,
      'before',
      'manual_ingest',
    )

    expect(urls).toHaveLength(3)
    expect(result.sourcesAttempted).toBe(3)
    expect(result.sourcesFailed).toBe(0)

    const rows = await observationRows()
    expect(rows).toHaveLength(3)
    /**
     * The tier travels from the saved row onto the observation rather than being re-guessed. It
     * is what lets the read zone tell a company's own page from a social post at a glance, which
     * is rule 2 applied to the source.
     */
    expect(new Map(rows.map((row) => [row.source_url, row.source_tier]))).toEqual(
      new Map([
        [SITE, 'company_website'],
        [NEWS, 'news'],
        [SOCIAL, 'social'],
      ]),
    )
  })
})

describe('one broken source costs only itself', () => {
  it('2 · two read, one fails → two ok rows, one failed row, and findings from the two', async () => {
    await addSource(SITE, 'company_website')
    await addSource(NEWS, 'news')
    await addSource(SOCIAL, 'social')

    const { source } = crawlerFor({
      [SITE]: { ok: true, html: PAGE, finalUrl: SITE },
      [NEWS]: { ok: false, reason: 'http_4xx' },
      [SOCIAL]: { ok: true, html: PAGE, finalUrl: SOCIAL },
    })
    const extractor = new CountingExtractor()
    const result = await buildService(source, extractor).ingest(COMPANY_ID, 'before', 'manual_ingest')

    expect(result.sourcesAttempted).toBe(3)
    expect(result.sourcesFailed).toBe(1)
    // Not `failed`: one page answering is still an answer, and rounding this to a failure would
    // tell Sales the read produced nothing when it produced two thirds of it.
    expect(result.fetchStatus).toBe('ok')

    const rows = await observationRows()
    expect(rows.filter((row) => row.fetch_status === 'ok')).toHaveLength(2)

    const failed = rows.find((row) => row.fetch_status === 'failed')
    expect(failed?.source_url).toBe(NEWS)
    // A social page that blocks readers is information about that source — recorded, named, and
    // NOT allowed to erase what the other two said.
    expect(failed?.fetch_error_reason).toBe('http_4xx')
    expect(extractor.calls).toBe(2)
    expect(await claimCount()).toBe(2)
  })

  it('3 · every source failing is still one row each, never a collapsed single failure', async () => {
    await addSource(SITE, 'company_website')
    await addSource(NEWS, 'news')

    const { source } = crawlerFor({
      [SITE]: { ok: false, reason: 'timeout' },
      [NEWS]: { ok: false, reason: 'js_required' },
    })
    const result = await buildService(source, new CountingExtractor()).ingest(
      COMPANY_ID,
      'before',
      'manual_ingest',
    )

    expect(result.fetchStatus).toBe('failed')
    expect(result.sourcesFailed).toBe(2)
    const rows = await observationRows()
    // Two different diagnoses, kept apart. "Không đọc được" for both would throw away the one
    // distinction the reason column exists to make.
    expect(rows.map((row) => row.fetch_error_reason).sort()).toEqual(['js_required', 'timeout'])
    expect(await claimCount()).toBe(0)
  })
})

describe('which list decides where to read (V4)', () => {
  it('4 · with saved sources, `companies.website` is not read at all', async () => {
    await addSource(NEWS, 'news')

    const { source, urls } = crawlerFor({ [NEWS]: { ok: true, html: PAGE, finalUrl: NEWS } })
    await buildService(source, new CountingExtractor()).ingest(COMPANY_ID, 'before', 'manual_ingest')

    /**
     * The precedence, pinned. Reading both lists would double every read of a company that has
     * saved sources AND a website — the common case — and the second copy would look like new
     * content on a different URL rather than a duplicate.
     */
    expect(urls).toEqual([NEWS])
  })

  it('5 · with no saved sources, the website is still read (phase 2 behaviour intact)', async () => {
    const { source, urls } = crawlerFor({
      [WEBSITE_FALLBACK]: { ok: true, html: PAGE, finalUrl: WEBSITE_FALLBACK },
    })
    await buildService(source, new CountingExtractor()).ingest(COMPANY_ID, 'before', 'manual_ingest')

    // The fall-back is what lets someone switch a company on and press read, without being made
    // to run a source search first.
    expect(urls).toEqual([WEBSITE_FALLBACK])
  })

  it('6 · with neither, the read is recorded as invalid_url rather than skipped', async () => {
    await owner.query('UPDATE companies SET website = NULL WHERE id = $1', [COMPANY_ID])
    const { source, urls } = crawlerFor({})

    const result = await buildService(source, new CountingExtractor()).ingest(
      COMPANY_ID,
      'before',
      'manual_ingest',
    )

    expect(urls).toHaveLength(0)
    expect(result.fetchStatus).toBe('failed')
    const rows = await observationRows()
    expect(rows).toHaveLength(1)
    expect(rows[0].fetch_error_reason).toBe('invalid_url')
  })
})

describe('I-3 stays per URL when there are several', () => {
  it('7 · reading twice with nothing changed costs no rows and no LLM calls', async () => {
    await addSource(SITE, 'company_website')
    await addSource(NEWS, 'news')

    const pages = {
      [SITE]: { ok: true as const, html: PAGE, finalUrl: SITE },
      [NEWS]: { ok: true as const, html: PAGE, finalUrl: NEWS },
    }
    const extractor = new CountingExtractor()
    const service = buildService(crawlerFor(pages).source, extractor)

    await service.ingest(COMPANY_ID, 'before', 'manual_ingest')
    const second = await service.ingest(COMPANY_ID, 'before', 'manual_ingest')

    /**
     * Identical HTML on two different URLs, so the two rows share a `content_hash`. Comparing per
     * company instead of per URL would call the second source "unchanged" on the first read and
     * never store it at all.
     */
    expect(second.unchanged).toBe(true)
    expect(await observationRows()).toHaveLength(2)
    expect(extractor.calls).toBe(2)
  })
})

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
 * Turning a source off has to stop it being FETCHED, not merely stop it being displayed — and this
 * file is where that is a measurement rather than an intention (ADR-0037).
 *
 * The guarantee it protects does not live in this code at all: `crm_system` lost `SELECT` on
 * `company_sources` and reads `company_sources_enabled` instead, so a reader that forgot to filter
 * gets `permission denied` rather than a page somebody had just switched off. That is measured
 * next door, in `live-source-columns-and-grants.test.ts`. What is measured HERE is the other half —
 * that the product, going through the real service, actually reads one fewer page.
 *
 * The second case is the one worth keeping: switching every source off must fall back to
 * `companies.website`, not to "this company has no sources". "Off" is a statement about one page,
 * never an instruction to stop reading the company.
 */

const SALES_ID = '11111111-1111-4111-8111-111111111111'
const COMPANY_ID = 'eeeeeeee-0012-4000-8000-000000000012'

const NEWS = 'https://baochi.example.com/bai-viet'
const PRESS = 'https://thong-cao.example.com/bai'
const WEBSITE_FALLBACK = 'https://cong-tac.example.com'

const QUOTE = 'Công ty vừa mở thêm một trung tâm phát triển tại Đà Nẵng.'
const PAGE = `<html><body><p>${QUOTE}</p></body></html>`

const owner = new Pool({ connectionString: process.env.DATABASE_URL_TEST })
const appConnection = createConnection(process.env.DATABASE_URL_TEST_APP as string)
const systemConnection = createConnection(process.env.DATABASE_URL_TEST_SYSTEM as string)

const settings = new SystemSettingService(
  appConnection.db,
  systemConnection.db,
  new AuditEventService(appConnection.db, systemConnection.db),
)

class SingleClaimExtractor implements ClaimExtractor {
  async extract(observation: ObservationInput): Promise<ClaimDraft[]> {
    if (!observation.rawContent.includes(QUOTE)) return []
    return [
      {
        statement: 'Công ty mở trung tâm phát triển mới',
        signalType: 'expansion',
        confidence: 'likely',
        quoteText: QUOTE,
      },
    ]
  }
}

/** Records every URL the reader actually asked for — the only way to prove one was skipped. */
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

function buildService(live: LiveCrawlSource): ObservationService {
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
    new SingleClaimExtractor(),
    new ClaimService(systemConnection.db, appConnection.db),
    new DemoSnapshotSource(systemConnection.db),
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

async function disable(url: string): Promise<void> {
  await owner.query('UPDATE company_sources SET enabled = false WHERE company_id = $1 AND url = $2', [
    COMPANY_ID,
    url,
  ])
}

async function observedUrls(): Promise<string[]> {
  const { rows } = await owner.query(
    'SELECT source_url FROM observations WHERE company_id = $1 ORDER BY source_url',
    [COMPANY_ID],
  )
  return rows.map((row) => row.source_url)
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
     VALUES ($1, 'Công ty có công tắc nguồn', 'ITO', 'it_solution', $2, false, $3, true)`,
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

describe('a source switched off is not fetched', () => {
  it('1 · two saved, one off → one page fetched, and it is the one still on', async () => {
    await addSource(NEWS, 'news')
    await addSource(PRESS, 'company_website')
    await disable(PRESS)

    const { source, urls } = crawlerFor({
      [NEWS]: { ok: true, html: PAGE, finalUrl: NEWS },
      [PRESS]: { ok: true, html: PAGE, finalUrl: PRESS },
    })
    const result = await buildService(source).ingest(COMPANY_ID, 'before', 'manual_ingest')

    /**
     * `urls` is the assertion, not the row count. A version that fetched both and then dropped one
     * before storing would leave the same single row here while still having sent a request to a
     * page somebody switched off — and paying for it.
     */
    expect(urls).toEqual([NEWS])
    expect(result.sourcesAttempted).toBe(1)
    expect(await observedUrls()).toEqual([NEWS])
  })

  it('2 · every source off → the website is read, not "no sources at all"', async () => {
    await addSource(NEWS, 'news')
    await addSource(PRESS, 'company_website')
    await disable(NEWS)
    await disable(PRESS)

    const { source, urls } = crawlerFor({
      [WEBSITE_FALLBACK]: { ok: true, html: PAGE, finalUrl: WEBSITE_FALLBACK },
    })
    const result = await buildService(source).ingest(COMPANY_ID, 'before', 'manual_ingest')

    /**
     * The same fall-back as having saved nothing (V4, `multi-source-ingest.test.ts` test 5).
     * Reading nothing instead would make "off" a statement about the company rather than about the
     * page it was applied to, and would leave the screen looking as though nothing was asked for.
     */
    expect(urls).toEqual([WEBSITE_FALLBACK])
    expect(result.fetchStatus).toBe('ok')
    expect(await observedUrls()).toEqual([WEBSITE_FALLBACK])
  })

  it('3 · switching one back on brings it back into the read', async () => {
    await addSource(NEWS, 'news')
    await addSource(PRESS, 'company_website')
    await disable(PRESS)
    await owner.query(
      'UPDATE company_sources SET enabled = true WHERE company_id = $1 AND url = $2',
      [COMPANY_ID, PRESS],
    )

    const { source, urls } = crawlerFor({
      [NEWS]: { ok: true, html: PAGE, finalUrl: NEWS },
      [PRESS]: { ok: true, html: PAGE, finalUrl: PRESS },
    })
    await buildService(source).ingest(COMPANY_ID, 'before', 'manual_ingest')

    // The switch is a switch, not a one-way door: the row keeps its snippet and its `added_by`
    // through both flips, which is the whole reason it is not a DELETE.
    expect(urls.sort()).toEqual([NEWS, PRESS].sort())
  })
})

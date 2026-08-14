import { Pool } from 'pg'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import type { SourceCandidate, SourceDiscovery } from '@crm/contracts'
import { SEED_COMPANIES, createConnection, resetTestDatabase } from '@crm/db'

import { AuditEventService } from '../../../common/audit/audit-event-service'
import { CompanySourceService } from '../company-source-service'
import { SystemSettingService } from '../../../settings/system-setting-service'
import type { Actor } from '../../../common/actor/actor-context'

/**
 * "The AI does not choose the source it then draws conclusions from" — as a test, not a GRANT.
 *
 * `0008_live_source.sql` already withholds INSERT on `company_sources` from `crm_system`, and
 * `live-source-columns-and-grants.test.ts` measures that. This file measures the layer above it:
 * that the DISCOVERY endpoint, whose whole job is to produce URLs, persists none of them. The two
 * are different failures — the grant stops the AI identity from writing, this stops the product
 * from writing on its behalf under `crm_app`, which no grant can catch.
 *
 * Test 1 is the one that matters. Everything else here is ordinary endpoint behaviour.
 */

const SALES_ID = '11111111-1111-4111-8111-111111111111'
const COMPANY_ID = 'eeeeeeee-0009-4000-8000-000000000009'
const SEED_COMPANY = SEED_COMPANIES[0]

const owner = new Pool({ connectionString: process.env.DATABASE_URL_TEST })
const appConnection = createConnection(process.env.DATABASE_URL_TEST_APP as string)
const systemConnection = createConnection(process.env.DATABASE_URL_TEST_SYSTEM as string)

const HUMAN: Actor = { kind: 'human', userId: SALES_ID }
const SYSTEM: Actor = { kind: 'system' }

const CANDIDATES: SourceCandidate[] = [
  {
    url: 'https://thu-nghiem.example.com/tin-tuc',
    sourceTier: 'company_website',
    snippet: 'Trang tin của công ty',
    reason: 'Tên miền khớp với website đang lưu',
  },
  {
    url: 'https://baochi.example.com/bai-viet',
    sourceTier: 'news',
    snippet: 'Bài báo về công ty',
    reason: 'Bài viết nhắc tên công ty',
  },
]

/** Counts calls so "the AI was never asked" is a number rather than an inference. */
class CountingDiscovery implements SourceDiscovery {
  calls = 0

  constructor(private readonly result: SourceCandidate[] = CANDIDATES) {}

  async discover(): Promise<SourceCandidate[]> {
    this.calls += 1
    return this.result
  }
}

function buildService(discovery: SourceDiscovery): CompanySourceService {
  const audit = new AuditEventService(appConnection.db, systemConnection.db)
  return new CompanySourceService(
    appConnection.db,
    discovery,
    new SystemSettingService(appConnection.db, systemConnection.db, audit),
    audit,
  )
}

/**
 * The suggestion list, read as the owner so the assertions are about what was STORED rather than
 * about what a role is allowed to see. What `crm_system` can see here is nothing at all, and that
 * is measured in `live-source-columns-and-grants.test.ts` tests 20 and 21.
 */
async function candidateRows(companyId = COMPANY_ID) {
  const { rows } = await owner.query(
    'SELECT url, source_tier, reason, snippet, found_by FROM company_source_candidates WHERE company_id = $1 ORDER BY found_at, url',
    [companyId],
  )
  return rows
}

async function sourceRows(companyId = COMPANY_ID) {
  const { rows } = await owner.query(
    'SELECT url, source_tier, discovered_via, search_snippet, added_by, enabled FROM company_sources WHERE company_id = $1 ORDER BY created_at',
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
    `INSERT INTO companies (id, name, industry, company_type, owner_id, website)
     VALUES ($1, 'Công ty Thử Nghiệm', 'ITO', 'it_solution', $2, 'https://thu-nghiem.example.com')`,
    [COMPANY_ID, SALES_ID],
  )
  await owner.query(
    `INSERT INTO companies (id, name, industry, company_type, owner_id)
     VALUES ($1, $2, 'Sản xuất', 'traditional', $3)`,
    [SEED_COMPANY.id, SEED_COMPANY.name, SALES_ID],
  )
  await owner.query(
    `INSERT INTO system_settings (key, value) VALUES ('ai_enabled', 'true'), ('watch_cycle_seconds', '60')
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
  )
})

afterAll(async () => {
  await Promise.all([owner.end(), appConnection.close(), systemConnection.close()])
})

describe('finding sources writes the suggestion list and never the reading list', () => {
  it('1 · candidates are stored, and `company_sources` is still empty', async () => {
    const discovery = new CountingDiscovery()
    const found = await buildService(discovery).findCandidates(HUMAN, COMPANY_ID)

    expect(found).toHaveLength(2)
    expect(discovery.calls).toBe(1)
    // Candidates now survive a refresh (ADR-0037) — in their own table, which `crm_system` holds
    // no privilege on whatsoever.
    expect(await candidateRows()).toHaveLength(2)
    /**
     * The assertion this file exists for, and it did NOT change when candidates started being
     * stored. A version that helpfully saved what it found into the READING LIST would return the
     * same list and pass every other test here, while quietly becoming a third self-write path
     * outside the two exceptions Specs opens (CLAUDE.md section 4).
     */
    expect(await sourceRows()).toHaveLength(0)
  })

  it('1b · what was offered is stored with the reason a person decides on', async () => {
    await buildService(new CountingDiscovery()).findCandidates(HUMAN, COMPANY_ID)

    const byUrl = new Map((await candidateRows()).map((row) => [row.url, row]))

    /**
     * Compared BY URL rather than by position, and that is a statement about the data: every row of
     * one search shares a `found_at` (they are inserted in a single transaction), so the stored
     * order is alphabetical rather than the order the model ranked them in. Nothing claims otherwise
     * on screen — six rows each carrying their own reason are read, not ranked — so no `rank` column
     * was added to preserve an order the product does not use.
     */
    // `reason` and `found_by` together are what make the row answerable months later: why this URL
    // was suggested, and who asked for the search that suggested it.
    expect(byUrl.get(CANDIDATES[0].url)?.reason).toBe(CANDIDATES[0].reason)
    expect(byUrl.get(CANDIDATES[0].url)?.snippet).toBe(CANDIDATES[0].snippet)
    expect(byUrl.get(CANDIDATES[0].url)?.found_by).toBe(SALES_ID)
    expect(byUrl.get(CANDIDATES[1].url)?.reason).toBe(CANDIDATES[1].reason)
    expect(byUrl.get(CANDIDATES[1].url)?.source_tier).toBe('news')
  })
})

describe('searching again replaces the suggestions and leaves the reading list alone', () => {
  it('10 · the second search REPLACES the list rather than piling onto it', async () => {
    const service = buildService(new CountingDiscovery())
    await service.findCandidates(HUMAN, COMPANY_ID)
    expect(await candidateRows()).toHaveLength(2)

    const second = buildService(
      new CountingDiscovery([
        {
          url: 'https://khac.example.com/tin',
          sourceTier: 'news',
          snippet: 'Bài mới',
          reason: 'Kết quả của lần tìm sau',
        },
      ]),
    )
    await second.findCandidates(HUMAN, COMPANY_ID)

    /**
     * "This is the result of the latest search" — one meaning, and a list that cannot grow without
     * limit. Accumulating would leave candidates somebody has skipped three times sitting there.
     */
    const rows = await candidateRows()
    expect(rows).toHaveLength(1)
    expect(rows[0].url).toBe('https://khac.example.com/tin')
  })

  it('11 · searching again does not touch a source already kept', async () => {
    const service = buildService(new CountingDiscovery())
    await service.findCandidates(HUMAN, COMPANY_ID)
    await service.save(HUMAN, COMPANY_ID, [
      { url: CANDIDATES[0].url, sourceTier: 'company_website' },
    ])

    await buildService(new CountingDiscovery([CANDIDATES[1]])).findCandidates(HUMAN, COMPANY_ID)

    // Two tables, two meanings: replacing what was OFFERED must never disturb what was KEPT.
    const kept = await sourceRows()
    expect(kept).toHaveLength(1)
    expect(kept[0].url).toBe(CANDIDATES[0].url)
  })

  it('12 · `listCandidates` says which candidates are already in the reading list', async () => {
    const service = buildService(new CountingDiscovery())
    await service.findCandidates(HUMAN, COMPANY_ID)
    const [saved] = await service.save(HUMAN, COMPANY_ID, [
      { url: CANDIDATES[0].url, sourceTier: 'company_website' },
    ])

    const listed = await service.listCandidates(COMPANY_ID)

    /**
     * Derived by joining on the URL, not stored as a second flag. One source of truth for "which
     * pages do we read" means there is no pair of columns that can fall out of step.
     */
    expect(listed.find((row) => row.url === CANDIDATES[0].url)?.savedSourceId).toBe(saved.id)
    expect(listed.find((row) => row.url === CANDIDATES[1].url)?.savedSourceId).toBeNull()
  })

  it('13 · a candidate can be removed, and the others stay', async () => {
    const service = buildService(new CountingDiscovery())
    await service.findCandidates(HUMAN, COMPANY_ID)
    const listed = await service.listCandidates(COMPANY_ID)

    await service.removeCandidate(HUMAN, COMPANY_ID, listed[0].id)

    const rows = await candidateRows()
    expect(rows).toHaveLength(1)
    expect(rows[0].url).toBe(listed[1].url)
  })
})

describe('the gates hold on every route that writes', () => {
  it('14 · the AI identity cannot make the machine fill its own suggestion list', async () => {
    const discovery = new CountingDiscovery()
    const service = buildService(discovery)

    await expect(service.findCandidates(SYSTEM, COMPANY_ID)).rejects.toThrow()

    /**
     * Refused BEFORE the search runs, and nothing stored. A suggestion list the machine filled by
     * itself is a nudge, and an absolute boundary has to hold when the command does not come from
     * the UI (T-10) — the two-step is only worth something if the first step is human too.
     */
    expect(discovery.calls).toBe(0)
    expect(await candidateRows()).toHaveLength(0)
  })

  it('15 · the AI identity can neither remove a candidate nor flip a source switch', async () => {
    const service = buildService(new CountingDiscovery())
    await service.findCandidates(HUMAN, COMPANY_ID)
    const [candidate] = await service.listCandidates(COMPANY_ID)
    const [saved] = await service.save(HUMAN, COMPANY_ID, [
      { url: CANDIDATES[1].url, sourceTier: 'news' },
    ])

    await expect(service.removeCandidate(SYSTEM, COMPANY_ID, candidate.id)).rejects.toThrow()
    // Switching a source off is the AI choosing to read LESS, which sounds harmless and is still
    // the AI deciding what evidence it sees. Same refusal, same audit trail.
    await expect(service.setEnabled(SYSTEM, COMPANY_ID, saved.id, false)).rejects.toThrow()

    expect(await candidateRows()).toHaveLength(2)
    const kept = await sourceRows()
    expect(kept[0].enabled).toBe(true)
  })

  it('16 · a person can switch a saved source off and on again', async () => {
    const service = buildService(new CountingDiscovery())
    const [saved] = await service.save(HUMAN, COMPANY_ID, [
      { url: CANDIDATES[0].url, sourceTier: 'company_website', searchSnippet: CANDIDATES[0].snippet },
    ])

    const off = await service.setEnabled(HUMAN, COMPANY_ID, saved.id, false)
    expect(off.enabled).toBe(false)

    /**
     * The reason this is a switch and not a DELETE: the snippet that made somebody pick this page
     * is still on the row after the flip, so turning it back on costs nothing and explains itself.
     */
    expect(off.searchSnippet).toBe(CANDIDATES[0].snippet)
    expect((await service.setEnabled(HUMAN, COMPANY_ID, saved.id, true)).enabled).toBe(true)
  })

  it('17 · a seed company has no candidates rather than an error', async () => {
    /**
     * I-16 still refuses the SEARCH for a seed company (test 7), so this list is permanently empty.
     * Reading it must not throw: "nothing found" and "you may not look" are different answers, and
     * a screen that cannot open at all teaches nobody which one it is.
     */
    expect(await buildService(new CountingDiscovery()).listCandidates(SEED_COMPANY.id)).toEqual([])
  })
})

describe('a person keeping a candidate is what writes the row', () => {
  it('2 · saving records the URL, the tier, the snippet and WHO kept it', async () => {
    await buildService(new CountingDiscovery()).save(HUMAN, COMPANY_ID, [
      { url: CANDIDATES[0].url, sourceTier: 'company_website', searchSnippet: CANDIDATES[0].snippet },
      { url: CANDIDATES[1].url, sourceTier: 'news', searchSnippet: CANDIDATES[1].snippet },
    ])

    const rows = await sourceRows()
    expect(rows).toHaveLength(2)
    expect(rows[0].added_by).toBe(SALES_ID)
    expect(rows[1].source_tier).toBe('news')
    // `web_search` rather than `manual`: months later, "why is the system reading this page"
    // is answerable from the row itself.
    expect(rows[0].discovered_via).toBe('web_search')
    expect(rows[0].search_snippet).toBe(CANDIDATES[0].snippet)
  })

  it('3 · the AI identity cannot save a source', async () => {
    const service = buildService(new CountingDiscovery())

    await expect(
      service.save(SYSTEM, COMPANY_ID, [{ url: CANDIDATES[0].url, sourceTier: 'news' }]),
    ).rejects.toThrow()

    expect(await sourceRows()).toHaveLength(0)
  })

  it('4 · the same URL twice is refused rather than duplicated', async () => {
    const service = buildService(new CountingDiscovery())
    await service.save(HUMAN, COMPANY_ID, [{ url: CANDIDATES[0].url, sourceTier: 'company_website' }])

    await expect(
      service.save(HUMAN, COMPANY_ID, [{ url: CANDIDATES[0].url, sourceTier: 'news' }]),
    ).rejects.toThrow()

    expect(await sourceRows()).toHaveLength(1)
  })

  it('5 · the list is capped, so one read can never fan out without limit', async () => {
    const service = buildService(new CountingDiscovery())
    const six = Array.from({ length: 6 }, (_, index) => ({
      url: `https://baochi.example.com/bai-${index}`,
      sourceTier: 'news' as const,
    }))

    /**
     * Every saved URL is a fetch and an LLM call on every read. The cap is what keeps "read
     * sources" a bounded operation rather than one whose cost a user sets by accident.
     */
    await expect(service.save(HUMAN, COMPANY_ID, six)).rejects.toThrow()
    expect(await sourceRows()).toHaveLength(0)
  })

  it('6 · a saved source can be removed again', async () => {
    const service = buildService(new CountingDiscovery())
    const [saved] = await service.save(HUMAN, COMPANY_ID, [
      { url: CANDIDATES[0].url, sourceTier: 'company_website' },
    ])

    await service.remove(HUMAN, COMPANY_ID, saved.id)

    expect(await sourceRows()).toHaveLength(0)
  })
})

describe('the gates that hold for reading hold for searching too', () => {
  it('7 · a seed company is refused, and the search is never run', async () => {
    const discovery = new CountingDiscovery()

    await expect(buildService(discovery).findCandidates(HUMAN, SEED_COMPANY.id)).rejects.toThrow()

    /**
     * I-16 covers the whole live path, not only the fetch. Running a paid search for a company
     * that can never be crawled would spend money to produce a list nothing may read.
     */
    expect(discovery.calls).toBe(0)
  })

  it('8 · the AI kill switch stops the search (T-9)', async () => {
    await owner.query(`UPDATE system_settings SET value = 'false' WHERE key = 'ai_enabled'`)
    const discovery = new CountingDiscovery()

    const found = await buildService(discovery).findCandidates(HUMAN, COMPANY_ID)

    // ADR-0009: the switch stops every generation path, and asking a model to search the web is
    // one of them. Empty and quiet, not an exception.
    expect(found).toEqual([])
    expect(discovery.calls).toBe(0)
  })

  it('9 · a search that finds nothing is a valid answer, not an error', async () => {
    const discovery = new CountingDiscovery([])

    expect(await buildService(discovery).findCandidates(HUMAN, COMPANY_ID)).toEqual([])
  })
})

import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { resetTestDatabase } from '../testing/reset-test-database'

/**
 * The DATABASE layer of the live-source switch (ADR-0035). Nothing here goes through a service,
 * on purpose: these are the guarantees that must hold against a caller who bypasses the domain
 * entirely, and that is the only kind of guarantee I-16 and the zone boundaries are worth
 * anything as.
 *
 * Four things are proven, and the third is the one the whole feature rests on:
 *
 *   1. `source_kind` defaults to `demo_snapshot`, so every row written by code that predates
 *      this migration keeps meaning what it meant.
 *   2. `fetch_error_reason` is a CLOSED list AND is pinned to a failed read — a reason on a
 *      successful read is a contradiction the table refuses to store.
 *   3. `crm_system` can read `company_sources` and can NEVER write it. The AI does not choose
 *      the source it then draws conclusions from — the same guarantee `snapshot_variant` has
 *      (`companies.ts:39`), extended to the new table.
 *   4. `crm_system` can read `live_source_enabled` and can never set it, so the AI cannot turn
 *      on its own uncontrolled source.
 */

const USER_ID = '11111111-1111-4111-8111-111111111111'
const COMPANY_ID = 'eeeeeeee-0001-4000-8000-000000000001'

let owner: Pool
let app: Pool
let system: Pool

beforeAll(async () => {
  owner = new Pool({ connectionString: process.env.DATABASE_URL_TEST })
  app = new Pool({ connectionString: process.env.DATABASE_URL_TEST_APP })
  system = new Pool({ connectionString: process.env.DATABASE_URL_TEST_SYSTEM })

  await resetTestDatabase(owner)
  await owner.query(
    `INSERT INTO users (id, email, password_hash, name, role)
     VALUES ($1, 'sales@test.local', 'x', 'Sales', 'sales')`,
    [USER_ID],
  )
  await owner.query(
    `INSERT INTO companies (id, name, industry, company_type, owner_id)
     VALUES ($1, 'Công ty ngoài bộ seed', 'ITO', 'it_solution', $2)`,
    [COMPANY_ID, USER_ID],
  )
})

afterAll(async () => {
  await Promise.all([owner?.end(), app?.end(), system?.end()])
})

function insertObservation(
  extraColumns: string,
  extraValues: string,
  parameters: unknown[],
): Promise<unknown> {
  return owner.query(
    `INSERT INTO observations
       (company_id, source_url, raw_content, content_hash, extractor_version, fetch_status
        ${extraColumns})
     VALUES ($1, 'https://example.test/news', 'nội dung', $2, 'test', $3 ${extraValues})`,
    parameters,
  )
}

describe('observations.source_kind — the safe value is the default value', () => {
  it('1 · a row written without naming source_kind comes out `demo_snapshot`', async () => {
    await insertObservation('', '', [COMPANY_ID, 'hash-default-source-kind', 'ok'])

    const { rows } = await owner.query(
      `SELECT source_kind FROM observations WHERE content_hash = 'hash-default-source-kind'`,
    )
    // Every insert in the codebase predates this column. The DEFAULT is what keeps their
    // meaning intact instead of leaving a NULL that reads as "nobody knows where this came from".
    expect(rows[0].source_kind).toBe('demo_snapshot')
  })

  it('2 · `live_crawl` is accepted', async () => {
    await expect(
      insertObservation(', source_kind', `, 'live_crawl'`, [
        COMPANY_ID,
        'hash-live-crawl',
        'ok',
      ]),
    ).resolves.toBeTruthy()
  })

  it('3 · a third source kind is refused by the CHECK, whoever writes it', async () => {
    await expect(
      insertObservation(', source_kind', `, 'rss_feed'`, [COMPANY_ID, 'hash-bogus-kind', 'ok']),
    ).rejects.toThrow(/observations_source_kind_check/i)
  })
})

describe('observations.fetch_error_reason — a closed list, pinned to a failed read', () => {
  it('4 · NULL on a successful read is the normal case', async () => {
    await expect(
      insertObservation('', '', [COMPANY_ID, 'hash-ok-no-reason', 'ok']),
    ).resolves.toBeTruthy()
  })

  it('5 · a reason on a SUCCESSFUL read is refused — that pair is a contradiction', async () => {
    // Without this half of the CHECK, "đọc được nhưng vì sao lỗi = timeout" is storable, and
    // the dashboard that counts failure reasons would count reads that worked.
    await expect(
      insertObservation(', fetch_error_reason', `, 'timeout'`, [
        COMPANY_ID,
        'hash-ok-with-reason',
        'ok',
      ]),
    ).rejects.toThrow(/observations_fetch_error_reason_check/i)
  })

  it('6 · a legal reason on a failed read is accepted', async () => {
    await expect(
      insertObservation(', fetch_error_reason', `, 'js_required'`, [
        COMPANY_ID,
        'hash-failed-js',
        'failed',
      ]),
    ).resolves.toBeTruthy()
  })

  it('7 · an invented reason is refused even on a failed read', async () => {
    // Free text here means every consumer has to guess the vocabulary, and the Vietnamese label
    // shown to Sales silently falls through to nothing.
    await expect(
      insertObservation(', fetch_error_reason', `, 'captcha_wall'`, [
        COMPANY_ID,
        'hash-failed-bogus',
        'failed',
      ]),
    ).rejects.toThrow(/observations_fetch_error_reason_check/i)
  })

  it('8 · all nine documented reasons are storable', async () => {
    const reasons = [
      'timeout',
      'http_4xx',
      'http_5xx',
      'redirect_loop',
      'js_required',
      'not_html',
      'too_large',
      'blocked_url',
      'invalid_url',
    ]

    for (const [index, reason] of reasons.entries()) {
      await expect(
        insertObservation(', fetch_error_reason', `, '${reason}'`, [
          COMPANY_ID,
          `hash-reason-${index}`,
          'failed',
        ]),
      ).resolves.toBeTruthy()
    }
  })
})

describe('companies.live_source_enabled — the AI cannot turn on its own source', () => {
  it('9 · a fresh company has it off without anyone setting it', async () => {
    const { rows } = await owner.query(
      'SELECT live_source_enabled FROM companies WHERE id = $1',
      [COMPANY_ID],
    )
    // I-17: the safe branch is the default branch, at the column level too. Reseeding (I-14)
    // therefore puts every company back to "off" with no clean-up code involved.
    expect(rows[0].live_source_enabled).toBe(false)
  })

  it('10 · crm_system UPDATE is refused — it holds no UPDATE on companies at all', async () => {
    await expect(
      system.query('UPDATE companies SET live_source_enabled = true WHERE id = $1', [COMPANY_ID]),
    ).rejects.toThrow(/permission denied/i)
  })

  it('11 · crm_system can still READ it — the read path has to know which source to use', async () => {
    const { rows } = await system.query(
      'SELECT live_source_enabled FROM companies WHERE id = $1',
      [COMPANY_ID],
    )
    expect(rows[0].live_source_enabled).toBe(false)
  })

  it('12 · crm_app can set it, for free, from the table-level GRANT', async () => {
    await app.query('UPDATE companies SET live_source_enabled = true WHERE id = $1', [COMPANY_ID])

    const { rows } = await owner.query(
      'SELECT live_source_enabled FROM companies WHERE id = $1',
      [COMPANY_ID],
    )
    expect(rows[0].live_source_enabled).toBe(true)
  })
})

describe('company_sources — the read list is human-owned, and the grant says so', () => {
  it('13 · crm_app can add a source', async () => {
    await expect(
      app.query(
        `INSERT INTO company_sources (company_id, url, source_tier, discovered_via, added_by)
         VALUES ($1, 'https://example.test/press', 'news', 'web_search', $2)`,
        [COMPANY_ID, USER_ID],
      ),
    ).resolves.toBeTruthy()
  })

  it('14 · crm_system INSERT is refused — the AI does not choose the source it reads', async () => {
    // THE load-bearing assertion of this file. "Find sources and save them yourself" would be a
    // third write path outside the two exceptions Specs opens (CLAUDE.md section 4), and the
    // whole candidate-then-human-click design exists to avoid it. Enforced here, not in a doc.
    await expect(
      system.query(
        `INSERT INTO company_sources (company_id, url, discovered_via)
         VALUES ($1, 'https://example.test/ai-picked-this', 'web_search')`,
        [COMPANY_ID],
      ),
    ).rejects.toThrow(/permission denied/i)
  })

  it('15 · crm_system can READ the list — the crawler has to know what to fetch', async () => {
    const { rows } = await system.query(
      'SELECT url, source_tier FROM company_sources WHERE company_id = $1',
      [COMPANY_ID],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].source_tier).toBe('news')
  })

  it('16 · crm_system cannot UPDATE or DELETE the list either', async () => {
    await expect(
      system.query(`UPDATE company_sources SET url = 'https://elsewhere.test'`),
    ).rejects.toThrow(/permission denied/i)
    await expect(system.query('DELETE FROM company_sources')).rejects.toThrow(/permission denied/i)
  })

  it('17 · the same URL cannot be added twice to one company', async () => {
    await expect(
      app.query(
        `INSERT INTO company_sources (company_id, url, discovered_via)
         VALUES ($1, 'https://example.test/press', 'manual')`,
        [COMPANY_ID],
      ),
    ).rejects.toThrow(/company_sources_company_id_url_unique|duplicate key/i)
  })

  it('18 · an invented source tier is refused', async () => {
    await expect(
      app.query(
        `INSERT INTO company_sources (company_id, url, source_tier, discovered_via)
         VALUES ($1, 'https://example.test/tier', 'podcast', 'manual')`,
        [COMPANY_ID],
      ),
    ).rejects.toThrow(/company_sources_source_tier_check/i)
  })
})

describe('company_source_candidates — the AI cannot see its own suggestion list', () => {
  it('19 · crm_app can add a candidate', async () => {
    await expect(
      app.query(
        `INSERT INTO company_source_candidates (company_id, url, source_tier, reason, snippet, found_by)
         VALUES ($1, 'https://example.test/candidate', 'news', 'Bài viết nhắc tên công ty', 'Trích đoạn', $2)`,
        [COMPANY_ID, USER_ID],
      ),
    ).resolves.toBeTruthy()
  })

  it('20 · crm_system SELECT is refused — a suggestion list is nothing the crawler acts on', async () => {
    /**
     * The difference from test 15 stated as a privilege. `company_sources` answers "which pages
     * do I fetch", which the crawler genuinely has to know. This table answers "which pages might
     * someone tick later", and a reader that consulted it would be reading a page nobody kept.
     * Granting SELECT here for symmetry would collapse the two-step into one.
     */
    await expect(
      system.query('SELECT url FROM company_source_candidates'),
    ).rejects.toThrow(/permission denied/i)
  })

  it('21 · crm_system INSERT, UPDATE and DELETE are all refused', async () => {
    // Nothing granted means all four refused, and all four are asserted rather than sampled:
    // the guarantee is "no privilege on this table", not "no INSERT".
    await expect(
      system.query(
        `INSERT INTO company_source_candidates (company_id, url, reason)
         VALUES ($1, 'https://example.test/ai-suggested-itself', 'vì AI muốn')`,
        [COMPANY_ID],
      ),
    ).rejects.toThrow(/permission denied/i)
    await expect(
      system.query(`UPDATE company_source_candidates SET url = 'https://elsewhere.test'`),
    ).rejects.toThrow(/permission denied/i)
    await expect(system.query('DELETE FROM company_source_candidates')).rejects.toThrow(
      /permission denied/i,
    )
  })

  it('22 · the same URL cannot be suggested twice for one company', async () => {
    // A second search returning a URL already on the list must not double the row a person reads.
    await expect(
      app.query(
        `INSERT INTO company_source_candidates (company_id, url, reason)
         VALUES ($1, 'https://example.test/candidate', 'lý do khác')`,
        [COMPANY_ID],
      ),
    ).rejects.toThrow(/company_source_candidates_company_id_url_unique|duplicate key/i)
  })

  it('23 · a candidate with no reason is refused — the reason is what a person decides on', async () => {
    // Rule 4 where it costs the most: a row offered for a decision, carrying no grounds for it.
    await expect(
      app.query(
        `INSERT INTO company_source_candidates (company_id, url)
         VALUES ($1, 'https://example.test/no-reason')`,
        [COMPANY_ID],
      ),
    ).rejects.toThrow(/reason/i)
  })
})

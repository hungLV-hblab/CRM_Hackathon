import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { resetTestDatabase } from '../testing/reset-test-database'

/**
 * `snapshot_pages` — the stored content `crm_system` reads to interpret a company's pages
 * (migration 0013). `crm_app`/`crm_owner` write it (the import path); `crm_system` gets SELECT
 * and nothing else, same reasoning as `company_sources`: the AI reads what content is
 * available, it never adds or edits a page — writing its own source would let it choose the
 * evidence it then reports on.
 */

const USER_ID = '11111111-1111-4111-8111-111111111111'
const COMPANY_ID = 'eeeeeeee-0002-4000-8000-000000000001'

let owner: Pool
let app: Pool
let system: Pool

beforeAll(async () => {
  owner = new Pool({ connectionString: process.env.DATABASE_URL_TEST })
  app = new Pool({ connectionString: process.env.DATABASE_URL_TEST_APP })
  system = new Pool({ connectionString: process.env.DATABASE_URL_TEST_SYSTEM })

  await resetTestDatabase(owner)
  await owner.query(
    `INSERT INTO users (id, email, password_hash, name, role) VALUES ($1, 'sales@test.local', 'x', 'Sales', 'sales')`,
    [USER_ID],
  )
  await owner.query(
    `INSERT INTO companies (id, name, industry, company_type, owner_id) VALUES ($1, 'Công ty test snapshot_pages', 'ITO', 'it_solution', $2)`,
    [COMPANY_ID, USER_ID],
  )
})

afterAll(async () => {
  await Promise.all([owner?.end(), app?.end(), system?.end()])
})

describe('snapshot_pages — nội dung AI đọc, không bao giờ AI ghi', () => {
  it('1 · crm_app thêm được một trang', async () => {
    await expect(
      app.query(
        `INSERT INTO snapshot_pages (company_id, page_slug, source_url, before_html, after_html)
         VALUES ($1, 'homepage', 'https://example.test', '<p>trước</p>', '<p>sau</p>')`,
        [COMPANY_ID],
      ),
    ).resolves.toBeTruthy()
  })

  it('2 · crm_system đọc được', async () => {
    const { rows } = await system.query('SELECT page_slug FROM snapshot_pages WHERE company_id = $1', [
      COMPANY_ID,
    ])
    expect(rows.length).toBeGreaterThan(0)
  })

  it('3 · crm_system INSERT bị từ chối', async () => {
    await expect(
      system.query(
        `INSERT INTO snapshot_pages (company_id, page_slug) VALUES ($1, 'news')`,
        [COMPANY_ID],
      ),
    ).rejects.toThrow(/permission denied/i)
  })

  it('4 · crm_system UPDATE bị từ chối', async () => {
    await expect(
      system.query(`UPDATE snapshot_pages SET after_html = 'x' WHERE company_id = $1`, [COMPANY_ID]),
    ).rejects.toThrow(/permission denied/i)
  })

  it('5 · crm_system DELETE bị từ chối', async () => {
    await expect(
      system.query('DELETE FROM snapshot_pages WHERE company_id = $1', [COMPANY_ID]),
    ).rejects.toThrow(/permission denied/i)
  })

  it('6 · cùng company_id + page_slug không thêm hai lần', async () => {
    await expect(
      app.query(
        `INSERT INTO snapshot_pages (company_id, page_slug) VALUES ($1, 'homepage')`,
        [COMPANY_ID],
      ),
    ).rejects.toThrow(/unique/i)
  })
})

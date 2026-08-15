import { Pool } from 'pg'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { createConnection, resetTestDatabase } from '@crm/db'

import { DemoSnapshotSource } from '../demo-snapshots'

/**
 * `DemoSnapshotSource` reads `snapshot_pages` — replaces the old hand-typed TS map (ADR-0021),
 * generalised to N pages/company. These tests exercise the class against a real database with
 * its own small, throwaway fixture rows, not the product's actual imported dataset.
 */

const COMPANY_ID = 'eeeeeeee-0003-4000-8000-000000000001'
const USER_ID = '11111111-1111-4111-8111-111111111111'

const owner = new Pool({ connectionString: process.env.DATABASE_URL_TEST })
const systemConnection = createConnection(process.env.DATABASE_URL_TEST_SYSTEM as string)

const source = new DemoSnapshotSource(systemConnection.db)

beforeEach(async () => {
  await resetTestDatabase(owner)
  await owner.query(
    `INSERT INTO users (id, email, password_hash, name, role) VALUES ($1, 'sales@test.local', 'x', 'Sales', 'sales')`,
    [USER_ID],
  )
  await owner.query(
    `INSERT INTO companies (id, name, industry, company_type, owner_id) VALUES ($1, 'Công ty test', 'ITO', 'it_solution', $2)`,
    [COMPANY_ID, USER_ID],
  )
})

afterAll(async () => {
  await Promise.all([owner.end(), systemConnection.close()])
})

async function insertPage(pageSlug: string, before: string | null, after: string | null): Promise<void> {
  await owner.query(
    `INSERT INTO snapshot_pages (company_id, page_slug, source_url, before_html, after_html)
     VALUES ($1, $2, 'https://example.test', $3, $4)`,
    [COMPANY_ID, pageSlug, before, after],
  )
}

describe('DemoSnapshotSource.readAll — nhiều trang/công ty', () => {
  it('1 · trả về đúng nội dung của biến thể được hỏi', async () => {
    await insertPage('homepage', '<p>trước</p>', '<p>sau</p>')

    const before = await source.readAll(COMPANY_ID, 'before')
    const after = await source.readAll(COMPANY_ID, 'after')

    expect(before).toHaveLength(1)
    expect(before[0].rawHtml).toBe('<p>trước</p>')
    expect(after[0].rawHtml).toBe('<p>sau</p>')
  })

  it('2 · nhiều trang → trả về nhiều kết quả (không còn giới hạn 1 trang/công ty)', async () => {
    await insertPage('homepage', '<p>a</p>', '<p>a2</p>')
    await insertPage('news', '<p>b</p>', '<p>b2</p>')
    await insertPage('recruit', '<p>c</p>', '<p>c2</p>')

    const after = await source.readAll(COMPANY_ID, 'after')
    expect(after).toHaveLength(3)
  })

  it('3 · trang có HTML rỗng/NULL cho biến thể đang hỏi bị bỏ qua, không crash', async () => {
    await insertPage('homepage', '<p>trước</p>', null)

    const after = await source.readAll(COMPANY_ID, 'after')
    expect(after).toHaveLength(0)
  })

  it('4 · công ty không có trang nào trả về mảng rỗng', async () => {
    const after = await source.readAll(COMPANY_ID, 'after')
    expect(after).toEqual([])
  })

  it('5 · sourceUrlFor trả về url của một trang bất kỳ, null nếu không có trang nào', async () => {
    expect(await source.sourceUrlFor(COMPANY_ID)).toBeNull()
    await insertPage('homepage', '<p>x</p>', '<p>y</p>')
    expect(await source.sourceUrlFor(COMPANY_ID)).toBe('https://example.test')
  })
})

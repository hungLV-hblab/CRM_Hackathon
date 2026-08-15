import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { AdminImportService } from '../admin-import-service'

const ZIP_PATH = resolve(__dirname, '../../../../../packages/db/seed-assets/hackathon-1-data.zip')
const zipBuffer = readFileSync(ZIP_PATH)

/**
 * `AdminImportService` reads `DATABASE_URL_OWNER` directly — point it at the TEST database for
 * the duration of this file only, so the test exercises the real code path (not a mock) without
 * touching the dev database.
 */
let originalOwnerUrl: string | undefined

beforeAll(() => {
  originalOwnerUrl = process.env.DATABASE_URL_OWNER
  process.env.DATABASE_URL_OWNER = process.env.DATABASE_URL_TEST
})

afterAll(() => {
  process.env.DATABASE_URL_OWNER = originalOwnerUrl
})

describe('AdminImportService.importZip — end to end on the real BTC zip', () => {
  it('1 · imports the real dataset and reports accurate counts', async () => {
    const service = new AdminImportService()
    const summary = await service.importZip(zipBuffer)

    expect(summary.companies).toBe(25)
    expect(summary.contacts).toBe(38)
    expect(summary.opportunities).toBe(15)
    expect(summary.snapshotPages).toBeGreaterThan(0)
    expect(summary.warnings.some((w) => w.includes('8 cơ hội'))).toBe(true)
  })

  it('2 · uploading the same zip twice is idempotent — same counts, same company IDs', async () => {
    const service = new AdminImportService()
    const first = await service.importZip(zipBuffer)
    const second = await service.importZip(zipBuffer)

    expect(second.companies).toBe(first.companies)
    expect(second.contacts).toBe(first.contacts)
    expect(second.opportunities).toBe(first.opportunities)

    const owner = new Pool({ connectionString: process.env.DATABASE_URL_TEST })
    try {
      const { rows } = await owner.query('SELECT id FROM companies ORDER BY id')
      expect(rows).toHaveLength(25)
    } finally {
      await owner.end()
    }
  })

  it('3 · rejects a buffer that is not a zip', async () => {
    const service = new AdminImportService()
    await expect(service.importZip(Buffer.from('not a zip'))).rejects.toThrow()
  })
})

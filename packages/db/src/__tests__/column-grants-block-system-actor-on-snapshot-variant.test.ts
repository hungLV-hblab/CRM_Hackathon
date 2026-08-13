import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { resetTestDatabase } from '../testing/reset-test-database'

/**
 * Pays off the debt ADR-0022 records: "a column added later is covered by the table-level
 * GRANT" is how Postgres is DOCUMENTED to behave, and 0001_grants.sql exists precisely because
 * a previous privilege assumption of that shape turned out to be wrong when measured.
 *
 * Two directions, and the forbidden one is the reason the column is safe to have at all:
 * `snapshot_variant` decides which page the AI reads. An AI that could set it would be able to
 * pick the news it then reports on — it would be manufacturing its own evidence.
 */

const USER_ID = '11111111-1111-4111-8111-111111111111'
const COMPANY_ID = 'dddddddd-0002-4000-8000-000000000002'

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
    `INSERT INTO companies (id, name, industry, company_type, owner_id)
     VALUES ($1, 'Snapshot variant company', 'ITO', 'it_solution', $2)`,
    [COMPANY_ID, USER_ID],
  )
})

afterAll(async () => {
  await Promise.all([owner?.end(), app?.end(), system?.end()])
})

describe('the AI identity cannot switch the source it reads (ADR-0022)', () => {
  it('a fresh company starts on the "before" snapshot without anyone setting it', async () => {
    const { rows } = await owner.query('SELECT snapshot_variant FROM companies WHERE id = $1', [
      COMPANY_ID,
    ])
    // The DEFAULT is what makes reseeding put every company back on "before" (I-14) with no
    // clean-up code involved.
    expect(rows[0].snapshot_variant).toBe('before')
  })

  it('crm_system UPDATE on snapshot_variant is refused', async () => {
    await expect(
      system.query(`UPDATE companies SET snapshot_variant = 'after' WHERE id = $1`, [COMPANY_ID]),
    ).rejects.toThrow(/permission denied/i)
  })

  it('crm_system can still READ it — the watch cycle has to know which page to open', async () => {
    const { rows } = await system.query('SELECT snapshot_variant FROM companies WHERE id = $1', [
      COMPANY_ID,
    ])
    expect(rows[0].snapshot_variant).toBe('before')
  })
})

describe('the human identity can, and gets the column for free from the table-level GRANT', () => {
  it('crm_app UPDATE on snapshot_variant succeeds', async () => {
    await app.query(`UPDATE companies SET snapshot_variant = 'after' WHERE id = $1`, [COMPANY_ID])

    const { rows } = await owner.query('SELECT snapshot_variant FROM companies WHERE id = $1', [
      COMPANY_ID,
    ])
    expect(rows[0].snapshot_variant).toBe('after')
  })

  it('a value that is neither variant is refused by the CHECK, whoever writes it', async () => {
    // Free text here would mean a typo reads as "this company has no source", and the watch
    // cycle would go quiet for a reason nobody could see.
    await expect(
      app.query(`UPDATE companies SET snapshot_variant = 'lastweek' WHERE id = $1`, [COMPANY_ID]),
    ).rejects.toThrow(/companies_snapshot_variant_check/i)
  })
})

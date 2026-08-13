import { Pool } from 'pg'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { createConnection, resetTestDatabase } from '@crm/db'

import { AuditEventService } from '../../../common/audit/audit-event-service'
import { ContactService } from '../contact-service'
import { humanActor } from '../../../common/actor/actor-context'

/**
 * "Đúng một đầu mối chính mỗi công ty" (ontology 3.1), proven at both layers it is held at:
 * the service that swaps the flag in a transaction, and the partial unique index underneath
 * that would refuse a second primary row even if the service were bypassed.
 *
 * The second half is the mutation check: case 4 writes two `is_primary = true` rows in raw
 * SQL. If it ever stops throwing, `contacts_one_primary_per_company` has been dropped and
 * every other case here would still be green.
 */

const USER_ID = '11111111-1111-4111-8111-111111111111'
const COMPANY_ID = 'dddddddd-0001-4000-8000-000000000001'
const OTHER_COMPANY_ID = 'dddddddd-0002-4000-8000-000000000002'

const owner = new Pool({ connectionString: process.env.DATABASE_URL_TEST })
const appConnection = createConnection(process.env.DATABASE_URL_TEST_APP as string)
const systemConnection = createConnection(process.env.DATABASE_URL_TEST_SYSTEM as string)

const audit = new AuditEventService(appConnection.db, systemConnection.db)
const contacts = new ContactService(appConnection.db, audit)
const sales = humanActor(USER_ID, 'sales')

beforeEach(async () => {
  await resetTestDatabase(owner)
  await owner.query(
    `INSERT INTO users (id, email, password_hash, name, role)
     VALUES ($1, 'sales@test.local', 'x', 'Sales', 'sales')`,
    [USER_ID],
  )
  await owner.query(
    `INSERT INTO companies (id, name, industry, company_type, owner_id) VALUES
       ($1, 'Đầu mối KK', 'Sản xuất', 'traditional', $3),
       ($2, 'Công ty khác', 'Bán lẻ', 'traditional', $3)`,
    [COMPANY_ID, OTHER_COMPANY_ID, USER_ID],
  )
})

afterAll(async () => {
  await Promise.all([owner.end(), appConnection.close(), systemConnection.close()])
})

async function primaryNames(companyId = COMPANY_ID): Promise<string[]> {
  const { rows } = await owner.query(
    `SELECT name FROM contacts WHERE company_id = $1 AND is_primary ORDER BY name`,
    [companyId],
  )
  return rows.map((row) => row.name)
}

describe('setting a new PIC lowers the previous one, in one act', () => {
  it('1 · creating a second primary contact demotes the first', async () => {
    await contacts.create(sales, { companyId: COMPANY_ID, name: 'Anh Tùng', isPrimary: true })
    await contacts.create(sales, { companyId: COMPANY_ID, name: 'Chị Mai', isPrimary: true })

    expect(await primaryNames()).toEqual(['Chị Mai'])
  })

  it('2 · promoting an existing contact demotes the incumbent', async () => {
    await contacts.create(sales, { companyId: COMPANY_ID, name: 'Anh Tùng', isPrimary: true })
    const second = await contacts.create(sales, { companyId: COMPANY_ID, name: 'Chị Mai' })

    await contacts.update(sales, second.id, { isPrimary: true })

    expect(await primaryNames()).toEqual(['Chị Mai'])
  })

  it('3 · another company keeps its own PIC — the rule is per company, not global', async () => {
    await contacts.create(sales, { companyId: COMPANY_ID, name: 'Anh Tùng', isPrimary: true })
    await contacts.create(sales, { companyId: OTHER_COMPANY_ID, name: 'Anh Sơn', isPrimary: true })

    expect(await primaryNames()).toEqual(['Anh Tùng'])
    expect(await primaryNames(OTHER_COMPANY_ID)).toEqual(['Anh Sơn'])
  })

  it('4 · MUTATION CHECK — raw SQL cannot write two primaries, the index still bites', async () => {
    await owner.query(
      `INSERT INTO contacts (company_id, name, is_primary) VALUES ($1, 'Người một', true)`,
      [COMPANY_ID],
    )

    await expect(
      owner.query(
        `INSERT INTO contacts (company_id, name, is_primary) VALUES ($1, 'Người hai', true)`,
        [COMPANY_ID],
      ),
    ).rejects.toThrow(/contacts_one_primary_per_company|duplicate key/i)
  })
})

describe('deleting a contact keeps the history it appears in', () => {
  it('5 · the timeline entry survives with contact_id detached, no foreign-key error', async () => {
    const contact = await contacts.create(sales, { companyId: COMPANY_ID, name: 'Anh Tùng' })
    await owner.query(
      `INSERT INTO timeline_entries (company_id, entry_type, occurred_at, description, contact_id, created_by)
       VALUES ($1, 'activity', now(), 'Gọi điện giới thiệu dịch vụ', $2, 'human')`,
      [COMPANY_ID, contact.id],
    )

    await contacts.remove(sales, contact.id)

    const { rows } = await owner.query(
      `SELECT description, contact_id FROM timeline_entries WHERE company_id = $1`,
      [COMPANY_ID],
    )
    // The call still happened. Losing the record of it to tidy up a contact list would be
    // the worse outcome, and `ON DELETE CASCADE` would have done exactly that.
    expect(rows).toHaveLength(1)
    expect(rows[0].contact_id).toBeNull()
  })
})

import { Pool } from 'pg'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { createConnection, resetTestDatabase } from '@crm/db'

import { AuditEventService } from '../../../common/audit/audit-event-service'
import { OpportunityService } from '../opportunity-service'
import { SYSTEM_ACTOR, humanActor } from '../../../common/actor/actor-context'

/**
 * Board order within a stage column, against a real database.
 *
 * The one design fact these tests pin down: a reorder is anchored to a CARD (`targetId`),
 * never to a visual index, and the server replays the exact arrayMove the board performed
 * optimistically. If the two ever compute different slots, case 3 or 4 goes red before a
 * Sales screen can disagree with its own refetch.
 *
 * Built with `new`, no HTTP, same as the never-blocks suite: the promises hold at the
 * service layer, so the tests reach the service layer.
 */

const USER_ID = '11111111-1111-4111-8111-111111111111'
const COMPANY_ID = 'cccccccc-0001-4000-8000-000000000001'

const owner = new Pool({ connectionString: process.env.DATABASE_URL_TEST })
const appConnection = createConnection(process.env.DATABASE_URL_TEST_APP as string)
const systemConnection = createConnection(process.env.DATABASE_URL_TEST_SYSTEM as string)

const audit = new AuditEventService(appConnection.db, systemConnection.db)
const opportunities = new OpportunityService(appConnection.db, systemConnection.db, audit)
const sales = humanActor(USER_ID, 'sales')

beforeEach(async () => {
  await resetTestDatabase(owner)
  await owner.query(
    `INSERT INTO users (id, email, password_hash, name, role)
     VALUES ($1, 'sales@test.local', 'x', 'Sales', 'sales')`,
    [USER_ID],
  )
  await owner.query(
    `INSERT INTO companies (id, name, industry, company_type, owner_id)
     VALUES ($1, 'Board-order KK', 'Sản xuất', 'traditional', $2)`,
    [COMPANY_ID, USER_ID],
  )
})

afterAll(async () => {
  await Promise.all([owner.end(), appConnection.close(), systemConnection.close()])
})

async function seedColumn(names: string[]): Promise<Record<string, string>> {
  const ids: Record<string, string> = {}
  for (const name of names) {
    const created = await opportunities.create(sales, { companyId: COMPANY_ID, name })
    ids[name] = created.id
  }
  return ids
}

async function columnNames(stage: 'prospecting' | 'qualified' = 'prospecting'): Promise<string[]> {
  const dtos = await opportunities.list({ stage })
  return dtos.map((dto) => dto.name)
}

describe('where a deal enters a column', () => {
  it('1 · new deals join the END of their column, in creation order', async () => {
    await seedColumn(['A', 'B', 'C'])

    expect(await columnNames()).toEqual(['A', 'B', 'C'])
  })

  it('2 · a stage change enters at the TOP of the new column — where the eye looks for what it just moved', async () => {
    const ids = await seedColumn(['A', 'B'])
    await opportunities.updateStage(sales, ids.A, 'qualified')
    await opportunities.updateStage(sales, ids.B, 'qualified')

    expect(await columnNames('qualified')).toEqual(['B', 'A'])
  })
})

describe('reorder anchored to a card — the server-side half of the board arrayMove', () => {
  it('3 · moving UP takes the anchor slot, pushing it down', async () => {
    const ids = await seedColumn(['A', 'B', 'C'])

    await opportunities.reorderOnBoard(sales, ids.C, ids.A)

    expect(await columnNames()).toEqual(['C', 'A', 'B'])
  })

  it('4 · moving DOWN lands where the anchor was, i.e. after it once rows shift', async () => {
    const ids = await seedColumn(['A', 'B', 'C'])

    await opportunities.reorderOnBoard(sales, ids.A, ids.C)

    expect(await columnNames()).toEqual(['B', 'C', 'A'])
  })

  it('5 · no anchor means the end of the column', async () => {
    const ids = await seedColumn(['A', 'B', 'C'])

    await opportunities.reorderOnBoard(sales, ids.A, null)

    expect(await columnNames()).toEqual(['B', 'C', 'A'])
  })

  it('6 · the order SURVIVES an unrelated edit — updatedAt no longer decides the column', async () => {
    const ids = await seedColumn(['A', 'B', 'C'])
    await opportunities.reorderOnBoard(sales, ids.C, ids.A)

    await opportunities.update(sales, ids.B, { name: 'B đổi tên' })

    expect(await columnNames()).toEqual(['C', 'A', 'B đổi tên'])
  })

  it('7 · an anchor that left the column is refused, and nothing moves', async () => {
    const ids = await seedColumn(['A', 'B', 'C'])
    await opportunities.updateStage(sales, ids.C, 'qualified')

    await expect(opportunities.reorderOnBoard(sales, ids.A, ids.C)).rejects.toThrow(
      'Thẻ mốc không còn trong cùng cột',
    )
    expect(await columnNames()).toEqual(['A', 'B'])
  })
})

describe('who may rearrange the board', () => {
  it('8 · actor=system is refused at the domain layer, and the refusal is audited', async () => {
    const ids = await seedColumn(['A', 'B'])

    await expect(opportunities.reorderOnBoard(SYSTEM_ACTOR, ids.B, ids.A)).rejects.toThrow(
      'Hệ thống không được xếp lại bảng cơ hội',
    )

    expect(await columnNames()).toEqual(['A', 'B'])
    const { rows } = await owner.query(
      `SELECT count(*)::int AS total FROM audit_events
       WHERE action = 'reorder_board' AND detail->>'outcome' = 'refused'`,
    )
    expect(rows[0].total).toBe(1)
  })
})

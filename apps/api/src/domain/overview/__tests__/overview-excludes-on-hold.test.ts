import { Pool } from 'pg'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { createConnection, resetTestDatabase } from '@crm/db'

import { AuditEventService } from '../../../common/audit/audit-event-service'
import { OpportunityService } from '../../opportunity/opportunity-service'
import { OverviewService } from '../overview-service'
import { humanActor } from '../../../common/actor/actor-context'

/**
 * The overview screen produces numbers people read out in a meeting, so the two places the
 * naive query is WRONG are what this file is about:
 *
 * - a paused deal folded into the running pipeline inflates the total someone then commits to
 * - a lost deal with no reason folded into the reason table makes the reasons add up to a
 *   figure that includes deals nobody gave a reason for
 */

const USER_ID = '11111111-1111-4111-8111-111111111111'
const COMPANY_ID = 'eeeeeeee-0001-4000-8000-000000000001'

const owner = new Pool({ connectionString: process.env.DATABASE_URL_TEST })
const appConnection = createConnection(process.env.DATABASE_URL_TEST_APP as string)
const systemConnection = createConnection(process.env.DATABASE_URL_TEST_SYSTEM as string)

const audit = new AuditEventService(appConnection.db, systemConnection.db)
const opportunities = new OpportunityService(appConnection.db, systemConnection.db, audit)
const overview = new OverviewService(appConnection.db)
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
     VALUES ($1, 'Tổng quan KK', 'Sản xuất', 'traditional', $2)`,
    [COMPANY_ID, USER_ID],
  )
})

afterAll(async () => {
  await Promise.all([owner.end(), appConnection.close(), systemConnection.close()])
})

async function deal(name: string, expectedValue: string, stage?: string) {
  const created = await opportunities.create(sales, {
    companyId: COMPANY_ID,
    name,
    expectedValue,
  })
  if (stage) await opportunities.updateStage(sales, created.id, stage as never)
  return created
}

describe('a paused deal is reported apart from the running pipeline', () => {
  it('1 · on_hold is absent from pipelineByStage and carries its own total', async () => {
    await deal('Đang chạy', '100000.00', 'negotiation')
    await deal('Tạm dừng', '900000.00', 'on_hold')

    const summary = await overview.summary()

    expect(summary.pipelineByStage.map((row) => row.stage)).not.toContain('on_hold')
    expect(summary.onHold).toEqual({ count: 1, totalValue: '900000.00' })

    // The number carried into the meeting is the running one, not 1,000,000.
    const runningTotal = summary.pipelineByStage
      .filter((row) => row.stage !== 'won' && row.stage !== 'lost')
      .reduce((sum, row) => sum + Number(row.totalValue), 0)
    expect(runningTotal).toBe(100000)
  })

  it('2 · with no paused deal the block reads zero rather than going missing', async () => {
    await deal('Đang chạy', '100000.00', 'negotiation')

    expect((await overview.summary()).onHold).toEqual({ count: 0, totalValue: '0' })
  })
})

describe('lost reasons', () => {
  it('3 · deals with no reason are counted on their own line, outside the table', async () => {
    const first = await deal('Thua có lý do 1', '1000.00')
    const second = await deal('Thua có lý do 2', '1000.00')
    const third = await deal('Thua không lý do', '1000.00')
    await opportunities.updateStage(sales, first.id, 'lost', { lostReason: 'Giá cao' })
    await opportunities.updateStage(sales, second.id, 'lost', { lostReason: 'Giá cao' })
    await opportunities.updateStage(sales, third.id, 'lost')

    const summary = await overview.summary()

    expect(summary.lostReasons).toEqual([{ reason: 'Giá cao', count: 2 }])
    expect(summary.lostWithoutReason).toBe(1)
  })
})

describe('companies by industry', () => {
  it('4 · counts only companies that are not soft-deleted', async () => {
    await owner.query(
      `INSERT INTO companies (name, industry, company_type, owner_id, deleted_at)
       VALUES ('Đã xoá', 'Sản xuất', 'traditional', $1, now())`,
      [USER_ID],
    )

    const summary = await overview.summary()

    expect(summary.companiesByIndustry).toEqual([{ industry: 'Sản xuất', count: 1 }])
  })
})

describe('the to-do list', () => {
  it('5 · overdue open deals only — closed ones and deals with no date stay out', async () => {
    const overdue = await opportunities.create(sales, {
      companyId: COMPANY_ID,
      name: 'Quá hạn',
      nextStepText: 'Gọi lại',
      nextStepDueDate: '2020-01-01',
    })
    const noDate = await opportunities.create(sales, { companyId: COMPANY_ID, name: 'Không hạn' })
    const closed = await opportunities.create(sales, {
      companyId: COMPANY_ID,
      name: 'Đã thắng',
      nextStepText: 'Bàn giao',
      nextStepDueDate: '2020-01-01',
    })
    await opportunities.updateStage(sales, closed.id, 'won')

    const ids = (await overview.summary()).overdueNextSteps.map((row) => row.id)

    expect(ids).toEqual([overdue.id])
    expect(ids).not.toContain(noDate.id)
    expect(ids).not.toContain(closed.id)
  })
})

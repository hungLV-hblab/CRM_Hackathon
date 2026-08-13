import { Pool } from 'pg'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { createConnection, resetTestDatabase } from '@crm/db'
import { createOpportunitySchema, updateStageSchema } from '@crm/contracts'

import { AuditEventService } from '../../../common/audit/audit-event-service'
import { OpportunityService } from '../opportunity-service'
import { OverviewService } from '../../overview/overview-service'
import { humanActor } from '../../../common/actor/actor-context'

/**
 * THE THREE NEVER-BLOCK RULES of feature group 1, against a real database.
 *
 * These rules are implemented by code that is NOT there: no `.refine()` keyed on stage, no
 * guard clause before the UPDATE. Absent code cannot be reviewed by eye, so each rule below
 * comes with a written way to break it (the mutation checks recorded in the phase file):
 *
 *   1. add a stage-conditional `.refine()` to `updateStageSchema` → cases 1, 2 and 3 go red
 *   2. write two `is_primary = true` rows directly → Postgres refuses (contact test)
 *   3. take the timeline insert out of the `updateStage` transaction → case 8 goes red
 *
 * Built with `new`, no HTTP: the promise is that the rules hold at the service layer, so the
 * test reaches the service layer.
 */

const USER_ID = '11111111-1111-4111-8111-111111111111'
const COMPANY_ID = 'cccccccc-0001-4000-8000-000000000001'

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
     VALUES ($1, 'Never-block KK', 'Sản xuất', 'traditional', $2)`,
    [COMPANY_ID, USER_ID],
  )
})

afterAll(async () => {
  await Promise.all([owner.end(), appConnection.close(), systemConnection.close()])
})

async function newOpportunity(name = 'Cơ hội thử'): Promise<string> {
  const created = await opportunities.create(sales, { companyId: COMPANY_ID, name })
  return created.id
}

describe('rule 1 · dragging to Đủ điều kiện with both signal cells empty', () => {
  it('1 · the move goes through and comes back carrying the flag', async () => {
    const id = await newOpportunity()

    const moved = await opportunities.updateStage(sales, id, 'qualified')

    expect(moved.stage).toBe('qualified')
    expect(moved.warnings).toContain('missing_qualification_signals')
  })

  it('2 · the flag disappears once all four cells are filled — no second move needed', async () => {
    const id = await newOpportunity()

    const moved = await opportunities.updateStage(sales, id, 'qualified', {
      needSignal: 'Thiếu 12 kỹ sư Java',
      needSignalSource: 'Ghi chú cuộc gọi 10/08',
      budgetSignal: 'Ngân sách 500k USD đã duyệt',
      budgetSignalSource: 'Email CFO 11/08',
    })

    // Only the signal flag is under test. The next-step flag stays: this deal genuinely has
    // no next step, and each flag answers for its own cells.
    expect(moved.warnings).not.toContain('missing_qualification_signals')
  })
})

describe('rule 2 · moving to Thua with no reason', () => {
  it('3 · the move goes through and carries the flag', async () => {
    const id = await newOpportunity()

    const moved = await opportunities.updateStage(sales, id, 'lost')

    expect(moved.stage).toBe('lost')
    expect(moved.warnings).toEqual(['missing_lost_reason'])
  })

  it('4 · and it stays OUT of the lost-reason table, counted separately', async () => {
    const withReason = await newOpportunity('Có lý do')
    const withoutReason = await newOpportunity('Không lý do')
    await opportunities.updateStage(sales, withReason, 'lost', { lostReason: 'Giá cao hơn đối thủ' })
    await opportunities.updateStage(sales, withoutReason, 'lost')

    const summary = await overview.summary()

    // Not "a bucket named chưa ghi": anything that sums the column would swallow it again.
    expect(summary.lostReasons).toEqual([{ reason: 'Giá cao hơn đối thủ', count: 1 }])
    expect(summary.lostWithoutReason).toBe(1)
  })
})

describe('rule 3 · saving an open opportunity with no next step', () => {
  it('5 · it saves, carries the flag, and is absent from the to-do list', async () => {
    const created = await opportunities.create(sales, {
      companyId: COMPANY_ID,
      name: 'Chưa có việc tiếp theo',
    })

    expect(created.warnings).toContain('missing_next_step')
    // Missing and overdue are ONE proposition: with no due date there is nothing to be late
    // for, so it drops off the to-do list without a second rule saying so.
    expect(created.isOverdue).toBe(false)

    const summary = await overview.summary()
    expect(summary.overdueNextSteps.map((row) => row.id)).not.toContain(created.id)
  })

  it('6 · an overdue next step DOES reach the to-do list', async () => {
    const created = await opportunities.create(sales, {
      companyId: COMPANY_ID,
      name: 'Quá hạn',
      nextStepText: 'Gọi lại cho CTO',
      nextStepDueDate: '2020-01-01',
    })

    const summary = await overview.summary()

    expect(summary.overdueNextSteps.map((row) => row.id)).toContain(created.id)
    expect(created.isOverdue).toBe(true)
  })
})

describe('stage order is not validated in either direction', () => {
  it('7 · backwards and skipping ahead are both allowed', async () => {
    const backwards = await newOpportunity('Đi lùi')
    await opportunities.updateStage(sales, backwards, 'negotiation')
    const steppedBack = await opportunities.updateStage(sales, backwards, 'prospecting')
    expect(steppedBack.stage).toBe('prospecting')
    // Back before the gate, so the qualification flag is gone rather than stuck on the row.
    expect(steppedBack.warnings).not.toContain('missing_qualification_signals')

    const skipped = await newOpportunity('Nhảy cóc')
    const jumped = await opportunities.updateStage(sales, skipped, 'negotiation')
    expect(jumped.stage).toBe('negotiation')
    expect(jumped.warnings).toContain('missing_qualification_signals')
  })
})

/**
 * The service is only half the path. A request reaches it through `ZodValidationPipe`, so a
 * stage-conditional `.refine()` in the schema would block the move BEFORE the service is ever
 * called — and every service-level case above would stay green while the product blocked
 * Sales. These cases are what makes mutation check 1 bite.
 */
describe('the schema itself refuses nothing', () => {
  it('9 · a stage change carrying none of the optional cells parses', () => {
    for (const stage of ['qualified', 'lost', 'negotiation', 'prospecting'] as const) {
      expect(updateStageSchema.safeParse({ stage }).success).toBe(true)
    }
  })

  it('10 · a half-filled qualify parses too — three cells out of four is not a rejection', () => {
    const parsed = updateStageSchema.safeParse({
      stage: 'qualified',
      needSignal: 'Thiếu 12 kỹ sư Java',
      needSignalSource: 'Ghi chú cuộc gọi 10/08',
      budgetSignal: 'Ngân sách 500k USD',
    })

    expect(parsed.success).toBe(true)
  })

  it('11 · creating an opportunity with no next step and no signals parses', () => {
    const parsed = createOpportunitySchema.safeParse({
      companyId: COMPANY_ID,
      name: 'Cơ hội trống',
    })

    expect(parsed.success).toBe(true)
  })
})

describe('every stage change leaves a trace on the timeline', () => {
  it('8 · one stage_change entry, written by the human, in the same transaction', async () => {
    const id = await newOpportunity()

    await opportunities.updateStage(sales, id, 'qualified')

    const { rows } = await owner.query(
      `SELECT entry_type, created_by, description FROM timeline_entries WHERE company_id = $1`,
      [COMPANY_ID],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].entry_type).toBe('stage_change')
    expect(rows[0].created_by).toBe('human')
    // The Vietnamese sentence is stored as-is: `description` is already a free-text cell Sales
    // types into for `activity` and `note`, and a second machine-readable format in the same
    // column would need a parser to read it back.
    expect(rows[0].description).toBe('Đổi giai đoạn: Tiếp cận → Đủ điều kiện')
  })
})

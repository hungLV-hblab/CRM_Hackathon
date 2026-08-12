import { Pool } from 'pg'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { createConnection, resetTestDatabase } from '@crm/db'

import { SYSTEM_ACTOR, humanActor } from '../common/actor/actor-context'
import { AuditEventService } from '../common/audit/audit-event-service'
import { OpportunityService } from '../domain/opportunity/opportunity-service'

/**
 * T-10 MINI — the organisers' acceptance script is explicit: try to change the stage "under
 * the system identity, NOT through the user interface".
 *
 * So this test boots no HTTP, builds no Nest module, and passes through no guard. It
 * constructs the service with `new` and calls it directly — the lowest layer a test living
 * in the same repository can reach (ADR-0004, "How the team verified this").
 *
 * THREE assertions, not one. Checking only "it throws" leaves a service that throws AND
 * writes anyway green, and we would believe we had blocked it.
 */

const USER_ID = '11111111-1111-4111-8111-111111111111'
const COMPANY_ID = 'ffffffff-0001-4000-8000-000000000001'
const OPPORTUNITY_ID = 'ffffffff-0002-4000-8000-000000000002'

const appConnection = createConnection(process.env.DATABASE_URL_TEST_APP as string)
const systemConnection = createConnection(process.env.DATABASE_URL_TEST_SYSTEM as string)
const owner = new Pool({ connectionString: process.env.DATABASE_URL_TEST })

const audit = new AuditEventService(appConnection.db, systemConnection.db)
const opportunityService = new OpportunityService(appConnection.db, systemConnection.db, audit)

beforeEach(async () => {
  await resetTestDatabase(owner)
  await owner.query(
    `INSERT INTO users (id, email, password_hash, name, role) VALUES ($1, 'sales@test.local', 'x', 'Sales', 'sales')`,
    [USER_ID],
  )
  await owner.query(
    `INSERT INTO companies (id, name, industry, company_type, owner_id)
     VALUES ($1, 'T10 company', 'ITO', 'it_solution', $2)`,
    [COMPANY_ID, USER_ID],
  )
  await owner.query(
    `INSERT INTO opportunities (id, company_id, name, expected_value, stage, next_step_text, next_step_source)
     VALUES ($1, $2, 'T10 opportunity', 100000, 'qualified', 'Sales typed this next step', 'human')`,
    [OPPORTUNITY_ID, COMPANY_ID],
  )
})

afterAll(async () => {
  await Promise.all([appConnection.close(), systemConnection.close(), owner.end()])
})

async function countSystemAuditEvents(action: string): Promise<number> {
  const { rows } = await owner.query(
    `SELECT count(*)::int AS total FROM audit_events WHERE action = $1 AND actor = 'system'`,
    [action],
  )
  return rows[0].total
}

async function readStage(): Promise<string> {
  const { rows } = await owner.query('SELECT stage FROM opportunities WHERE id = $1', [
    OPPORTUNITY_ID,
  ])
  return rows[0].stage
}

describe('T-10 mini — actor=system is blocked when calling the service directly', () => {
  it('throws · records an AuditEvent · leaves the data UNCHANGED', async () => {
    await expect(
      opportunityService.updateStage(SYSTEM_ACTOR, OPPORTUNITY_ID, 'won'),
    ).rejects.toThrow(/không được đổi giai đoạn/i)

    expect(await countSystemAuditEvents('update_stage')).toBe(1)
    expect(await readStage()).toBe('qualified')
  })

  it('the same call as a human succeeds — blocking the right thing, not everything', async () => {
    await opportunityService.updateStage(humanActor(USER_ID, 'sales'), OPPORTUNITY_ID, 'negotiation')
    expect(await readStage()).toBe('negotiation')
    expect(await countSystemAuditEvents('update_stage')).toBe(0)
  })

  it('I-7 · the system cannot overwrite a human-typed next step, not even when overdue', async () => {
    await expect(
      opportunityService.updateNextStep(SYSTEM_ACTOR, OPPORTUNITY_ID, {
        text: 'machine set this',
        dueDate: '2026-08-30',
      }),
    ).rejects.toThrow(/I-7/)

    const { rows } = await owner.query(
      'SELECT next_step_text, next_step_source FROM opportunities WHERE id = $1',
      [OPPORTUNITY_ID],
    )
    expect(rows[0].next_step_text).toBe('Sales typed this next step')
    expect(rows[0].next_step_source).toBe('human')
  })

  it('autonomy zone 3 · an empty cell may be written, and is marked as system', async () => {
    await owner.query(
      `UPDATE opportunities SET next_step_text = NULL, next_step_source = NULL WHERE id = $1`,
      [OPPORTUNITY_ID],
    )

    await opportunityService.updateNextStep(SYSTEM_ACTOR, OPPORTUNITY_ID, {
      text: 'Follow up on the funding news',
      dueDate: '2026-08-30',
    })

    const { rows } = await owner.query(
      'SELECT next_step_text, next_step_source FROM opportunities WHERE id = $1',
      [OPPORTUNITY_ID],
    )
    expect(rows[0].next_step_text).toBe('Follow up on the funding news')
    expect(rows[0].next_step_source).toBe('system')
  })
})

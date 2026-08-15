import { type INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import cookieParser from 'cookie-parser'
import { Pool } from 'pg'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { DEMO_PASSWORD } from '@crm/contracts'
import { SEED_USERS, loadDefaultDataset, seed } from '@crm/db'

import { AppModule } from '../../../app.module'

/**
 * ADR-0046, the write side — and the reason the boundary was worth the day it cost.
 *
 * Before this, `POST /auto-next-step-events/:id/undo` checked two things: that the caller was a
 * person, and that seven days had not passed. It never asked whose deal it was. The ids it
 * accepts were published by `GET /opportunities/auto-next-steps`, which was equally unscoped —
 * so any signed-in Sales person could list every machine-written next step in the product and
 * undo somebody else's, writing `next_step_text`, `next_step_due_date` and `next_step_source` on
 * a deal they had nothing to do with, and being recorded as the person who did it.
 *
 * Under rule 5 of CLAUDE.md — "Next step là nhịp tim của deal" — that is erasing another Sales
 * person's morning. The tests below are the evidence it can no longer happen.
 *
 * NOT FOUND rather than FORBIDDEN throughout: a 403 tells the caller the id names something
 * real, which is one bit more than someone outside the boundary is owed.
 */

let app: INestApplication
let owner: Pool

const SALES1 = SEED_USERS[0]
const SALES2 = SEED_USERS.find((user) => user.email === 'sales2@hblab.vn')!
const ADMIN = SEED_USERS.find((user) => user.role === 'admin')!

/**
 * Both imported from the BTC zip, and picked for WHO `Account.csv` says looks after them:
 * `sales_owner` gives 日立ソリューションズ to Vân and Genky to Thảo (ADR-0046). Vân's company is
 * the concrete victim every "Thảo must not write here" assertion needs, and it carries an
 * opportunity, which the machine-written next step below has to hang on.
 */
const OTHER_COMPANY = '日立ソリューションズ'
const OWN_COMPANY = 'Genky'

const EVENT_ID = 'cccccccc-0039-4000-8000-000000000001'
const OBSERVATION_ID = 'cccccccc-0039-4000-8000-000000000002'
const CLAIM_ID = 'cccccccc-0039-4000-8000-000000000003'
const MACHINE_TEXT = 'Goi lai khach sau tin mo rong'
const MACHINE_DUE = '2026-08-25'

let otherCompanyId: string
let ownCompanyId: string
let otherOpportunityId: string
let sales1Cookie: string
let sales2Cookie: string
let adminCookie: string

beforeAll(async () => {
  owner = new Pool({ connectionString: process.env.DATABASE_URL_TEST })
  await seed(process.env.DATABASE_URL_TEST as string, loadDefaultDataset())

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
  app = moduleRef.createNestApplication()
  app.use(cookieParser())
  app.setGlobalPrefix('api')
  await app.init()

  otherCompanyId = await idOf('SELECT id FROM companies WHERE name = $1', OTHER_COMPANY)
  ownCompanyId = await idOf('SELECT id FROM companies WHERE name = $1', OWN_COMPANY)
  otherOpportunityId = await idOf(
    'SELECT id FROM opportunities WHERE company_id = $1 LIMIT 1',
    otherCompanyId,
  )
  await seedMachineWrittenNextStep()

  sales1Cookie = await login(SALES1.email)
  sales2Cookie = await login(SALES2.email)
  adminCookie = await login(ADMIN.email)
}, 60_000)

afterAll(async () => {
  await app?.close()
  await owner?.end()
})

function http() {
  return request(app.getHttpServer())
}

async function login(email: string): Promise<string> {
  const res = await http()
    .post('/api/auth/login')
    .send({ email, password: DEMO_PASSWORD })
    .expect(200)
  return res.headers['set-cookie'][0]
}

async function idOf(sql: string, param: string): Promise<string> {
  const { rows } = await owner.query(sql, [param])
  if (rows.length === 0) throw new Error(`Nothing found for: ${sql} (${param})`)
  return rows[0].id
}

/**
 * A machine-written next step on sales2's deal, with its undo window open. Written straight to
 * the tables because producing one for real means running the watch cycle against a changed
 * snapshot, and this test is about who may press the button, not about how the row appears.
 */
async function seedMachineWrittenNextStep(): Promise<void> {
  const rawContent = 'Khach mo rong sang thi truong Bac Au trong quy toi.'
  await owner.query('DELETE FROM auto_next_step_events WHERE id = $1', [EVENT_ID])
  await owner.query('DELETE FROM claims WHERE id = $1', [CLAIM_ID])
  await owner.query('DELETE FROM observations WHERE id = $1', [OBSERVATION_ID])

  await owner.query(
    `INSERT INTO observations (id, company_id, source_url, raw_content, extractor_version,
                               content_hash, fetch_status)
     VALUES ($1, $2, 'https://example.test/tin-mo-rong', $3, 'owner-boundary',
             'owner-boundary-undo-hash', 'ok')`,
    [OBSERVATION_ID, otherCompanyId, rawContent],
  )
  await owner.query(
    `INSERT INTO claims (id, company_id, observation_id, statement, signal_type, confidence,
                         quote_text, quote_start, quote_end, trigger_context)
     VALUES ($1, $2, $3, 'Khach mo rong Bac Au', 'expansion', 'likely', $4, 0, $5,
             'watch_cycle')`,
    [CLAIM_ID, otherCompanyId, OBSERVATION_ID, rawContent, rawContent.length],
  )
  await owner.query(
    `INSERT INTO auto_next_step_events (id, opportunity_id, claim_id, new_text, new_due_date,
                                        previous_text, previous_source, undo_deadline)
     VALUES ($1, $2, $3, $4, $5, NULL, NULL, now() + interval '7 days')`,
    [EVENT_ID, otherOpportunityId, CLAIM_ID, MACHINE_TEXT, MACHINE_DUE],
  )
  await owner.query(
    `UPDATE opportunities
        SET next_step_text = $2, next_step_due_date = $3, next_step_source = 'system'
      WHERE id = $1`,
    [otherOpportunityId, MACHINE_TEXT, MACHINE_DUE],
  )
}

async function nextStepCell() {
  const { rows } = await owner.query(
    'SELECT next_step_text, next_step_due_date, next_step_source FROM opportunities WHERE id = $1',
    [otherOpportunityId],
  )
  return rows[0]
}

describe('undoing a machine write is refused across the ownership boundary', () => {
  it('refuses a sales person the undo on another persons deal', async () => {
    const before = await nextStepCell()

    await http()
      .post(`/api/auto-next-step-events/${EVENT_ID}/undo`)
      .set('Cookie', sales1Cookie)
      .expect(404)

    // Not one column moved. "Refused" has to mean the deal is untouched, not merely that the
    // response was an error.
    expect(await nextStepCell()).toEqual(before)
  })

  it('records the refusal, so the attempt is answerable later', async () => {
    // `outcome` lives inside the `detail` jsonb, stamped by `recordRefusal`.
    const { rows } = await owner.query(
      `SELECT count(*)::int AS total FROM audit_events
        WHERE action = 'undo_auto_next_step' AND detail->>'outcome' = 'refused'`,
    )
    expect(rows[0].total).toBeGreaterThan(0)
  })

  it('still lets the person who looks after the deal undo it', async () => {
    await http()
      .post(`/api/auto-next-step-events/${EVENT_ID}/undo`)
      .set('Cookie', sales2Cookie)
      .expect(201)

    const cell = await nextStepCell()
    expect(cell.next_step_text).toBeNull()
    expect(cell.next_step_source).not.toBe('system')
  })
})

describe('the other write paths are bounded the same way', () => {
  it('refuses editing another persons company profile', async () => {
    await http()
      .patch(`/api/companies/${otherCompanyId}`)
      .set('Cookie', sales1Cookie)
      .send({ industry: 'Bi sua trom' })
      .expect(404)

    const { rows } = await owner.query('SELECT industry FROM companies WHERE id = $1', [
      otherCompanyId,
    ])
    expect(rows[0].industry).not.toBe('Bi sua trom')
  })

  it('refuses deleting another persons company', async () => {
    await http()
      .delete(`/api/companies/${otherCompanyId}`)
      .set('Cookie', sales1Cookie)
      .expect(404)

    const { rows } = await owner.query('SELECT deleted_at FROM companies WHERE id = $1', [
      otherCompanyId,
    ])
    expect(rows[0].deleted_at).toBeNull()
  })

  it('still lets a person edit the company they look after', async () => {
    await http()
      .patch(`/api/companies/${ownCompanyId}`)
      .set('Cookie', sales1Cookie)
      .send({ size: '900-950' })
      .expect(200)
  })

  it('leaves an admin able to write anywhere, as ADR-0033 settled', async () => {
    await http()
      .patch(`/api/companies/${otherCompanyId}`)
      .set('Cookie', adminCookie)
      .send({ size: '60-70' })
      .expect(200)
  })
})

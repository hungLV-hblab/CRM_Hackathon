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
 * The owner scoping runs through HTTP on purpose: the rule "a sales actor is pinned to their
 * own view no matter what the URL says" lives in the CONTROLLER (ADR-0004 keeps the service
 * ignorant of the ambient actor), so a service-level test would prove nothing about it.
 *
 * Runs against the seed, which is the BTC dataset parsed from the zip. Ownership is IMPORTED
 * from the `sales_owner` column (ADR-0046): five sales people, five companies each. Every
 * figure asserted below is read off `Account.csv` + `Opps.csv` and named where it is used —
 * hard-coded rather than recomputed, because a test that recalculates the answer the same way
 * the query does would pass while both were wrong.
 *
 * Two properties of the real data that the hand-typed seed did not have, and that several
 * assertions here now stand on:
 *   - NO opportunity sits at stage "Thua", so every lost-reason block is honestly empty.
 *   - Vân's three open deals all carry a month-only `due_date`, which rule 4 stores as NULL —
 *     so all three count as missing a next step.
 */

let app: INestApplication
let owner: Pool

const SALES1 = SEED_USERS[0]
const SALES2 = SEED_USERS.find((user) => user.email === 'sales2@hblab.vn')!
/** Linh — the one sales person whose deals are all paused, so her open figures read zero. */
const SALES4 = SEED_USERS.find((user) => user.email === 'sales4@hblab.vn')!
const ADMIN = SEED_USERS.find((user) => user.role === 'admin')!

beforeAll(async () => {
  owner = new Pool({ connectionString: process.env.DATABASE_URL_TEST })
  await seed(process.env.DATABASE_URL_TEST as string, loadDefaultDataset())

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
  app = moduleRef.createNestApplication()
  app.use(cookieParser())
  app.setGlobalPrefix('api')
  await app.init()
})

afterAll(async () => {
  await app?.close()
  await owner?.end()
})

function http() {
  return request(app.getHttpServer())
}

async function login(email: string): Promise<string> {
  const res = await http().post('/api/auth/login').send({ email, password: DEMO_PASSWORD }).expect(200)
  return res.headers['set-cookie'][0]
}

async function overview(cookie: string, ownerId?: string) {
  const res = await http()
    .get(ownerId ? `/api/overview?ownerId=${ownerId}` : '/api/overview')
    .set('Cookie', cookie)
    .expect(200)
  return res.body
}

function runningTotal(body: { pipelineByStage: { stage: string; totalValue: string }[] }) {
  return body.pipelineByStage
    .filter((row) => row.stage !== 'won' && row.stage !== 'lost')
    .reduce((sum, row) => sum + Number(row.totalValue), 0)
}

describe('a sales actor is pinned to their own view', () => {
  it('1 · no param → own numbers only (Thảo sees 9,3tr, not the whole 171,8tr)', async () => {
    const cookie = await login(SALES1.email)
    const body = await overview(cookie)

    // Thảo's two open deals: C18 at 1.800.000 and C16 at 7.500.000. C15 is Thắng, so it is out.
    expect(runningTotal(body)).toBe(9_300_000)
    expect(body.lostReasons).toEqual([])
    expect(body.lostWithoutReason).toBe(0)
  })

  it('2 · passing someone else\'s ownerId changes nothing — the URL is not an identity', async () => {
    const cookie = await login(SALES1.email)
    const own = await overview(cookie)
    const spoofed = await overview(cookie, SALES2.id)

    expect(spoofed).toEqual(own)
  })

  it('3 · the per-sales table is absent for a sales actor', async () => {
    const cookie = await login(SALES2.email)
    const body = await overview(cookie)

    expect(body.perSales).toBeUndefined()
  })
})

describe('an admin sees everything, and may look through one sales\' eyes', () => {
  it('4 · no param → whole-team numbers plus one per-sales row per sales user', async () => {
    const cookie = await login(ADMIN.email)
    const body = await overview(cookie)

    expect(runningTotal(body)).toBe(171_800_000)
    // One row per sales account in `DEMO_ACCOUNTS`; the admin is not a sales and gets none.
    expect(body.perSales).toHaveLength(5)

    const bySales2 = body.perSales.find(
      (row: { userId: string }) => row.userId === SALES2.id,
    )
    // Vân's three open deals total 55.200.000, and all three are missing a next step: their
    // `due_date` is month-only in the CSV, which rule 4 stores as NULL rather than a guess.
    expect(bySales2).toMatchObject({
      name: SALES2.name,
      runningPipeline: '55200000.00',
      openCount: 3,
      missingNextStepCount: 3,
    })

    const bySales4 = body.perSales.find(
      (row: { userId: string }) => row.userId === SALES4.id,
    )
    // Linh's deals are all "Tạm dừng", which the running pipeline excludes on purpose — she
    // still gets a row, reading zero, because absent and zero differ.
    expect(bySales4).toMatchObject({ runningPipeline: '0', openCount: 0 })
  })

  it('5 · ?ownerId narrows every figure to that sales, lost blocks included', async () => {
    const cookie = await login(ADMIN.email)
    const body = await overview(cookie, SALES2.id)

    // The whole team runs at 171,8tr; asking for Vân has to answer with HER 55,2tr.
    expect(runningTotal(body)).toBe(55_200_000)
    // Nobody in the imported data has lost a deal, so both lost blocks stay empty instead of
    // carrying somebody else's rows through the filter.
    expect(body.lostReasons).toEqual([])
    expect(body.lostWithoutReason).toBe(0)
  })

  it('6 · an unassigned company is stated as uncounted, not silently dropped', async () => {
    const cookie = await login(ADMIN.email)
    expect((await overview(cookie)).unassignedCompanies).toBe(0)

    await owner.query(
      `INSERT INTO companies (name, industry, company_type)
       VALUES ('Chưa gán ai', 'Kiểm thử', 'other_ito')`,
    )

    expect((await overview(cookie)).unassignedCompanies).toBe(1)
  })

  it('7 · a company the ADMIN owns is uncounted too — it belongs to no sales view', async () => {
    const cookie = await login(ADMIN.email)
    const before = (await overview(cookie)).unassignedCompanies

    // Exactly what a judge does: press the admin demo button, then create a company.
    await http()
      .post('/api/companies')
      .set('Cookie', cookie)
      .send({ name: 'Cty Quản Trị Tạo', industry: 'Kiểm thử', companyType: 'other_ito' })
      .expect(201)

    // It appears in no per-sales row, so the screen has to SAY it is missing. Owned-but-by-
    // nobody-relevant used to read as owned, and the company vanished with nothing said.
    const after = await overview(cookie)
    expect(after.unassignedCompanies).toBe(before + 1)
    expect(after.perSales).toHaveLength(5)
  })
})

describe('the due-soon window', () => {
  it('7 · today..+3 stays in; +5 days, overdue and closed stay out', async () => {
    const today = new Date()
    const plus = (days: number) =>
      new Date(today.getTime() + days * 86_400_000).toISOString().slice(0, 10)

    await owner.query(
      `INSERT INTO companies (id, name, industry, company_type, owner_id)
       VALUES ('eeeeeeee-0009-4000-8000-000000000009', 'Cty Cửa Sổ Hạn', 'Kiểm thử', 'other_ito', $1)`,
      [SALES1.id],
    )
    const rows: [string, string, string | null][] = [
      ['Đúng cửa sổ', 'call', plus(2)],
      ['Ngoài cửa sổ', 'call', plus(5)],
      ['Đã trễ', 'call', plus(-1)],
    ]
    for (const [name, text, due] of rows) {
      await owner.query(
        `INSERT INTO opportunities (company_id, name, stage, next_step_text, next_step_due_date)
         VALUES ('eeeeeeee-0009-4000-8000-000000000009', $1, 'prospecting', $2, $3)`,
        [name, text, due],
      )
    }

    const cookie = await login(SALES1.email)
    const body = await overview(cookie)
    const dueSoonNames = body.dueSoon.map((row: { name: string }) => row.name)
    const overdueNames = body.overdueNextSteps.map((row: { name: string }) => row.name)

    expect(dueSoonNames).toContain('Đúng cửa sổ')
    expect(dueSoonNames).not.toContain('Ngoài cửa sổ')
    // Late is late, not "soon": the row belongs to exactly one block.
    expect(dueSoonNames).not.toContain('Đã trễ')
    expect(overdueNames).toContain('Đã trễ')
  })

  it('8 · a past date with no text is ONE problem, not two — it belongs to the silent block', async () => {
    // Both columns are independently nullable, so this row is reachable: a date left behind
    // after the text was cleared. Late against nothing is not a task, it is a missing task.
    await owner.query(
      `INSERT INTO opportunities (company_id, name, stage, next_step_text, next_step_due_date)
       VALUES ('eeeeeeee-0009-4000-8000-000000000009', 'Hạn không việc', 'prospecting', NULL, current_date - 1)`,
    )

    const cookie = await login(SALES1.email)
    const body = await overview(cookie)

    expect(body.overdueNextSteps.map((row: { name: string }) => row.name)).not.toContain(
      'Hạn không việc',
    )
    expect(body.missingNextStep.map((row: { name: string }) => row.name)).toContain(
      'Hạn không việc',
    )

    // And the admin's row counts the same deals the sales' own screen lists — the count and
    // the list are two renderings of one definition, so they must not drift apart.
    const adminCookie = await login(ADMIN.email)
    const row = (await overview(adminCookie)).perSales.find(
      (candidate: { userId: string }) => candidate.userId === SALES1.id,
    )
    expect(row.overdueCount).toBe(body.overdueNextSteps.length)
    expect(row.missingNextStepCount).toBe(body.missingNextStep.length)
  })

  it('9 · missing-next-step lists open silent deals, and leaves paused ones alone', async () => {
    // Both rows are created here rather than borrowed from the imported data: every real open
    // deal already carries a next step, so the silent case has to be constructed.
    await owner.query(
      `INSERT INTO opportunities (company_id, name, stage)
       VALUES ('eeeeeeee-0009-4000-8000-000000000009', 'Im lặng đang mở', 'prospecting'),
              ('eeeeeeee-0009-4000-8000-000000000009', 'Im lặng tạm dừng', 'on_hold')`,
    )

    const cookie = await login(SALES1.email)
    const names = (await overview(cookie)).missingNextStep.map((row: { name: string }) => row.name)

    expect(names).toContain('Im lặng đang mở')
    // A paused deal may stay silent by design, so it must not be nagged about.
    expect(names).not.toContain('Im lặng tạm dừng')
  })
})

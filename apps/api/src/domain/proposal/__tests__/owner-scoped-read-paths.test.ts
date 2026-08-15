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
 * ADR-0046 — the read side of the owner boundary, checked ENDPOINT BY ENDPOINT rather than
 * service by service.
 *
 * The shape of this file is the point. An earlier draft of the work scoped the suggestion queue
 * alone and called the boundary closed; it was not, because a suggestion's content is its claim,
 * and `GET /companies/:id/reading-zone` hands out that same claim — statement, quote text and
 * offsets — for any company id a caller cares to name. Company ids are enumerable. So the test
 * walks a LIST of routes, and adding a route to the product without adding it here is meant to
 * feel like an omission.
 *
 * Seed ownership, which every expectation below leans on, is IMPORTED rather than assigned:
 * `Account.csv` gives each of its five companies to the person its `sales_owner` cell names, so
 * Genky belongs to Thảo (`sales@hblab.vn`) and 日立ソリューションズ to Vân (`sales2@hblab.vn`).
 */

let app: INestApplication
let owner: Pool

const SALES1 = SEED_USERS[0]
const SALES2 = SEED_USERS.find((user) => user.email === 'sales2@hblab.vn')!
const ADMIN = SEED_USERS.find((user) => user.role === 'admin')!

/** Vân's, so every "Thảo must not see this" assertion has a concrete subject. */
const OTHER_COMPANY = '日立ソリューションズ'
/** Thảo's own, so the same assertions can prove the boundary lets the right person through. */
const OWN_COMPANY = 'Genky'

const FIXTURE_OBSERVATION = 'dddddddd-0039-4000-8000-000000000001'
const FIXTURE_CLAIM = 'dddddddd-0039-4000-8000-000000000002'
const FIXTURE_PROPOSAL = 'dddddddd-0039-4000-8000-000000000003'
/** A quote no seeded page contains, so leaking it anywhere is unambiguous. */
const SECRET_QUOTE = 'Khach ky hop dong thue ngoai 4,2 trieu do voi doi tac Bac Au'

let otherCompanyId: string
let ownCompanyId: string
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

  otherCompanyId = await companyIdByName(OTHER_COMPANY)
  ownCompanyId = await companyIdByName(OWN_COMPANY)
  await seedPendingProposalFor(otherCompanyId)

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

async function companyIdByName(name: string): Promise<string> {
  const { rows } = await owner.query('SELECT id FROM companies WHERE name = $1', [name])
  if (rows.length === 0) throw new Error(`Seed has no company named "${name}"`)
  return rows[0].id
}

/**
 * Written straight to the tables, like the T-9 harness does: what the queue holds after a real
 * read depends on what the model returned, and a boundary test cannot be allowed to pass
 * vacuously against an empty queue.
 */
async function seedPendingProposalFor(companyId: string): Promise<void> {
  const rawContent = `Ban tin cong ty. ${SECRET_QUOTE}.`
  await owner.query('DELETE FROM proposals WHERE id = $1', [FIXTURE_PROPOSAL])
  await owner.query('DELETE FROM claims WHERE id = $1', [FIXTURE_CLAIM])
  await owner.query('DELETE FROM observations WHERE id = $1', [FIXTURE_OBSERVATION])

  await owner.query(
    `INSERT INTO observations (id, company_id, source_url, raw_content, extractor_version,
                               content_hash, fetch_status)
     VALUES ($1, $2, 'https://example.test/ban-tin', $3, 'owner-boundary-fixture',
             'owner-boundary-hash', 'ok')`,
    [FIXTURE_OBSERVATION, companyId, rawContent],
  )
  await owner.query(
    `INSERT INTO claims (id, company_id, observation_id, statement, signal_type, confidence,
                         quote_text, quote_start, quote_end, trigger_context)
     VALUES ($1, $2, $3, 'Khach ky hop dong thue ngoai lon', 'expansion', 'likely', $4, $5, $6,
             'manual_ingest')`,
    [
      FIXTURE_CLAIM,
      companyId,
      FIXTURE_OBSERVATION,
      SECRET_QUOTE,
      rawContent.indexOf(SECRET_QUOTE),
      rawContent.indexOf(SECRET_QUOTE) + SECRET_QUOTE.length,
    ],
  )
  await owner.query(
    `INSERT INTO proposals (id, company_id, claim_id, proposal_type, proposed_value,
                            impact_if_wrong, status)
     VALUES ($1, $2, $3, 'timeline_entry', $4, 'Sai thi dong thoi gian mang tin khong co that',
             'pending')`,
    [FIXTURE_PROPOSAL, companyId, FIXTURE_CLAIM, SECRET_QUOTE],
  )
}

function get(path: string, cookie: string) {
  return http().get(path).set('Cookie', cookie)
}

describe('the suggestion queue is scoped to the companies a person looks after', () => {
  it('shows a sales person only their own companies suggestions', async () => {
    const res = await get('/api/proposals', sales1Cookie).expect(200)
    const companies = res.body.map((row: { companyName: string }) => row.companyName)
    expect(companies).not.toContain(OTHER_COMPANY)
  })

  it('shows the owner their own suggestion', async () => {
    const res = await get('/api/proposals', sales2Cookie).expect(200)
    const ids = res.body.map((row: { id: string }) => row.id)
    expect(ids).toContain(FIXTURE_PROPOSAL)
  })

  it('shows an admin every companys suggestions', async () => {
    const res = await get('/api/proposals', adminCookie).expect(200)
    const ids = res.body.map((row: { id: string }) => row.id)
    expect(ids).toContain(FIXTURE_PROPOSAL)
  })

  /**
   * The badge counts have to agree with the list, or a company row shows "nothing waiting" for a
   * queue the reader is simply not allowed to see — a false statement rather than a blank one,
   * which is what rule 4 of CLAUDE.md forbids.
   */
  it('counts in the pending summary only what the same person can open', async () => {
    const mine = await get('/api/proposals/pending-summary', sales1Cookie).expect(200)
    expect(mine.body[otherCompanyId]).toBeUndefined()

    const theirs = await get('/api/proposals/pending-summary', sales2Cookie).expect(200)
    expect(theirs.body[otherCompanyId]).toBeGreaterThan(0)
  })
})

describe('the evidence behind a suggestion is scoped the same way', () => {
  /**
   * This is the endpoint that made "scope the queue only" a fiction: for a `timeline_entry`
   * suggestion the proposed value IS the claim statement, and the reading zone serves the claim
   * with its verbatim quote attached.
   */
  it('refuses another persons reading zone instead of serving the quote', async () => {
    const res = await get(`/api/companies/${otherCompanyId}/reading-zone`, sales1Cookie)
    expect(res.status).toBe(404)
    expect(JSON.stringify(res.body)).not.toContain(SECRET_QUOTE)
  })

  it('serves the reading zone to the person who looks after the company', async () => {
    const res = await get(`/api/companies/${otherCompanyId}/reading-zone`, sales2Cookie).expect(200)
    expect(JSON.stringify(res.body)).toContain(SECRET_QUOTE)
  })

  it('refuses another companys timeline', async () => {
    await get(`/api/companies/${otherCompanyId}/timeline`, sales1Cookie).expect(404)
    await get(`/api/companies/${otherCompanyId}/timeline`, sales2Cookie).expect(200)
  })
})

describe('the company and deal lists are scoped', () => {
  it('leaves other peoples companies out of the list', async () => {
    const res = await get('/api/companies', sales1Cookie).expect(200)
    const names = res.body.items.map((row: { name: string }) => row.name)
    expect(names).toContain(OWN_COMPANY)
    expect(names).not.toContain(OTHER_COMPANY)
  })

  it('gives an admin every company', async () => {
    const res = await get('/api/companies', adminCookie).expect(200)
    const names = res.body.items.map((row: { name: string }) => row.name)
    expect(names).toContain(OWN_COMPANY)
    expect(names).toContain(OTHER_COMPANY)
  })

  it('refuses another persons company by id rather than 403, which would confirm it exists', async () => {
    await get(`/api/companies/${otherCompanyId}`, sales1Cookie).expect(404)
    await get(`/api/companies/${ownCompanyId}`, sales1Cookie).expect(200)
  })

  it('leaves deals at other peoples companies out of the deal list', async () => {
    const res = await get('/api/opportunities', sales1Cookie).expect(200)
    const companyIds = res.body.map((row: { companyId: string }) => row.companyId)
    expect(companyIds).not.toContain(otherCompanyId)
  })

  /**
   * The list that hands out the event ids the undo button acts on. Left unscoped it is the first
   * half of a cross-owner WRITE, which is why it belongs to the read phase rather than being
   * left for the write one.
   */
  it('leaves other peoples auto next step events out of the active list', async () => {
    const res = await get('/api/opportunities/auto-next-steps', sales1Cookie).expect(200)
    // Keyed by opportunity id, so the company is read off each entry's claim.
    const companyIds = Object.values(
      res.body as Record<string, { claim: { companyId: string } }>,
    ).map((entry) => entry.claim.companyId)
    expect(companyIds).not.toContain(otherCompanyId)
  })
})

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
 * ADR-0047 on the company list, and the three things that go wrong quietly if nobody checks.
 *
 * 1. `page` ABSENT means every row. Five of this endpoint's six callers want the whole list, and
 *    a default of twenty would have shortened all five without an error anywhere.
 * 2. `total` counts what matches the FILTER, not the table. A total that ignored the filter would
 *    draw a pager for pages that cannot be reached.
 * 3. ORDER BY ends in `id`, so rows sharing a sort key land on exactly one page each.
 *
 * The collation test is the one the plan called mandatory. Sorting moved to Postgres when the
 * list became paged — a browser can only sort the page it was given — so the Vietnamese ordering
 * is now the database's answer, and an answer nobody measured is an assumption.
 */

let app: INestApplication
let owner: Pool

const ADMIN = SEED_USERS.find((user) => user.role === 'admin')!

/** Đ after D, and the diacritics in vowel order — the two things a default C collation gets wrong. */
const COLLATION_NAMES = ['Da Nang Corp', 'Đông Á Corp', 'Dương Minh Corp', 'Cường Thịnh Corp']
const COLLATION_IDS = COLLATION_NAMES.map((_, index) => `dddddddd-0040-4000-8000-00000000000${index}`)
/** Two rows with the SAME name, so the `id` tiebreaker is the only thing separating them. */
const TWIN_NAME = 'Zz Cong Ty Trung Ten'
const TWIN_IDS = ['dddddddd-0040-4000-8000-000000000010', 'dddddddd-0040-4000-8000-000000000011']

let adminCookie: string

beforeAll(async () => {
  owner = new Pool({ connectionString: process.env.DATABASE_URL_TEST })
  await seed(process.env.DATABASE_URL_TEST as string, loadDefaultDataset())

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
  app = moduleRef.createNestApplication()
  app.use(cookieParser())
  app.setGlobalPrefix('api')
  await app.init()

  for (const [index, name] of COLLATION_NAMES.entries()) {
    await insertCompany(COLLATION_IDS[index], name, 'Kiem thu sap xep')
  }
  for (const id of TWIN_IDS) await insertCompany(id, TWIN_NAME, 'Kiem thu trung ten')

  adminCookie = await login(ADMIN.email)
}, 60_000)

afterAll(async () => {
  /**
   * The six fixtures are removed again. Every file here reseeds in `beforeAll`, but a file that
   * leaves rows behind still pollutes anything running between its inserts and the next reseed —
   * and a list endpoint is exactly what other files count.
   */
  await owner?.query('DELETE FROM companies WHERE id = ANY($1)', [
    [...COLLATION_IDS, ...TWIN_IDS],
  ])
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

async function insertCompany(id: string, name: string, industry: string): Promise<void> {
  await owner.query('DELETE FROM companies WHERE id = $1', [id])
  await owner.query(
    `INSERT INTO companies (id, name, industry, company_type) VALUES ($1, $2, $3, 'it_solution')`,
    [id, name, industry],
  )
}

async function list(queryString = '') {
  const res = await http().get(`/api/companies${queryString}`).set('Cookie', adminCookie).expect(200)
  return res.body as { items: { id: string; name: string }[]; total: number; pageSize: number }
}

describe('an absent page means the whole list', () => {
  it('returns every company when no page is asked for', async () => {
    const body = await list()
    expect(body.items).toHaveLength(body.total)
    expect(body.total).toBeGreaterThanOrEqual(11)
  })

  it('ignores a page that is not a whole number above zero, rather than guessing one', async () => {
    const nonsense = await list('?page=0')
    const everything = await list()
    expect(nonsense.items).toHaveLength(everything.items.length)
  })
})

describe('paging cuts the list and reports the whole size', () => {
  it('returns one page and the total across all of them', async () => {
    const body = await list('?page=1&pageSize=3')
    expect(body.items).toHaveLength(3)
    expect(body.total).toBeGreaterThan(3)
  })

  it('counts what matches the FILTER, not the table', async () => {
    const filtered = await list('?industry=Kiem%20thu%20sap%20xep&page=1&pageSize=2')
    expect(filtered.total).toBe(COLLATION_NAMES.length)
  })

  it('walks every page without repeating or losing a row', async () => {
    const everything = await list()
    const collected: string[] = []

    for (let page = 1; collected.length < everything.total; page += 1) {
      const body = await list(`?page=${page}&pageSize=3`)
      collected.push(...body.items.map((row) => row.id))
      if (body.items.length === 0) break
    }

    expect(new Set(collected).size).toBe(everything.total)
  })

  /**
   * Two companies with an identical name. Only `id` separates them, and without it as the last
   * ORDER BY key one could be served on two pages, or on neither.
   */
  it('keeps rows with an identical name on exactly one page each', async () => {
    const seen: string[] = []
    const everything = await list()

    for (let page = 1; page <= Math.ceil(everything.total / 2); page += 1) {
      const body = await list(`?page=${page}&pageSize=2`)
      seen.push(...body.items.filter((row) => row.name === TWIN_NAME).map((row) => row.id))
    }

    expect(seen.sort()).toEqual([...TWIN_IDS].sort())
  })
})

describe('the database does the sorting, so the order has to be measured', () => {
  /**
   * The mandatory collation check. Vietnamese puts Đ after D and orders the diacritics; a plain
   * byte comparison puts every accented letter after Z, which would silently mis-sort a company
   * list that is mostly Vietnamese names. If this fails, the fallback recorded in ADR-0047 is to
   * stop offering sort while the list is paged rather than to ship a wrong order.
   */
  it('orders Vietnamese names the way a Vietnamese reader expects', async () => {
    const body = await list('?industry=Kiem%20thu%20sap%20xep&sortBy=name&sortDir=asc')
    expect(body.items.map((row) => row.name)).toEqual([
      'Cường Thịnh Corp',
      'Da Nang Corp',
      'Dương Minh Corp',
      'Đông Á Corp',
    ])
  })

  it('reverses on request', async () => {
    const ascending = await list('?industry=Kiem%20thu%20sap%20xep&sortBy=name&sortDir=asc')
    const descending = await list('?industry=Kiem%20thu%20sap%20xep&sortBy=name&sortDir=desc')
    expect(descending.items.map((row) => row.name)).toEqual(
      ascending.items.map((row) => row.name).reverse(),
    )
  })
})

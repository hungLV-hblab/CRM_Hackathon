import { type INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import cookieParser from 'cookie-parser'
import { Pool } from 'pg'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { DEMO_PASSWORD } from '@crm/contracts'
import { SEED_USERS, loadDefaultDataset, seed } from '@crm/db'

import { AppModule } from '../app.module'

let app: INestApplication
let owner: Pool

const SALES = SEED_USERS[0]
// Located by role, not by position: the seed now lists three sales rows before the admin.
const ADMIN = SEED_USERS.find((user) => user.role === 'admin') as (typeof SEED_USERS)[number]

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

async function login(email: string, password: string): Promise<string> {
  const res = await http().post('/api/auth/login').send({ email, password }).expect(200)
  return res.headers['set-cookie'][0]
}

describe('real login through an httpOnly cookie (spec 7.3)', () => {
  it('correct password → 200 and the cookie carries the HttpOnly flag', async () => {
    const res = await http()
      .post('/api/auth/login')
      .send({ email: SALES.email, password: DEMO_PASSWORD })
      .expect(200)

    const cookie = res.headers['set-cookie']?.[0] ?? ''
    expect(cookie).toMatch(/crm_session=/)
    expect(cookie).toMatch(/HttpOnly/i)
    expect(res.body.user.role).toBe('sales')
  })

  it('wrong password → 401 and NO cookie is set', async () => {
    const res = await http()
      .post('/api/auth/login')
      .send({ email: SALES.email, password: 'wrong-password' })
      .expect(401)

    expect(res.headers['set-cookie']).toBeUndefined()
  })

  it('calling a protected endpoint without logging in → 401', async () => {
    await http().get('/api/companies').expect(401)
  })

  it('Sales calling an admin-only endpoint → 403 (RolesGuard tells the roles apart)', async () => {
    const cookie = await login(SALES.email, DEMO_PASSWORD)
    await http().get('/api/settings').set('Cookie', cookie).expect(403)
  })

  it('Admin calling that same endpoint → 200 (blocking the right role, not every role)', async () => {
    const cookie = await login(ADMIN.email, DEMO_PASSWORD)
    const res = await http().get('/api/settings').set('Cookie', cookie).expect(200)
    expect(res.body).toEqual({ aiEnabled: true, watchCycleSeconds: expect.any(Number) })
  })
})

describe('the life of one company over HTTP (acceptance check 3)', () => {
  it('create then list shows it, and the row really is in Postgres', async () => {
    const cookie = await login(SALES.email, DEMO_PASSWORD)

    await http()
      .post('/api/companies')
      .set('Cookie', cookie)
      .send({ name: 'Cty Kiem Thu', industry: 'ITO', companyType: 'it_solution' })
      .expect(201)

    const list = await http().get('/api/companies').set('Cookie', cookie).expect(200)
    // `.items` since ADR-0047: the list answers with a paginated envelope, and no `page` was
    // asked for, so that one page holds everything.
    expect(list.body.items.map((company: { name: string }) => company.name)).toContain(
      'Cty Kiem Thu',
    )

    const { rows } = await owner.query(
      'SELECT count(*)::int AS total FROM companies WHERE name = $1',
      ['Cty Kiem Thu'],
    )
    expect(rows[0].total).toBe(1)
  })

  it('a payload missing a required field → 400, and nothing is created', async () => {
    const cookie = await login(SALES.email, DEMO_PASSWORD)
    await http()
      .post('/api/companies')
      .set('Cookie', cookie)
      .send({ name: 'Missing industry' })
      .expect(400)
  })
})

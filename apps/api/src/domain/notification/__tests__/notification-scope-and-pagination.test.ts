import { type INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import cookieParser from 'cookie-parser'
import { Pool } from 'pg'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { DEMO_PASSWORD } from '@crm/contracts'
import { SEED_USERS, loadDefaultDataset, seed } from '@crm/db'

import { AppModule } from '../../../app.module'

/**
 * Two things at once, because they touch the same three methods.
 *
 * THE DEFECT. `markRead` selected a notice by id and then updated it by id, with no condition on
 * whose it was — so any signed-in person could mark another person's notice as seen. Under
 * ontology 3.3 a notice must not disappear before the person it belongs to has read it, and the
 * strip on the deal board hides what is read: marking someone else's notice seen removed their
 * only prompt that the machine had written to their deal.
 *
 * THE PAGINATION. `unreadOnly=false` has a test of its own on purpose. The first draft of the
 * contract reached for `z.coerce.boolean()`, which is `Boolean(input)` and turns the string
 * "false" into `true`; a suite that only ever passes `true` stays green while the history page
 * silently shows unread rows only. ADR-0047.
 */

let app: INestApplication
let owner: Pool

const SALES1 = SEED_USERS[0]
const SALES2 = SEED_USERS.find((user) => user.email === 'sales2@hblab.vn')!

let sales1Cookie: string
let sales2Cookie: string

beforeAll(async () => {
  owner = new Pool({ connectionString: process.env.DATABASE_URL_TEST })
  await seed(process.env.DATABASE_URL_TEST as string, loadDefaultDataset())

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
  app = moduleRef.createNestApplication()
  app.use(cookieParser())
  app.setGlobalPrefix('api')
  await app.init()

  sales1Cookie = await login(SALES1.email)
  sales2Cookie = await login(SALES2.email)
}, 60_000)

afterAll(async () => {
  await app?.close()
  await owner?.end()
})

beforeEach(async () => {
  await owner.query('DELETE FROM notifications')
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

/**
 * Notices are normally raised inside the transaction of the write they announce, so there is no
 * endpoint that creates one. Written directly here for the same reason the T-9 harness does it:
 * producing them for real means running the watch cycle, and this file is about who may read and
 * mark them.
 *
 * `created_at` is stepped by whole seconds EXCEPT for the pair at index 1 and 2, which share a
 * timestamp deliberately — that collision is what the tiebreaker test needs.
 */
async function seedNotices(userId: string, count: number): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    const secondsAgo = index === 2 ? 1 : index
    await owner.query(
      `INSERT INTO notifications (user_id, message, created_at)
       VALUES ($1, $2, now() - ($3 || ' seconds')::interval)`,
      [userId, `Thong bao so ${index}`, String(secondsAgo)],
    )
  }
}

async function readAtFor(userId: string): Promise<(Date | null)[]> {
  const { rows } = await owner.query(
    'SELECT read_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC',
    [userId],
  )
  return rows.map((row) => row.read_at)
}

async function anyNoticeIdOf(userId: string): Promise<string> {
  const { rows } = await owner.query('SELECT id FROM notifications WHERE user_id = $1 LIMIT 1', [
    userId,
  ])
  return rows[0].id
}

describe('a notice can only be marked seen by the person it belongs to', () => {
  it('refuses to mark another persons notice, and leaves it unread', async () => {
    await seedNotices(SALES2.id, 1)
    const theirNotice = await anyNoticeIdOf(SALES2.id)

    await http()
      .post(`/api/notifications/${theirNotice}/read`)
      .set('Cookie', sales1Cookie)
      .expect(404)

    expect(await readAtFor(SALES2.id)).toEqual([null])
  })

  it('lets the owner mark their own notice seen', async () => {
    await seedNotices(SALES1.id, 1)
    const mine = await anyNoticeIdOf(SALES1.id)

    await http().post(`/api/notifications/${mine}/read`).set('Cookie', sales1Cookie).expect(204)

    expect((await readAtFor(SALES1.id))[0]).not.toBeNull()
  })
})

describe('marking everything seen touches only the callers own notices', () => {
  it('clears the callers unread notices and leaves everybody elses alone', async () => {
    await seedNotices(SALES1.id, 3)
    await seedNotices(SALES2.id, 2)

    await http().post('/api/notifications/read-all').set('Cookie', sales1Cookie).expect(204)

    expect(await readAtFor(SALES1.id)).not.toContain(null)
    expect(await readAtFor(SALES2.id)).toEqual([null, null])
  })

  it('is safe to press twice', async () => {
    await seedNotices(SALES1.id, 2)
    await http().post('/api/notifications/read-all').set('Cookie', sales1Cookie).expect(204)
    const afterFirst = await readAtFor(SALES1.id)

    await http().post('/api/notifications/read-all').set('Cookie', sales1Cookie).expect(204)
    expect(await readAtFor(SALES1.id)).toEqual(afterFirst)
  })

  /**
   * The route has to be declared before `:id/read`, or Nest matches "read-all" as an id and the
   * UUID pipe rejects it. Cheap to get wrong, invisible until someone presses the button.
   */
  it('is not swallowed by the single-notice route', async () => {
    await http().post('/api/notifications/read-all').set('Cookie', sales1Cookie).expect(204)
  })
})

describe('the list is paginated', () => {
  it('cuts the page and reports the total across all pages', async () => {
    await seedNotices(SALES1.id, 5)

    const first = await http()
      .get('/api/notifications?page=1&pageSize=2')
      .set('Cookie', sales1Cookie)
      .expect(200)
    expect(first.body.items).toHaveLength(2)
    expect(first.body.total).toBe(5)

    const last = await http()
      .get('/api/notifications?page=3&pageSize=2')
      .set('Cookie', sales1Cookie)
      .expect(200)
    expect(last.body.items).toHaveLength(1)
  })

  /**
   * Two notices sharing a `created_at` — which happens for real, because the watch cycle writes
   * several inside one transaction and runs every ten seconds in e2e. Without `id` as a
   * tiebreaker their relative order is undefined and one can land on both pages, or on neither.
   */
  it('keeps rows with equal timestamps on exactly one page each', async () => {
    await seedNotices(SALES1.id, 4)

    const pageOne = await http()
      .get('/api/notifications?page=1&pageSize=2')
      .set('Cookie', sales1Cookie)
      .expect(200)
    const pageTwo = await http()
      .get('/api/notifications?page=2&pageSize=2')
      .set('Cookie', sales1Cookie)
      .expect(200)

    const ids = [...pageOne.body.items, ...pageTwo.body.items].map((row: { id: string }) => row.id)
    expect(new Set(ids).size).toBe(4)
  })

  it('shows each person only their own notices', async () => {
    await seedNotices(SALES1.id, 2)
    await seedNotices(SALES2.id, 3)

    // Asserted from BOTH sides: a list that returned nothing to everyone would also satisfy
    // "sales1 does not see sales2's".
    const mine = await http().get('/api/notifications').set('Cookie', sales1Cookie).expect(200)
    expect(mine.body.total).toBe(2)

    const theirs = await http().get('/api/notifications').set('Cookie', sales2Cookie).expect(200)
    expect(theirs.body.total).toBe(3)
  })
})

describe('the unread filter reads the query string honestly', () => {
  it('narrows to unread when asked for unread', async () => {
    await seedNotices(SALES1.id, 3)
    const mine = await anyNoticeIdOf(SALES1.id)
    await http().post(`/api/notifications/${mine}/read`).set('Cookie', sales1Cookie).expect(204)

    const res = await http()
      .get('/api/notifications?unreadOnly=true')
      .set('Cookie', sales1Cookie)
      .expect(200)
    expect(res.body.total).toBe(2)
  })

  /**
   * The case `z.coerce.boolean()` gets wrong. If this returns the unread subset, the history page
   * at `/thong-bao` is hiding the very thing it exists to keep reachable.
   */
  it('returns read AND unread when asked for unreadOnly=false', async () => {
    await seedNotices(SALES1.id, 3)
    const mine = await anyNoticeIdOf(SALES1.id)
    await http().post(`/api/notifications/${mine}/read`).set('Cookie', sales1Cookie).expect(204)

    const res = await http()
      .get('/api/notifications?unreadOnly=false')
      .set('Cookie', sales1Cookie)
      .expect(200)
    expect(res.body.total).toBe(3)
  })
})

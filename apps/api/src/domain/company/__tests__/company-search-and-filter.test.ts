import { Pool } from 'pg'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { createConnection, resetTestDatabase } from '@crm/db'

import { AuditEventService } from '../../../common/audit/audit-event-service'
import { CompanyService } from '../company-service'
import { OpportunityService } from '../../opportunity/opportunity-service'
import { TimelineService } from '../../timeline/timeline-service'
import { humanActor } from '../../../common/actor/actor-context'

/**
 * Search, the four filters, and what a soft delete actually hides.
 *
 * The delete cases are the ones worth the setup: the flag is set on ONE table and every other
 * screen goes quiet through its join. If a query ever forgets `deletedAt IS NULL`, a deleted
 * company's deals reappear on the board with no company to open — which is how the second
 * half of this file fails rather than the first.
 */

const USER_ID = '11111111-1111-4111-8111-111111111111'
const SAKURA = 'bbbbbbbb-0001-4000-8000-000000000001'
const OHARA = 'bbbbbbbb-0002-4000-8000-000000000002'
const FPT = 'bbbbbbbb-0003-4000-8000-000000000003'

const owner = new Pool({ connectionString: process.env.DATABASE_URL_TEST })
const appConnection = createConnection(process.env.DATABASE_URL_TEST_APP as string)
const systemConnection = createConnection(process.env.DATABASE_URL_TEST_SYSTEM as string)

const audit = new AuditEventService(appConnection.db, systemConnection.db)
const companies = new CompanyService(appConnection.db, audit)
const opportunities = new OpportunityService(appConnection.db, systemConnection.db, audit)
const timeline = new TimelineService(appConnection.db, audit)
const sales = humanActor(USER_ID, 'sales')

beforeEach(async () => {
  await resetTestDatabase(owner)
  await owner.query(
    `INSERT INTO users (id, email, password_hash, name, role)
     VALUES ($1, 'sales@test.local', 'x', 'Sales', 'sales')`,
    [USER_ID],
  )
  await owner.query(
    `INSERT INTO companies (id, name, industry, company_type, country, is_watched, owner_id) VALUES
       ($1, 'Sakura Manufacturing KK', 'Sản xuất', 'traditional', 'Nhật Bản', true,  $4),
       ($2, 'Ohara Retail Group',      'Bán lẻ',   'traditional', 'Nhật Bản', false, $4),
       ($3, 'FPT Software',            'Sản xuất', 'it_solution', 'Việt Nam', true,  $4)`,
    [SAKURA, OHARA, FPT, USER_ID],
  )
})

afterAll(async () => {
  await Promise.all([owner.end(), appConnection.close(), systemConnection.close()])
})

async function namesFrom(query: Parameters<typeof companies.list>[0]): Promise<string[]> {
  const rows = await companies.list(query)
  return rows.map((row) => row.name)
}

describe('search by name', () => {
  it('1 · a fragment from the middle of the name matches, case-insensitively', async () => {
    expect(await namesFrom({ q: 'retail' })).toEqual(['Ohara Retail Group'])
  })

  it('2 · no query returns everything — an empty screen hides the data it exists to show', async () => {
    expect(await namesFrom({})).toHaveLength(3)
  })
})

describe('the four filters, combinable', () => {
  it('3 · industry', async () => {
    expect(await namesFrom({ industry: 'Sản xuất' })).toEqual(['FPT Software', 'Sakura Manufacturing KK'])
  })

  it('4 · companyType', async () => {
    expect(await namesFrom({ companyType: 'it_solution' })).toEqual(['FPT Software'])
  })

  it('5 · country', async () => {
    expect(await namesFrom({ country: 'Việt Nam' })).toEqual(['FPT Software'])
  })

  it('6 · isWatched, and false really means false rather than "unset"', async () => {
    expect(await namesFrom({ isWatched: true })).toEqual(['FPT Software', 'Sakura Manufacturing KK'])
    expect(await namesFrom({ isWatched: false })).toEqual(['Ohara Retail Group'])
  })

  it('7 · two filters narrow together', async () => {
    expect(await namesFrom({ industry: 'Sản xuất', country: 'Nhật Bản' })).toEqual([
      'Sakura Manufacturing KK',
    ])
  })
})

describe('a human may edit every profile cell', () => {
  it('8 · companyType included — I-11 constrains the AI, not the person who typed it', async () => {
    const updated = await companies.update(sales, SAKURA, { companyType: 'it_product' })

    expect(updated.companyType).toBe('it_product')
  })
})

describe('soft delete hides the company and everything read through it', () => {
  it('9 · the company leaves the list but its row survives', async () => {
    await companies.softDelete(sales, OHARA)

    expect(await namesFrom({})).toEqual(['FPT Software', 'Sakura Manufacturing KK'])
    const { rows } = await owner.query('SELECT deleted_at FROM companies WHERE id = $1', [OHARA])
    expect(rows[0].deleted_at).not.toBeNull()
  })

  it('10 · its opportunities disappear from the board without being deleted', async () => {
    const deal = await opportunities.create(sales, { companyId: OHARA, name: 'Gói ITO 2026' })

    await companies.softDelete(sales, OHARA)

    expect((await opportunities.list()).map((row) => row.id)).not.toContain(deal.id)
    const { rows } = await owner.query('SELECT count(*)::int AS total FROM opportunities')
    // Not cascaded: undeleting the company brings the deal back exactly as it was.
    expect(rows[0].total).toBe(1)
  })

  it('11 · timeline entries survive too', async () => {
    await timeline.add(sales, OHARA, {
      entryType: 'note',
      occurredAt: new Date().toISOString(),
      description: 'Khách hẹn gọi lại tháng sau',
    })

    await companies.softDelete(sales, OHARA)

    const { rows } = await owner.query('SELECT count(*)::int AS total FROM timeline_entries')
    expect(rows[0].total).toBe(1)
  })
})

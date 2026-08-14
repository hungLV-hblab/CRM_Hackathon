import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { Pool } from 'pg'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { createConnection, resetTestDatabase } from '@crm/db'

import { AuditEventService } from '../common/audit/audit-event-service'
import { CompanyService } from '../domain/company/company-service'
import { OpportunityService } from '../domain/opportunity/opportunity-service'
import { SYSTEM_ACTOR, humanActor } from '../common/actor/actor-context'

/**
 * T-10 IN FULL — "đổi giai đoạn · đổi giá trị tiền · xoá công ty dưới danh nghĩa hệ thống, không
 * qua UI → cả ba bị từ chối".
 *
 * The organisers' script says "not through the user interface", so nothing here boots HTTP or
 * passes a guard. Two layers are exercised for each of the three branches, and they catch
 * DIFFERENT failures — phase 7 measured that a CHECK constraint cannot stand in for a column
 * GRANT and vice versa, so they are never collapsed into one:
 *
 *   - **Domain layer** (ADR-0004): the service is constructed with `new` and called with
 *     `actor = system`. It must throw, must leave the row untouched, and must record an
 *     `AuditEvent` — Postgres alone answers `permission denied for table opportunities`, a
 *     sentence naming neither the caller nor the intent, and round 2 asks for the intent.
 *   - **Database layer** (ADR-0010): raw SQL over the `crm_system` connection, reaching past
 *     every line of application code. Delete the domain check and this half still goes red.
 *
 * A fourth assertion has no layer because it is about ABSENCE: boundary 3 of ontology section 5
 * forbids the machine contacting a customer, and the only honest proof is that no way to send
 * anything exists in the codebase at all.
 */

const USER_ID = '11111111-1111-4111-8111-111111111111'
const COMPANY_ID = 'ffffffff-0001-4000-8000-000000000001'
const OPPORTUNITY_ID = 'ffffffff-0002-4000-8000-000000000002'

const ORIGINAL_STAGE = 'qualified'
const ORIGINAL_VALUE = '100000.00'

const appConnection = createConnection(process.env.DATABASE_URL_TEST_APP as string)
const systemConnection = createConnection(process.env.DATABASE_URL_TEST_SYSTEM as string)
const owner = new Pool({ connectionString: process.env.DATABASE_URL_TEST })

/** The raw `crm_system` connection — no Drizzle, no service, no guard between it and Postgres. */
const systemSql = new Pool({ connectionString: process.env.DATABASE_URL_TEST_SYSTEM })

const audit = new AuditEventService(appConnection.db, systemConnection.db)
const opportunities = new OpportunityService(appConnection.db, systemConnection.db, audit)
const companies = new CompanyService(appConnection.db, audit)

beforeEach(async () => {
  await resetTestDatabase(owner)
  await owner.query(
    `INSERT INTO users (id, email, password_hash, name, role)
     VALUES ($1, 'sales@test.local', 'x', 'Sales', 'sales')`,
    [USER_ID],
  )
  await owner.query(
    `INSERT INTO companies (id, name, industry, company_type, owner_id)
     VALUES ($1, 'T10 company', 'ITO', 'it_solution', $2)`,
    [COMPANY_ID, USER_ID],
  )
  await owner.query(
    `INSERT INTO opportunities (id, company_id, name, expected_value, stage)
     VALUES ($1, $2, 'T10 opportunity', $3, $4)`,
    [OPPORTUNITY_ID, COMPANY_ID, ORIGINAL_VALUE, ORIGINAL_STAGE],
  )
})

afterAll(async () => {
  await Promise.all([
    appConnection.close(),
    systemConnection.close(),
    owner.end(),
    systemSql.end(),
  ])
})

async function readOpportunity(): Promise<{ stage: string; expected_value: string }> {
  const { rows } = await owner.query(
    'SELECT stage, expected_value FROM opportunities WHERE id = $1',
    [OPPORTUNITY_ID],
  )
  return rows[0]
}

async function countRefusals(action: string): Promise<number> {
  const { rows } = await owner.query(
    `SELECT count(*)::int AS total FROM audit_events
      WHERE action = $1 AND actor = 'system' AND detail->>'outcome' = 'refused'`,
    [action],
  )
  return rows[0].total
}

describe('T-10 · lớp domain — gọi thẳng service với actor = system', () => {
  it('1 · đổi giai đoạn bị từ chối, có ghi vết, dữ liệu nguyên vẹn', async () => {
    await expect(
      opportunities.updateStage(SYSTEM_ACTOR, OPPORTUNITY_ID, 'won'),
    ).rejects.toThrow(/không được đổi giai đoạn/i)

    // Three assertions, not one: a service that throws AND writes anyway would pass on "it threw".
    expect(await countRefusals('update_stage')).toBe(1)
    expect((await readOpportunity()).stage).toBe(ORIGINAL_STAGE)
  })

  it('2 · đổi giá trị tiền bị từ chối, có ghi vết, dữ liệu nguyên vẹn', async () => {
    await expect(
      opportunities.update(SYSTEM_ACTOR, OPPORTUNITY_ID, { expectedValue: '999999' }),
    ).rejects.toThrow(/không được sửa cơ hội/i)

    expect(await countRefusals('update_opportunity')).toBe(1)
    expect((await readOpportunity()).expected_value).toBe(ORIGINAL_VALUE)
  })

  it('3 · xoá công ty bị từ chối, có ghi vết, công ty vẫn còn', async () => {
    await expect(companies.softDelete(SYSTEM_ACTOR, COMPANY_ID)).rejects.toThrow(
      /không được xoá công ty/i,
    )

    expect(await countRefusals('delete_company')).toBe(1)
    const { rows } = await owner.query('SELECT deleted_at FROM companies WHERE id = $1', [
      COMPANY_ID,
    ])
    expect(rows[0].deleted_at).toBeNull()
  })

  it('4 · cùng ba lời gọi dưới danh nghĩa người thì chạy — chặn đúng chỗ, không chặn tất cả', async () => {
    const sales = humanActor(USER_ID, 'sales')

    await opportunities.updateStage(sales, OPPORTUNITY_ID, 'negotiation')
    await opportunities.update(sales, OPPORTUNITY_ID, { expectedValue: '250000' })
    await companies.softDelete(sales, COMPANY_ID)

    const row = await readOpportunity()
    expect(row.stage).toBe('negotiation')
    expect(row.expected_value).toBe('250000.00')
    /**
     * A boundary that refused everyone would pass every test above and make the product useless.
     * No refusal was recorded here, because none happened.
     */
    expect(await countRefusals('update_stage')).toBe(0)
    expect(await countRefusals('delete_company')).toBe(0)
  })
})

describe('T-10 · lớp CSDL — SQL thô qua kết nối crm_system, không đi qua dòng mã nào', () => {
  it('5 · UPDATE stage → permission denied', async () => {
    await expect(
      systemSql.query('UPDATE opportunities SET stage = $1 WHERE id = $2', ['won', OPPORTUNITY_ID]),
    ).rejects.toThrow(/permission denied/i)

    expect((await readOpportunity()).stage).toBe(ORIGINAL_STAGE)
  })

  it('6 · UPDATE expected_value → permission denied', async () => {
    await expect(
      systemSql.query('UPDATE opportunities SET expected_value = $1 WHERE id = $2', [
        '999999',
        OPPORTUNITY_ID,
      ]),
    ).rejects.toThrow(/permission denied/i)

    expect((await readOpportunity()).expected_value).toBe(ORIGINAL_VALUE)
  })

  it('7 · xoá công ty — cả DELETE lẫn UPDATE deleted_at đều permission denied', async () => {
    /**
     * BOTH statements, because "xoá công ty" is a soft delete in this product: `crm_system` holds
     * SELECT on `companies` and nothing else, so the flag column is as unreachable as the row.
     * Testing only the hard DELETE would leave the path the application actually uses unmeasured.
     */
    await expect(
      systemSql.query('DELETE FROM companies WHERE id = $1', [COMPANY_ID]),
    ).rejects.toThrow(/permission denied/i)

    await expect(
      systemSql.query('UPDATE companies SET deleted_at = now() WHERE id = $1', [COMPANY_ID]),
    ).rejects.toThrow(/permission denied/i)

    const { rows } = await owner.query('SELECT deleted_at FROM companies WHERE id = $1', [
      COMPANY_ID,
    ])
    expect(rows[0].deleted_at).toBeNull()
  })

  it('8 · và crm_system vẫn ĐỌC được — chặn quyền ghi, không chặn cả kết nối', async () => {
    const { rows } = await systemSql.query('SELECT stage FROM opportunities WHERE id = $1', [
      OPPORTUNITY_ID,
    ])
    expect(rows[0].stage).toBe(ORIGINAL_STAGE)
  })
})

/**
 * Boundary 3 of ontology section 5 — "không liên hệ khách".
 *
 * Both halves are scanned, and the `package.json` half is the one that matters: a dependency
 * sitting in the manifest with no import yet is one line of code away from being a send path, and
 * a source-only scan would call that clean. Reading the manifests catches it while it is still
 * only a dependency.
 */
const MESSAGING_TOKENS = ['nodemailer', 'smtp', 'twilio', 'sendgrid', '@slack', 'mailgun']
const REPO_ROOT = resolve(__dirname, '../../../..')
const THIS_FILE = 't10-system-actor-blocked-at-both-layers.test.ts'

describe('T-10 · khẳng định thứ tư — không có đường gửi thư/tin nhắn nào tồn tại', () => {
  it('9 · không package.json nào trong workspace khai báo thư viện gửi tin', () => {
    const manifests = [
      'package.json',
      'apps/api/package.json',
      'apps/web/package.json',
      'packages/contracts/package.json',
      'packages/db/package.json',
    ]

    const found: string[] = []
    for (const manifest of manifests) {
      const parsed = JSON.parse(readFileSync(join(REPO_ROOT, manifest), 'utf8'))
      const names = [
        ...Object.keys(parsed.dependencies ?? {}),
        ...Object.keys(parsed.devDependencies ?? {}),
      ]
      for (const name of names) {
        if (MESSAGING_TOKENS.some((token) => name.toLowerCase().includes(token))) {
          found.push(`${manifest} → ${name}`)
        }
      }
    }

    expect(found, 'a messaging dependency appeared in the workspace').toEqual([])
  })

  it('10 · không file nguồn nào của API nhắc tới một đường gửi tin', () => {
    const found: string[] = []

    for (const file of typescriptFilesUnder(join(REPO_ROOT, 'apps/api/src'))) {
      // This file names every token in order to search for them; it is not a send path.
      if (file.endsWith(THIS_FILE)) continue

      const source = readFileSync(file, 'utf8').toLowerCase()
      for (const token of MESSAGING_TOKENS) {
        if (source.includes(token)) found.push(`${file} → ${token}`)
      }
    }

    expect(found, 'a messaging path appeared in apps/api/src').toEqual([])
  })
})

function typescriptFilesUnder(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) return typescriptFilesUnder(path)
    return path.endsWith('.ts') ? [path] : []
  })
}

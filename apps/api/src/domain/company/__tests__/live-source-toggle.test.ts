import { Pool } from 'pg'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { createConnection, loadDefaultDataset, resetTestDatabase } from '@crm/db'

import { AuditEventService } from '../../../common/audit/audit-event-service'
import { CompanyService } from '../company-service'
import type { Actor } from '../../../common/actor/actor-context'

/**
 * I-16 at the write path (ADR-0035): turning the live source ON for a company of the seed set is
 * REFUSED, and the refusal is recorded.
 *
 * Why this is absolute rather than a warning. T-6 and T-8 are triggered by flipping a company's
 * snapshot from `before` to `after`, and that is the only way a judge can replay those two
 * scenarios. A source that changes outside the judge's control makes two of the ten acceptance
 * checks unrepeatable — so the switch is not merely defaulted off for seed companies, it cannot
 * be turned on for them at all.
 *
 * The AuditEvent is the other half. Postgres would answer a permission problem with "permission
 * denied for table companies", a sentence naming neither the caller, the intent nor the row
 * (ADR-0010). Here there is no permission problem to lean on — `crm_app` may write the column —
 * so the refusal has to be produced and recorded by the domain, or round 2 has nothing to read.
 */

const SALES_ID = '11111111-1111-4111-8111-111111111111'
const SEED_COMPANY = loadDefaultDataset().companies[0]
const OUTSIDE_SEED = 'eeeeeeee-0004-4000-8000-000000000004'

const owner = new Pool({ connectionString: process.env.DATABASE_URL_TEST })
const appConnection = createConnection(process.env.DATABASE_URL_TEST_APP as string)
const systemConnection = createConnection(process.env.DATABASE_URL_TEST_SYSTEM as string)

const HUMAN: Actor = { kind: 'human', userId: SALES_ID }
const SYSTEM: Actor = { kind: 'system' }

function buildService(): CompanyService {
  return new CompanyService(
    appConnection.db,
    new AuditEventService(appConnection.db, systemConnection.db),
  )
}

async function liveSourceEnabled(companyId: string): Promise<boolean> {
  const { rows } = await owner.query('SELECT live_source_enabled FROM companies WHERE id = $1', [
    companyId,
  ])
  return rows[0].live_source_enabled
}

async function auditEvents(): Promise<{ actor: string; action: string; entity_id: string }[]> {
  const { rows } = await owner.query(
    'SELECT actor, action, entity_id, detail FROM audit_events ORDER BY at',
  )
  return rows
}

beforeEach(async () => {
  await resetTestDatabase(owner)
  await owner.query(
    `INSERT INTO users (id, email, password_hash, name, role)
     VALUES ($1, 'sales@test.local', 'x', 'Sales', 'sales')`,
    [SALES_ID],
  )
  await owner.query(
    `INSERT INTO companies (id, name, industry, company_type, owner_id) VALUES
       ($1, $3, 'Sản xuất', 'traditional', $4),
       ($2, 'Công ty Sales tự thêm', 'ITO', 'it_solution', $4)`,
    [SEED_COMPANY.id, OUTSIDE_SEED, SEED_COMPANY.name, SALES_ID],
  )
})

afterAll(async () => {
  await Promise.all([owner.end(), appConnection.close(), systemConnection.close()])
})

describe('a company outside the seed set can be opted in', () => {
  it('1 · turning it on works and is reflected in the column', async () => {
    const company = await buildService().setLiveSourceEnabled(HUMAN, OUTSIDE_SEED, true)

    expect(company.liveSourceEnabled).toBe(true)
    expect(await liveSourceEnabled(OUTSIDE_SEED)).toBe(true)
  })

  it('2 · turning it back off works too', async () => {
    const service = buildService()
    await service.setLiveSourceEnabled(HUMAN, OUTSIDE_SEED, true)
    await service.setLiveSourceEnabled(HUMAN, OUTSIDE_SEED, false)

    expect(await liveSourceEnabled(OUTSIDE_SEED)).toBe(false)
  })
})

describe('I-16 · a seed company can never be opted in', () => {
  it('3 · turning it on is refused and the column stays off', async () => {
    await expect(
      buildService().setLiveSourceEnabled(HUMAN, SEED_COMPANY.id, true),
    ).rejects.toThrow(/bộ dữ liệu nghiệm thu|nghiệm thu/i)

    expect(await liveSourceEnabled(SEED_COMPANY.id)).toBe(false)
  })

  it('4 · the refusal is recorded exactly once, naming the company', async () => {
    await expect(
      buildService().setLiveSourceEnabled(HUMAN, SEED_COMPANY.id, true),
    ).rejects.toThrow()

    const events = await auditEvents()
    expect(events).toHaveLength(1)
    expect(events[0].action).toBe('enable_live_source')
    expect(events[0].entity_id).toBe(SEED_COMPANY.id)
    // Recorded under the human identity: a person asked for this and was told no. Recording it
    // as `system` would make the trail lie about who acted (audit-event-service.ts).
    expect(events[0].actor).toBe('human')
  })

  it('5 · every seed company is covered, not just the first one', async () => {
    const service = buildService()
    for (const seeded of loadDefaultDataset().companies.slice(1)) {
      await owner.query(
        `INSERT INTO companies (id, name, industry, company_type, owner_id)
         VALUES ($1, $2, 'Ngành', 'traditional', $3)`,
        [seeded.id, seeded.name, SALES_ID],
      )
      await expect(service.setLiveSourceEnabled(HUMAN, seeded.id, true)).rejects.toThrow()
      expect(await liveSourceEnabled(seeded.id)).toBe(false)
    }
  })

  it('6 · turning it OFF for a seed company is NOT refused — only enabling is', async () => {
    // The invariant protects the acceptance suite from an uncontrolled source. Moving toward the
    // snapshot can never threaten that, and a symmetric refusal would leave a seed company stuck
    // if the flag ever got set by a migration or by hand.
    await expect(
      buildService().setLiveSourceEnabled(HUMAN, SEED_COMPANY.id, false),
    ).resolves.toBeTruthy()

    expect(await auditEvents()).toHaveLength(0)
  })
})

describe('the AI identity may not touch the switch at all', () => {
  it('7 · a system actor is refused before the seed question is even asked', async () => {
    /**
     * Defence in depth, and neither layer is decoration: this one produces a readable refusal
     * with an actor and a row, while `crm_system` holding no UPDATE on `companies` means the same
     * call dies in Postgres even if this guard were removed (measured in
     * `live-source-columns-and-grants.test.ts` test 10).
     */
    await expect(
      buildService().setLiveSourceEnabled(SYSTEM, OUTSIDE_SEED, true),
    ).rejects.toThrow(/Hệ thống/i)

    expect(await liveSourceEnabled(OUTSIDE_SEED)).toBe(false)
    const events = await auditEvents()
    expect(events).toHaveLength(1)
    expect(events[0].actor).toBe('system')
  })
})

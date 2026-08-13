import { Pool } from 'pg'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { resetTestDatabase } from '@crm/db'

/**
 * The DATABASE half of feature group 3. Nothing here goes through a service on purpose: these
 * are the guarantees that must hold against a caller who bypasses the domain entirely, which
 * is the only kind of guarantee T-4 and I-11 are worth anything as.
 *
 * Three things are proven:
 *   1. the CHECK constraint pins each proposal kind to its own shape (ADR-0023)
 *   2. `status` is unreachable for `crm_system`, so an AI-filed proposal cannot arrive approved
 *   3. the column-level GRANT of `opportunity_id` is what lets `next_step` exist at all — and
 *      removing it breaks the insert, which is the mutation measurement ADR-0023 owes
 */

const SALES_ID = '11111111-1111-4111-8111-111111111111'
const COMPANY_ID = 'aaaaaaaa-0001-4000-8000-000000000001'
const OPPORTUNITY_ID = 'bbbbbbbb-0001-4000-8000-000000000001'

const owner = new Pool({ connectionString: process.env.DATABASE_URL_TEST })
const system = new Pool({ connectionString: process.env.DATABASE_URL_TEST_SYSTEM })

let claimId: string
let observationId: string

beforeEach(async () => {
  await resetTestDatabase(owner)
  await owner.query(
    `INSERT INTO users (id, email, password_hash, name, role)
     VALUES ($1, 'sales@test.local', 'x', 'Sales', 'sales')`,
    [SALES_ID],
  )
  await owner.query(
    `INSERT INTO companies (id, name, industry, company_type, owner_id)
     VALUES ($1, 'Sakura Manufacturing KK', 'Sản xuất', 'traditional', $2)`,
    [COMPANY_ID, SALES_ID],
  )
  await owner.query(
    `INSERT INTO opportunities (id, company_id, name, stage)
     VALUES ($1, $2, 'Gói bảo trì hệ thống 2026', 'qualified')`,
    [OPPORTUNITY_ID, COMPANY_ID],
  )
  const observation = await owner.query(
    `INSERT INTO observations (company_id, source_url, raw_content, fetch_status,
                              content_hash, extractor_version)
     VALUES ($1, 'https://example.test/news', 'Trụ sở chính: Aichi, Nhật Bản', 'ok',
             'hash-boundary-test', 'test')
     RETURNING id`,
    [COMPANY_ID],
  )
  observationId = observation.rows[0].id
  const claim = await owner.query(
    `INSERT INTO claims (company_id, observation_id, statement, signal_type, confidence,
                         quote_text, quote_start, quote_end, trigger_context)
     VALUES ($1, $2, 'Trụ sở tại Nhật Bản', 'other', 'certain',
             'Trụ sở chính: Aichi, Nhật Bản', 0, 29, 'watch_cycle')
     RETURNING id`,
    [COMPANY_ID, observationId],
  )
  claimId = claim.rows[0].id
})

afterAll(async () => {
  await Promise.all([owner.end(), system.end()])
})

function insertProposal(
  pool: Pool,
  columns: string,
  values: string,
  parameters: unknown[],
): Promise<unknown> {
  return pool.query(`INSERT INTO proposals (${columns}) VALUES (${values})`, parameters)
}

describe('the CHECK constraint pins every proposal kind to its own shape (ADR-0023)', () => {
  it('1 · `field_update` on a whitelisted field, no opportunity: accepted', async () => {
    await expect(
      insertProposal(
        owner,
        'company_id, claim_id, proposal_type, target_field, proposed_value',
        '$1, $2, $3, $4, $5',
        [COMPANY_ID, claimId, 'field_update', 'country', 'Nhật Bản'],
      ),
    ).resolves.toBeTruthy()
  })

  it('2 · I-11: `company_type` is refused by the database, not just by the service', async () => {
    await expect(
      insertProposal(
        owner,
        'company_id, claim_id, proposal_type, target_field, proposed_value',
        '$1, $2, $3, $4, $5',
        [COMPANY_ID, claimId, 'field_update', 'company_type', 'it_product'],
      ),
    ).rejects.toThrow(/proposals_target_field_matches_type/)
  })

  it('3 · I-11: `name` is refused too — the ban is on the pair, not on one field', async () => {
    await expect(
      insertProposal(
        owner,
        'company_id, claim_id, proposal_type, target_field, proposed_value',
        '$1, $2, $3, $4, $5',
        [COMPANY_ID, claimId, 'field_update', 'name', 'Tên mới'],
      ),
    ).rejects.toThrow(/proposals_target_field_matches_type/)
  })

  it('4 · `field_update` may not carry an opportunity — that shape belongs to `next_step`', async () => {
    await expect(
      insertProposal(
        owner,
        'company_id, claim_id, proposal_type, target_field, proposed_value, opportunity_id',
        '$1, $2, $3, $4, $5, $6',
        [COMPANY_ID, claimId, 'field_update', 'country', 'Nhật Bản', OPPORTUNITY_ID],
      ),
    ).rejects.toThrow(/proposals_target_field_matches_type/)
  })

  it('5 · `timeline_entry` carries neither a target field nor an opportunity', async () => {
    await expect(
      insertProposal(
        owner,
        'company_id, claim_id, proposal_type, proposed_value',
        '$1, $2, $3, $4',
        [COMPANY_ID, claimId, 'timeline_entry', 'Công ty vừa gọi vốn'],
      ),
    ).resolves.toBeTruthy()

    await expect(
      insertProposal(
        owner,
        'company_id, claim_id, proposal_type, target_field, proposed_value',
        '$1, $2, $3, $4, $5',
        [COMPANY_ID, claimId, 'timeline_entry', 'country', 'Công ty vừa gọi vốn'],
      ),
    ).rejects.toThrow(/proposals_target_field_matches_type/)
  })

  it('6 · `next_step` without an opportunity is refused — a deal-less next step cannot be decided', async () => {
    await expect(
      insertProposal(
        owner,
        'company_id, claim_id, proposal_type, target_field, proposed_value',
        '$1, $2, $3, $4, $5',
        [COMPANY_ID, claimId, 'next_step', 'next_step_text', 'Gọi lại về vòng Series B'],
      ),
    ).rejects.toThrow(/proposals_target_field_matches_type/)
  })

  it('7 · `next_step` with its opportunity and its own target field: accepted', async () => {
    await expect(
      insertProposal(
        owner,
        'company_id, claim_id, proposal_type, target_field, proposed_value, opportunity_id',
        '$1, $2, $3, $4, $5, $6',
        [COMPANY_ID, claimId, 'next_step', 'next_step_text', 'Gọi lại về vòng Series B', OPPORTUNITY_ID],
      ),
    ).resolves.toBeTruthy()
  })

  it('8 · `next_step` may not borrow a profile field name', async () => {
    await expect(
      insertProposal(
        owner,
        'company_id, claim_id, proposal_type, target_field, proposed_value, opportunity_id',
        '$1, $2, $3, $4, $5, $6',
        [COMPANY_ID, claimId, 'next_step', 'country', 'Nhật Bản', OPPORTUNITY_ID],
      ),
    ).rejects.toThrow(/proposals_target_field_matches_type/)
  })
})

describe('T-4 at the database layer: the AI cannot file an approved proposal', () => {
  it('9 · `crm_system` inserts a proposal and it comes out `pending`, unasked', async () => {
    await insertProposal(
      system,
      'company_id, claim_id, proposal_type, target_field, proposed_value',
      '$1, $2, $3, $4, $5',
      [COMPANY_ID, claimId, 'field_update', 'country', 'Nhật Bản'],
    )

    const { rows } = await owner.query('SELECT status FROM proposals')
    expect(rows[0].status).toBe('pending')
  })

  it('10 · `crm_system` naming `status` is refused: the column is not in its GRANT', async () => {
    await expect(
      insertProposal(
        system,
        'company_id, claim_id, proposal_type, target_field, proposed_value, status',
        '$1, $2, $3, $4, $5, $6',
        [COMPANY_ID, claimId, 'field_update', 'country', 'Nhật Bản', 'decided'],
      ),
    ).rejects.toThrow(/permission denied for column status|permission denied/i)
  })

  it('11 · `crm_system` cannot flip an existing proposal to `decided` — no UPDATE at all', async () => {
    await insertProposal(
      owner,
      'company_id, claim_id, proposal_type, target_field, proposed_value',
      '$1, $2, $3, $4, $5',
      [COMPANY_ID, claimId, 'field_update', 'country', 'Nhật Bản'],
    )

    await expect(system.query(`UPDATE proposals SET status = 'decided'`)).rejects.toThrow(
      /permission denied/i,
    )
  })

  it('12 · `crm_system` cannot record a decision — deciding is a human act by definition', async () => {
    await expect(
      system.query(
        `INSERT INTO proposal_decisions (proposal_id, decision, decided_by)
         VALUES (gen_random_uuid(), 'accept', $1)`,
        [SALES_ID],
      ),
    ).rejects.toThrow(/permission denied/i)
  })
})

describe('mutation measurement owed by ADR-0023: the column GRANT is load-bearing', () => {
  it('13 · revoking INSERT on `opportunity_id` breaks `next_step`, restoring it fixes it', async () => {
    const insertNextStep = (): Promise<unknown> =>
      insertProposal(
        system,
        'company_id, claim_id, proposal_type, target_field, proposed_value, opportunity_id',
        '$1, $2, $3, $4, $5, $6',
        [COMPANY_ID, claimId, 'next_step', 'next_step_text', 'Gọi lại về vòng Series B', OPPORTUNITY_ID],
      )

    await expect(insertNextStep()).resolves.toBeTruthy()

    try {
      await owner.query('REVOKE INSERT (opportunity_id) ON proposals FROM crm_system')
      // Without migration 0006 this is the state the code would ship in: group 4 raises an
      // I-7 proposal and the insert dies on a permission error. Loud, and on the safe side.
      await expect(insertNextStep()).rejects.toThrow(/permission denied/i)
    } finally {
      await owner.query('GRANT INSERT (opportunity_id) ON proposals TO crm_system')
    }

    await expect(insertNextStep()).resolves.toBeTruthy()
  })
})

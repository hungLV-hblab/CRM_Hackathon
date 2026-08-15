import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { resetTestDatabase } from '../testing/reset-test-database'

/**
 * Rebuilds the four ADR-0010 measurements as tests that run inside `pnpm test` — paying off
 * the debt that ADR records at its end ("so far only run by hand with psql").
 *
 * This is the SECOND defence layer of ADR-0004, measured at the lowest level: connecting
 * straight to Postgres as `crm_system`, with no HTTP, no service and no Drizzle in between.
 * If some AI code ever calls a repository directly, this is as far down as it can reach.
 *
 * Both directions are checked, deliberately: testing only the forbidden direction leaves an
 * over-broad GRANT green, and the team would believe it has two layers when it has one.
 */

const USER_ID = '11111111-1111-4111-8111-111111111111'
const COMPANY_ID = 'dddddddd-0001-4000-8000-000000000001'
const OPPORTUNITY_ID = 'eeeeeeee-0001-4000-8000-000000000001'

let owner: Pool
let system: Pool

beforeAll(async () => {
  owner = new Pool({ connectionString: process.env.DATABASE_URL_TEST })
  system = new Pool({ connectionString: process.env.DATABASE_URL_TEST_SYSTEM })

  await resetTestDatabase(owner)
  await owner.query(
    `INSERT INTO users (id, email, password_hash, name, role) VALUES ($1, 'sales@test.local', 'x', 'Sales', 'sales')`,
    [USER_ID],
  )
  await owner.query(
    `INSERT INTO companies (id, name, industry, company_type, owner_id)
     VALUES ($1, 'Grant test company', 'ITO', 'it_solution', $2)`,
    [COMPANY_ID, USER_ID],
  )
  await owner.query(
    `INSERT INTO opportunities (id, company_id, name, expected_value, stage)
     VALUES ($1, $2, 'Grant test opportunity', 100000, 'qualified')`,
    [OPPORTUNITY_ID, COMPANY_ID],
  )
})

afterAll(async () => {
  await Promise.all([owner?.end(), system?.end()])
})

/**
 * A snapshot and one finding drawn from it, created as `crm_owner` so no privilege is involved in
 * the setup. Needed since ADR-0029: a `system` timeline entry with no `source_claim_id` is refused
 * by the CHECK regardless of who writes it — an assertion on the official timeline with no source
 * behind it is the one row rule 1 exists to forbid.
 */
async function seedClaim(): Promise<string> {
  const rawContent = 'Cong ty vua bo nhiem Giam doc Cong nghe moi.'
  const quote = 'bo nhiem Giam doc Cong nghe moi'

  const observation = await owner.query(
    `INSERT INTO observations (company_id, source_url, raw_content, extractor_version,
                               content_hash, fetch_status)
     VALUES ($1, 'https://example.test/news', $2, 'v1', $3, 'ok') RETURNING id`,
    [COMPANY_ID, rawContent, `hash-${Date.now()}`],
  )
  const claim = await owner.query(
    `INSERT INTO claims (company_id, observation_id, statement, signal_type, confidence,
                         quote_text, quote_start, quote_end, trigger_context)
     VALUES ($1, $2, 'Cong ty co CTO moi', 'leadership_hire', 'likely', $3, $4, $5, 'watch_cycle')
     RETURNING id`,
    [
      COMPANY_ID,
      observation.rows[0].id,
      quote,
      rawContent.indexOf(quote),
      rawContent.indexOf(quote) + quote.length,
    ],
  )
  return claim.rows[0].id
}

describe('forbidden direction — crm_system cannot touch the absolute no-go zone (ontology 5)', () => {
  it('1 · setting the stage to won is refused', async () => {
    await expect(
      system.query(`UPDATE opportunities SET stage = 'won' WHERE id = $1`, [OPPORTUNITY_ID]),
    ).rejects.toThrow(/permission denied/i)
  })

  it('2 · changing the money value is refused', async () => {
    await expect(
      system.query(`UPDATE opportunities SET expected_value = 1 WHERE id = $1`, [OPPORTUNITY_ID]),
    ).rejects.toThrow(/permission denied/i)
  })

  it('2b · rearranging the board is refused — board_order sits outside the three-column grant', async () => {
    await expect(
      system.query(`UPDATE opportunities SET board_order = 0 WHERE id = $1`, [OPPORTUNITY_ID]),
    ).rejects.toThrow(/permission denied/i)
  })

  it('3 · deleting an opportunity is refused', async () => {
    await expect(system.query('DELETE FROM opportunities')).rejects.toThrow(/permission denied/i)
  })

  it('4 · deleting a timeline entry is refused', async () => {
    await expect(system.query('DELETE FROM timeline_entries')).rejects.toThrow(/permission denied/i)
  })

  it('4b · deleting a company is refused (the fourth boundary, which T-10 does try)', async () => {
    await expect(system.query('DELETE FROM companies')).rejects.toThrow(/permission denied/i)
  })
})

describe('allowed direction — crm_system can still do its job in autonomy zones 3 and 4', () => {
  it('5 · setting the next step succeeds (zone 3)', async () => {
    await system.query(
      `UPDATE opportunities SET next_step_text = 'goi lai', next_step_source = 'system' WHERE id = $1`,
      [OPPORTUNITY_ID],
    )
    const { rows } = await owner.query('SELECT next_step_text FROM opportunities WHERE id = $1', [
      OPPORTUNITY_ID,
    ])
    expect(rows[0].next_step_text).toBe('goi lai')
  })

  /**
   * ── NARROWED by ADR-0029, deliberately ──────────────────────────────────────────────────
   * This used to pass `created_by = 'system'` in the INSERT, which worked because `0001` granted
   * INSERT at TABLE level here. ADR-0029 took that away: `created_by` is what the "do hệ thống
   * thêm" label is read from, so an AI holding the column can write a row that reads as something
   * Sales typed. The label now comes from the DEFAULT instead, and naming the column at all is
   * refused — which is asserted right below, next to the allowed form so the pair reads together.
   *
   * The full matrix for this table (contact_id, the CHECK, the human direction) lives in
   * `column-grants-block-system-actor-on-timeline-entries.test.ts`.
   */
  it('6 · adding a timeline entry succeeds (zone 4), naming only the granted columns', async () => {
    const claimId = await seedClaim()

    await system.query(
      `INSERT INTO timeline_entries (company_id, entry_type, occurred_at, description, source_claim_id)
       VALUES ($1, 'system_entry', now(), 'watch cycle added an entry', $2)`,
      [COMPANY_ID, claimId],
    )
    const { rows } = await owner.query(
      `SELECT count(*)::int AS total FROM timeline_entries WHERE created_by = 'system'`,
    )
    expect(rows[0].total).toBe(1)
  })

  it('6b · but naming `created_by` is refused — the label is not the AI to write', async () => {
    const claimId = await seedClaim()

    await expect(
      system.query(
        `INSERT INTO timeline_entries (company_id, entry_type, occurred_at, description,
                                       source_claim_id, created_by)
         VALUES ($1, 'system_entry', now(), 'trong nhu nguoi go', $2, 'human')`,
        [COMPANY_ID, claimId],
      ),
    ).rejects.toThrow(/permission denied/i)
  })
})

describe('final state — what was refused must be UNCHANGED, not merely thrown at', () => {
  it('stage and money value are exactly what they were set up as', async () => {
    const { rows } = await owner.query(
      'SELECT stage, expected_value FROM opportunities WHERE id = $1',
      [OPPORTUNITY_ID],
    )
    expect(rows[0].stage).toBe('qualified')
    expect(Number(rows[0].expected_value)).toBe(100000)
  })
})

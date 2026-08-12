import { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { resetTestDatabase } from '../testing/reset-test-database'

/**
 * The second defence layer for the seven tables added by migration 0002, granted by 0003.
 *
 * ADR-0010 measured the trap on `UPDATE`: a table-level grant covers every column and a
 * column-level REVOKE cannot punch a hole in it. ADR-0015 claims the SAME trap exists on
 * `INSERT` — that `GRANT INSERT ON proposals` would let `crm_system` pass `status` straight in
 * and approve its own suggestion without needing any UPDATE privilege at all. That claim was
 * reasoning, not measurement, and ADR-0010 exists precisely because reasoning like it was
 * wrong once. This file is the measurement.
 *
 * Everything runs straight against Postgres as `crm_system` — no HTTP, no service, no Drizzle.
 * That is what T-10 means by "not through the user interface".
 *
 * Three groups, and all three are needed:
 * - allowed direction: a missing GRANT blocks feature groups 4 and 5 instead of protecting
 *   anything, and testing only the forbidden direction leaves that failure invisible.
 * - forbidden direction: the column lists of 0003 actually bite.
 * - defaults: the forbidden direction is only safe because the column the AI cannot write
 *   still receives the right value. Take the DEFAULT away and every "denied" below becomes a
 *   NULL in official data.
 */

const USER_ID = '11111111-1111-4111-8111-111111111111'
const COMPANY_ID = 'aaaaaaaa-0001-4000-8000-000000000001'
const OPPORTUNITY_ID = 'aaaaaaaa-0002-4000-8000-000000000002'
const OBSERVATION_ID = 'aaaaaaaa-0003-4000-8000-000000000003'
const CLAIM_ID = 'aaaaaaaa-0004-4000-8000-000000000004'
const PROPOSAL_ID = 'aaaaaaaa-0005-4000-8000-000000000005'
const AUTO_EVENT_ID = 'aaaaaaaa-0006-4000-8000-000000000006'
const NOTIFICATION_ID = 'aaaaaaaa-0007-4000-8000-000000000007'

const RAW_CONTENT = 'Cong ty X vua hoan tat vong gay von Series B 20 trieu USD.'
const QUOTE = 'vong gay von Series B'

let owner: Pool
let system: Pool

/** The rows every group starts from, created by `crm_owner` so no privilege is involved. */
async function seedFixture(): Promise<void> {
  await resetTestDatabase(owner)
  await owner.query(
    `INSERT INTO users (id, email, password_hash, name, role)
     VALUES ($1, 'sales@test.local', 'x', 'Sales', 'sales')`,
    [USER_ID],
  )
  await owner.query(
    `INSERT INTO companies (id, name, industry, company_type, owner_id, is_watched)
     VALUES ($1, 'AI tables test company', 'ITO', 'it_solution', $2, true)`,
    [COMPANY_ID, USER_ID],
  )
  await owner.query(
    `INSERT INTO opportunities (id, company_id, name, expected_value, stage)
     VALUES ($1, $2, 'AI tables test opportunity', 100000, 'qualified')`,
    [OPPORTUNITY_ID, COMPANY_ID],
  )
  await owner.query(
    `INSERT INTO observations (id, company_id, source_url, raw_content, extractor_version,
                               content_hash, fetch_status)
     VALUES ($1, $2, 'https://example.test/news', $3, 'v1', 'hash-before', 'ok')`,
    [OBSERVATION_ID, COMPANY_ID, RAW_CONTENT],
  )
  await owner.query(
    `INSERT INTO claims (id, company_id, observation_id, statement, signal_type, confidence,
                         quote_text, quote_start, quote_end, trigger_context)
     VALUES ($1, $2, $3, 'Cong ty vua goi von', 'funding', 'certain', $4, $5, $6, 'watch_cycle')`,
    [
      CLAIM_ID,
      COMPANY_ID,
      OBSERVATION_ID,
      QUOTE,
      RAW_CONTENT.indexOf(QUOTE),
      RAW_CONTENT.indexOf(QUOTE) + QUOTE.length,
    ],
  )
}

beforeAll(async () => {
  owner = new Pool({ connectionString: process.env.DATABASE_URL_TEST })
  system = new Pool({ connectionString: process.env.DATABASE_URL_TEST_SYSTEM })
})

afterAll(async () => {
  await Promise.all([owner?.end(), system?.end()])
})

beforeEach(seedFixture)

describe('allowed direction — crm_system can do its job in zones 1 to 4', () => {
  it('1 · zone 1: creates an observation', async () => {
    await system.query(
      `INSERT INTO observations (company_id, source_url, raw_content, extractor_version,
                                 content_hash, fetch_status)
       VALUES ($1, 'https://example.test/news', $2, 'v1', 'hash-after', 'ok')`,
      [COMPANY_ID, RAW_CONTENT],
    )
    const { rows } = await owner.query(
      `SELECT source_tier FROM observations WHERE content_hash = 'hash-after'`,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].source_tier).toBe('company_website')
  })

  it('2 · zone 1: creates a claim', async () => {
    await system.query(
      `INSERT INTO claims (company_id, observation_id, statement, signal_type, confidence,
                           quote_text, quote_start, quote_end, trigger_context)
       VALUES ($1, $2, 'Phat hien moi', 'funding', 'likely', $3, 0, 5, 'watch_cycle')`,
      [COMPANY_ID, OBSERVATION_ID, RAW_CONTENT.slice(0, 5)],
    )
    const { rows } = await owner.query(
      `SELECT count(*)::int AS total FROM claims WHERE statement = 'Phat hien moi'`,
    )
    expect(rows[0].total).toBe(1)
  })

  it('3 · zone 2: generates a proposal without naming `status`', async () => {
    await system.query(
      `INSERT INTO proposals (company_id, claim_id, proposal_type, target_field, proposed_value)
       VALUES ($1, $2, 'field_update', 'industry', 'Fintech')`,
      [COMPANY_ID, CLAIM_ID],
    )
    const { rows } = await owner.query(`SELECT status FROM proposals WHERE company_id = $1`, [
      COMPANY_ID,
    ])
    expect(rows).toHaveLength(1)
  })

  it('4 · zone 3: records an auto-next-step event without naming `undo_deadline`', async () => {
    await system.query(
      `INSERT INTO auto_next_step_events (opportunity_id, claim_id, previous_text,
                                          previous_source, new_text, new_due_date)
       VALUES ($1, $2, NULL, NULL, 'Goi lai sau tin goi von', now()::date + 3)`,
      [OPPORTUNITY_ID, CLAIM_ID],
    )
    const { rows } = await owner.query(
      `SELECT count(*)::int AS total FROM auto_next_step_events WHERE opportunity_id = $1`,
      [OPPORTUNITY_ID],
    )
    expect(rows[0].total).toBe(1)
  })

  it('5 · zone 3: raises a notification without naming `read_at`', async () => {
    await system.query(
      `INSERT INTO notifications (user_id, message) VALUES ($1, 'He thong da dat Viec tiep theo')`,
      [USER_ID],
    )
    const { rows } = await owner.query(`SELECT count(*)::int AS total FROM notifications`)
    expect(rows[0].total).toBe(1)
  })

  it('6 · reads contacts, because news is interpreted against who works there', async () => {
    await owner.query(
      `INSERT INTO contacts (company_id, name, title, is_primary)
       VALUES ($1, 'Nguyen Van A', 'CTO', true)`,
      [COMPANY_ID],
    )
    const { rows } = await system.query('SELECT name FROM contacts WHERE company_id = $1', [
      COMPANY_ID,
    ])
    expect(rows[0].name).toBe('Nguyen Van A')
  })
})

describe('forbidden direction — the column lists of 0003_grants_ai_tables.sql bite', () => {
  it('7 · cannot INSERT a proposal that is already decided (T-4 at the database layer)', async () => {
    await expect(
      system.query(
        `INSERT INTO proposals (company_id, claim_id, proposal_type, target_field,
                                proposed_value, status)
         VALUES ($1, $2, 'field_update', 'industry', 'Fintech', 'decided')`,
        [COMPANY_ID, CLAIM_ID],
      ),
    ).rejects.toThrow(/permission denied/i)
  })

  it('8 · cannot UPDATE a proposal status either — approving is a human act', async () => {
    await owner.query(
      `INSERT INTO proposals (id, company_id, claim_id, proposal_type, target_field, proposed_value)
       VALUES ($1, $2, $3, 'field_update', 'industry', 'Fintech')`,
      [PROPOSAL_ID, COMPANY_ID, CLAIM_ID],
    )
    await expect(
      system.query(`UPDATE proposals SET status = 'decided' WHERE id = $1`, [PROPOSAL_ID]),
    ).rejects.toThrow(/permission denied/i)
    const { rows } = await owner.query('SELECT status FROM proposals WHERE id = $1', [PROPOSAL_ID])
    expect(rows[0].status).toBe('pending')
  })

  it('9 · cannot shrink the 7-day undo window by writing `undo_deadline` (T-7)', async () => {
    await expect(
      system.query(
        `INSERT INTO auto_next_step_events (opportunity_id, claim_id, new_text, undo_deadline)
         VALUES ($1, $2, 'Goi lai', now())`,
        [OPPORTUNITY_ID, CLAIM_ID],
      ),
    ).rejects.toThrow(/permission denied/i)
  })

  it('10 · cannot fabricate an undo record by writing `undone_at`', async () => {
    await expect(
      system.query(
        `INSERT INTO auto_next_step_events (opportunity_id, claim_id, new_text, undone_at)
         VALUES ($1, $2, 'Goi lai', now())`,
        [OPPORTUNITY_ID, CLAIM_ID],
      ),
    ).rejects.toThrow(/permission denied/i)
  })

  it('11 · cannot UPDATE an auto event — undoing is a human clicking a button', async () => {
    await owner.query(
      `INSERT INTO auto_next_step_events (id, opportunity_id, claim_id, new_text)
       VALUES ($1, $2, $3, 'Goi lai')`,
      [AUTO_EVENT_ID, OPPORTUNITY_ID, CLAIM_ID],
    )
    await expect(
      system.query(`UPDATE auto_next_step_events SET undone_at = now() WHERE id = $1`, [
        AUTO_EVENT_ID,
      ]),
    ).rejects.toThrow(/permission denied/i)
  })

  it('12 · cannot mark its own notification as read on Sales behalf (T-6)', async () => {
    await expect(
      system.query(`INSERT INTO notifications (user_id, message, read_at) VALUES ($1, 'x', now())`, [
        USER_ID,
      ]),
    ).rejects.toThrow(/permission denied/i)
  })

  it('13 · cannot UPDATE `read_at` afterwards either', async () => {
    await owner.query(`INSERT INTO notifications (id, user_id, message) VALUES ($1, $2, 'x')`, [
      NOTIFICATION_ID,
      USER_ID,
    ])
    await expect(
      system.query('UPDATE notifications SET read_at = now() WHERE id = $1', [NOTIFICATION_ID]),
    ).rejects.toThrow(/permission denied/i)
    const { rows } = await owner.query('SELECT read_at FROM notifications WHERE id = $1', [
      NOTIFICATION_ID,
    ])
    expect(rows[0].read_at).toBeNull()
  })

  it('14 · cannot write its own score into proposal_decisions', async () => {
    await owner.query(
      `INSERT INTO proposals (id, company_id, claim_id, proposal_type, target_field, proposed_value)
       VALUES ($1, $2, $3, 'field_update', 'industry', 'Fintech')`,
      [PROPOSAL_ID, COMPANY_ID, CLAIM_ID],
    )
    await expect(
      system.query(
        `INSERT INTO proposal_decisions (proposal_id, decision, decided_by)
         VALUES ($1, 'accept', $2)`,
        [PROPOSAL_ID, USER_ID],
      ),
    ).rejects.toThrow(/permission denied/i)
  })

  it('15 · cannot write to contacts — people data is Sales data', async () => {
    await expect(
      system.query(`INSERT INTO contacts (company_id, name) VALUES ($1, 'Nguoi la')`, [COMPANY_ID]),
    ).rejects.toThrow(/permission denied/i)
  })

  it.each([
    'observations',
    'claims',
    'proposals',
    'proposal_decisions',
    'auto_next_step_events',
    'notifications',
    'contacts',
  ])('16 · cannot DELETE from %s — the fourth absolute boundary', async (table) => {
    await expect(system.query(`DELETE FROM ${table}`)).rejects.toThrow(/permission denied/i)
  })
})

describe('the DEFAULTs the forbidden direction depends on', () => {
  it('17 · a proposal the AI inserted comes out `pending`, not NULL', async () => {
    await system.query(
      `INSERT INTO proposals (company_id, claim_id, proposal_type, target_field, proposed_value)
       VALUES ($1, $2, 'field_update', 'website', 'https://x.test')`,
      [COMPANY_ID, CLAIM_ID],
    )
    const { rows } = await owner.query('SELECT status FROM proposals WHERE company_id = $1', [
      COMPANY_ID,
    ])
    expect(rows[0].status).toBe('pending')
  })

  it('18 · an auto event the AI inserted gets a deadline 7 days out, not NULL', async () => {
    await system.query(
      `INSERT INTO auto_next_step_events (opportunity_id, claim_id, new_text)
       VALUES ($1, $2, 'Goi lai')`,
      [OPPORTUNITY_ID, CLAIM_ID],
    )
    const { rows } = await owner.query(
      `SELECT extract(epoch FROM (undo_deadline - now())) / 86400 AS days_left
       FROM auto_next_step_events WHERE opportunity_id = $1`,
      [OPPORTUNITY_ID],
    )
    expect(Number(rows[0].days_left)).toBeGreaterThan(6.9)
    expect(Number(rows[0].days_left)).toBeLessThan(7.1)
  })

  it('19 · a notification the AI raised starts UNREAD', async () => {
    await system.query(`INSERT INTO notifications (user_id, message) VALUES ($1, 'x')`, [USER_ID])
    const { rows } = await owner.query('SELECT read_at FROM notifications')
    expect(rows[0].read_at).toBeNull()
  })
})

/**
 * These run as `crm_owner`, which bypasses every column privilege. That is the point: what is
 * being proven here is the CONSTRAINT, not the grant — "thử ghi thẳng, phải bị từ chối" (T-2)
 * has to hold for the most privileged writer in the system, not merely for the AI role.
 */
describe('constraints that hold against raw SQL from any role (T-2 and I-11)', () => {
  it('20 · a claim with no quote cannot be stored at all (I-1)', async () => {
    await expect(
      owner.query(
        `INSERT INTO claims (company_id, observation_id, statement, signal_type, confidence,
                             quote_start, quote_end, trigger_context)
         VALUES ($1, $2, 'Khong co cau trich', 'funding', 'certain', 0, 5, 'watch_cycle')`,
        [COMPANY_ID, OBSERVATION_ID],
      ),
    ).rejects.toThrow(/not-null constraint|violates not-null/i)
  })

  it('21 · a blank quote is refused too — NOT NULL alone would let it through', async () => {
    await expect(
      owner.query(
        `INSERT INTO claims (company_id, observation_id, statement, signal_type, confidence,
                             quote_text, quote_start, quote_end, trigger_context)
         VALUES ($1, $2, 'Cau trich rong', 'funding', 'certain', '   ', 0, 5, 'watch_cycle')`,
        [COMPANY_ID, OBSERVATION_ID],
      ),
    ).rejects.toThrow(/claims_quote_text_not_blank/i)
  })

  it('22 · an impossible quote span is refused (backstop for I-2)', async () => {
    await expect(
      owner.query(
        `INSERT INTO claims (company_id, observation_id, statement, signal_type, confidence,
                             quote_text, quote_start, quote_end, trigger_context)
         VALUES ($1, $2, 'Span nguoc', 'funding', 'certain', 'abc', 10, 4, 'watch_cycle')`,
        [COMPANY_ID, OBSERVATION_ID],
      ),
    ).rejects.toThrow(/claims_quote_span_is_valid/i)
  })

  it.each(['name', 'company_type'])(
    '23 · a proposal may not target `%s` (I-11 second half)',
    async (field) => {
      await expect(
        owner.query(
          `INSERT INTO proposals (company_id, claim_id, proposal_type, target_field, proposed_value)
           VALUES ($1, $2, 'field_update', $3, 'gi cung duoc')`,
          [COMPANY_ID, CLAIM_ID, field],
        ),
      ).rejects.toThrow(/proposals_target_field_matches_type/i)
    },
  )

  it('24 · a `timeline_entry` proposal with a target field is refused', async () => {
    await expect(
      owner.query(
        `INSERT INTO proposals (company_id, claim_id, proposal_type, target_field, proposed_value)
         VALUES ($1, $2, 'timeline_entry', 'industry', 'Tin moi')`,
        [COMPANY_ID, CLAIM_ID],
      ),
    ).rejects.toThrow(/proposals_target_field_matches_type/i)
  })

  it('25 · a `timeline_entry` proposal with NULL target field is ACCEPTED', async () => {
    await owner.query(
      `INSERT INTO proposals (company_id, claim_id, proposal_type, proposed_value)
       VALUES ($1, $2, 'timeline_entry', 'Cong ty vua goi von Series B')`,
      [COMPANY_ID, CLAIM_ID],
    )
    const { rows } = await owner.query(
      `SELECT count(*)::int AS total FROM proposals WHERE proposal_type = 'timeline_entry'`,
    )
    expect(rows[0].total).toBe(1)
  })

  it('26 · a company cannot have two primary contacts, but may have many non-primary', async () => {
    await owner.query(
      `INSERT INTO contacts (company_id, name, is_primary) VALUES ($1, 'Dau moi chinh', true)`,
      [COMPANY_ID],
    )
    await expect(
      owner.query(
        `INSERT INTO contacts (company_id, name, is_primary) VALUES ($1, 'Dau moi thu hai', true)`,
        [COMPANY_ID],
      ),
    ).rejects.toThrow(/contacts_one_primary_per_company/i)

    await owner.query(
      `INSERT INTO contacts (company_id, name, is_primary)
       VALUES ($1, 'Nguoi thuong 1', false), ($1, 'Nguoi thuong 2', false)`,
      [COMPANY_ID],
    )
    const { rows } = await owner.query(
      'SELECT count(*)::int AS total FROM contacts WHERE company_id = $1',
      [COMPANY_ID],
    )
    expect(rows[0].total).toBe(3)
  })

  it('27 · the same content may return after changing away and back (ADR-0017)', async () => {
    /**
     * I-3 says "different from the MOST RECENT snapshot", which is NOT what a unique index on
     * (company_id, content_hash) says. This asserts the absence of that index: the sequence a
     * judge produces by toggling the fixture before → after → before has to keep working, or
     * the AI silently stops producing halfway through the second run of the demo script.
     */
    await owner.query(
      `INSERT INTO observations (company_id, source_url, raw_content, extractor_version,
                                 content_hash, fetch_status)
       VALUES ($1, 'https://example.test/news', 'after', 'v1', 'hash-after', 'ok')`,
      [COMPANY_ID],
    )
    await owner.query(
      `INSERT INTO observations (company_id, source_url, raw_content, extractor_version,
                                 content_hash, fetch_status)
       VALUES ($1, 'https://example.test/news', $2, 'v1', 'hash-before', 'ok')`,
      [COMPANY_ID, RAW_CONTENT],
    )
    const { rows } = await owner.query(
      `SELECT count(*)::int AS total FROM observations WHERE content_hash = 'hash-before'`,
    )
    expect(rows[0].total).toBe(2)
  })
})

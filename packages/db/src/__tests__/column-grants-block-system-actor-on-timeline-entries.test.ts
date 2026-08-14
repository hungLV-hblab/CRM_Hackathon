import { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { resetTestDatabase } from '../testing/reset-test-database'

/**
 * Autonomy zone 4 at the database layer — `timeline_entries`, granted by 0007.
 *
 * 0001_grants.sql handed `crm_system` INSERT at TABLE level here, which is the same shape of
 * hole ADR-0015 caught on the seven tables of 0002 and this table was never classified because
 * it predates that ADR. Table-level INSERT means the AI identity can pass `created_by` and
 * `source_claim_id` itself, i.e. it can write a row that reads as SOMETHING A PERSON TYPED,
 * with no source behind it. Rules 1 and 2 of CLAUDE.md both fail on that one row, and no amount
 * of care in the service layer closes it — the whole point of T-10 is a caller that skips the
 * service.
 *
 * Three groups, all three load-bearing:
 * - allowed direction: REVOKE without a matching GRANT does not protect anything, it just
 *   silently stops feature group 5 from working. That failure has to be visible here.
 * - forbidden direction: the column list of 0007 and the CHECK actually bite.
 * - the human direction: `crm_app` must keep writing `created_by = 'human'`, which the new
 *   DEFAULT must not quietly take over.
 */

const USER_ID = '11111111-1111-4111-8111-111111111111'
const COMPANY_ID = 'eeeeeeee-0001-4000-8000-000000000001'
const CONTACT_ID = 'eeeeeeee-0002-4000-8000-000000000002'
const OBSERVATION_ID = 'eeeeeeee-0003-4000-8000-000000000003'
const CLAIM_ID = 'eeeeeeee-0004-4000-8000-000000000004'

const RAW_CONTENT = 'Cong ty vua bo nhiem Giam doc Cong nghe moi tu thang Tam.'
const QUOTE = 'bo nhiem Giam doc Cong nghe moi'

let owner: Pool
let app: Pool
let system: Pool

beforeAll(async () => {
  owner = new Pool({ connectionString: process.env.DATABASE_URL_TEST })
  app = new Pool({ connectionString: process.env.DATABASE_URL_TEST_APP })
  system = new Pool({ connectionString: process.env.DATABASE_URL_TEST_SYSTEM })
})

afterAll(async () => {
  await Promise.all([owner?.end(), app?.end(), system?.end()])
})

beforeEach(async () => {
  await resetTestDatabase(owner)
  await owner.query(
    `INSERT INTO users (id, email, password_hash, name, role)
     VALUES ($1, 'sales@test.local', 'x', 'Sales', 'sales')`,
    [USER_ID],
  )
  await owner.query(
    `INSERT INTO companies (id, name, industry, company_type, owner_id, is_watched)
     VALUES ($1, 'Timeline grants company', 'ITO', 'it_solution', $2, true)`,
    [COMPANY_ID, USER_ID],
  )
  await owner.query(
    `INSERT INTO contacts (id, company_id, name, title) VALUES ($1, $2, 'Nguyen Van A', 'CTO')`,
    [CONTACT_ID, COMPANY_ID],
  )
  await owner.query(
    `INSERT INTO observations (id, company_id, source_url, raw_content, extractor_version,
                               content_hash, fetch_status)
     VALUES ($1, $2, 'https://example.test/news', $3, 'v1', 'hash-after', 'ok')`,
    [OBSERVATION_ID, COMPANY_ID, RAW_CONTENT],
  )
  await owner.query(
    `INSERT INTO claims (id, company_id, observation_id, statement, signal_type, confidence,
                         quote_text, quote_start, quote_end, trigger_context)
     VALUES ($1, $2, $3, 'Cong ty co CTO moi', 'leadership_hire', 'likely', $4, $5, $6, 'watch_cycle')`,
    [
      CLAIM_ID,
      COMPANY_ID,
      OBSERVATION_ID,
      QUOTE,
      RAW_CONTENT.indexOf(QUOTE),
      RAW_CONTENT.indexOf(QUOTE) + QUOTE.length,
    ],
  )
})

describe('allowed direction — the watch cycle can still add its entry', () => {
  it('1 · inserts a system entry naming only the columns 0007 grants', async () => {
    await system.query(
      `INSERT INTO timeline_entries (company_id, entry_type, occurred_at, description, source_claim_id)
       VALUES ($1, 'system_entry', now(), 'Cong ty co CTO moi', $2)`,
      [COMPANY_ID, CLAIM_ID],
    )

    const { rows } = await owner.query(
      'SELECT created_by, entry_type, source_claim_id FROM timeline_entries WHERE company_id = $1',
      [COMPANY_ID],
    )
    expect(rows).toHaveLength(1)
    // The DEFAULT does the labelling, which is why the AI never needs the column at all.
    expect(rows[0].created_by).toBe('system')
    expect(rows[0].entry_type).toBe('system_entry')
    expect(rows[0].source_claim_id).toBe(CLAIM_ID)
  })

  it('2 · can still READ the timeline — I-3 and the no-duplicate rule both depend on it', async () => {
    await owner.query(
      `INSERT INTO timeline_entries (company_id, entry_type, occurred_at, description, created_by)
       VALUES ($1, 'note', now(), 'Ghi chu cua Sales', 'human')`,
      [COMPANY_ID],
    )
    const { rows } = await system.query(
      'SELECT description FROM timeline_entries WHERE company_id = $1',
      [COMPANY_ID],
    )
    expect(rows[0].description).toBe('Ghi chu cua Sales')
  })
})

describe('forbidden direction — the column list of 0007 bites', () => {
  it('3 · cannot write a row that claims a PERSON typed it', async () => {
    /**
     * The whole reason ADR-0029 exists. `created_by` is what the "do hệ thống thêm" label is
     * rendered from, so an AI able to write `human` can hide itself inside Sales' own stream.
     */
    await expect(
      system.query(
        `INSERT INTO timeline_entries (company_id, entry_type, occurred_at, description,
                                       source_claim_id, created_by)
         VALUES ($1, 'system_entry', now(), 'Trong nhu nguoi go', $2, 'human')`,
        [COMPANY_ID, CLAIM_ID],
      ),
    ).rejects.toThrow(/permission denied/i)
  })

  it('4 · cannot attach a contact to an entry it wrote itself', async () => {
    /**
     * `contact_id` is absent from the GRANT on purpose: the AI naming a person on an entry it
     * invented is fabricating a meeting that never happened.
     */
    await expect(
      system.query(
        `INSERT INTO timeline_entries (company_id, entry_type, occurred_at, description,
                                       source_claim_id, contact_id)
         VALUES ($1, 'system_entry', now(), 'Da gap CTO', $2, $3)`,
        [COMPANY_ID, CLAIM_ID, CONTACT_ID],
      ),
    ).rejects.toThrow(/permission denied/i)
  })

  it('5 · cannot UPDATE an entry — an entry is appended, never rewritten', async () => {
    await owner.query(
      `INSERT INTO timeline_entries (id, company_id, entry_type, occurred_at, description, created_by)
       VALUES ('eeeeeeee-0005-4000-8000-000000000005', $1, 'note', now(), 'Ghi chu', 'human')`,
      [COMPANY_ID],
    )
    await expect(
      system.query(`UPDATE timeline_entries SET description = 'sua lai' WHERE company_id = $1`, [
        COMPANY_ID,
      ]),
    ).rejects.toThrow(/permission denied/i)
  })

  it('6 · cannot DELETE — removing an entry is Sales act and the I-13 metric', async () => {
    await expect(system.query('DELETE FROM timeline_entries')).rejects.toThrow(
      /permission denied/i,
    )
  })
})

/**
 * As `crm_owner`, which bypasses every column privilege. That is deliberate: what is proven
 * here is the CONSTRAINT, so it has to hold for the most privileged writer in the system and
 * not merely for the AI role — "thử ghi thẳng, phải bị từ chối" (T-2) applies to raw SQL.
 */
describe('the CHECK holds against raw SQL from any role', () => {
  it('7 · a system row with no source claim cannot be stored at all (rule 1)', async () => {
    await expect(
      owner.query(
        `INSERT INTO timeline_entries (company_id, entry_type, occurred_at, description, created_by)
         VALUES ($1, 'system_entry', now(), 'Khong co nguon', 'system')`,
        [COMPANY_ID],
      ),
    ).rejects.toThrow(/timeline_system_entry_needs_quote/i)
  })

  it('8 · a system row wearing another entry type is refused', async () => {
    /**
     * Without this half, the AI could write `entry_type = 'activity'` and its row would render
     * as "Hoạt động" — the machine hue of rule 2 is chosen from the type as well as the author.
     */
    await expect(
      owner.query(
        `INSERT INTO timeline_entries (company_id, entry_type, occurred_at, description,
                                       source_claim_id, created_by)
         VALUES ($1, 'activity', now(), 'Doi lot hoat dong', $2, 'system')`,
        [COMPANY_ID, CLAIM_ID],
      ),
    ).rejects.toThrow(/timeline_system_entry_needs_quote/i)
  })
})

describe('the human direction the new DEFAULT must not swallow', () => {
  it('9 · crm_app still writes created_by = human explicitly', async () => {
    await app.query(
      `INSERT INTO timeline_entries (company_id, entry_type, occurred_at, description, created_by)
       VALUES ($1, 'activity', now(), 'Goi cho khach', 'human')`,
      [COMPANY_ID],
    )
    const { rows } = await owner.query(
      'SELECT created_by FROM timeline_entries WHERE company_id = $1',
      [COMPANY_ID],
    )
    expect(rows[0].created_by).toBe('human')
  })

  it('10 · crm_app can DELETE a system entry — that is the I-13 path', async () => {
    await system.query(
      `INSERT INTO timeline_entries (company_id, entry_type, occurred_at, description, source_claim_id)
       VALUES ($1, 'system_entry', now(), 'Cong ty co CTO moi', $2)`,
      [COMPANY_ID, CLAIM_ID],
    )
    await app.query(`DELETE FROM timeline_entries WHERE company_id = $1`, [COMPANY_ID])

    const { rows } = await owner.query('SELECT count(*)::int AS total FROM timeline_entries')
    expect(rows[0].total).toBe(0)
  })
})

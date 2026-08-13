import { Pool } from 'pg'
import { sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { deleteSystemTimelineEntrySchema } from '@crm/contracts'
import { createConnection, resetTestDatabase } from '@crm/db'

import { AuditEventService } from '../../common/audit/audit-event-service'
import { SYSTEM_ACTOR, humanActor } from '../../common/actor/actor-context'
import {
  DELETE_SYSTEM_TIMELINE_ENTRY_ACTION,
  SystemTimelineEntryRemovalService,
} from '../system-timeline-entry-removal-service'

/**
 * I-13 — the counterweight that makes autonomy zone 4 defensible.
 *
 * Zone 4 writes to Sales' official timeline without asking anyone, and rule 3 of CLAUDE.md prices
 * that: undoing it must be EASIER than the machine's own act, and the number of times it was
 * undone must be measurable. Both halves are asserted here, because either one alone is hollow —
 * a delete with no record leaves feature group 6 with nothing to count, and a record of a delete
 * that did not happen is worse than neither.
 *
 * The service is built with `new` rather than reached through HTTP, for the same reason the T-10
 * tests are: the guarantees have to hold at the lowest layer a caller can reach.
 */

const SALES_ID = '11111111-1111-4111-8111-111111111111'
const COMPANY_ID = 'aaaaaaaa-0001-4000-8000-000000000001'
const OTHER_COMPANY_ID = 'aaaaaaaa-0005-4000-8000-000000000005'
const OBSERVATION_ID = 'cccccccc-0001-4000-8000-000000000001'
const CLAIM_ID = 'cccccccc-0002-4000-8000-000000000002'
const SYSTEM_ENTRY_ID = 'cccccccc-0003-4000-8000-000000000003'
const HUMAN_ENTRY_ID = 'cccccccc-0004-4000-8000-000000000004'

const RAW_CONTENT = 'Nimbus bo nhiem Giam doc Cong nghe moi tu thang nay.'
const QUOTE = 'bo nhiem Giam doc Cong nghe moi'

const owner = new Pool({ connectionString: process.env.DATABASE_URL_TEST })
const appConnection = createConnection(process.env.DATABASE_URL_TEST_APP as string)
const systemConnection = createConnection(process.env.DATABASE_URL_TEST_SYSTEM as string)

const removal = new SystemTimelineEntryRemovalService(
  appConnection.db,
  new AuditEventService(appConnection.db, systemConnection.db),
)

const sales = humanActor(SALES_ID, 'sales')

async function entryCount(): Promise<number> {
  const { rows } = await owner.query('SELECT count(*)::int AS total FROM timeline_entries')
  return rows[0].total
}

async function auditEvents(action = DELETE_SYSTEM_TIMELINE_ENTRY_ACTION) {
  const { rows } = await owner.query(
    'SELECT actor, action, entity, entity_id, detail FROM audit_events WHERE action = $1',
    [action],
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
    `INSERT INTO companies (id, name, industry, company_type, owner_id, is_watched) VALUES
       ($1, 'Nimbus Cloud Solutions', 'Công nghệ', 'it_solution', $3, true),
       ($2, 'Marlin Product Labs', 'Phần mềm', 'it_product', $3, false)`,
    [COMPANY_ID, OTHER_COMPANY_ID, SALES_ID],
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
  await owner.query(
    `INSERT INTO timeline_entries (id, company_id, entry_type, occurred_at, description,
                                   source_claim_id, created_by)
     VALUES ($1, $2, 'system_entry', now(), 'Cong ty co CTO moi', $3, 'system')`,
    [SYSTEM_ENTRY_ID, COMPANY_ID, CLAIM_ID],
  )
  await owner.query(
    `INSERT INTO timeline_entries (id, company_id, entry_type, occurred_at, description, created_by)
     VALUES ($1, $2, 'activity', now(), 'Goi cho khach hom qua', 'human')`,
    [HUMAN_ENTRY_ID, COMPANY_ID],
  )
})

afterAll(async () => {
  await Promise.all([owner.end(), appConnection.close(), systemConnection.close()])
})

describe('I-13 · Sales removes a system entry, with a reason on the record', () => {
  it('1 · the row goes and an AuditEvent takes its place', async () => {
    await removal.remove(sales, COMPANY_ID, SYSTEM_ENTRY_ID, { reason: 'Tin này là công ty khác' })

    expect(await entryCount()).toBe(1) // the hand-typed one is untouched

    const events = await auditEvents()
    expect(events).toHaveLength(1)
    expect(events[0].actor).toBe('human')
    expect(events[0].entity).toBe('timeline_entry')
    expect(events[0].entity_id).toBe(SYSTEM_ENTRY_ID)
    /**
     * The detail is the point. The row is gone, so this is the only surviving answer to "what did
     * the machine get wrong and how did the reader know" — and `action` is where feature group 6
     * counts the numerator of the error-detection rate (ontology section 7).
     */
    expect(events[0].detail.reason).toBe('Tin này là công ty khác')
    expect(events[0].detail.sourceClaimId).toBe(CLAIM_ID)
    expect(events[0].detail.description).toBe('Cong ty co CTO moi')
  })

  it('2 · a reason is required — the schema refuses blank and whitespace alike', async () => {
    /**
     * Enforced in the CONTRACT, not in the service, so the web form and any other caller share
     * one rule. Whitespace is checked separately: `min(1)` on an untrimmed string would accept a
     * single space, and a metric filled with spaces looks populated while meaning nothing.
     */
    expect(deleteSystemTimelineEntrySchema.safeParse({ reason: '' }).success).toBe(false)
    expect(deleteSystemTimelineEntrySchema.safeParse({ reason: '   ' }).success).toBe(false)
    expect(deleteSystemTimelineEntrySchema.safeParse({}).success).toBe(false)
    expect(deleteSystemTimelineEntrySchema.safeParse({ reason: 'Sai công ty' }).success).toBe(true)
  })

  it('3 · a hand-typed entry is refused — this path is not a general delete', async () => {
    await expect(
      removal.remove(sales, COMPANY_ID, HUMAN_ENTRY_ID, { reason: 'Gõ sai' }),
    ).rejects.toThrow(/mục do hệ thống thêm/i)

    // Nothing removed, and no misleading "deleted" event left behind.
    expect(await entryCount()).toBe(2)
    expect(await auditEvents()).toHaveLength(0)
  })

  it('4 · under the SYSTEM identity it is refused AND the refusal is recorded', async () => {
    /**
     * One of the absolute boundaries: the AI must not delete data (CLAUDE.md section 4). The
     * sharper reason here is that an AI able to delete its own entries could delete the evidence
     * of its own mistakes — and the error-detection rate would then read as flawless.
     */
    await expect(
      removal.remove(SYSTEM_ACTOR, COMPANY_ID, SYSTEM_ENTRY_ID, { reason: 'tự dọn' }),
    ).rejects.toThrow(/Hệ thống không được xoá/i)

    expect(await entryCount()).toBe(2)

    const events = await auditEvents()
    expect(events).toHaveLength(1)
    expect(events[0].actor).toBe('system')
    expect(events[0].detail.outcome).toBe('refused')
  })

  it('5 · the company in the path must own the entry', async () => {
    /**
     * The id alone would be enough to find the row, which is exactly why it is not enough to act
     * on: a wrong company segment would then delete a row off a different company's timeline and
     * file an audit event naming the wrong company.
     */
    await expect(
      removal.remove(sales, OTHER_COMPANY_ID, SYSTEM_ENTRY_ID, { reason: 'Sai công ty' }),
    ).rejects.toThrow(/Không tìm thấy/i)

    expect(await entryCount()).toBe(2)
  })

  it('6 · crm_system holds no DELETE at all, so the refusal has a second layer', async () => {
    /**
     * The service check above is the readable layer; this is the one that holds when the call does
     * not come through the service (T-10). Both are needed — ADR-0010 exists because a boundary
     * enforced in one place only turned out to be enforced nowhere.
     */
    await expect(
      systemConnection.db.execute(
        sql`DELETE FROM timeline_entries WHERE id = ${SYSTEM_ENTRY_ID}`,
      ),
    ).rejects.toThrow(/permission denied/i)

    expect(await entryCount()).toBe(2)
  })
})

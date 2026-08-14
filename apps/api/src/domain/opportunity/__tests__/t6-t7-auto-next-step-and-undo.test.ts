import { Pool } from 'pg'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { createConnection, resetTestDatabase } from '@crm/db'

import { AuditEventService } from '../../../common/audit/audit-event-service'
import { AutoNextStepService } from '../auto-next-step-service'
import { ClaimReactionService } from '../../claim/claim-reaction-service'
import { ClaimService } from '../../claim/claim-service'
import { DemoSnapshotSource } from '../../../ai/demo-snapshots'
import { FixtureClaimExtractor } from '../../../ai/fixture-claim-extractor'
import { NotificationService } from '../../notification/notification-service'
import { ObservationService } from '../../observation/observation-service'
import { OpportunityService } from '../opportunity-service'
import { ProposalService } from '../../proposal/proposal-service'
import { SYSTEM_ACTOR, humanActor } from '../../../common/actor/actor-context'
import { SystemSettingService } from '../../../settings/system-setting-service'
import { SystemTimelineEntryService } from '../../../watch/system-timeline-entry-service'

/**
 * T-6, T-7 and the four invariants of feature group 4 — autonomy zone 3, the one place the AI
 * writes into Sales' official data without asking.
 *
 * Everything here runs against the real database through the real roles. The point of the phase
 * is not that a method returns the right object; it is that a machine write lands in exactly
 * three columns, is announced, is reversible for seven days, and restores the value a PERSON
 * typed rather than the machine's own previous guess.
 *
 * TWO MUTATION MEASUREMENTS live at the bottom, and neither is decorative:
 *
 *   1. `crm_system` cannot record an undo. Hard-wiring `dbApp` in `AutoNextStepService` would
 *      delete that layer while every other test in this file stayed green — the mistake that
 *      actually happened on 12/08, on `updateStage`.
 *   2. `undo_deadline` is absent from the AI's INSERT grant, so the 7-day window is fixed by
 *      the column DEFAULT. The column list of `0003` had never been measured until this test.
 */

const SALES_ID = '11111111-1111-4111-8111-111111111111'
/** Human-typed next step. The I-7 case: news arrives, the cell is NOT overwritten. */
const SAKURA = 'aaaaaaaa-0001-4000-8000-000000000001'
/** Empty next step + `leadership_hire` news in its `after` page. The T-6/T-7 case. */
const NIMBUS = 'aaaaaaaa-0002-4000-8000-000000000002'
/** `expansion` news only — I-6 says the queue, never a write. */
const KITEFIN = 'aaaaaaaa-0003-4000-8000-000000000003'

const SAKURA_OPPORTUNITY = 'bbbbbbbb-0001-4000-8000-000000000001'
const NIMBUS_OPPORTUNITY = 'bbbbbbbb-0002-4000-8000-000000000002'
const KITEFIN_OPPORTUNITY = 'bbbbbbbb-0003-4000-8000-000000000003'

const HUMAN_NEXT_STEP = 'Gửi lại báo giá sau buổi họp kỹ thuật'

const owner = new Pool({ connectionString: process.env.DATABASE_URL_TEST })
const system = new Pool({ connectionString: process.env.DATABASE_URL_TEST_SYSTEM })
const appConnection = createConnection(process.env.DATABASE_URL_TEST_APP as string)
const systemConnection = createConnection(process.env.DATABASE_URL_TEST_SYSTEM as string)

const audit = new AuditEventService(appConnection.db, systemConnection.db)
const autoNextSteps = new AutoNextStepService(systemConnection.db, appConnection.db, audit)
const notifications = new NotificationService(appConnection.db)
const opportunityService = new OpportunityService(appConnection.db, systemConnection.db, audit)
const settings = new SystemSettingService(
  appConnection.db,
  systemConnection.db,
  new AuditEventService(appConnection.db, systemConnection.db),
)
const snapshots = new DemoSnapshotSource()

const sales = humanActor(SALES_ID, 'sales')

function buildIngest(): ObservationService {
  return new ObservationService(
    systemConnection.db,
    appConnection.db,
    new FixtureClaimExtractor(),
    new ClaimService(systemConnection.db, appConnection.db),
    snapshots,
    settings,
    new ClaimReactionService(
      autoNextSteps,
      new ProposalService(systemConnection.db, appConnection.db),
      new SystemTimelineEntryService(systemConnection.db),
    ),
  )
}

interface NextStepCell {
  next_step_text: string | null
  due: string | null
  next_step_source: string | null
}

async function nextStepCell(opportunityId: string): Promise<NextStepCell> {
  const { rows } = await owner.query(
    `SELECT next_step_text, next_step_due_date::text AS due, next_step_source
     FROM opportunities WHERE id = $1`,
    [opportunityId],
  )
  return rows[0]
}

/** `YYYY-MM-DD` N days from now in the LOCAL calendar — the one Sales works in (I-9). */
function localDateInDays(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

/**
 * A finding, written straight into the table under the OWNER role so a test can pick the
 * signal type and confidence it needs without going through a snapshot that happens to
 * contain the right sentence.
 */
async function seedClaim(
  companyId: string,
  signalType: string,
  confidence: string,
  statement = 'Công ty vừa gọi vốn vòng Series B 20 triệu USD',
): Promise<{ id: string; statement: string; signalType: string; confidence: string }> {
  const quote = `Nguồn ghi: ${statement}`
  const observation = await owner.query(
    `INSERT INTO observations (company_id, source_url, raw_content, fetch_status,
                               content_hash, extractor_version)
     VALUES ($1, 'https://example.test/news', $2, 'ok', $3, 'test')
     RETURNING id`,
    [companyId, quote, `hash-${companyId}-${signalType}-${confidence}-${Math.random()}`],
  )
  const claim = await owner.query(
    `INSERT INTO claims (company_id, observation_id, statement, signal_type, confidence,
                         quote_text, quote_start, quote_end, trigger_context)
     VALUES ($1, $2, $3, $4, $5, $6, 0, $7, 'watch_cycle')
     RETURNING id`,
    [companyId, observation.rows[0].id, statement, signalType, confidence, quote, quote.length],
  )
  return { id: claim.rows[0].id, statement, signalType, confidence }
}

/** What `ClaimReactionService` hands the service — a saved finding, no field suggestion. */
async function savedClaimsFor(
  companyId: string,
  signalType: string,
  confidence: string,
  statement?: string,
): Promise<{ claim: never }[]> {
  const claim = await seedClaim(companyId, signalType, confidence, statement)
  const { rows } = await owner.query('SELECT * FROM claims WHERE id = $1', [claim.id])
  const row = rows[0]
  return [
    {
      claim: {
        id: row.id,
        companyId: row.company_id,
        observationId: row.observation_id,
        statement: row.statement,
        signalType: row.signal_type,
        confidence: row.confidence,
        quoteText: row.quote_text,
        quoteStart: row.quote_start,
        quoteEnd: row.quote_end,
        triggerContext: row.trigger_context,
        createdAt: row.created_at.toISOString(),
      } as never,
    },
  ]
}

beforeEach(async () => {
  await resetTestDatabase(owner)
  await owner.query(
    `INSERT INTO users (id, email, password_hash, name, role)
     VALUES ($1, 'sales@test.local', 'x', 'Sales', 'sales')`,
    [SALES_ID],
  )
  await owner.query(
    `INSERT INTO companies (id, name, industry, company_type, owner_id, is_watched,
                            country, size, website) VALUES
       ($1, 'Sakura Manufacturing KK', 'Sản xuất linh kiện', 'traditional', $4, true,
        'Nhật Bản', '500-1000', 'https://sakura-mfg.example.jp'),
       ($2, 'Nimbus Cloud Solutions', 'Tích hợp hệ thống', 'it_solution', $4, true,
        'Singapore', '100-500', 'https://nimbus.example.sg'),
       ($3, 'Kitefin Analytics', 'Phân tích dữ liệu', 'tech_startup', $4, true,
        'Hoa Kỳ', '50-100', NULL)`,
    [SAKURA, NIMBUS, KITEFIN, SALES_ID],
  )
  await owner.query(
    `INSERT INTO opportunities (id, company_id, name, stage, next_step_text, next_step_due_date,
                                next_step_source) VALUES
       ($1, $4, 'Thuê ngoài đội bảo trì MES', 'qualified', $7, '2026-08-20', 'human'),
       ($2, $5, 'Đội phát triển nền tảng tích hợp', 'negotiation', NULL, NULL, NULL),
       ($3, $6, 'Mở rộng đội dữ liệu', 'prospecting', NULL, NULL, NULL)`,
    [
      SAKURA_OPPORTUNITY,
      NIMBUS_OPPORTUNITY,
      KITEFIN_OPPORTUNITY,
      SAKURA,
      NIMBUS,
      KITEFIN,
      HUMAN_NEXT_STEP,
    ],
  )
  await owner.query(
    `INSERT INTO system_settings (key, value) VALUES ('ai_enabled', 'true'),
                                                    ('watch_cycle_seconds', '60')
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
  )
})

afterAll(async () => {
  await Promise.all([owner.end(), system.end(), appConnection.close(), systemConnection.close()])
})

describe('T-6 · reading the "after" page sets the next step, announces it, and marks the cell', () => {
  it('1 · an empty cell is filled, and it is filled AS THE SYSTEM', async () => {
    await buildIngest().ingest(NIMBUS, 'after', 'watch_cycle')

    const cell = await nextStepCell(NIMBUS_OPPORTUNITY)
    expect(cell.next_step_text).toContain('Đặt lịch chào người mới phụ trách')
    /**
     * `system`, and this is what the whole zone hangs off: rule 2 of CLAUDE.md reads it to
     * draw the machine mark, and I-7 reads it at the next write to know whose cell this is.
     */
    expect(cell.next_step_source).toBe('system')
    // I-9: `leadership_hire` is a 5-day window, from the urgency table and not from the model.
    expect(cell.due).toBe(localDateInDays(5))
  })

  it('2 · the write leaves a trail with BOTH halves of the change', async () => {
    await buildIngest().ingest(NIMBUS, 'after', 'watch_cycle')

    const { rows } = await owner.query(
      `SELECT previous_text, previous_source, new_text, new_due_date::text AS new_due,
              undo_deadline, undone_at, claim_id
       FROM auto_next_step_events`,
    )
    expect(rows).toHaveLength(1)
    // The cell was empty before, so the "previous" half is empty — recorded, not omitted.
    expect(rows[0].previous_text).toBeNull()
    expect(rows[0].previous_source).toBeNull()
    expect(rows[0].new_text).toContain('Đặt lịch chào người mới phụ trách')
    expect(rows[0].undone_at).toBeNull()
    // Provenance survives into zone 3: the cell can be traced to the sentence that caused it.
    expect(rows[0].claim_id).not.toBeNull()

    /** The 7-day window comes from the column DEFAULT, which is why the AI cannot shorten it. */
    const days = (new Date(rows[0].undo_deadline).getTime() - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(6.9)
    expect(days).toBeLessThan(7.1)
  })

  it('3 · Sales is told immediately, and the notice says what, for which deal, and why', async () => {
    await buildIngest().ingest(NIMBUS, 'after', 'watch_cycle')

    const list = await notifications.list(sales)
    expect(list).toHaveLength(1)
    expect(list[0].readAt).toBeNull()
    expect(list[0].autoEventId).not.toBeNull()
    expect(list[0].canUndo).toBe(true)
    expect(list[0].message).toContain('Đội phát triển nền tảng tích hợp')
    expect(list[0].message).toContain('Nimbus Cloud Solutions')
    // I-9 in words. A date with no reason is a number Sales has to take on trust.
    expect(list[0].message).toContain('sếp mới xem lại lựa chọn của người cũ')
  })

  it('4 · the board gets everything it needs to draw the mark and the button', async () => {
    await buildIngest().ingest(NIMBUS, 'after', 'watch_cycle')

    const map = await autoNextSteps.listActive()
    const entry = map[NIMBUS_OPPORTUNITY]

    expect(entry).toBeDefined()
    expect(entry.canUndo).toBe(true)
    expect(entry.dueDays).toBe(5)
    // Rule 1 holds in zone 3 too: the quote travels with the cell.
    expect(entry.claim.quoteText.length).toBeGreaterThan(0)
    expect(entry.claim.signalType).toBe('leadership_hire')
  })
})

describe('I-6 · which findings may cause a write at all', () => {
  it('5 · `expansion` never writes — it goes to the review queue instead', async () => {
    const result = await autoNextSteps.react(
      SYSTEM_ACTOR,
      { companyId: KITEFIN, savedClaims: (await savedClaimsFor(KITEFIN, 'expansion', 'certain')) as never },
    )

    expect(result.written).toBe(0)
    expect(result.skippedReason).toBe('no_eligible_claim')
    expect((await nextStepCell(KITEFIN_OPPORTUNITY)).next_step_text).toBeNull()
  })

  it('6 · `speculative` never writes either, even for a signal that otherwise would', async () => {
    const result = await autoNextSteps.react(SYSTEM_ACTOR, {
      companyId: NIMBUS,
      savedClaims: (await savedClaimsFor(NIMBUS, 'funding', 'speculative')) as never,
    })

    expect(result.written).toBe(0)
    expect(result.skippedReason).toBe('no_eligible_claim')
    expect((await nextStepCell(NIMBUS_OPPORTUNITY)).next_step_text).toBeNull()
  })

  it('7 · no open deal, no write — a closed deal is not a place to put work', async () => {
    await owner.query(`UPDATE opportunities SET stage = 'won' WHERE id = $1`, [NIMBUS_OPPORTUNITY])

    const result = await autoNextSteps.react(SYSTEM_ACTOR, {
      companyId: NIMBUS,
      savedClaims: (await savedClaimsFor(NIMBUS, 'funding', 'certain')) as never,
    })

    expect(result.written).toBe(0)
    expect(result.skippedReason).toBe('no_open_opportunity')
  })

  it('8 · `on_hold` IS open (ontology 3.5) — a paused deal is one news can restart', async () => {
    await owner.query(`UPDATE opportunities SET stage = 'on_hold' WHERE id = $1`, [
      NIMBUS_OPPORTUNITY,
    ])

    const result = await autoNextSteps.react(SYSTEM_ACTOR, {
      companyId: NIMBUS,
      savedClaims: (await savedClaimsFor(NIMBUS, 'funding', 'certain')) as never,
    })

    expect(result.written).toBe(1)
  })

  it('9 · one write per round: two eligible findings do not overwrite each other', async () => {
    const first = await savedClaimsFor(NIMBUS, 'funding', 'likely', 'Công ty vừa gọi vốn')
    const second = await savedClaimsFor(NIMBUS, 'leadership_hire', 'certain', 'Công ty có CTO mới')

    const result = await autoNextSteps.react(SYSTEM_ACTOR, {
      companyId: NIMBUS,
      savedClaims: [...first, ...second] as never,
    })

    expect(result.written).toBe(1)
    const { rows } = await owner.query('SELECT count(*)::int AS total FROM auto_next_step_events')
    expect(rows[0].total).toBe(1)
    // `certain` outranks `likely`, whatever order they were stored in.
    expect((await nextStepCell(NIMBUS_OPPORTUNITY)).next_step_text).toContain('CTO mới')
  })
})

describe('I-7 · a cell a human typed is never overwritten, overdue or not', () => {
  it('10 · the overdue human cell survives, and the case becomes a suggestion', async () => {
    // Overdue on purpose: this is the case that reads like a stale cell and is not one.
    await owner.query(`UPDATE opportunities SET next_step_due_date = '2020-01-01' WHERE id = $1`, [
      SAKURA_OPPORTUNITY,
    ])

    await buildIngest().ingest(SAKURA, 'after', 'watch_cycle')

    const cell = await nextStepCell(SAKURA_OPPORTUNITY)
    expect(cell.next_step_text).toBe(HUMAN_NEXT_STEP)
    expect(cell.next_step_source).toBe('human')

    // Nothing was written, so there is nothing to undo and nothing to announce.
    const events = await owner.query('SELECT count(*)::int AS total FROM auto_next_step_events')
    expect(events.rows[0].total).toBe(0)

    // ADR-0023: the refusal lands in the queue as a `next_step` suggestion instead of vanishing.
    const { rows } = await owner.query(
      `SELECT current_value, proposed_value, opportunity_id
       FROM proposals WHERE proposal_type = 'next_step'`,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].current_value).toBe(HUMAN_NEXT_STEP)
    expect(rows[0].opportunity_id).toBe(SAKURA_OPPORTUNITY)
  })

  it('11 · typing over a machine cell hands it back, and the next write respects that', async () => {
    await autoNextSteps.react(SYSTEM_ACTOR, {
      companyId: NIMBUS,
      savedClaims: (await savedClaimsFor(NIMBUS, 'funding', 'certain')) as never,
    })
    expect((await nextStepCell(NIMBUS_OPPORTUNITY)).next_step_source).toBe('system')

    await opportunityService.update(sales, NIMBUS_OPPORTUNITY, {
      nextStepText: 'Tôi tự gọi sáng mai',
    })

    const result = await autoNextSteps.react(SYSTEM_ACTOR, {
      companyId: NIMBUS,
      savedClaims: (await savedClaimsFor(NIMBUS, 'leadership_hire', 'certain')) as never,
    })

    expect(result.written).toBe(0)
    expect(result.blocked).toHaveLength(1)
    expect((await nextStepCell(NIMBUS_OPPORTUNITY)).next_step_text).toBe('Tôi tự gọi sáng mai')
  })
})

describe('T-7 · one click puts it back, and I-8 says what "back" means', () => {
  it('12 · undo restores the cell exactly and records both directions', async () => {
    await buildIngest().ingest(NIMBUS, 'after', 'watch_cycle')
    const map = await autoNextSteps.listActive()
    const eventId = map[NIMBUS_OPPORTUNITY].eventId

    const restored = await autoNextSteps.undo(sales, eventId)

    expect(restored.restoredText).toBeNull()
    const cell = await nextStepCell(NIMBUS_OPPORTUNITY)
    expect(cell.next_step_text).toBeNull()
    expect(cell.due).toBeNull()
    /** Never `system` after an undo: the cell is the person's again, or nobody's. */
    expect(cell.next_step_source).toBeNull()

    const { rows } = await owner.query(
      `SELECT undone_at, undone_by, undone_to_text FROM auto_next_step_events WHERE id = $1`,
      [eventId],
    )
    expect(rows[0].undone_at).not.toBeNull()
    expect(rows[0].undone_by).toBe(SALES_ID)
    expect(rows[0].undone_to_text).toBeNull()

    // The mark is gone from the board: the cell is no longer something the machine wrote.
    expect(await autoNextSteps.listActive()).toEqual({})
  })

  it('13 · I-8: after TWO machine writes, undo goes back past BOTH, not to the first one', async () => {
    /**
     * The trap this test exists for, and the reachable shape of it.
     *
     * "Giá trị trước đó" reads like "the value immediately before", and on the second machine
     * write that value is the machine's own first sentence. Restoring `previous_text` off the
     * newest event would put a machine sentence back into the cell and label it the human's —
     * ADR-0026's rejected option D, which looks entirely correct while doing it.
     *
     * Note WHY the baseline here is empty rather than a typed sentence: I-7 means the machine
     * never writes over a human cell, so no event produced by the product can carry
     * `previous_source = 'human'`. The chain always starts from an empty cell, and "the last
     * human-typed value" is therefore "nothing" — which is exactly what must come back. Test 14
     * exercises the predicate against a chain that does carry a human baseline.
     */
    await autoNextSteps.react(SYSTEM_ACTOR, {
      companyId: NIMBUS,
      savedClaims: (await savedClaimsFor(NIMBUS, 'funding', 'certain')) as never,
    })
    const first = (await nextStepCell(NIMBUS_OPPORTUNITY)).next_step_text
    expect(first).toContain('cửa sổ gọi vốn')

    // The machine MAY overwrite its own cell (ADR-0005 C1), so the second write is legitimate.
    await autoNextSteps.react(SYSTEM_ACTOR, {
      companyId: NIMBUS,
      savedClaims: (await savedClaimsFor(NIMBUS, 'leadership_hire', 'certain')) as never,
    })

    const events = await owner.query(
      `SELECT previous_text, previous_source FROM auto_next_step_events
       WHERE opportunity_id = $1 ORDER BY created_at`,
      [NIMBUS_OPPORTUNITY],
    )
    expect(events.rows).toHaveLength(2)
    // The second event's predecessor IS the machine's first sentence. That is the bait.
    expect(events.rows[1].previous_text).toBe(first)
    expect(events.rows[1].previous_source).toBe('system')

    const map = await autoNextSteps.listActive()
    const restored = await autoNextSteps.undo(sales, map[NIMBUS_OPPORTUNITY].eventId)

    // Back to empty — NOT back to the machine's first attempt.
    expect(restored.restoredText).toBeNull()
    const cell = await nextStepCell(NIMBUS_OPPORTUNITY)
    expect(cell.next_step_text).toBeNull()
    expect(cell.next_step_text).not.toBe(first)
    expect(cell.next_step_source).toBeNull()
  })

  it('14 · I-8: where a human baseline DOES exist in the chain, that is what comes back', async () => {
    /**
     * Seeded straight into the table under the owner role, and deliberately so: the product
     * cannot produce this chain (I-7 blocks it), but the predicate that reads it has to be
     * right anyway. Data can arrive from an import, and `previous_source` is the column the
     * whole restore hangs off — a predicate only ever exercised against NULL is a predicate
     * nobody has actually tested.
     */
    const claim = await seedClaim(NIMBUS, 'funding', 'certain')
    await owner.query(
      `INSERT INTO auto_next_step_events
         (opportunity_id, claim_id, previous_text, previous_due_date, previous_source,
          new_text, new_due_date, created_at)
       VALUES ($1, $2, 'Tôi hẹn khách tuần sau', '2026-09-09', 'human',
               'Máy đặt lần 1', '2026-08-18', now() - interval '2 hours')`,
      [NIMBUS_OPPORTUNITY, claim.id],
    )
    const second = await owner.query(
      `INSERT INTO auto_next_step_events
         (opportunity_id, claim_id, previous_text, previous_due_date, previous_source,
          new_text, new_due_date, created_at)
       VALUES ($1, $2, 'Máy đặt lần 1', '2026-08-18', 'system',
               'Máy đặt lần 2', '2026-08-19', now() - interval '1 hour')
       RETURNING id`,
      [NIMBUS_OPPORTUNITY, claim.id],
    )
    await owner.query(
      `UPDATE opportunities SET next_step_text = 'Máy đặt lần 2',
                                next_step_due_date = '2026-08-19',
                                next_step_source = 'system' WHERE id = $1`,
      [NIMBUS_OPPORTUNITY],
    )

    const restored = await autoNextSteps.undo(sales, second.rows[0].id)

    // The HUMAN sentence, two events back — not `Máy đặt lần 1`, which sits one event back.
    expect(restored.restoredText).toBe('Tôi hẹn khách tuần sau')
    expect(restored.restoredDueDate).toBe('2026-09-09')

    const cell = await nextStepCell(NIMBUS_OPPORTUNITY)
    expect(cell.next_step_text).toBe('Tôi hẹn khách tuần sau')
    expect(cell.due).toBe('2026-09-09')
    expect(cell.next_step_source).toBe('human')
  })

  it('15 · past the 7-day deadline the undo is refused, and the trail is untouched', async () => {
    await buildIngest().ingest(NIMBUS, 'after', 'watch_cycle')
    const map = await autoNextSteps.listActive()
    const eventId = map[NIMBUS_OPPORTUNITY].eventId

    // Only the owner role can move the deadline — which is itself the point of the grant split.
    await owner.query(
      `UPDATE auto_next_step_events SET undo_deadline = now() - interval '1 hour' WHERE id = $1`,
      [eventId],
    )

    await expect(autoNextSteps.undo(sales, eventId)).rejects.toThrow(/quá 7 ngày/i)

    const { rows } = await owner.query(
      'SELECT undone_at FROM auto_next_step_events WHERE id = $1',
      [eventId],
    )
    expect(rows[0].undone_at).toBeNull()

    // The button is gone from the board, but the cell keeps its machine mark: it is still
    // something the system wrote, and rule 2 does not expire.
    const stale = await autoNextSteps.listActive()
    expect(stale[NIMBUS_OPPORTUNITY].canUndo).toBe(false)
  })

  it('16 · the same undo cannot be pressed twice', async () => {
    await buildIngest().ingest(NIMBUS, 'after', 'watch_cycle')
    const map = await autoNextSteps.listActive()
    const eventId = map[NIMBUS_OPPORTUNITY].eventId

    await autoNextSteps.undo(sales, eventId)
    await expect(autoNextSteps.undo(sales, eventId)).rejects.toThrow(/đã được hoàn tác/i)
  })

  it('17 · the system may not undo on a person\'s behalf, and the refusal is audited', async () => {
    await buildIngest().ingest(NIMBUS, 'after', 'watch_cycle')
    const map = await autoNextSteps.listActive()

    await expect(
      autoNextSteps.undo(SYSTEM_ACTOR, map[NIMBUS_OPPORTUNITY].eventId),
    ).rejects.toThrow(/không được tự hoàn tác/i)

    const { rows } = await owner.query(
      `SELECT actor FROM audit_events WHERE action = 'undo_auto_next_step'`,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].actor).toBe('system')
  })
})

describe('ontology 3.3 · a notice does not disappear before it is read', () => {
  it('18 · it survives listing, and only "Đã xem" sets `read_at`', async () => {
    await buildIngest().ingest(NIMBUS, 'after', 'watch_cycle')

    // Reading the list three times must not mark anything: scrolling past is not reading.
    await notifications.list(sales)
    await notifications.list(sales)
    let list = await notifications.list(sales)
    expect(list[0].readAt).toBeNull()

    await notifications.markRead(sales, list[0].id)

    list = await notifications.list(sales)
    // Still present — marked, not deleted. The record that Sales was told is part of the trail.
    expect(list).toHaveLength(1)
    expect(list[0].readAt).not.toBeNull()
  })
})

describe('the AI cannot reach past its three columns on this path', () => {
  it('19 · `crm_system` writing `stage` or `expected_value` on an opportunity is refused', async () => {
    await expect(
      system.query(`UPDATE opportunities SET stage = 'won' WHERE id = $1`, [NIMBUS_OPPORTUNITY]),
    ).rejects.toThrow(/permission denied/i)

    await expect(
      system.query(`UPDATE opportunities SET expected_value = 1 WHERE id = $1`, [
        NIMBUS_OPPORTUNITY,
      ]),
    ).rejects.toThrow(/permission denied/i)
  })
})

describe('mutation measurement 1 · the pool choice is the second defence layer', () => {
  /**
   * `AutoNextStepService.undo` picks its pool by actor. Hard-wire `dbApp` there and the guard
   * at the top of the method is all that is left — one layer, and ADR-0004 claims two.
   *
   * This test measures the layer directly, by issuing the two statements `undo()` issues under
   * the AI role. The restore of the cell SUCCEEDS (those three columns are granted, and they
   * must be, or zone 3 could not write at all) and the trail write is REFUSED. So a hard-wired
   * `dbApp` plus a deleted guard produces a complete, silent, machine-performed undo — with
   * every other test in this file still green.
   */
  it('20 · `crm_system` cannot record an undo, so the trail cannot be forged', async () => {
    await buildIngest().ingest(NIMBUS, 'after', 'watch_cycle')
    const map = await autoNextSteps.listActive()
    const eventId = map[NIMBUS_OPPORTUNITY].eventId

    await expect(
      system.query(`UPDATE auto_next_step_events SET undone_at = now() WHERE id = $1`, [eventId]),
    ).rejects.toThrow(/permission denied/i)

    await expect(
      system.query(`UPDATE auto_next_step_events SET undone_by = $1 WHERE id = $2`, [
        SALES_ID,
        eventId,
      ]),
    ).rejects.toThrow(/permission denied/i)

    // And it cannot mark its own notice read either, which is the same hole one table over.
    await expect(system.query(`UPDATE notifications SET read_at = now()`)).rejects.toThrow(
      /permission denied/i,
    )
  })
})

describe('mutation measurement 2 · the 7-day window is fixed by a GRANT, not by good manners', () => {
  /**
   * The debt `0003` has carried since it was written: its column list was reasoned about and
   * never measured. Granting `undo_deadline` back turns "the AI cannot shorten its own undo
   * window" from true to false, and no other test in the suite would notice.
   */
  it('21 · granting `undo_deadline` to `crm_system` lets it shrink the window; revoking fixes it', async () => {
    const claim = await seedClaim(NIMBUS, 'funding', 'certain')

    const insertWithOwnDeadline = (): Promise<unknown> =>
      system.query(
        `INSERT INTO auto_next_step_events
           (opportunity_id, claim_id, new_text, new_due_date, undo_deadline)
         VALUES ($1, $2, 'Gọi lại', '2026-08-20', now() + interval '1 minute')`,
        [NIMBUS_OPPORTUNITY, claim.id],
      )

    await expect(insertWithOwnDeadline()).rejects.toThrow(/permission denied/i)

    try {
      await owner.query('GRANT INSERT (undo_deadline) ON auto_next_step_events TO crm_system')
      // With the column granted, the AI writes a one-minute undo window and T-7 becomes a lie.
      await expect(insertWithOwnDeadline()).resolves.toBeTruthy()

      const { rows } = await owner.query(
        `SELECT undo_deadline FROM auto_next_step_events ORDER BY created_at DESC LIMIT 1`,
      )
      const minutes = (new Date(rows[0].undo_deadline).getTime() - Date.now()) / 60_000
      expect(minutes).toBeLessThan(2)
    } finally {
      await owner.query('REVOKE INSERT (undo_deadline) ON auto_next_step_events FROM crm_system')
    }

    await expect(insertWithOwnDeadline()).rejects.toThrow(/permission denied/i)
  })

  it('22 · the AI cannot fabricate an undo record on insert either', async () => {
    const claim = await seedClaim(NIMBUS, 'funding', 'certain')

    await expect(
      system.query(
        `INSERT INTO auto_next_step_events
           (opportunity_id, claim_id, new_text, undone_at, undone_by)
         VALUES ($1, $2, 'Gọi lại', now(), $3)`,
        [NIMBUS_OPPORTUNITY, claim.id, SALES_ID],
      ),
    ).rejects.toThrow(/permission denied/i)
  })
})

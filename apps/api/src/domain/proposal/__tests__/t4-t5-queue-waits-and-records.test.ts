import { Pool } from 'pg'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createConnection, resetTestDatabase } from '@crm/db'

import { AuditEventService } from '../../../common/audit/audit-event-service'
import { AutoNextStepService } from '../../opportunity/auto-next-step-service'
import { ClaimReactionService } from '../../claim/claim-reaction-service'
import { ClaimService } from '../../claim/claim-service'
import { DemoSnapshotSource } from '../../../ai/demo-snapshots'
import { FixtureClaimExtractor } from '../../../ai/fixture-claim-extractor'
import { ObservationService } from '../../observation/observation-service'
import { ProposalDecisionService } from '../proposal-decision-service'
import { ProposalService } from '../proposal-service'
import { SYSTEM_ACTOR, humanActor } from '../../../common/actor/actor-context'
import { SystemSettingService } from '../../../settings/system-setting-service'
import { SystemTimelineEntryService } from '../../../watch/system-timeline-entry-service'
import { WatchCycleRollup } from '../../../watch/watch-cycle-rollup'
import { WatchCycleService } from '../../../watch/watch-cycle-service'

/**
 * T-4 and T-5 — the two acceptance checks of feature group 3.
 *
 * T-4 is the important one: it proves autonomy zone 2 does not DRIFT into zone 3. A queue that
 * quietly applies itself after a while would still pass every other test in this phase, and it
 * is the single failure that would make the whole "máy chuẩn bị, người quyết" claim false.
 *
 * It runs at the integration layer with a fake clock rather than in Playwright: three real
 * cycles at the configured 60s cadence would be a three-minute e2e test, and the assertion that
 * matters — "the profile row is byte-for-byte what it was" — is a SELECT, not a screen.
 */

const SALES_ID = '11111111-1111-4111-8111-111111111111'
const SAKURA = 'aaaaaaaa-0001-4000-8000-000000000001'
const MARLIN = 'aaaaaaaa-0005-4000-8000-000000000005'
const OPPORTUNITY_ID = 'bbbbbbbb-0001-4000-8000-000000000001'

const owner = new Pool({ connectionString: process.env.DATABASE_URL_TEST })
const appConnection = createConnection(process.env.DATABASE_URL_TEST_APP as string)
const systemConnection = createConnection(process.env.DATABASE_URL_TEST_SYSTEM as string)

const settings = new SystemSettingService(
  appConnection.db,
  systemConnection.db,
  new AuditEventService(appConnection.db, systemConnection.db),
)
const snapshots = new DemoSnapshotSource()
const proposalService = new ProposalService(systemConnection.db, appConnection.db)
const decisions = new ProposalDecisionService(
  appConnection.db,
  new AuditEventService(appConnection.db, systemConnection.db),
)

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
      new AutoNextStepService(
        systemConnection.db,
        appConnection.db,
        new AuditEventService(appConnection.db, systemConnection.db),
      ),
      proposalService,
      new SystemTimelineEntryService(systemConnection.db),
    ),
  )
}

async function companyProfile(companyId: string): Promise<Record<string, unknown>> {
  const { rows } = await owner.query(
    'SELECT industry, country, size, website, updated_at FROM companies WHERE id = $1',
    [companyId],
  )
  return rows[0]
}

async function pendingIdByType(proposalType: string): Promise<string> {
  const { rows } = await owner.query(
    `SELECT id FROM proposals WHERE proposal_type = $1 AND status = 'pending' LIMIT 1`,
    [proposalType],
  )
  expect(rows).toHaveLength(1)
  return rows[0].id
}

async function setAiEnabled(enabled: boolean): Promise<void> {
  await owner.query(
    `INSERT INTO system_settings (key, value) VALUES ('ai_enabled', $1), ('watch_cycle_seconds', '60')
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [String(enabled)],
  )
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
       ($1, 'Sakura Manufacturing KK', 'Sản xuất linh kiện', 'traditional', $3, true,
        'Nhật Bản', '500-1000', 'https://sakura-mfg.example.jp'),
       ($2, 'Marlin Product Labs', 'Phần mềm đóng gói', 'it_product', $3, false,
        'Singapore', '50-100', 'https://marlin-labs.example.com')`,
    [SAKURA, MARLIN, SALES_ID],
  )
  await owner.query(
    `INSERT INTO opportunities (id, company_id, name, stage, next_step_text, next_step_source)
     VALUES ($1, $2, 'Thuê ngoài đội bảo trì MES', 'qualified',
             'Gửi lại báo giá sau buổi họp kỹ thuật', 'human')`,
    [OPPORTUNITY_ID, SAKURA],
  )
  await setAiEnabled(true)
})

afterAll(async () => {
  await Promise.all([owner.end(), appConnection.close(), systemConnection.close()])
})

describe('T-4 · a suggestion nobody decides changes nothing, indefinitely', () => {
  let worker: WatchCycleService

  afterEach(async () => {
    await worker?.onModuleDestroy()
    vi.useRealTimers()
  })

  it('1 · three watch cycles later the profile is untouched and the queue still waits', async () => {
    const firstRead = await buildIngest().ingest(SAKURA, 'after', 'watch_cycle')

    const queued = await owner.query(`SELECT count(*)::int AS total FROM proposals`)
    expect(queued.rows[0].total).toBeGreaterThan(0)
    const before = await companyProfile(SAKURA)

    /**
     * Point the watch cycle at the SAME page the read above used. The cycle takes which snapshot
     * to open from `companies.snapshot_variant` (ADR-0022) and never from an argument, so without
     * this line the cycles would read the `before` page — genuinely new content, genuinely new
     * findings — and the test would be measuring the fixture rather than T-4.
     */
    await owner.query(`UPDATE companies SET snapshot_variant = 'after' WHERE id = $1`, [SAKURA])

    vi.useFakeTimers()
    worker = new WatchCycleService(
      settings,
      systemConnection.db,
      buildIngest(),
      new WatchCycleRollup(systemConnection.db),
    )
    worker.onModuleInit()
    await worker.awaitCurrentTick()

    for (let cycle = 0; cycle < 3; cycle += 1) {
      await vi.advanceTimersByTimeAsync(60_000)
      await worker.awaitCurrentTick()
    }

    // Four ticks have run (the immediate one plus three). Nothing applied itself.
    const runs = await owner.query('SELECT count(*)::int AS total FROM watch_cycle_runs')
    expect(runs.rows[0].total).toBeGreaterThanOrEqual(4)

    expect(await companyProfile(SAKURA)).toEqual(before)

    const still = await owner.query(
      `SELECT count(*)::int AS total FROM proposals WHERE status <> 'pending'`,
    )
    expect(still.rows[0].total).toBe(0)

    const decided = await owner.query('SELECT count(*)::int AS total FROM proposal_decisions')
    expect(decided.rows[0].total).toBe(0)

    /**
     * Nor did anything slip onto the timeline while nobody was looking — and after ADR-0028 that
     * sentence needs saying precisely, because Sakura IS a watched company, so zone 4 wrote its
     * entry during the first read above. Two things are asserted instead of a flat zero:
     *
     *   no entry claims a PERSON typed it — an accepted suggestion would be written by `crm_app`
     *   as `created_by = 'human'`, so a human-authored row appearing with nobody deciding is
     *   precisely the T-4 failure;
     *
     *   the system entries did not GROW over three further cycles — I-3 sees an unchanged page,
     *   produces no findings, and so zone 4 has nothing to write. Without this half, a version
     *   that re-adds the same news every 60 seconds would pass.
     */
    const byAuthor = await owner.query(
      `SELECT created_by, count(*)::int AS total FROM timeline_entries GROUP BY created_by`,
    )
    const totals = Object.fromEntries(byAuthor.rows.map((row) => [row.created_by, row.total]))
    expect(totals.human ?? 0).toBe(0)
    expect(totals.system ?? 0).toBe(firstRead.systemEntriesAdded)
  })
})

describe('T-5 · every decision is recorded, and `edit` is not `accept`', () => {
  it('2 · Duyệt writes the profile under the DECIDING PERSON, not under the system', async () => {
    await buildIngest().ingest(SAKURA, 'after', 'watch_cycle')
    const id = await pendingIdByType('field_update')

    await decisions.decide(sales, id, { decision: 'accept', secondsToDecide: 7 })

    const profile = await companyProfile(SAKURA)
    expect(profile.size).toBe('1000+')

    const { rows } = await owner.query(
      `SELECT decision, decided_by, seconds_to_decide, final_value, reject_reason
       FROM proposal_decisions`,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].decision).toBe('accept')
    // The whole point of zone 2: the row bears a person's id, so "ai quyết" is answerable.
    expect(rows[0].decided_by).toBe(SALES_ID)
    expect(rows[0].seconds_to_decide).toBe(7)
    expect(rows[0].final_value).toBeNull()

    const status = await owner.query('SELECT status FROM proposals WHERE id = $1', [id])
    expect(status.rows[0].status).toBe('decided')
  })

  it('3 · Sửa rồi duyệt stores what the PERSON typed and counts as `edit` (I-12)', async () => {
    await buildIngest().ingest(SAKURA, 'after', 'watch_cycle')
    const id = await pendingIdByType('field_update')

    await decisions.decide(sales, id, {
      decision: 'edit',
      finalValue: '1000-2000',
      secondsToDecide: 22,
    })

    // Not `proposed_value`: the human overrode it, and the cell must hold their version.
    expect((await companyProfile(SAKURA)).size).toBe('1000-2000')

    const { rows } = await owner.query(
      'SELECT decision, final_value FROM proposal_decisions',
    )
    expect(rows[0].decision).toBe('edit')
    expect(rows[0].final_value).toBe('1000-2000')

    // I-12 is structural: counting accept means counting the value `accept`, and this is not it.
    const accepts = await owner.query(
      `SELECT count(*)::int AS total FROM proposal_decisions WHERE decision = 'accept'`,
    )
    expect(accepts.rows[0].total).toBe(0)
  })

  it('4 · Bỏ records the reason and leaves official data exactly as it was', async () => {
    await buildIngest().ingest(SAKURA, 'after', 'watch_cycle')
    const id = await pendingIdByType('field_update')
    const before = await companyProfile(SAKURA)

    await decisions.decide(sales, id, {
      decision: 'reject',
      rejectReason: 'wrong_info',
      secondsToDecide: 4,
    })

    expect(await companyProfile(SAKURA)).toEqual(before)

    const { rows } = await owner.query(
      'SELECT decision, reject_reason FROM proposal_decisions',
    )
    expect(rows[0].decision).toBe('reject')
    // Half of error-detection rate comes from this column (ontology section 7).
    expect(rows[0].reject_reason).toBe('wrong_info')
  })

  it('5 · accepting a `timeline_entry` writes an entry that belongs to the person', async () => {
    await buildIngest().ingest(MARLIN, 'after', 'watch_cycle')
    const id = await pendingIdByType('timeline_entry')

    await decisions.decide(sales, id, { decision: 'accept' })

    const { rows } = await owner.query(
      'SELECT created_by, entry_type, description FROM timeline_entries',
    )
    expect(rows).toHaveLength(1)
    /**
     * `human`, not `system`. The "do hệ thống thêm" label belongs to the watch cycle (zone 4);
     * wearing it here would make a reviewed entry indistinguishable from an unreviewed one.
     */
    expect(rows[0].created_by).toBe('human')
    expect(rows[0].entry_type).toBe('note')
  })

  it('6 · a `next_step` suggestion, once accepted, is a HUMAN next step with an I-9 due date', async () => {
    /**
     * The I-7 hand-off, end to end and no longer simulated. Sakura's deal carries a next step a
     * person typed, so reading its `after` page has feature group 4 REFUSE to write and file
     * this suggestion instead (ADR-0023). Until phase 6 this test built the row by hand.
     */
    await buildIngest().ingest(SAKURA, 'after', 'watch_cycle')

    const id = await pendingIdByType('next_step')
    const proposed = await owner.query('SELECT proposed_value FROM proposals WHERE id = $1', [id])
    await decisions.decide(sales, id, { decision: 'accept' })

    const { rows } = await owner.query(
      `SELECT next_step_text, next_step_due_date::text AS due, next_step_source
       FROM opportunities WHERE id = $1`,
      [OPPORTUNITY_ID],
    )
    expect(rows[0].next_step_text).toBe(proposed.rows[0].proposed_value)
    // The human-typed sentence is gone only because a PERSON pressed Duyệt on its replacement.
    expect(rows[0].next_step_text).not.toBe('Gửi lại báo giá sau buổi họp kỹ thuật')
    // `human`: a person decided. `system` would drop this cell into zone 3 and drag the
    // notification and the 7-day undo along with it.
    expect(rows[0].next_step_source).toBe('human')

    /**
     * I-9: funding is a 3-day window, measured from the DECISION — not a fixed number.
     *
     * Compared as text on both sides deliberately. node-postgres turns a `date` column into a
     * JS `Date` at LOCAL midnight, so `toISOString()` on it reports the previous day anywhere
     * east of UTC — a comparison that would fail in Saigon and pass in London.
     */
    const expected = new Date()
    expected.setDate(expected.getDate() + 3)
    const expectedLocalDate = [
      expected.getFullYear(),
      String(expected.getMonth() + 1).padStart(2, '0'),
      String(expected.getDate()).padStart(2, '0'),
    ].join('-')
    expect(rows[0].due).toBe(expectedLocalDate)
  })

  it('7 · the system may not decide on its own behalf, and the refusal is audited', async () => {
    await buildIngest().ingest(SAKURA, 'after', 'watch_cycle')
    const id = await pendingIdByType('field_update')

    await expect(decisions.decide(SYSTEM_ACTOR, id, { decision: 'accept' })).rejects.toThrow(
      /không được tự duyệt/i,
    )

    const { rows } = await owner.query(
      `SELECT actor, action FROM audit_events WHERE action = 'decide_proposal'`,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].actor).toBe('system')

    const decided = await owner.query('SELECT count(*)::int AS total FROM proposal_decisions')
    expect(decided.rows[0].total).toBe(0)
  })
})

describe('ADR-0009 · switching the AI off does not freeze the queue', () => {
  it('8 · a suggestion raised before the switch is still decidable after it', async () => {
    await buildIngest().ingest(SAKURA, 'after', 'watch_cycle')
    const id = await pendingIdByType('field_update')

    await setAiEnabled(false)

    // The switch stops NEW generation. Deciding is a human act and has nothing to do with it —
    // freezing the queue would punish the reviewer for turning the AI off.
    await decisions.decide(sales, id, { decision: 'accept' })

    expect((await companyProfile(SAKURA)).size).toBe('1000+')
  })
})

describe('Specs · a decided suggestion does not come back with the same content', () => {
  it('9 · re-reading the same page proposes nothing again; a NEW snapshot reopens it', async () => {
    const ingest = buildIngest()
    await ingest.ingest(SAKURA, 'after', 'watch_cycle')
    const id = await pendingIdByType('field_update')
    await decisions.decide(sales, id, { decision: 'reject', rejectReason: 'outdated' })

    // Layer one is I-3: identical content produces no observation at all, so three more reads
    // cannot resurrect it.
    for (let read = 0; read < 3; read += 1) {
      const result = await ingest.ingest(SAKURA, 'after', 'watch_cycle')
      expect(result.unchanged).toBe(true)
    }
    /**
     * Scoped to `field_update`, which is the kind this test decided. Sakura's deal also carries
     * a human-typed next step, so the same read hands feature group 4 an I-7 refusal and the
     * queue legitimately holds a `next_step` suggestion nobody has looked at.
     */
    let pending = await owner.query(
      `SELECT count(*)::int AS total FROM proposals
       WHERE status = 'pending' AND proposal_type = 'field_update'`,
    )
    expect(pending.rows[0].total).toBe(0)

    // Layer two: a genuinely different page IS new evidence, and Specs allows the suggestion
    // back. Reading `before` then `after` gives the second `after` a newer observation.
    await ingest.ingest(SAKURA, 'before', 'watch_cycle')
    await ingest.ingest(SAKURA, 'after', 'watch_cycle')

    pending = await owner.query(
      `SELECT count(*)::int AS total FROM proposals
       WHERE status = 'pending' AND target_field = 'size'`,
    )
    expect(pending.rows[0].total).toBe(1)
  })
})

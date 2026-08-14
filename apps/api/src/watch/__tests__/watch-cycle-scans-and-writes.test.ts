import { Pool } from 'pg'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ClaimDraft, ClaimExtractor, ObservationInput } from '@crm/contracts'
import { createConnection, resetTestDatabase } from '@crm/db'

import { AuditEventService } from '../../common/audit/audit-event-service'
import { AutoNextStepService } from '../../domain/opportunity/auto-next-step-service'
import { ClaimReactionService } from '../../domain/claim/claim-reaction-service'
import { ClaimService } from '../../domain/claim/claim-service'
import { DemoSnapshotSource } from '../../ai/demo-snapshots'
import { FixtureClaimExtractor } from '../../ai/fixture-claim-extractor'
import { ObservationService } from '../../domain/observation/observation-service'
import { ProposalService } from '../../domain/proposal/proposal-service'
import { SystemSettingService } from '../../settings/system-setting-service'
import { SystemTimelineEntryService } from '../system-timeline-entry-service'
import { WatchCycleRollup } from '../watch-cycle-rollup'
import { WatchCycleService } from '../watch-cycle-service'

/**
 * The closed loop of feature group 5: a timer fires, sources are read, entries appear, and the
 * log row says what happened — with nobody pressing anything at any point.
 *
 * `self-scheduling-watch-cycle.test.ts` covers the CADENCE (ADR-0011). This file covers what a
 * cycle DOES, and the two are kept apart because the cadence tests must stay readable without a
 * reaction chain in the picture.
 *
 * The four numbers on a `WatchCycleRun` are asserted rather than described, because the log is
 * the only place the loop is observable after the fact — round 2 reads it, and a number nobody
 * ever checked is decoration. `entries_added = 0` alongside `new_content_count > 0` is the shape
 * that says the filter or the prompt is wrong, so the pair has to be trustworthy.
 */

const SALES_ID = '11111111-1111-4111-8111-111111111111'
const SAKURA = 'aaaaaaaa-0001-4000-8000-000000000001'
const NIMBUS = 'aaaaaaaa-0002-4000-8000-000000000002'
const KITEFIN = 'aaaaaaaa-0003-4000-8000-000000000003'
/** Not watched. Present so "scanned" means watched companies, not every company. */
const MARLIN = 'aaaaaaaa-0005-4000-8000-000000000005'

const owner = new Pool({ connectionString: process.env.DATABASE_URL_TEST })
const appConnection = createConnection(process.env.DATABASE_URL_TEST_APP as string)
const systemConnection = createConnection(process.env.DATABASE_URL_TEST_SYSTEM as string)

const settings = new SystemSettingService(appConnection.db, systemConnection.db)
const snapshots = new DemoSnapshotSource()

let worker: WatchCycleService

/** Counts extractor calls, so "no LLM call" can be measured instead of assumed (I-3). */
class CountingExtractor implements ClaimExtractor {
  calls = 0
  private readonly inner = new FixtureClaimExtractor()

  async extract(observation: ObservationInput): Promise<ClaimDraft[]> {
    this.calls += 1
    return this.inner.extract(observation)
  }
}

/** Throws for ONE company. The other companies of the same cycle must still be read. */
class FailingForOneExtractor implements ClaimExtractor {
  calls = 0
  private readonly inner = new FixtureClaimExtractor()

  constructor(private readonly failForCompanyId: string) {}

  async extract(observation: ObservationInput): Promise<ClaimDraft[]> {
    this.calls += 1
    if (observation.companyId === this.failForCompanyId) {
      throw new Error('nguồn lỗi giả lập')
    }
    return this.inner.extract(observation)
  }
}

function createWorker(extractor: ClaimExtractor): WatchCycleService {
  const claims = new ClaimService(systemConnection.db, appConnection.db)
  const reactions = new ClaimReactionService(
    new AutoNextStepService(
      systemConnection.db,
      appConnection.db,
      new AuditEventService(appConnection.db, systemConnection.db),
    ),
    new ProposalService(systemConnection.db, appConnection.db),
    new SystemTimelineEntryService(systemConnection.db),
  )
  const observations = new ObservationService(
    systemConnection.db,
    appConnection.db,
    extractor,
    claims,
    snapshots,
    settings,
    reactions,
  )
  worker = new WatchCycleService(
    settings,
    systemConnection.db,
    observations,
    new WatchCycleRollup(systemConnection.db),
  )
  return worker
}

/** Advance the clock, then WAIT for the tick it fired to finish writing. */
async function advance(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms)
  await worker.awaitCurrentTick()
}

interface RunRow {
  companies_scanned: number
  new_content_count: number
  entries_added: number
  error_count: number
  error_detail: string | null
  skipped_reason: string | null
  is_rollup: boolean
  cycles_covered: number
}

async function runs(): Promise<RunRow[]> {
  const { rows } = await owner.query(
    `SELECT companies_scanned, new_content_count, entries_added, error_count, error_detail,
            skipped_reason, is_rollup, cycles_covered
     FROM watch_cycle_runs ORDER BY started_at, is_rollup`,
  )
  return rows
}

async function systemEntryCount(): Promise<number> {
  const { rows } = await owner.query(
    `SELECT count(*)::int AS total FROM timeline_entries WHERE created_by = 'system'`,
  )
  return rows[0].total
}

beforeEach(async () => {
  await resetTestDatabase(owner)
  await owner.query(
    `INSERT INTO users (id, email, password_hash, name, role)
     VALUES ($1, 'sales@test.local', 'x', 'Sales', 'sales')`,
    [SALES_ID],
  )
  await owner.query(
    `INSERT INTO companies (id, name, industry, company_type, owner_id, is_watched, snapshot_variant)
     VALUES
       ($1, 'Sakura Manufacturing KK', 'Sản xuất', 'traditional', $5, true, 'after'),
       ($2, 'Nimbus Cloud Solutions', 'Công nghệ', 'it_solution', $5, true, 'after'),
       ($3, 'Kitefin Analytics', 'Dữ liệu', 'it_product', $5, true, 'after'),
       ($4, 'Marlin Product Labs', 'Phần mềm', 'it_product', $5, false, 'after')`,
    [SAKURA, NIMBUS, KITEFIN, MARLIN, SALES_ID],
  )
  await owner.query(
    `INSERT INTO system_settings (key, value) VALUES ('ai_enabled', 'true'), ('watch_cycle_seconds', '60')
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
  )
  vi.useFakeTimers()
})

afterEach(async () => {
  await worker?.onModuleDestroy()
  vi.useRealTimers()
})

afterAll(async () => {
  await Promise.all([owner.end(), appConnection.close(), systemConnection.close()])
})

describe('one cycle reads every watched company and logs four honest numbers', () => {
  it('1 · scans only the WATCHED companies and adds entries for them', async () => {
    createWorker(new CountingExtractor()).onModuleInit()
    await advance(0)

    const [run] = await runs()
    // Marlin is not watched, so three, not four.
    expect(run.companies_scanned).toBe(3)
    expect(run.new_content_count).toBe(3)
    expect(run.entries_added).toBeGreaterThan(0)
    expect(run.error_count).toBe(0)
    expect(run.error_detail).toBeNull()
    expect(run.skipped_reason).toBeNull()

    expect(await systemEntryCount()).toBe(run.entries_added)

    const { rows } = await owner.query(
      'SELECT count(*)::int AS total FROM timeline_entries WHERE company_id = $1',
      [MARLIN],
    )
    expect(rows[0].total).toBe(0)
  })

  it('2 · I-3 inside the cycle: the second cycle reads nothing new and calls no extractor', async () => {
    const extractor = new CountingExtractor()
    createWorker(extractor).onModuleInit()
    await advance(0)

    const afterFirst = extractor.calls
    const entriesAfterFirst = await systemEntryCount()
    expect(afterFirst).toBe(3)

    await advance(60_000)

    const rows = await runs()
    expect(rows).toHaveLength(2)
    expect(rows[1].companies_scanned).toBe(3)
    // "Đã đọc, không đổi" — which is what the log line must say, not "nothing found".
    expect(rows[1].new_content_count).toBe(0)
    expect(rows[1].entries_added).toBe(0)

    // The expensive half of I-3. Asserting only "no new entries" would pass a version that pays
    // for three model calls every single minute.
    expect(extractor.calls).toBe(afterFirst)
    expect(await systemEntryCount()).toBe(entriesAfterFirst)
  })

  it('3 · one company failing does not kill the cycle, and the failure is written down', async () => {
    const extractor = new FailingForOneExtractor(NIMBUS)
    createWorker(extractor).onModuleInit()
    await advance(0)

    const [run] = await runs()
    expect(run.companies_scanned).toBe(3)
    expect(run.error_count).toBe(1)
    expect(run.error_detail).toContain('Nimbus')
    // The other two were read despite the failure between them.
    expect(run.new_content_count).toBe(2)
    expect(run.entries_added).toBeGreaterThan(0)

    const { rows } = await owner.query(
      'SELECT count(*)::int AS total FROM timeline_entries WHERE company_id = $1',
      [NIMBUS],
    )
    expect(rows[0].total).toBe(0)
  })

  it('4 · I-10 with a slow cycle: the next tick skips and adds no duplicate entry', async () => {
    /**
     * The real situation at the T-8 cadence of 10 seconds: three companies, several model calls,
     * and a cycle that outlasts its own period. What must NOT happen is two cycles writing the
     * same news twice.
     */
    let release: (() => void) | undefined
    let started: (() => void) | undefined
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    const firstStarted = new Promise<void>((resolve) => {
      started = resolve
    })

    let first = true
    const slowExtractor: ClaimExtractor = {
      async extract(observation) {
        if (first) {
          first = false
          started?.()
          await held
        }
        return new FixtureClaimExtractor().extract(observation)
      },
    }

    createWorker(slowExtractor).onModuleInit()
    const firstTick = Reflect.get(worker, 'currentTick') as Promise<void>
    await firstStarted

    await vi.advanceTimersByTimeAsync(60_000)
    await worker.awaitCurrentTick()

    const during = await runs()
    expect(during).toHaveLength(1)
    expect(during[0].skipped_reason).toBe('previous_cycle_running')
    // A skipped tick scans nothing, so its own counters must be zeroes, not inherited numbers.
    expect(during[0].companies_scanned).toBe(0)
    expect(during[0].entries_added).toBe(0)

    release?.()
    await firstTick

    const after = await runs()
    expect(after).toHaveLength(2)
    const real = after.filter((row) => row.skipped_reason === null)
    expect(real).toHaveLength(1)
    expect(await systemEntryCount()).toBe(real[0].entries_added)
  })
})

describe('the rolled-up line every ten cycles', () => {
  it('5 · exactly one rollup row after ten cycles, covering ten, sorted AFTER them', async () => {
    const extractor = new CountingExtractor()
    createWorker(extractor).onModuleInit()
    await advance(0)
    for (let cycle = 1; cycle < 10; cycle += 1) {
      await advance(60_000)
    }

    const rows = await runs()
    const rollups = rows.filter((row) => row.is_rollup)
    expect(rollups).toHaveLength(1)
    expect(rollups[0].cycles_covered).toBe(10)
    // Ten real cycles plus one summary.
    expect(rows).toHaveLength(11)

    // The summary sums its ten, not the whole table: three companies, ten cycles.
    expect(rollups[0].companies_scanned).toBe(30)
    // Only the FIRST cycle saw new content — three companies' worth — and I-3 silenced the
    // other nine cycles entirely. The sum being 3 rather than 30 is what proves that.
    expect(rollups[0].new_content_count).toBe(3)
    expect(rollups[0].entries_added).toBe(await systemEntryCount())

    const { rows: ordered } = await owner.query(
      'SELECT is_rollup FROM watch_cycle_runs ORDER BY started_at, is_rollup',
    )
    // `max(started_at)` rather than `min`, so the total never sorts before its parts.
    expect(ordered[ordered.length - 1].is_rollup).toBe(true)
  })

  it('6 · nine cycles produce no rollup at all — the threshold is not "about ten"', async () => {
    createWorker(new CountingExtractor()).onModuleInit()
    await advance(0)
    for (let cycle = 1; cycle < 9; cycle += 1) {
      await advance(60_000)
    }

    const rows = await runs()
    expect(rows).toHaveLength(9)
    expect(rows.filter((row) => row.is_rollup)).toHaveLength(0)
  })

  it('7 · the second rollup covers the NEXT ten, never the same ten twice', async () => {
    createWorker(new CountingExtractor()).onModuleInit()
    await advance(0)
    for (let cycle = 1; cycle < 20; cycle += 1) {
      await advance(60_000)
    }

    const rows = await runs()
    const rollups = rows.filter((row) => row.is_rollup)
    expect(rollups).toHaveLength(2)
    // The watermark subquery is what makes this hold: each summary starts where the last ended.
    expect(rollups.every((row) => row.cycles_covered === 10)).toBe(true)
  })

  it('8 · a SKIPPED tick counts as a cycle — it happened and chose not to scan', async () => {
    createWorker(new CountingExtractor()).onModuleInit()
    await advance(0)

    // Switch the AI off: every further tick records a skip, and each is still a cycle.
    await owner.query(`UPDATE system_settings SET value = 'false' WHERE key = 'ai_enabled'`)
    for (let cycle = 1; cycle < 10; cycle += 1) {
      await advance(60_000)
    }

    const rows = await runs()
    const rollups = rows.filter((row) => row.is_rollup)
    expect(rollups).toHaveLength(1)
    expect(rollups[0].cycles_covered).toBe(10)
    expect(rows.filter((row) => row.skipped_reason === 'ai_disabled')).toHaveLength(9)
  })
})

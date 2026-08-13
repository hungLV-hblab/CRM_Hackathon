import { Pool } from 'pg'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { IngestResultDto } from '@crm/contracts'
import { createConnection, resetTestDatabase } from '@crm/db'

import type { ObservationService } from '../../domain/observation/observation-service'
import { SystemSettingService } from '../../settings/system-setting-service'
import type { WatchCycleRollup } from '../watch-cycle-rollup'
import { WatchCycleService } from '../watch-cycle-service'

/** "Read, nothing there" — the shape `ingest()` returns for an unchanged source. */
const EMPTY_INGEST: IngestResultDto = {
  observationId: null,
  unchanged: true,
  skippedReason: null,
  fetchStatus: 'ok',
  claimsProposed: 0,
  claimsSaved: 0,
  claimsDroppedNoVerbatimQuote: 0,
  claimsDowngradedFromCertain: 0,
  systemEntriesAdded: 0,
}

/**
 * Pays off ADR-0011's verification debt — that ADR was written without a single line ever
 * having been run.
 *
 * These tests use a REAL database (no fake `SystemSettingService`) because the thing being
 * proven is precisely that "the worker reads its parameters FROM THE DATABASE every tick".
 * Fake that away and the rest proves nothing.
 *
 * Why every clock advance is followed by `awaitCurrentTick()`: a fake clock only fires
 * `setTimeout`, it knows nothing about a Postgres query in flight. Read the table right
 * after advancing and you read a half-finished state, and the test goes red for reasons that
 * have nothing to do with the behaviour under test.
 *
 * ─── One deliberate divergence from the phase file, stated plainly ──────────────────────
 * Scenario 2 there reads "tick 2 comes EXACTLY 10s after tick 1". That cannot coexist with
 * scenario 5 (I-10): for tick 2 to use the new value, scheduling must happen AFTER the scan
 * completes — and scheduling there means an overrunning scan pushes the next tick out by
 * itself, so "previous cycle still running" can never occur. The two scenarios are mutually
 * exclusive.
 * We keep I-10 and measure the standard ADR-0011/plan.md states: "the cadence changes within
 * ≤1 cycle". The measurement still refutes `@Cron` — under `@Cron` the cadence NEVER changes.
 */

const owner = new Pool({ connectionString: process.env.DATABASE_URL_TEST })
const appConnection = createConnection(process.env.DATABASE_URL_TEST_APP as string)
const systemConnection = createConnection(process.env.DATABASE_URL_TEST_SYSTEM as string)

const settings = new SystemSettingService(appConnection.db, systemConnection.db)

let worker: WatchCycleService

/**
 * A worker whose SCAN does nothing. This file is about the CADENCE — ADR-0011's three converging
 * requirements — and a real reaction chain here would make every assertion below depend on
 * fixture content and model behaviour as well as on the clock. What a cycle does is measured in
 * `watch-cycle-scans-and-writes.test.ts`; keeping the two apart is what keeps both readable.
 */
function createWorker(): WatchCycleService {
  const noopIngest = {
    async ingest() {
      return EMPTY_INGEST
    },
  } as unknown as ObservationService
  const noopRollup = {
    async maybeWrite() {
      return false
    },
  } as unknown as WatchCycleRollup

  worker = new WatchCycleService(settings, systemConnection.db, noopIngest, noopRollup)
  return worker
}

/** Advance the clock, then WAIT for the tick it fired to finish writing to the database. */
async function advance(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms)
  await worker.awaitCurrentTick()
}

async function setParameters(aiEnabled: boolean, seconds: number): Promise<void> {
  await owner.query(
    `INSERT INTO system_settings (key, value) VALUES ('ai_enabled', $1), ('watch_cycle_seconds', $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [String(aiEnabled), String(seconds)],
  )
}

async function watchLog(): Promise<{ skipped_reason: string | null }[]> {
  const { rows } = await owner.query(
    'SELECT skipped_reason, started_at FROM watch_cycle_runs ORDER BY started_at, skipped_reason',
  )
  return rows
}

beforeEach(async () => {
  await resetTestDatabase(owner)
  await owner.query(
    `INSERT INTO companies (name, industry, company_type, is_watched)
     VALUES ('Watched company', 'ITO', 'it_solution', true)`,
  )
  await setParameters(true, 60)
  vi.useFakeTimers()
})

afterEach(async () => {
  await worker?.onModuleDestroy()
  vi.useRealTimers()
})

afterAll(async () => {
  await Promise.all([owner.end(), appConnection.close(), systemConnection.close()])
})

describe('self-scheduling watch cycle (ADR-0011)', () => {
  it('1 · 60s cycle, three ticks → exactly three log rows, no more and no fewer', async () => {
    createWorker().onModuleInit()
    await advance(0)
    await advance(60_000)
    await advance(60_000)

    const rows = await watchLog()
    expect(rows).toHaveLength(3)
    expect(rows.every((row) => row.skipped_reason === null)).toBe(true)
  })

  it('2 · changing the cycle in the database changes the cadence within ≤1 cycle, NO restart', async () => {
    createWorker().onModuleInit()
    await advance(0)

    await setParameters(true, 10)

    // Tick 2 still follows the old schedule (60s) — this is the "≤1 cycle", not "instantly".
    await advance(60_000)
    expect(await watchLog()).toHaveLength(2)

    // From tick 2 onward the worker has read 10s: advancing 10s produces tick 3.
    await advance(10_000)
    expect(await watchLog()).toHaveLength(3)

    // Another 10s gives tick 4 — the cadence really changed, this is not a coincidence.
    await advance(10_000)
    expect(await watchLog()).toHaveLength(4)
  })

  it('3 · aiEnabled=false → nothing is scanned, every tick records a skip reason (T-9)', async () => {
    await setParameters(false, 60)
    createWorker().onModuleInit()
    await advance(0)
    await advance(60_000)

    const rows = await watchLog()
    expect(rows).toHaveLength(2)
    expect(rows.every((row) => row.skipped_reason === 'ai_disabled')).toBe(true)
  })

  it('4 · switching the AI off MID-FLIGHT silences the next ticks at once, no restart (T-9)', async () => {
    createWorker().onModuleInit()
    await advance(0)

    await setParameters(false, 60)
    await advance(60_000)
    await advance(60_000)

    const rows = await watchLog()
    expect(rows).toHaveLength(3)
    expect(rows.filter((row) => row.skipped_reason === null)).toHaveLength(1)
    expect(rows.filter((row) => row.skipped_reason === 'ai_disabled')).toHaveLength(2)
  })

  it('5 · a scan longer than one cycle makes the next tick skip, NOT run in parallel (I-10)', async () => {
    createWorker()

    // Force the first scan to outlast a cycle. This is a real situation for feature group 5:
    // a 60s cycle plus a few LLM calls overruns easily.
    let releaseScan: (() => void) | undefined
    let signalScanStarted: (() => void) | undefined
    const slowScan = new Promise<void>((resolve) => {
      releaseScan = resolve
    })
    const scanStarted = new Promise<void>((resolve) => {
      signalScanStarted = resolve
    })

    const originalScan = (
      Reflect.get(worker, 'scan') as (startedAt: number) => Promise<void>
    ).bind(worker)
    let firstScan = true
    Reflect.set(worker, 'scan', async (startedAt: number) => {
      if (firstScan) {
        firstScan = false
        signalScanStarted?.()
        await slowScan
      }
      return originalScan(startedAt)
    })

    worker.onModuleInit()
    // Hold tick 1 separately: `awaitCurrentTick()` points at tick 2 the moment tick 2 starts,
    // so without this handle nobody knows when tick 1 finished writing — and its row leaks
    // into the next test.
    const firstTick = Reflect.get(worker, 'currentTick') as Promise<void>
    await scanStarted // tick 1 has read its parameters, scheduled the next tick, and is mid-scan

    await vi.advanceTimersByTimeAsync(60_000)
    await worker.awaitCurrentTick() // tick 2

    const duringScan = await watchLog()
    expect(duringScan).toHaveLength(1)
    expect(duringScan[0].skipped_reason).toBe('previous_cycle_running')

    releaseScan?.()
    await firstTick

    const afterScan = await watchLog()
    expect(afterScan).toHaveLength(2)
    expect(afterScan.filter((row) => row.skipped_reason === null)).toHaveLength(1)
  })

  it('6 · onModuleDestroy clears the timer and no further tick ever runs', async () => {
    createWorker().onModuleInit()
    await advance(0)
    expect(await watchLog()).toHaveLength(1)

    await worker.onModuleDestroy()
    await vi.advanceTimersByTimeAsync(300_000)

    // Assert on behaviour (no further ticks) plus the released timer handle.
    // NOT `vi.getTimerCount()`: it also counts the `pg` pool's internal idle timeout, so that
    // number never reaches zero and the measurement would be lying.
    expect(await watchLog()).toHaveLength(1)
    expect(Reflect.get(worker, 'timer')).toBeUndefined()
  })
})

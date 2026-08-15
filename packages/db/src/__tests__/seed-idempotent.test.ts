import { createHash } from 'node:crypto'

import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { loadDefaultDataset, seed } from '../seed'

/**
 * I-14 and spec 7.5 — judges replay the scenario a second time, so `pnpm seed` has to return
 * the system to EXACTLY the initial state, not approximately.
 *
 * The snapshot counts every table and hashes the business content rather than comparing rows
 * one by one: that catches both a seed that accidentally appends and a seed that generates
 * fresh random values (ids, password hashes) on every run.
 */

let owner: Pool

const TABLES = [
  'users',
  'companies',
  'contacts',
  'opportunities',
  'timeline_entries',
  'system_settings',
  'watch_cycle_runs',
  'audit_events',
]

/**
 * Business columns per table, deliberately WITHOUT `created_at`/`updated_at`: those default
 * to `now()`, differ between runs by nature, and are not what I-14 is about.
 * `rowMode: 'array'` is required: two tables both have an `id` column, and object-shaped
 * rows would swallow the duplicate name, leaving a hollow snapshot that still passes.
 */
const BUSINESS_COLUMNS: Record<string, string> = {
  users: 'id, email, password_hash, name, role',
  /**
   * `snapshot_variant` is in the list deliberately: the demo switches it, so a reseed that
   * left a company on the "after" snapshot would hand the judges a scenario that plays
   * differently the second time — which is exactly what I-14 forbids.
   */
  companies:
    'id, name, industry, company_type, country, size, website, is_watched, snapshot_variant, owner_id, deleted_at',
  contacts: 'id, company_id, name, title, email, is_primary',
  opportunities:
    'id, company_id, name, expected_value, expected_close_month, stage, next_step_text, next_step_due_date, next_step_source, need_signal, need_signal_source, budget_signal, budget_signal_source, lost_reason',
  timeline_entries:
    'id, company_id, entry_type, occurred_at, description, created_by, source_claim_id',
  system_settings: 'key, value',
  watch_cycle_runs: 'id, skipped_reason, companies_scanned, entries_added',
  audit_events: 'id, actor, action, entity, entity_id',
}

async function snapshot(): Promise<string> {
  const parts: string[] = []
  for (const table of TABLES) {
    const { rows } = await owner.query({
      text: `SELECT ${BUSINESS_COLUMNS[table]} FROM ${table} ORDER BY 1`,
      rowMode: 'array',
    })
    parts.push(`${table}=${rows.length}`)
    parts.push(createHash('sha256').update(JSON.stringify(rows)).digest('hex'))
  }
  return parts.join('|')
}

beforeAll(() => {
  owner = new Pool({ connectionString: process.env.DATABASE_URL_TEST })
})

afterAll(async () => {
  await owner?.end()
})

describe('reseeding returns the system to exactly the initial state (I-14)', () => {
  it('running seed twice produces an identical state', async () => {
    const url = process.env.DATABASE_URL_TEST as string

    await seed(url, loadDefaultDataset())
    const first = await snapshot()

    await seed(url, loadDefaultDataset())
    const second = await snapshot()

    expect(second).toBe(first)
  })

  it('seed wipes what the demo produced instead of accumulating on top of it', async () => {
    const url = process.env.DATABASE_URL_TEST as string
    await seed(url, loadDefaultDataset())

    // Reproduces exactly what a judge does at acceptance check 3: create one more company.
    await owner.query(
      `INSERT INTO companies (name, industry, company_type) VALUES ('Judge created company', 'ITO', 'other_ito')`,
    )
    const seedCompanyCount = loadDefaultDataset().companies.length
    const { rows: before } = await owner.query('SELECT count(*)::int AS total FROM companies')
    expect(before[0].total).toBe(seedCompanyCount + 1)

    await seed(url, loadDefaultDataset())
    const { rows: after } = await owner.query('SELECT count(*)::int AS total FROM companies')
    expect(after[0].total).toBe(seedCompanyCount)
  })

  it('reseeding puts every company back on the "before" snapshot', async () => {
    const url = process.env.DATABASE_URL_TEST as string
    await seed(url, loadDefaultDataset())

    // What a judge does at acceptance checks 6 and 8: flip a source, watch the system react.
    await owner.query(`UPDATE companies SET snapshot_variant = 'after'`)

    await seed(url, loadDefaultDataset())
    const { rows } = await owner.query(
      `SELECT count(*)::int AS total FROM companies WHERE snapshot_variant <> 'before'`,
    )
    // No clean-up code does this — TRUNCATE plus the column DEFAULT do (ADR-0022).
    expect(rows[0].total).toBe(0)
  })

  it('the real BTC dataset carries enough watched companies and readable sources for T-8', async () => {
    await seed(process.env.DATABASE_URL_TEST as string, loadDefaultDataset())

    // T-8 needs to be able to pick 3 watched companies and flip 2 of them — real data has far
    // more than 3 watched, unlike the old 5-company fixture that carried exactly 3.
    const { rows: watched } = await owner.query(
      'SELECT count(*)::int AS total FROM companies WHERE is_watched',
    )
    expect(watched[0].total).toBeGreaterThanOrEqual(3)

    const { rows: readable } = await owner.query(
      `SELECT count(DISTINCT c.id)::int AS total
       FROM companies c
       JOIN snapshot_pages sp ON sp.company_id = c.id
       WHERE c.is_watched AND (sp.before_html IS NOT NULL OR sp.after_html IS NOT NULL)`,
    )
    expect(readable[0].total).toBeGreaterThanOrEqual(3)

    /**
     * Real data has ZERO opportunities at stage `lost` (verified: `Opps.csv` carries no
     * `Thua` row among the 15 real opportunities — the fictional fixture used to hand-craft one
     * with a `lost_reason` and one without). T-1 now demonstrates that path by hand — dragging
     * an opportunity to Lost through the UI — rather than relying on pre-seeded rows.
     */
    const { rows: signals } = await owner.query(
      `SELECT
         count(*) FILTER (WHERE need_signal IS NOT NULL AND budget_signal IS NOT NULL)::int AS complete,
         count(*) FILTER (WHERE stage = 'lost')::int AS lost
       FROM opportunities`,
    )
    expect(signals[0].complete).toBeGreaterThanOrEqual(1)
    expect(signals[0].lost).toBe(0)

    const { rows: primaries } = await owner.query(
      `SELECT company_id, count(*)::int AS total FROM contacts GROUP BY company_id ORDER BY total DESC`,
    )
    expect(primaries[0].total).toBeGreaterThanOrEqual(2)
  })

  it('the effective AI parameters live in the database after seeding (ontology 3.4)', async () => {
    await seed(process.env.DATABASE_URL_TEST as string, loadDefaultDataset())
    const { rows } = await owner.query('SELECT key, value FROM system_settings ORDER BY key')
    expect(rows.map((r) => r.key)).toEqual(['ai_enabled', 'watch_cycle_seconds'])
  })
})

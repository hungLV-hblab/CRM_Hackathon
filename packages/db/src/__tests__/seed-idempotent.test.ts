import { createHash } from 'node:crypto'

import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { seed } from '../seed'

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
  companies:
    'id, name, industry, company_type, country, size, website, is_watched, owner_id, deleted_at',
  opportunities:
    'id, company_id, name, expected_value, expected_close_month, stage, next_step_text, next_step_due_date, next_step_source',
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

    await seed(url)
    const first = await snapshot()

    await seed(url)
    const second = await snapshot()

    expect(second).toBe(first)
  })

  it('seed wipes what the demo produced instead of accumulating on top of it', async () => {
    const url = process.env.DATABASE_URL_TEST as string
    await seed(url)

    // Reproduces exactly what a judge does at acceptance check 3: create one more company.
    await owner.query(
      `INSERT INTO companies (name, industry, company_type) VALUES ('Judge created company', 'ITO', 'other_ito')`,
    )
    const { rows: before } = await owner.query('SELECT count(*)::int AS total FROM companies')
    expect(before[0].total).toBe(5)

    await seed(url)
    const { rows: after } = await owner.query('SELECT count(*)::int AS total FROM companies')
    expect(after[0].total).toBe(4)
  })

  it('the effective AI parameters live in the database after seeding (ontology 3.4)', async () => {
    await seed(process.env.DATABASE_URL_TEST as string)
    const { rows } = await owner.query('SELECT key, value FROM system_settings ORDER BY key')
    expect(rows.map((r) => r.key)).toEqual(['ai_enabled', 'watch_cycle_seconds'])
  })
})

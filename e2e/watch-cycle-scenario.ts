import { resolve } from 'node:path'

import { config } from 'dotenv'
import { Pool } from 'pg'

/**
 * Harness for T-8 — putting the demo database into a KNOWN watch-cycle starting state.
 *
 * Everything here reaches past the application on purpose, as `crm_owner`, and every function is
 * a scenario setup rather than a user action. The reason it has to exist: T-8 asks for "three
 * watched companies, the source of two of them changes, and within two cycles two new entries
 * appear". Every noun in that sentence is a precondition, and the e2e suite shares one database
 * with five other specs that have already read sources and stored snapshots by the time this one
 * runs. Without an explicit reset, T-8 would pass or fail depending on file order — a harness
 * problem wearing a product bug's clothes.
 *
 * Written against raw `pg` rather than `@crm/db`: that package resolves to its BUILT output, and
 * the e2e suite must not need a package build to run against a stack that is already up (same
 * reason `turn-ai-off.ts` spells out its setting key by hand).
 */

function ownerPool(): Pool {
  config({ path: resolve(__dirname, '../.env') })

  const connectionString = process.env.DATABASE_URL_OWNER
  if (!connectionString) {
    throw new Error('Missing DATABASE_URL_OWNER. Copy .env.example to .env and fill it in.')
  }
  return new Pool({ connectionString })
}

/**
 * The cycle length, in seconds. T-8 runs at 10 so two cycles fit inside a test instead of two
 * minutes — and the worker picks it up without a restart, which is the ADR-0011 property being
 * relied on here rather than merely assumed.
 *
 * MUST be restored to 60 afterwards: leave it at 10 and every later run of the whole suite has a
 * worker reading five sources every ten seconds behind it.
 */
export async function setWatchCycleSeconds(seconds: number): Promise<void> {
  const pool = ownerPool()
  try {
    const { rowCount } = await pool.query(
      'UPDATE system_settings SET value = $1, updated_at = now() WHERE key = $2',
      [String(seconds), 'watch_cycle_seconds'],
    )
    if (rowCount === 0) {
      throw new Error('No "watch_cycle_seconds" row in system_settings. Run `pnpm seed` first.')
    }
  } finally {
    await pool.end()
  }
}

/**
 * Forgets everything the AI has ever read about the named companies, and points each at a
 * snapshot.
 *
 * Deletion order follows the foreign keys inward: timeline entries reference claims, claims
 * reference observations. Doing it the other way round fails on the constraint, which is the
 * point of writing it out rather than relying on a cascade nobody has read.
 *
 * Proposals are cleared too. They reference the claims being removed, and leaving them would also
 * leave the no-regeneration rule of feature group 3 suppressing the very news T-8 wants written.
 */
export async function resetReadHistory(
  companyNames: string[],
  variant: 'before' | 'after',
): Promise<void> {
  const pool = ownerPool()
  try {
    await pool.query(
      `DELETE FROM timeline_entries
        WHERE company_id IN (SELECT id FROM companies WHERE name = ANY($1))
          AND created_by = 'system'`,
      [companyNames],
    )
    /**
     * Decisions before proposals, notifications before events: none of these foreign keys
     * cascades, and by the time this runs T-5 and T-6 have already produced rows on these very
     * companies. The earlier version of this harness deleted proposals first and passed — but only
     * because it was first run in isolation, before T-5 had decided anything. Running the suite in
     * order is what exposed the true order.
     */
    await pool.query(
      `DELETE FROM proposal_decisions
        WHERE proposal_id IN (SELECT p.id FROM proposals p
                              JOIN companies co ON co.id = p.company_id
                              WHERE co.name = ANY($1))`,
      [companyNames],
    )
    await pool.query(
      `DELETE FROM proposals WHERE company_id IN (SELECT id FROM companies WHERE name = ANY($1))`,
      [companyNames],
    )
    await pool.query(
      `DELETE FROM notifications
        WHERE auto_event_id IN (SELECT e.id FROM auto_next_step_events e
                                JOIN claims c ON c.id = e.claim_id
                                JOIN companies co ON co.id = c.company_id
                                WHERE co.name = ANY($1))`,
      [companyNames],
    )
    await pool.query(
      `DELETE FROM auto_next_step_events
        WHERE claim_id IN (SELECT c.id FROM claims c
                           JOIN companies co ON co.id = c.company_id
                           WHERE co.name = ANY($1))`,
      [companyNames],
    )
    await pool.query(
      `DELETE FROM claims WHERE company_id IN (SELECT id FROM companies WHERE name = ANY($1))`,
      [companyNames],
    )
    await pool.query(
      `DELETE FROM observations WHERE company_id IN (SELECT id FROM companies WHERE name = ANY($1))`,
      [companyNames],
    )

    const { rowCount } = await pool.query(
      'UPDATE companies SET snapshot_variant = $1 WHERE name = ANY($2)',
      [variant, companyNames],
    )
    if (rowCount !== companyNames.length) {
      throw new Error(
        `Expected ${companyNames.length} companies, updated ${rowCount}. Run \`pnpm seed\` first.`,
      )
    }
  } finally {
    await pool.end()
  }
}

/** Points companies at a snapshot WITHOUT forgetting what was read — "the source changed". */
export async function setSnapshotVariant(
  companyNames: string[],
  variant: 'before' | 'after',
): Promise<void> {
  const pool = ownerPool()
  try {
    await pool.query('UPDATE companies SET snapshot_variant = $1 WHERE name = ANY($2)', [
      variant,
      companyNames,
    ])
  } finally {
    await pool.end()
  }
}

export interface SystemEntryRow {
  companyName: string
  description: string
  quoteText: string | null
  rawContent: string | null
}

/** Timeline entries the WATCH CYCLE wrote, with the quote each one hangs off. */
export async function systemEntriesFor(companyNames: string[]): Promise<SystemEntryRow[]> {
  const pool = ownerPool()
  try {
    const { rows } = await pool.query(
      `SELECT co.name AS company_name, t.description, c.quote_text, o.raw_content
       FROM timeline_entries t
       JOIN companies co ON co.id = t.company_id
       LEFT JOIN claims c ON c.id = t.source_claim_id
       LEFT JOIN observations o ON o.id = c.observation_id
       WHERE t.created_by = 'system' AND co.name = ANY($1)
       ORDER BY co.name, t.created_at`,
      [companyNames],
    )
    return rows.map((row) => ({
      companyName: row.company_name,
      description: row.description,
      quoteText: row.quote_text,
      rawContent: row.raw_content,
    }))
  } finally {
    await pool.end()
  }
}

/**
 * Everything the AI has produced, counted. T-9 asserts these numbers do not MOVE while the kill
 * switch is off, and that none of them shrink — "dừng sinh mới" is not "xoá cái đã sinh".
 *
 * All four in one query round so the four counts describe the same instant. Read separately, a
 * cycle finishing between two of them would produce a snapshot no moment in time ever had.
 */
export interface AiOutputCounts {
  claims: number
  proposals: number
  autoNextStepEvents: number
  systemTimelineEntries: number
}

export async function aiOutputCounts(): Promise<AiOutputCounts> {
  const pool = ownerPool()
  try {
    const { rows } = await pool.query(
      `SELECT (SELECT count(*)::int FROM claims) AS claims,
              (SELECT count(*)::int FROM proposals) AS proposals,
              (SELECT count(*)::int FROM auto_next_step_events) AS auto_events,
              (SELECT count(*)::int FROM timeline_entries WHERE created_by = 'system') AS entries`,
    )
    return {
      claims: rows[0].claims,
      proposals: rows[0].proposals,
      autoNextStepEvents: rows[0].auto_events,
      systemTimelineEntries: rows[0].entries,
    }
  } finally {
    await pool.end()
  }
}

/** The two-way trail T-9 requires: switching off is an event, and so is switching back on. */
export async function toggleAiAuditEvents(): Promise<{ from: boolean; to: boolean }[]> {
  const pool = ownerPool()
  try {
    const { rows } = await pool.query(
      `SELECT detail FROM audit_events WHERE action = 'toggle_ai' ORDER BY at`,
    )
    return rows.map((row) => ({ from: row.detail.from, to: row.detail.to }))
  } finally {
    await pool.end()
  }
}

/**
 * A pending suggestion that is guaranteed to be there — the precondition for "hàng đợi tồn vẫn
 * duyệt được" (ADR-0009).
 *
 * Written by the harness rather than produced by reading a source, because the queue's contents at
 * this point depend on which specs ran before and on what the model returned; a T-9 that asserted
 * "the queue is decidable" against whatever happened to be there would pass vacuously on an empty
 * queue. It hangs off Ohara: not watched, and its stored snapshot is empty, so no other spec ever
 * produces a card for it.
 *
 * Fixed ids, cleared first: running the suite twice must not accumulate copies.
 */
export const SEEDED_PROPOSAL_COMPANY = 'Ohara Retail Group'
export const SEEDED_PROPOSAL_VALUE = 'https://ohara-retail.example.jp/gian-hang-moi'

const SEEDED_OBSERVATION_ID = 'eeeeeeee-0009-4000-8000-000000000001'
const SEEDED_CLAIM_ID = 'eeeeeeee-0009-4000-8000-000000000002'
const SEEDED_PROPOSAL_ID = 'eeeeeeee-0009-4000-8000-000000000003'

export async function seedPendingProposal(): Promise<void> {
  const pool = ownerPool()
  const quote = `Website chính thức: ${SEEDED_PROPOSAL_VALUE}`
  const rawContent = `Ohara Retail Group mở gian hàng mới. ${quote}`

  try {
    await pool.query('DELETE FROM proposal_decisions WHERE proposal_id = $1', [SEEDED_PROPOSAL_ID])
    await pool.query('DELETE FROM proposals WHERE id = $1', [SEEDED_PROPOSAL_ID])
    await pool.query('DELETE FROM claims WHERE id = $1', [SEEDED_CLAIM_ID])
    await pool.query('DELETE FROM observations WHERE id = $1', [SEEDED_OBSERVATION_ID])

    const { rows } = await pool.query('SELECT id FROM companies WHERE name = $1', [
      SEEDED_PROPOSAL_COMPANY,
    ])
    if (rows.length === 0) {
      throw new Error(`No company named "${SEEDED_PROPOSAL_COMPANY}". Run \`pnpm seed\` first.`)
    }
    const companyId = rows[0].id

    await pool.query(
      `INSERT INTO observations (id, company_id, source_url, raw_content, extractor_version,
                                 content_hash, fetch_status)
       VALUES ($1, $2, 'https://ohara-retail.example.jp', $3, 't9-harness', 't9-harness-hash', 'ok')`,
      [SEEDED_OBSERVATION_ID, companyId, rawContent],
    )
    await pool.query(
      `INSERT INTO claims (id, company_id, observation_id, statement, signal_type, confidence,
                           quote_text, quote_start, quote_end, trigger_context)
       VALUES ($1, $2, $3, 'Ohara công bố website mới', 'expansion', 'likely', $4, $5, $6,
               'manual_ingest')`,
      [
        SEEDED_CLAIM_ID,
        companyId,
        SEEDED_OBSERVATION_ID,
        quote,
        rawContent.indexOf(quote),
        rawContent.indexOf(quote) + quote.length,
      ],
    )
    await pool.query(
      `INSERT INTO proposals (id, company_id, claim_id, proposal_type, target_field,
                              proposed_value, impact_if_wrong)
       VALUES ($1, $2, $3, 'field_update', 'website', $4,
               'Sales mở nhầm trang, mất một lượt tiếp cận')`,
      [SEEDED_PROPOSAL_ID, companyId, SEEDED_CLAIM_ID, SEEDED_PROPOSAL_VALUE],
    )
  } finally {
    await pool.end()
  }
}

/** Was the seeded suggestion decided, and how — the proof the queue still worked with AI off. */
export async function seededProposalDecision(): Promise<string | null> {
  const pool = ownerPool()
  try {
    const { rows } = await pool.query(
      'SELECT decision FROM proposal_decisions WHERE proposal_id = $1',
      [SEEDED_PROPOSAL_ID],
    )
    return rows[0]?.decision ?? null
  } finally {
    await pool.end()
  }
}

/** How many proposals are still waiting — ADR-0009: the queue stays decidable with the AI off. */
export async function pendingProposalCount(): Promise<number> {
  const pool = ownerPool()
  try {
    const { rows } = await pool.query(
      `SELECT count(*)::int AS total FROM proposals WHERE status = 'pending'`,
    )
    return rows[0].total
  } finally {
    await pool.end()
  }
}

export interface CycleRow {
  companiesScanned: number
  newContentCount: number
  entriesAdded: number
  errorCount: number
  skippedReason: string | null
  isRollup: boolean
}

export async function watchCycleRuns(): Promise<CycleRow[]> {
  const pool = ownerPool()
  try {
    const { rows } = await pool.query(
      `SELECT companies_scanned, new_content_count, entries_added, error_count,
              skipped_reason, is_rollup
       FROM watch_cycle_runs ORDER BY started_at`,
    )
    return rows.map((row) => ({
      companiesScanned: row.companies_scanned,
      newContentCount: row.new_content_count,
      entriesAdded: row.entries_added,
      errorCount: row.error_count,
      skippedReason: row.skipped_reason,
      isRollup: row.is_rollup,
    }))
  } finally {
    await pool.end()
  }
}

/**
 * Waits for a condition the WORKER is expected to bring about, polling the database.
 *
 * Polling rather than sleeping for N cycles: at a 10s cadence with several model calls per cycle,
 * overrunning the period is the NORMAL state (I-10 records a skipped tick and carries on), so a
 * fixed sleep would either be flaky or absurdly long. The timeout is what makes the assertion
 * "within two cycles" meaningful — it is generous about *when* inside the window, strict about
 * the window.
 */
export async function waitFor<T>(
  describe: string,
  read: () => Promise<T>,
  isDone: (value: T) => boolean,
  timeoutMs: number,
): Promise<T> {
  const deadline = Date.now() + timeoutMs
  let last: T = await read()

  while (!isDone(last)) {
    if (Date.now() > deadline) {
      throw new Error(
        `Timed out after ${timeoutMs}ms waiting for ${describe}. Last value: ${JSON.stringify(last)}`,
      )
    }
    await new Promise((done) => setTimeout(done, 2_000))
    last = await read()
  }

  return last
}

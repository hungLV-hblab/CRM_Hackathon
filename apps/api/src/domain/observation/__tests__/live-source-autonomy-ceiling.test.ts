import { Pool } from 'pg'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import type { SourceKind } from '@crm/contracts'
import { createConnection, resetTestDatabase } from '@crm/db'

import { AuditEventService } from '../../../common/audit/audit-event-service'
import { AutoNextStepService } from '../../opportunity/auto-next-step-service'
import { ClaimReactionService } from '../../claim/claim-reaction-service'
import { ProposalService } from '../../proposal/proposal-service'
import { SystemTimelineEntryService } from '../../../watch/system-timeline-entry-service'
import type { SavedClaim } from '../../claim/claim-service'

/**
 * I-15 — the autonomy ceiling is a function of the SOURCE, not only of the feature (ADR-0035).
 *
 * Zones 3 and 4 are safe because the CONTENT of the snapshot set was vetted by a human before it
 * ever reached the product — not because an undo button exists and not because a row is labelled.
 * Read an uncontrolled public page and that assumption is gone: a defaced page, an ad, a
 * fabricated news item would write themselves into a company's official timeline before anyone
 * looked. So a finding drawn from `live_crawl` may only ever become a `Proposal`.
 *
 * ── WHY THE TABLE HAS A THIRD COLUMN ────────────────────────────────────────────────────────
 * The first draft of this design simply skipped group 4 for `live_crawl`. That reopens the hole
 * ADR-0028 closed, one level up: `blockedNextSteps` is the ONLY route by which a next-step
 * implication becomes a `next_step` suggestion, so skipping group 4 makes that implication
 * vanish with no log, no count and no exception — a finding that silently loses half its meaning.
 * I-15 says live findings "may only ever become a Proposal"; it therefore REQUIRES the suggestion
 * to exist, not to disappear. Group 4 runs in propose-only mode instead.
 *
 * Every cell asserts THREE numbers. Asserting only the presence of one leaves the door open to a
 * version where a live finding produces both an entry and a suggestion, or neither.
 *
 *                    │ demo_snapshot                     │ live_crawl
 *   ─────────────────┼───────────────────────────────────┼──────────────────────────────────
 *   not watched      │ suggestion · 0 entry · writes NS  │ suggestion · 0 entry · SUGGESTS NS
 *   watched          │ 0 suggestion · entry · writes NS  │ SUGGESTION · 0 entry · SUGGESTS NS
 *
 * NS = next step. The two right-hand cells are the ones a missed sign-flip turns into
 * "0 suggestion + 0 entry + 0 next step", and I-3 then makes that permanent.
 */

const SALES_ID = '11111111-1111-4111-8111-111111111111'
/** Outside the seed set: a seed company can never reach the live path at all (I-16). */
const WATCHED = 'eeeeeeee-0001-4000-8000-000000000001'
const NOT_WATCHED = 'eeeeeeee-0002-4000-8000-000000000002'
const WATCHED_OPPORTUNITY = 'ffffffff-0001-4000-8000-000000000001'
const NOT_WATCHED_OPPORTUNITY = 'ffffffff-0002-4000-8000-000000000002'

const owner = new Pool({ connectionString: process.env.DATABASE_URL_TEST })
const appConnection = createConnection(process.env.DATABASE_URL_TEST_APP as string)
const systemConnection = createConnection(process.env.DATABASE_URL_TEST_SYSTEM as string)

/** The real chain, group 4 → group 3 → group 5. A stub anywhere here proves nothing about I-15. */
function buildReactions(): ClaimReactionService {
  return new ClaimReactionService(
    new AutoNextStepService(
      systemConnection.db,
      appConnection.db,
      new AuditEventService(appConnection.db, systemConnection.db),
    ),
    new ProposalService(systemConnection.db, appConnection.db),
    new SystemTimelineEntryService(systemConnection.db),
  )
}

/**
 * A funding item at `certain`: newsworthy for group 5 AND eligible for group 4's auto-write
 * (`AUTO_WRITE_SIGNALS`). One finding that every branch has an opinion about is what makes the
 * three numbers per cell comparable.
 */
async function seedFinding(
  companyId: string,
  sourceKind: SourceKind,
): Promise<{ savedClaims: SavedClaim[]; observationId: string; capturedAt: Date }> {
  const rawContent = 'Công ty vừa hoàn tất vòng Series B huy động 20 triệu USD.'
  const observation = await owner.query(
    `INSERT INTO observations
       (company_id, source_url, raw_content, content_hash, extractor_version, fetch_status, source_kind)
     VALUES ($1, 'https://example.test/news', $2, $3, 'test', 'ok', $4)
     RETURNING id, captured_at`,
    [companyId, rawContent, `hash-${companyId}-${sourceKind}`, sourceKind],
  )
  const observationId = observation.rows[0].id as string
  const capturedAt = observation.rows[0].captured_at as Date

  const claim = await owner.query(
    `INSERT INTO claims (company_id, observation_id, statement, signal_type, confidence,
                         quote_text, quote_start, quote_end, trigger_context)
     VALUES ($1, $2, 'Công ty vừa gọi vốn vòng Series B 20 triệu USD', 'funding', 'certain',
             $3, 0, $4, 'watch_cycle')
     RETURNING id, created_at`,
    [companyId, observationId, rawContent, rawContent.length],
  )

  return {
    observationId,
    capturedAt,
    savedClaims: [
      {
        claim: {
          id: claim.rows[0].id,
          companyId,
          observationId,
          statement: 'Công ty vừa gọi vốn vòng Series B 20 triệu USD',
          signalType: 'funding',
          confidence: 'certain',
          quoteText: rawContent,
          quoteStart: 0,
          quoteEnd: rawContent.length,
          triggerContext: 'watch_cycle',
          createdAt: (claim.rows[0].created_at as Date).toISOString(),
        },
      },
    ],
  }
}

async function counts(companyId: string): Promise<{
  entries: number
  autoEvents: number
  timelineProposals: number
  nextStepProposals: number
  opportunitiesWrittenBySystem: number
}> {
  const query = async (sql: string, parameters: unknown[]): Promise<number> => {
    const { rows } = await owner.query(sql, parameters)
    return Number(rows[0].count)
  }

  return {
    entries: await query(
      `SELECT count(*) FROM timeline_entries WHERE company_id = $1 AND created_by = 'system'`,
      [companyId],
    ),
    autoEvents: await query(
      `SELECT count(*) FROM auto_next_step_events e
       JOIN opportunities o ON o.id = e.opportunity_id WHERE o.company_id = $1`,
      [companyId],
    ),
    timelineProposals: await query(
      `SELECT count(*) FROM proposals WHERE company_id = $1 AND proposal_type = 'timeline_entry'`,
      [companyId],
    ),
    nextStepProposals: await query(
      `SELECT count(*) FROM proposals WHERE company_id = $1 AND proposal_type = 'next_step'`,
      [companyId],
    ),
    opportunitiesWrittenBySystem: await query(
      `SELECT count(*) FROM opportunities WHERE company_id = $1 AND next_step_source = 'system'`,
      [companyId],
    ),
  }
}

async function react(companyId: string, sourceKind: SourceKind): Promise<void> {
  const { savedClaims, observationId, capturedAt } = await seedFinding(companyId, sourceKind)
  await buildReactions().react({
    companyId,
    observationId,
    savedClaims,
    observationCapturedAt: capturedAt,
    sourceKind,
  })
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
       ($1, 'Công ty đang theo dõi', 'ITO', 'it_solution', $3, true),
       ($2, 'Công ty không theo dõi', 'ITO', 'it_solution', $3, false)`,
    [WATCHED, NOT_WATCHED, SALES_ID],
  )
  await owner.query(
    `INSERT INTO opportunities (id, company_id, name, stage) VALUES
       ($1, $3, 'Cơ hội của công ty theo dõi', 'qualified'),
       ($2, $4, 'Cơ hội của công ty không theo dõi', 'qualified')`,
    [WATCHED_OPPORTUNITY, NOT_WATCHED_OPPORTUNITY, WATCHED, NOT_WATCHED],
  )
  await owner.query(
    `INSERT INTO system_settings (key, value) VALUES ('ai_enabled', 'true'), ('watch_cycle_seconds', '60')
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
  )
})

afterAll(async () => {
  await Promise.all([owner.end(), appConnection.close(), systemConnection.close()])
})

describe('demo_snapshot — the control column: zones 3 and 4 behave as before', () => {
  it('1 · watched → system entry, no timeline suggestion, next step WRITTEN', async () => {
    await react(WATCHED, 'demo_snapshot')

    const c = await counts(WATCHED)
    expect(c.entries).toBe(1)
    expect(c.timelineProposals).toBe(0)
    expect(c.autoEvents).toBe(1)
    expect(c.opportunitiesWrittenBySystem).toBe(1)
    expect(c.nextStepProposals).toBe(0)
  })

  it('2 · not watched → timeline suggestion, no entry, next step still WRITTEN', async () => {
    // I-5 governs the timeline branch only. Group 4 is unaffected by Đang theo dõi, and this
    // assertion is what keeps a future change from quietly coupling them.
    await react(NOT_WATCHED, 'demo_snapshot')

    const c = await counts(NOT_WATCHED)
    expect(c.entries).toBe(0)
    expect(c.timelineProposals).toBe(1)
    expect(c.autoEvents).toBe(1)
    expect(c.opportunitiesWrittenBySystem).toBe(1)
    expect(c.nextStepProposals).toBe(0)
  })
})

describe('live_crawl — the ceiling drops to zone 2, in BOTH directions (I-15)', () => {
  it('3 · not watched → suggestion, 0 entry, next step SUGGESTED instead of written', async () => {
    await react(NOT_WATCHED, 'live_crawl')

    const c = await counts(NOT_WATCHED)
    expect(c.entries).toBe(0)
    expect(c.timelineProposals).toBe(1)
    // The half a skipped group 4 would lose silently.
    expect(c.nextStepProposals).toBe(1)
    expect(c.autoEvents).toBe(0)
    expect(c.opportunitiesWrittenBySystem).toBe(0)
  })

  it('4 · WATCHED → suggestion anyway: I-5 flips to the suggestion side (I-15 vế 2)', async () => {
    /**
     * The cell that decides whether this feature is safe or silently broken. Đang theo dõi
     * normally means "the system writes the news", but the delegation was granted over a vetted
     * source. With an unvetted one the entry is refused — and if the suggestion branch is not
     * flipped at the same time, I-15 blocks the entry, I-5 blocks the suggestion, and the finding
     * has NO route out at all. I-3 then makes that permanent.
     */
    await react(WATCHED, 'live_crawl')

    const c = await counts(WATCHED)
    expect(c.entries).toBe(0)
    expect(c.timelineProposals).toBe(1)
    expect(c.nextStepProposals).toBe(1)
    expect(c.autoEvents).toBe(0)
    expect(c.opportunitiesWrittenBySystem).toBe(0)
  })
})

describe('I-7 is meaningless for a live source — every case becomes a suggestion', () => {
  it('5 · an EMPTY next-step cell is suggested, not filled', async () => {
    await react(NOT_WATCHED, 'live_crawl')

    const { rows } = await owner.query(
      `SELECT current_value, proposed_value, opportunity_id FROM proposals
       WHERE company_id = $1 AND proposal_type = 'next_step'`,
      [NOT_WATCHED],
    )
    expect(rows).toHaveLength(1)
    // Nothing was there, and nothing was written — the suggestion says so honestly.
    expect(rows[0].current_value).toBeNull()
    expect(rows[0].proposed_value.length).toBeGreaterThan(0)
    expect(rows[0].opportunity_id).toBe(NOT_WATCHED_OPPORTUNITY)
  })

  it('6 · a HUMAN-typed next-step cell is suggested too, and never overwritten', async () => {
    await owner.query(
      `UPDATE opportunities SET next_step_text = 'Gọi cho anh Minh thứ Ba',
                                next_step_source = 'human' WHERE id = $1`,
      [NOT_WATCHED_OPPORTUNITY],
    )

    await react(NOT_WATCHED, 'live_crawl')

    const { rows } = await owner.query(
      `SELECT next_step_text, next_step_source FROM opportunities WHERE id = $1`,
      [NOT_WATCHED_OPPORTUNITY],
    )
    expect(rows[0].next_step_text).toBe('Gọi cho anh Minh thứ Ba')
    expect(rows[0].next_step_source).toBe('human')

    const c = await counts(NOT_WATCHED)
    expect(c.nextStepProposals).toBe(1)
    expect(c.autoEvents).toBe(0)
  })

  it('7 · no notification is raised for a live source — nothing was written to notify about', async () => {
    // Zone 3 buys its privilege with an immediate notice. Propose-only writes nothing, so a
    // notice would be announcing a change that did not happen.
    await react(WATCHED, 'live_crawl')

    const { rows } = await owner.query('SELECT count(*) FROM notifications')
    expect(Number(rows[0].count)).toBe(0)
  })
})

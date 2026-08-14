import { Pool } from 'pg'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { createConnection, resetTestDatabase } from '@crm/db'

import { MetricsService } from '../metrics-service'

/**
 * The dashboard numbers of ontology section 7, measured rather than reasoned about.
 *
 * Rows are inserted with SQL instead of driven through the pipeline on purpose: what is under
 * test is the ARITHMETIC — which rows land in which numerator, and which denominator they are
 * divided by — and a fixture built by running the LLM path would make the expected values a
 * function of what the model happened to return that day.
 *
 * Three properties here are the ones that would silently break:
 *
 *   1. I-12 — `edit` is not `accept`. Merging them makes the auto-accept rate flattering by
 *      exactly the amount of work a human had to redo.
 *   2. ADR-0031 — the error-detection denominator is the THREE sets the AI put in front of a
 *      person. Adding `claims` to it would pin the ratio near zero forever.
 *   3. Rule 4 — an empty denominator produces `null`, never `0`. A `0%` beside
 *      "Error-detection rate" reads as "the AI is wrong every time".
 */

const SALES_ID = '11111111-1111-4111-8111-111111111111'
const COMPANY_ID = 'aaaaaaaa-0001-4000-8000-000000000001'
const OPPORTUNITY_ID = 'bbbbbbbb-0001-4000-8000-000000000001'
const OBSERVATION_ID = 'cccccccc-0001-4000-8000-000000000001'

const owner = new Pool({ connectionString: process.env.DATABASE_URL_TEST })
const appConnection = createConnection(process.env.DATABASE_URL_TEST_APP as string)

const metrics = new MetricsService(appConnection.db)

afterAll(async () => {
  await Promise.all([appConnection.close(), owner.end()])
})

beforeEach(async () => {
  await resetTestDatabase(owner)
  await owner.query(
    `INSERT INTO users (id, email, password_hash, name, role)
     VALUES ($1, 'sales@test.local', 'x', 'Sales', 'sales')`,
    [SALES_ID],
  )
  await owner.query(
    `INSERT INTO companies (id, name, industry, company_type, owner_id, is_watched)
     VALUES ($1, 'Sakura Manufacturing KK', 'Sản xuất linh kiện', 'traditional', $2, true)`,
    [COMPANY_ID, SALES_ID],
  )
  await owner.query(
    `INSERT INTO opportunities (id, company_id, name, stage)
     VALUES ($1, $2, 'Thuê ngoài đội bảo trì MES', 'qualified')`,
    [OPPORTUNITY_ID, COMPANY_ID],
  )
  await owner.query(
    `INSERT INTO observations (id, company_id, source_url, raw_content, extractor_version,
                               content_hash, fetch_status)
     VALUES ($1, $2, 'https://sakura-mfg.example.jp', 'Sakura gọi vốn vòng B', 'test', 'hash-1', 'ok')`,
    [OBSERVATION_ID, COMPANY_ID],
  )
})

/** One finding. Several of them exist to prove they do NOT enter the EDR denominator. */
async function insertClaim(index: number, confidence: string): Promise<string> {
  const { rows } = await owner.query(
    `INSERT INTO claims (company_id, observation_id, statement, signal_type, confidence,
                         quote_text, quote_start, quote_end, trigger_context)
     VALUES ($1, $2, $3, 'funding', $4, 'gọi vốn vòng B', 7, 21, 'watch_cycle')
     RETURNING id`,
    [COMPANY_ID, OBSERVATION_ID, `Phát hiện ${index}`, confidence],
  )
  return rows[0].id
}

async function insertProposal(claimId: string): Promise<string> {
  const { rows } = await owner.query(
    `INSERT INTO proposals (company_id, claim_id, proposal_type, target_field, proposed_value)
     VALUES ($1, $2, 'field_update', 'website', 'https://sakura-mfg.example.jp') RETURNING id`,
    [COMPANY_ID, claimId],
  )
  return rows[0].id
}

async function decide(
  proposalId: string,
  decision: 'accept' | 'edit' | 'reject',
  options: { rejectReason?: string; secondsToDecide?: number } = {},
): Promise<void> {
  await owner.query(
    `INSERT INTO proposal_decisions (proposal_id, decision, decided_by, reject_reason, seconds_to_decide)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      proposalId,
      decision,
      SALES_ID,
      options.rejectReason ?? null,
      options.secondsToDecide ?? null,
    ],
  )
}

async function insertAutoNextStepEvent(claimId: string, undone: boolean): Promise<void> {
  await owner.query(
    `INSERT INTO auto_next_step_events (opportunity_id, claim_id, new_text, new_due_date, undone_at)
     VALUES ($1, $2, 'Gọi lại sau tin gọi vốn', '2026-08-20', $3)`,
    [OPPORTUNITY_ID, claimId, undone ? new Date() : null],
  )
}

async function insertSystemTimelineEntry(claimId: string): Promise<void> {
  await owner.query(
    `INSERT INTO timeline_entries (company_id, entry_type, occurred_at, description, created_by,
                                   source_claim_id)
     VALUES ($1, 'system_entry', now(), 'Sakura gọi vốn vòng B', 'system', $2)`,
    [COMPANY_ID, claimId],
  )
}

/** The phase 7 contract: this event is where "how often did a person delete a machine entry" lives. */
async function recordEntryDeletion(reason: string, outcome: 'done' | 'refused'): Promise<void> {
  await owner.query(
    `INSERT INTO audit_events (actor, action, entity, entity_id, detail)
     VALUES ($1, 'delete_system_timeline_entry', 'timeline_entry', $2, $3)`,
    [
      outcome === 'done' ? 'human' : 'system',
      OBSERVATION_ID,
      JSON.stringify({ outcome, reason }),
    ],
  )
}

describe('auto-accept rate and the share of edit (I-12)', () => {
  it('1 · edit is counted on its own line and never inside accept', async () => {
    const claimId = await insertClaim(1, 'certain')
    await decide(await insertProposal(claimId), 'accept')
    await decide(await insertProposal(claimId), 'accept')
    await decide(await insertProposal(claimId), 'edit')
    await decide(await insertProposal(claimId), 'reject', { rejectReason: 'wrong_info' })

    const summary = await metrics.summary()

    /**
     * 2 of 4, NOT 2 of 3. The denominator includes `edit`, which is the whole point: a suggestion
     * a person had to rewrite before using was not one the machine got right. Change the formula
     * to `accept / (accept + reject)` and this line goes red at 0.666… — the mutation measurement
     * this test exists to survive.
     */
    expect(summary.autoAcceptRate).toEqual({ rate: 0.5, numerator: 2, denominator: 4 })
    expect(summary.editRate).toEqual({ rate: 0.25, numerator: 1, denominator: 4 })
  })

  it('2 · with nothing decided the rate is null, not zero', async () => {
    const summary = await metrics.summary()

    // `0%` next to "Auto-accept rate" reads as "nobody accepts anything" (rule 4).
    expect(summary.autoAcceptRate).toEqual({ rate: null, numerator: 0, denominator: 0 })
    expect(summary.errorDetectionRate.rate).toBeNull()
    expect(summary.undoRate.rate).toBeNull()
  })
})

describe('error-detection rate (ADR-0031)', () => {
  it('3 · the denominator is exactly the three sets the AI put in front of a person', async () => {
    const claimId = await insertClaim(1, 'certain')
    // 2 proposals · 1 auto next step · 1 system timeline entry = denominator 4.
    await insertProposal(claimId)
    const rejected = await insertProposal(claimId)
    await insertAutoNextStepEvent(claimId, false)
    await insertSystemTimelineEntry(claimId)

    await decide(rejected, 'reject', { rejectReason: 'wrong_info' })

    const summary = await metrics.summary()

    expect(summary.errorDetectionRate.denominatorBreakdown).toEqual({
      proposals: 2,
      autoNextStepEvents: 1,
      systemTimelineEntries: 1,
    })
    expect(summary.errorDetectionRate.denominator).toBe(4)
    expect(summary.errorDetectionRate.numerator).toBe(1)
    expect(summary.errorDetectionRate.rate).toBe(0.25)
  })

  it('4 · findings nobody ever saw stay OUT of the denominator', async () => {
    const claimId = await insertClaim(1, 'certain')
    await insertProposal(claimId)

    // Nine more findings that never became anything a person could reject.
    for (let index = 2; index <= 10; index += 1) await insertClaim(index, 'speculative')

    const summary = await metrics.summary()

    /**
     * Still 1. Counting `claims` here is the rejected alternative of ADR-0031: it inflates the
     * denominator five- to tenfold with material nobody was ever shown, and a ratio that can only
     * sit near zero is a number that can never be wrong.
     */
    expect(summary.errorDetectionRate.denominator).toBe(1)
    expect(summary.confidences).toEqual([
      { key: 'speculative', count: 9 },
      { key: 'certain', count: 1 },
    ])
  })

  it('5 · the numerator counts the four ways a person contradicts the machine', async () => {
    const claimId = await insertClaim(1, 'certain')
    await decide(await insertProposal(claimId), 'reject', { rejectReason: 'wrong_info' })
    await decide(await insertProposal(claimId), 'reject', { rejectReason: 'misread_context' })
    // `irrelevant` is a rejection but NOT an error: the machine was right and it did not matter.
    await decide(await insertProposal(claimId), 'reject', { rejectReason: 'irrelevant' })
    await insertAutoNextStepEvent(claimId, true)
    await insertSystemTimelineEntry(claimId)
    await recordEntryDeletion('Tin này không phải của công ty này', 'done')

    const summary = await metrics.summary()

    expect(summary.errorDetectionRate.numeratorBreakdown).toEqual({
      rejectedWrongInfo: 1,
      rejectedMisreadContext: 1,
      undoneAutoNextSteps: 1,
      deletedSystemEntries: 1,
    })
    expect(summary.errorDetectionRate.numerator).toBe(4)
    expect(summary.rejectReasons).toContainEqual({ key: 'irrelevant', count: 1 })
    expect(summary.systemEntryDeleteReasons).toEqual([
      { key: 'Tin này không phải của công ty này', count: 1 },
    ])
  })

  it('6 · a deletion the SYSTEM was refused does not count as a person catching a mistake', async () => {
    const claimId = await insertClaim(1, 'certain')
    await insertProposal(claimId)
    await recordEntryDeletion('hệ thống bị chặn', 'refused')

    const summary = await metrics.summary()

    /**
     * Same action name, opposite meaning. The refusal row is written by the boundary that BLOCKED
     * the AI; crediting it to the human would make the metric that measures people rise every time
     * the machine misbehaved.
     */
    expect(summary.errorDetectionRate.numeratorBreakdown.deletedSystemEntries).toBe(0)
    expect(summary.systemEntryDeleteReasons).toEqual([])
  })
})

describe('undo rate and time-to-decide', () => {
  it('7 · undo rate is undone over every zone-3 write', async () => {
    const claimId = await insertClaim(1, 'certain')
    await insertAutoNextStepEvent(claimId, true)
    await insertAutoNextStepEvent(claimId, false)
    await insertAutoNextStepEvent(claimId, false)
    await insertAutoNextStepEvent(claimId, false)

    const summary = await metrics.summary()

    expect(summary.undoRate).toEqual({ rate: 0.25, numerator: 1, denominator: 4 })
  })

  it('8 · the median comes with its sample size and the rows that lost their mark', async () => {
    const claimId = await insertClaim(1, 'certain')
    await decide(await insertProposal(claimId), 'accept', { secondsToDecide: 10 })
    await decide(await insertProposal(claimId), 'accept', { secondsToDecide: 20 })
    await decide(await insertProposal(claimId), 'accept', { secondsToDecide: 60 })
    // ADR-0025: a page reload between opening the queue and deciding loses the mark. The column
    // is left EMPTY rather than filled with a guess, and the dashboard has to say how often.
    await decide(await insertProposal(claimId), 'accept')

    const summary = await metrics.summary()

    expect(summary.decisionTime).toEqual({
      medianSeconds: 20,
      sampleSize: 3,
      missingTimestamps: 1,
    })
  })

  it('9 · no marks at all → no median, and the sample size says why', async () => {
    const summary = await metrics.summary()

    expect(summary.decisionTime).toEqual({
      medianSeconds: null,
      sampleSize: 0,
      missingTimestamps: 0,
    })
  })
})

import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { and, desc, eq, isNull, lte, ne, notInArray, or, sql } from 'drizzle-orm'

import {
  AUTO_WRITE_CONFIDENCE,
  AUTO_WRITE_SIGNALS,
  CLOSED_STAGES,
  type AutoNextStepMap,
  type AutoWriteSignal,
  type ClaimDto,
  type UndoResultDto,
} from '@crm/contracts'
import { type CrmDatabase, autoNextStepEvents, claims, companies, opportunities } from '@crm/db'

import type { Actor } from '../../common/actor/actor-context'
import type { BlockedNextStep } from '../proposal/proposal-service'
import type { SavedClaim } from '../claim/claim-service'
import { AuditEventService } from '../../common/audit/audit-event-service'
import { DRIZZLE_APP, DRIZZLE_SYSTEM } from '../../common/db/db.module'
import { dueDateFor, dueDaysFor, dueReasonFor } from './next-step-due-date'

/**
 * AUTONOMY ZONE 3 — the AI writes into Sales' official data and asks nobody first.
 *
 * This is the most dangerous privilege in the product, and Specs grants it for exactly one
 * cell. Three things buy it (CLAUDE.md section 4), and all three are in this file:
 *
 *   notify immediately · one-click undo for 7 days · a two-way trail
 *
 * WHY THIS DOES NOT GO THROUGH `OpportunityService.updateNextStep`. That method stays as the
 * shared guard for anyone setting a next step from outside, and it is still the path a future
 * caller should use. Group 4 needs something it cannot offer: the cell, the
 * `AutoNextStepEvent` and the notification must land in ONE transaction. Split them and a
 * crash in between leaves a machine-written cell with no trail and no notice — a write nobody
 * can see and nobody can undo, which is the single state zone 3 must never reach. Both paths
 * pick their pool by actor, so neither loses the database layer.
 *
 * THE FOUR INVARIANTS, and where each one lives:
 *
 *   I-6  `eligibleClaims` — only `certain`/`likely` findings of a signal type that justifies
 *        interrupting someone's day, and only when a deal is actually open. Everything else
 *        goes to the review queue instead.
 *   I-7  `applyToOpportunity` — a human-typed cell is NEVER overwritten, overdue or not, and
 *        comes back as a `BlockedNextStep` for feature group 3 to file as a suggestion.
 *   I-8  `humanBaseline` — undo restores the last HUMAN-typed value by walking BACK through
 *        the event chain (ADR-0026), not the machine's previous guess.
 *   I-9  `next-step-due-date.ts` — the date comes from the urgency table, never from a model.
 */


/**
 * The sentence is built by CODE from a fixed opener plus the finding's own statement. The
 * model never writes into this cell directly, and that is deliberate: `next_step_text` is
 * official data, so what lands there has to be something the team can account for line by
 * line. The finding it was built from travels with it (`claim_id`), so the quote is one click
 * away from the cell itself.
 */
const NEXT_STEP_OPENER: Record<AutoWriteSignal, string> = {
  funding: 'Gọi lại khi cửa sổ gọi vốn còn mở',
  leadership_hire: 'Đặt lịch chào người mới phụ trách',
}

export interface AutoNextStepInput {
  companyId: string
  savedClaims: SavedClaim[]
  /**
   * I-15 (ADR-0035 · ADR-0036) — the source lowered the ceiling to zone 2, so this service may
   * still DECIDE what the next step should be but may not write it. Every open deal comes back
   * as a `BlockedNextStep` and feature group 3 files it as a suggestion.
   *
   * Why propose rather than skip: `blocked` is the ONLY route by which a next-step implication
   * becomes a `next_step` suggestion. Skipping this service entirely for a live source would make
   * that implication vanish with no log, no count and no exception — the shape of the hole
   * ADR-0028 closed, one level up. I-15 says a live finding may only ever become a `Proposal`,
   * which requires the suggestion to exist rather than to disappear.
   *
   * It is also not a new mechanism: this is exactly what I-7 already does for a human-typed cell,
   * applied to every cell instead of one.
   */
  proposeOnly?: boolean
}

export interface AutoNextStepResult {
  /** One event per open deal of the company (ADR-0005 B1). */
  written: number
  /** I-7 refusals, handed to feature group 3 so the case becomes a suggestion instead. */
  blocked: BlockedNextStep[]
  /** Why nothing was written, when nothing was. A real reason beats an unexplained zero. */
  skippedReason: 'no_eligible_claim' | 'no_open_opportunity' | 'no_owner_to_notify' | null
}

@Injectable()
export class AutoNextStepService {
  private readonly logger = new Logger('AutoNextStepService')

  constructor(
    @Inject(DRIZZLE_SYSTEM) private readonly dbSystem: CrmDatabase,
    @Inject(DRIZZLE_APP) private readonly dbApp: CrmDatabase,
    private readonly audit: AuditEventService,
  ) {}

  /**
   * The zone 3 write. Called by `ClaimReactionService` right after a source was read, BEFORE
   * the review queue runs, so its refusals can travel on into the same call.
   */
  async react(actor: Actor, input: AutoNextStepInput): Promise<AutoNextStepResult> {
    const empty = (reason: AutoNextStepResult['skippedReason']): AutoNextStepResult => ({
      written: 0,
      blocked: [],
      skippedReason: reason,
    })

    const claim = this.pickClaim(input.savedClaims)
    if (!claim) return empty('no_eligible_claim')

    const db = this.poolFor(actor)
    const company = await this.loadCompany(db, input.companyId)

    /**
     * No owner means nobody to notify, and an immediate notice is one of the three things that
     * buy zone 3 its privilege. So the write does not happen — it does not happen QUIETLY
     * either, which is what the reason code and the log line below are for. The queue still
     * gets its suggestions; only the unasked write is withheld.
     *
     * Skipped in propose-only mode, and that is not a shortcut: nothing is written there, so
     * there is nothing to notify anybody about. Keeping the gate would refuse a SUGGESTION over a
     * missing notification recipient, which is the wrong trade — the suggestion is what makes the
     * finding reachable at all under I-15.
     */
    if (!input.proposeOnly && !company.ownerId) {
      this.logger.warn(
        `Công ty ${input.companyId} không có người phụ trách — không tự đặt Việc tiếp theo ` +
          'vì không có ai để báo. Gợi ý vẫn vào hàng đợi.',
      )
      return empty('no_owner_to_notify')
    }

    const open = await this.openOpportunities(db, input.companyId)
    if (open.length === 0) return empty('no_open_opportunity')

    const signalType = claim.signalType as AutoWriteSignal
    const text = `${NEXT_STEP_OPENER[signalType]}: ${claim.statement}`
    const dueDate = dueDateFor(signalType)

    const result: AutoNextStepResult = { written: 0, blocked: [], skippedReason: null }

    for (const opportunity of open) {
      /**
       * I-15 first, then I-7 — and the order matters. An unvetted source removes the authority to
       * write ANY cell, so it is checked before the narrower question of whose cell this is.
       * `currentNextStepText` is passed through as-is: `null` for an empty cell is the honest
       * "hiện tại" for the reviewer to see, not a value to invent.
       */
      if (input.proposeOnly) {
        result.blocked.push({
          claim,
          opportunityId: opportunity.id,
          currentNextStepText: opportunity.nextStepText,
          proposedNextStepText: text,
        })
        continue
      }

      /**
       * I-7. An overdue human-typed cell is a debt Sales is carrying, not a stale cell to
       * clean up — so it is not touched, and the case is handed on rather than dropped.
       */
      if (opportunity.nextStepSource === 'human' && opportunity.nextStepText) {
        result.blocked.push({
          claim,
          opportunityId: opportunity.id,
          currentNextStepText: opportunity.nextStepText,
          proposedNextStepText: text,
        })
        continue
      }

      await this.writeOne(db, {
        opportunity,
        claim,
        text,
        dueDate,
        /** Unreachable in propose-only mode: the loop above `continue`s before getting here. */
        ownerId: company.ownerId as string,
        companyName: company.name,
        signalType,
      })
      result.written += 1
    }

    this.logger.log(
      input.proposeOnly
        ? `Công ty ${input.companyId}: nguồn thật nên KHÔNG tự đặt Việc tiếp theo — ` +
            `${result.blocked.length} cơ hội chuyển thành gợi ý chờ duyệt (I-15)`
        : `Công ty ${input.companyId}: tự đặt Việc tiếp theo cho ${result.written} cơ hội · ` +
            `${result.blocked.length} không đè vì ô do người gõ (I-7)`,
    )

    return result
  }

  /**
   * I-6. One finding per round, `certain` before `likely` and stored order after that.
   *
   * Not "every eligible finding": a single snapshot can state two pieces of news, and writing
   * both would have the second one overwrite the first on the same cell — leaving a trail of
   * two events where the earlier one describes a value that was never on screen.
   */
  private pickClaim(savedClaims: SavedClaim[]): ClaimDto | null {
    const eligible = savedClaims
      .map((saved) => saved.claim)
      .filter(
        (claim) =>
          (AUTO_WRITE_SIGNALS as readonly string[]).includes(claim.signalType) &&
          (AUTO_WRITE_CONFIDENCE as readonly string[]).includes(claim.confidence),
      )

    return eligible.find((claim) => claim.confidence === 'certain') ?? eligible[0] ?? null
  }

  /**
   * ONE transaction: the cell, the trail and the notice. See the class header for why these
   * three cannot be separate statements.
   */
  private async writeOne(
    db: CrmDatabase,
    input: {
      opportunity: OpenOpportunity
      claim: ClaimDto
      text: string
      dueDate: string
      ownerId: string
      companyName: string
      signalType: AutoWriteSignal
    },
  ): Promise<void> {
    const { opportunity, claim } = input

    await db.transaction(async (tx) => {
      await tx
        .update(opportunities)
        .set({
          nextStepText: input.text,
          nextStepDueDate: input.dueDate,
          /**
           * The system declares itself. Rule 2 of CLAUDE.md reads this to draw the machine
           * mark, and I-7 reads it at the next write to know whose cell this is.
           */
          nextStepSource: 'system',
        })
        .where(eq(opportunities.id, opportunity.id))

      /**
       * WRITTEN OUT COLUMN BY COLUMN, and NOT through `db.insert().values()`.
       *
       * Drizzle's insert builder names EVERY column of the table, filling absent ones with
       * `DEFAULT`. Naming `undo_deadline` at all is enough for Postgres to refuse the whole
       * statement, because `crm_system` deliberately holds no privilege on it (`0003`,
       * ADR-0015) — its DEFAULT of `now() + 7 days` is what fixes the window. The fix is not
       * to widen the GRANT: widening it would let the AI shrink its own undo window, which is
       * the guarantee T-7 exists to prove.
       *
       * Keep this list identical to the GRANT in `0003_grants_ai_tables.sql`.
       */
      const event = await tx.execute(sql`
        INSERT INTO auto_next_step_events
          (opportunity_id, claim_id, previous_text, previous_due_date, previous_source,
           new_text, new_due_date)
        VALUES (${opportunity.id}, ${claim.id}, ${opportunity.nextStepText},
                ${opportunity.nextStepDueDate}, ${opportunity.nextStepSource}::next_step_source,
                ${input.text}, ${input.dueDate})
        RETURNING id
      `)
      const eventId = (event.rows[0] as { id: string }).id

      /**
       * `read_at` is absent from the column list for the same reason: the system that wrote to
       * official data must not be able to mark its own notice as seen.
       */
      await tx.execute(sql`
        INSERT INTO notifications (user_id, auto_event_id, message)
        VALUES (${input.ownerId}, ${eventId}, ${this.notificationMessage(input)})
      `)
    })
  }

  /**
   * What the notice says. Four things, because a notice that only says "something changed"
   * makes Sales open the deal to find out — and the undo is meant to be cheaper than the write.
   */
  private notificationMessage(input: {
    opportunity: OpenOpportunity
    companyName: string
    text: string
    dueDate: string
    signalType: AutoWriteSignal
  }): string {
    return (
      `Hệ thống đã tự đặt Việc tiếp theo cho cơ hội “${input.opportunity.name}” ` +
      `(${input.companyName}): “${input.text}”. ` +
      `Hạn ${input.dueDate} — ${dueReasonFor(input.signalType)}. ` +
      `Hoàn tác được trong 7 ngày.`
    )
  }

  /**
   * What the deal board needs to draw the machine mark and the undo button (ADR-0027 · B1).
   *
   * Reads through `crm_app`: this is Sales looking at their own board, whoever triggered it.
   *
   * The join back to `opportunities` on `next_step_source = 'system'` is doing real work. An
   * event whose cell has since been typed over by a person must not keep the machine mark on
   * that person's sentence, and undoing it would throw their edit away. Once the cell belongs
   * to a human again the event stays in the trail — it happened — but it stops describing what
   * is on screen, so it stops being shown.
   */
  async listActive(): Promise<AutoNextStepMap> {
    const rows = await this.dbApp
      .select({
        eventId: autoNextStepEvents.id,
        opportunityId: autoNextStepEvents.opportunityId,
        newText: autoNextStepEvents.newText,
        newDueDate: autoNextStepEvents.newDueDate,
        createdAt: autoNextStepEvents.createdAt,
        undoDeadline: autoNextStepEvents.undoDeadline,
        claim: claims,
      })
      .from(autoNextStepEvents)
      .innerJoin(claims, eq(claims.id, autoNextStepEvents.claimId))
      .innerJoin(opportunities, eq(opportunities.id, autoNextStepEvents.opportunityId))
      .where(and(isNull(autoNextStepEvents.undoneAt), eq(opportunities.nextStepSource, 'system')))
      .orderBy(desc(autoNextStepEvents.createdAt))

    const now = Date.now()
    const map: AutoNextStepMap = {}

    for (const row of rows) {
      // Newest first, so the first row for an opportunity is the one describing its cell.
      if (map[row.opportunityId]) continue
      map[row.opportunityId] = {
        eventId: row.eventId,
        opportunityId: row.opportunityId,
        newText: row.newText,
        newDueDate: row.newDueDate,
        claim: toClaimDto(row.claim),
        dueReason: dueReasonFor(row.claim.signalType),
        dueDays: dueDaysFor(row.claim.signalType),
        createdAt: row.createdAt.toISOString(),
        undoDeadline: row.undoDeadline.toISOString(),
        /** Against SERVER time: a browser clock deciding this would offer an undo that fails. */
        canUndo: row.undoDeadline.getTime() > now,
      }
    }

    return map
  }

  /**
   * The one click that takes it back (I-8, ADR-0026).
   *
   * TWO defence layers, and neither is decoration:
   *   - the guard below, so a refusal is explicit and audited rather than a permission error
   *     nobody reads;
   *   - `poolFor(actor)`, so the same call under a system identity dies in Postgres anyway —
   *     `crm_system` holds no UPDATE on `auto_next_step_events` at all. Hard-wiring `dbApp`
   *     here would delete that second layer silently, which is the mistake of 12/08 and why
   *     the measurement in the test file exists.
   */
  async undo(actor: Actor, eventId: string): Promise<UndoResultDto> {
    if (actor.kind === 'system' || !actor.userId) {
      await this.audit.recordRefusal(actor, 'undo_auto_next_step', 'auto_next_step_event', eventId, {
        reason: 'undoing a machine write is the human half of autonomy zone 3',
      })
      throw new ForbiddenException('Hệ thống không được tự hoàn tác')
    }

    const db = this.poolFor(actor)

    const restored = await db.transaction(async (tx) => {
      const event = await this.loadUndoable(tx, eventId)

      /**
       * I-8. NOT `event.previousText` — that is whatever stood there a moment before, which on
       * the second machine write is the machine's own earlier sentence. The button protects
       * human data, so it walks back to the last event whose predecessor was not the system
       * (`IS DISTINCT FROM`, so a cell that was empty counts). Nothing found → an empty cell,
       * which is the honest answer when a person never typed one.
       */
      const baseline = await this.humanBaseline(tx, event.opportunityId, eventId)

      await tx
        .update(opportunities)
        .set({
          nextStepText: baseline.text,
          nextStepDueDate: baseline.dueDate,
          /** Never `system`: after an undo the cell is the person's again, or nobody's. */
          nextStepSource: baseline.text ? 'human' : null,
        })
        .where(eq(opportunities.id, event.opportunityId))

      await tx
        .update(autoNextStepEvents)
        .set({
          undoneAt: new Date(),
          undoneBy: actor.userId as string,
          undoneToText: baseline.text,
          undoneToDueDate: baseline.dueDate,
        })
        .where(eq(autoNextStepEvents.id, eventId))

      return {
        opportunityId: event.opportunityId,
        restoredText: baseline.text,
        restoredDueDate: baseline.dueDate,
      }
    })

    this.logger.log(
      `Hoàn tác ${eventId} bởi ${actor.userId}: Việc tiếp theo trở lại ` +
        (restored.restoredText ? `“${restored.restoredText}”` : 'trạng thái trống'),
    )

    return restored
  }

  /**
   * The three refusals, all measured against SERVER time and the row itself rather than
   * against anything the client sent.
   */
  private async loadUndoable(tx: CrmDatabase, eventId: string): Promise<{ opportunityId: string }> {
    const [event] = await tx
      .select({
        id: autoNextStepEvents.id,
        opportunityId: autoNextStepEvents.opportunityId,
        undoDeadline: autoNextStepEvents.undoDeadline,
        undoneAt: autoNextStepEvents.undoneAt,
      })
      .from(autoNextStepEvents)
      .where(eq(autoNextStepEvents.id, eventId))
      .limit(1)

    if (!event) throw new NotFoundException('Không tìm thấy lần hệ thống tự đặt Việc tiếp theo')
    if (event.undoneAt) throw new ForbiddenException('Lần tự đặt này đã được hoàn tác')
    if (event.undoDeadline.getTime() <= Date.now()) {
      throw new ForbiddenException('Đã quá 7 ngày, không hoàn tác được nữa')
    }

    /**
     * Only the NEWEST un-undone event of a deal may be undone. Undoing an older one would put a
     * value from two writes ago into a cell describing the newest, and the trail would then
     * disagree with the cell it is supposed to account for.
     *
     * Asked as "is the newest one me?" rather than as "does a newer one exist?", and the
     * difference is not style. `created_at` is `timestamptz`, which Postgres stores to the
     * MICROSECOND; node-postgres hands it back as a JS `Date`, which holds milliseconds. Send
     * that value back as a parameter and `created_at > $1` is true of the row it came from —
     * so the "is there a newer one" form refused every undo, including the only one that
     * existed. Comparing ids never leaves the database's own precision.
     */
    const [newest] = await tx
      .select({ id: autoNextStepEvents.id })
      .from(autoNextStepEvents)
      .where(
        and(
          eq(autoNextStepEvents.opportunityId, event.opportunityId),
          isNull(autoNextStepEvents.undoneAt),
        ),
      )
      .orderBy(desc(autoNextStepEvents.createdAt))
      .limit(1)

    if (newest && newest.id !== eventId) {
      throw new ForbiddenException('Đã có lần tự đặt mới hơn — hoàn tác lần mới nhất trước')
    }

    return { opportunityId: event.opportunityId }
  }

  /**
   * ADR-0026 · A — walk the chain back to the last predecessor that was not the system.
   *
   * The cut-off is expressed as a SUBQUERY on the event's own `created_at` rather than as a JS
   * `Date` parameter, for the microsecond reason spelled out in `loadUndoable`: a millisecond
   * value sent back as a parameter compares wrong against the row it was read from, and here it
   * would silently exclude the newest event from its own baseline search.
   */
  private async humanBaseline(
    tx: CrmDatabase,
    opportunityId: string,
    upToEventId: string,
  ): Promise<{ text: string | null; dueDate: string | null }> {
    const [row] = await tx
      .select({
        text: autoNextStepEvents.previousText,
        dueDate: autoNextStepEvents.previousDueDate,
      })
      .from(autoNextStepEvents)
      .where(
        and(
          eq(autoNextStepEvents.opportunityId, opportunityId),
          lte(
            autoNextStepEvents.createdAt,
            sql`(SELECT created_at FROM auto_next_step_events WHERE id = ${upToEventId})`,
          ),
          /** `IS DISTINCT FROM`: a NULL predecessor is "the cell was empty", which counts. */
          or(isNull(autoNextStepEvents.previousSource), ne(autoNextStepEvents.previousSource, 'system')),
        ),
      )
      .orderBy(desc(autoNextStepEvents.createdAt))
      .limit(1)

    return { text: row?.text ?? null, dueDate: row?.dueDate ?? null }
  }

  /**
   * ontology 3.5 — open means "not closed", so `on_hold` is in. A paused deal is still a deal
   * a piece of news can restart, and quietly excluding it would be a rule nobody wrote down.
   */
  private async openOpportunities(
    db: CrmDatabase,
    companyId: string,
  ): Promise<OpenOpportunity[]> {
    return db
      .select({
        id: opportunities.id,
        name: opportunities.name,
        nextStepText: opportunities.nextStepText,
        nextStepDueDate: opportunities.nextStepDueDate,
        nextStepSource: opportunities.nextStepSource,
      })
      .from(opportunities)
      .where(
        and(
          eq(opportunities.companyId, companyId),
          notInArray(opportunities.stage, [...CLOSED_STAGES]),
        ),
      )
      .orderBy(opportunities.id)
  }

  /** `owner_id` is who the notice goes to. `crm_system` reads `companies` and nothing of `users`. */
  private async loadCompany(
    db: CrmDatabase,
    companyId: string,
  ): Promise<{ name: string; ownerId: string | null }> {
    const [company] = await db
      .select({ name: companies.name, ownerId: companies.ownerId })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1)

    if (!company) throw new NotFoundException('Không tìm thấy công ty')
    return company
  }

  private poolFor(actor: Actor): CrmDatabase {
    return actor.kind === 'system' ? this.dbSystem : this.dbApp
  }
}

interface OpenOpportunity {
  id: string
  name: string
  nextStepText: string | null
  nextStepDueDate: string | null
  nextStepSource: string | null
}

function toClaimDto(row: typeof claims.$inferSelect): ClaimDto {
  return {
    id: row.id,
    companyId: row.companyId,
    observationId: row.observationId,
    statement: row.statement,
    signalType: row.signalType,
    confidence: row.confidence,
    quoteText: row.quoteText,
    quoteStart: row.quoteStart,
    quoteEnd: row.quoteEnd,
    triggerContext: row.triggerContext,
    createdAt: row.createdAt.toISOString(),
  }
}

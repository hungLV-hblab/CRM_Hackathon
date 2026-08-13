import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, desc, eq, isNull } from 'drizzle-orm'

import {
  STAGE,
  type CreateOpportunityDto,
  type ListOpportunitiesQuery,
  type OpportunityDto,
  type Stage,
  type UpdateOpportunityDto,
  type UpdateStageDto,
} from '@crm/contracts'
import { type CrmDatabase, companies, opportunities, timelineEntries } from '@crm/db'

import { DRIZZLE_APP, DRIZZLE_SYSTEM } from '../../common/db/db.module'
import { AuditEventService } from '../../common/audit/audit-event-service'
import { isOverdue, opportunityWarnings, todayIso } from './opportunity-warnings'
import type { Actor } from '../../common/actor/actor-context'

/**
 * The FIRST defence layer of ADR-0004 (domain level). The second one is the GRANT set in
 * `packages/db/migrations/0001_grants.sql` — both are required, see the note on
 * `AuditEventService` for why one is not enough.
 *
 * This service deliberately carries no decorator beyond `@Injectable`/`@Inject`: the T-10
 * test has to construct it with `new OpportunityService(...)` without booting HTTP, because
 * T-10 describes an action arriving from OUTSIDE the user interface.
 *
 * What this service must NOT do is as important as what it does: it never REFUSES a stage
 * move by a human. Every incompleteness comes back as a warning flag on the returned DTO
 * (`opportunity-warnings.ts`), never as a rejection — see the header of
 * `opportunity-stage-never-blocks.test.ts`.
 *
 * User-facing messages stay Vietnamese: Sales reads them.
 */

/** The cells the stage-transition dialog may collect on the way. Offering ≠ requiring. */
type StageChangeCells = Omit<UpdateStageDto, 'stage'>

/** The `opportunities` columns plus the company name the board and the to-do list show. */
const SELECTION = {
  id: opportunities.id,
  companyId: opportunities.companyId,
  companyName: companies.name,
  name: opportunities.name,
  expectedValue: opportunities.expectedValue,
  expectedCloseMonth: opportunities.expectedCloseMonth,
  stage: opportunities.stage,
  nextStepText: opportunities.nextStepText,
  nextStepDueDate: opportunities.nextStepDueDate,
  nextStepSource: opportunities.nextStepSource,
  needSignal: opportunities.needSignal,
  needSignalSource: opportunities.needSignalSource,
  budgetSignal: opportunities.budgetSignal,
  budgetSignalSource: opportunities.budgetSignalSource,
  lostReason: opportunities.lostReason,
  updatedAt: opportunities.updatedAt,
}

/**
 * Written out rather than derived from `SELECTION`: the mapped-type version silently drops
 * the nullability of every column, so `expectedValue` came back as `string` and a `null` in
 * the middle of the money column type-checked fine.
 */
type OpportunityRow = Omit<typeof opportunities.$inferSelect, 'createdAt'> & {
  companyName: string
}

@Injectable()
export class OpportunityService {
  constructor(
    @Inject(DRIZZLE_APP) private readonly dbApp: CrmDatabase,
    @Inject(DRIZZLE_SYSTEM) private readonly dbSystem: CrmDatabase,
    private readonly audit: AuditEventService,
  ) {}

  async create(actor: Actor, dto: CreateOpportunityDto): Promise<OpportunityDto> {
    const db = this.poolFor(actor)

    if (actor.kind === 'system') {
      await this.audit.recordRefusal(actor, 'create_opportunity', 'opportunity', null, {
        reason: 'a deal is opened by a person; the AI may only propose (ontology section 5)',
      })
      throw new ForbiddenException('Hệ thống không được tạo cơ hội')
    }

    // Nothing is validated against the stage here on purpose: an opportunity may be created
    // already at `negotiation`, with no next step and no signal cells, and it saves.
    const [created] = await db
      .insert(opportunities)
      .values({
        companyId: dto.companyId,
        name: dto.name,
        expectedValue: dto.expectedValue ?? null,
        expectedCloseMonth: dto.expectedCloseMonth ?? null,
        stage: dto.stage ?? 'prospecting',
        nextStepText: dto.nextStepText ?? null,
        nextStepDueDate: dto.nextStepDueDate ?? null,
        // A human typed it, and I-7 later reads this to decide whether the system may touch it.
        nextStepSource: dto.nextStepText ? 'human' : null,
        needSignal: dto.needSignal ?? null,
        needSignalSource: dto.needSignalSource ?? null,
        budgetSignal: dto.budgetSignal ?? null,
        budgetSignalSource: dto.budgetSignalSource ?? null,
        lostReason: dto.lostReason ?? null,
      })
      .returning({ id: opportunities.id })

    return this.byId(created.id)
  }

  async update(actor: Actor, opportunityId: string, dto: UpdateOpportunityDto): Promise<OpportunityDto> {
    const db = this.poolFor(actor)

    if (actor.kind === 'system') {
      await this.audit.recordRefusal(actor, 'update_opportunity', 'opportunity', opportunityId, {
        reason: 'this path can write `expectedValue` and `stage`; both are no-go for the AI',
      })
      throw new ForbiddenException('Hệ thống không được sửa cơ hội')
    }

    const patch: Partial<typeof opportunities.$inferInsert> = { updatedAt: new Date() }
    if (dto.name !== undefined) patch.name = dto.name
    if (dto.expectedValue !== undefined) patch.expectedValue = dto.expectedValue
    if (dto.expectedCloseMonth !== undefined) patch.expectedCloseMonth = dto.expectedCloseMonth
    if (dto.stage !== undefined) patch.stage = dto.stage
    if (dto.nextStepText !== undefined) {
      patch.nextStepText = dto.nextStepText
      // Typing over a cell the system filled hands ownership back to the human (I-7).
      patch.nextStepSource = dto.nextStepText ? 'human' : null
    }
    if (dto.nextStepDueDate !== undefined) patch.nextStepDueDate = dto.nextStepDueDate
    if (dto.needSignal !== undefined) patch.needSignal = dto.needSignal
    if (dto.needSignalSource !== undefined) patch.needSignalSource = dto.needSignalSource
    if (dto.budgetSignal !== undefined) patch.budgetSignal = dto.budgetSignal
    if (dto.budgetSignalSource !== undefined) patch.budgetSignalSource = dto.budgetSignalSource
    if (dto.lostReason !== undefined) patch.lostReason = dto.lostReason

    await db.update(opportunities).set(patch).where(eq(opportunities.id, opportunityId))

    return this.byId(opportunityId)
  }

  /**
   * No-go boundaries 1 and 2 (ontology section 5): the stage only changes when a HUMAN acts.
   * Checked on the FIRST line, before any query — checking after a read or write is too late.
   *
   * `cells` carries whatever the transition dialog managed to collect. All of it is optional,
   * every time: the dialog always keeps a "Để trống, bổ sung sau" button, and this method is
   * what has to honour it.
   */
  async updateStage(
    actor: Actor,
    opportunityId: string,
    stage: Stage,
    cells: StageChangeCells = {},
  ): Promise<OpportunityDto> {
    /**
     * The connection is chosen BY ACTOR, and that is what makes the second defence layer
     * real here rather than theoretical.
     *
     * Measured by deleting the check below and re-running the T-10 test: with the write
     * hard-wired to `dbApp`, a system actor set the stage to 'won' and nothing stopped it —
     * the call did not even throw. The column grants of ADR-0010 never applied, because a
     * grant can only bite the role that actually issues the statement, and `crm_app` is
     * allowed to change the stage. ADR-0004 claims two independent layers; with a fixed
     * `dbApp` there was exactly one, and the test would still have been green.
     *
     * Now the same deletion leaves Postgres refusing the UPDATE: `crm_system` holds no
     * privilege on the `stage` column.
     */
    const db = this.poolFor(actor)

    if (actor.kind === 'system') {
      await this.audit.recordRefusal(actor, 'update_stage', 'opportunity', opportunityId, {
        attemptedStage: stage,
        reason: 'actor=system may not change the stage (ontology section 5, boundary 1)',
      })
      throw new ForbiddenException('Hệ thống không được đổi giai đoạn của cơ hội')
    }

    const current = await this.rowOrThrow(db, opportunityId)

    /**
     * ONE transaction for two writes: the stage move and the timeline entry recording it.
     * Split them and a crash in between leaves a deal that changed stage with no trace of
     * when or from where — the timeline stops being the account of what happened, which is
     * the only thing it is for.
     */
    await db.transaction(async (tx) => {
      await tx
        .update(opportunities)
        .set({
          stage,
          // Only cells the dialog actually collected. `undefined` leaves the column alone;
          // an explicit `null` is Sales clearing it.
          ...(cells.needSignal !== undefined ? { needSignal: cells.needSignal } : {}),
          ...(cells.needSignalSource !== undefined
            ? { needSignalSource: cells.needSignalSource }
            : {}),
          ...(cells.budgetSignal !== undefined ? { budgetSignal: cells.budgetSignal } : {}),
          ...(cells.budgetSignalSource !== undefined
            ? { budgetSignalSource: cells.budgetSignalSource }
            : {}),
          ...(cells.lostReason !== undefined ? { lostReason: cells.lostReason } : {}),
          updatedAt: new Date(),
        })
        .where(eq(opportunities.id, opportunityId))

      await tx.insert(timelineEntries).values({
        companyId: current.companyId,
        entryType: 'stage_change',
        occurredAt: new Date(),
        // The Vietnamese sentence, not a `prospecting->qualified` code: this column is
        // already free text Sales types into for `activity` and `note`, and two formats in
        // one column means writing a parser to read the other one back.
        description: `Đổi giai đoạn: ${STAGE[current.stage]} → ${STAGE[stage]}`,
        createdBy: 'human',
      })
    })

    return this.byId(opportunityId)
  }

  /**
   * Autonomy zone 3 — the system MAY set the next step, but I-7 forbids overwriting one a
   * human typed, even when it is overdue ("an overdue human-typed cell is a debt Sales is
   * holding, not a junk cell"). This refuses explicitly rather than overwriting quietly.
   *
   * TWO PATHS WRITE `next_step_*` AS THE SYSTEM, and the split is deliberate rather than
   * leftover. Feature group 4 does NOT come through here: it needs the cell, the
   * `AutoNextStepEvent` and the notification in ONE transaction, which is a shape this
   * method cannot offer without growing the trail and the notice as parameters. So it lives
   * in `auto-next-step-service.ts`, which repeats the I-7 check on its own rows.
   *
   * What keeps that safe is that BOTH paths pick their pool by actor, so `crm_system`'s
   * three-column grant applies to either. This method stays as the shared guard for any
   * caller setting a next step from outside group 4 — a future importer, a script — and
   * deleting it would leave that case with no domain-level check at all.
   */
  async updateNextStep(
    actor: Actor,
    opportunityId: string,
    nextStep: { text: string; dueDate: string | null },
  ): Promise<void> {
    const db = this.poolFor(actor)

    if (actor.kind === 'system') {
      const [current] = await db
        .select({ source: opportunities.nextStepSource, text: opportunities.nextStepText })
        .from(opportunities)
        .where(eq(opportunities.id, opportunityId))

      if (current?.source === 'human' && current.text) {
        await this.audit.recordRefusal(actor, 'update_next_step', 'opportunity', opportunityId, {
          reason: 'I-7: never overwrite a human-typed next step, not even when overdue',
        })
        throw new ForbiddenException('Không được ghi đè Việc tiếp theo do người gõ (I-7)')
      }
    }

    await db
      .update(opportunities)
      .set({
        nextStepText: nextStep.text,
        nextStepDueDate: nextStep.dueDate,
        // The system must declare itself as the system: CLAUDE.md rule 2 relies on this to
        // show the distinguishing mark, and I-7 relies on it at the next write.
        nextStepSource: actor.kind,
      })
      .where(eq(opportunities.id, opportunityId))
  }

  /**
   * Reads for a screen always go through `crm_app`: this is Sales looking at their own data,
   * whoever triggered the request.
   */
  async list(query: ListOpportunitiesQuery = {}): Promise<OpportunityDto[]> {
    const today = todayIso()
    const conditions = [isNull(companies.deletedAt)]
    if (query.companyId) conditions.push(eq(opportunities.companyId, query.companyId))
    if (query.stage) conditions.push(eq(opportunities.stage, query.stage))

    const rows = await this.dbApp
      .select(SELECTION)
      .from(opportunities)
      // A soft-deleted company hides its opportunities without the delete cascading into
      // them: no extra column, no migration, and undeleting brings everything back.
      .innerJoin(companies, eq(companies.id, opportunities.companyId))
      .where(and(...conditions))
      .orderBy(desc(opportunities.updatedAt))

    const dtos = rows.map((row) => toDto(row, today))
    return query.overdueOnly ? dtos.filter((dto) => dto.isOverdue) : dtos
  }

  async byId(opportunityId: string): Promise<OpportunityDto> {
    const [row] = await this.dbApp
      .select(SELECTION)
      .from(opportunities)
      .innerJoin(companies, eq(companies.id, opportunities.companyId))
      .where(and(eq(opportunities.id, opportunityId), isNull(companies.deletedAt)))

    if (!row) throw new NotFoundException('Không tìm thấy cơ hội')
    return toDto(row, todayIso())
  }

  private poolFor(actor: Actor): CrmDatabase {
    return actor.kind === 'system' ? this.dbSystem : this.dbApp
  }

  private async rowOrThrow(
    db: CrmDatabase,
    opportunityId: string,
  ): Promise<{ companyId: string; stage: Stage }> {
    const [row] = await db
      .select({ companyId: opportunities.companyId, stage: opportunities.stage })
      .from(opportunities)
      .where(eq(opportunities.id, opportunityId))

    if (!row) throw new NotFoundException('Không tìm thấy cơ hội')
    return row
  }
}

/**
 * Warnings and `isOverdue` are computed HERE, once, on the way out — so the board, the detail
 * screen and the overview cannot disagree about whether a row is incomplete.
 */
function toDto(row: OpportunityRow, today: string): OpportunityDto {
  const source = {
    stage: row.stage,
    needSignal: row.needSignal,
    needSignalSource: row.needSignalSource,
    budgetSignal: row.budgetSignal,
    budgetSignalSource: row.budgetSignalSource,
    lostReason: row.lostReason,
    nextStepText: row.nextStepText,
    nextStepDueDate: row.nextStepDueDate,
  }

  return {
    id: row.id,
    companyId: row.companyId,
    companyName: row.companyName,
    name: row.name,
    expectedValue: row.expectedValue,
    expectedCloseMonth: row.expectedCloseMonth,
    stage: row.stage,
    nextStepText: row.nextStepText,
    nextStepDueDate: row.nextStepDueDate,
    nextStepSource: row.nextStepSource,
    needSignal: row.needSignal,
    needSignalSource: row.needSignalSource,
    budgetSignal: row.budgetSignal,
    budgetSignalSource: row.budgetSignalSource,
    lostReason: row.lostReason,
    warnings: opportunityWarnings(source),
    isOverdue: isOverdue(source, today),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** Exported for the overview screen, which reads the same rows through its own query. */
export { toDto as toOpportunityDto, SELECTION as OPPORTUNITY_SELECTION }

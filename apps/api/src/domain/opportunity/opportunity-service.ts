import { ForbiddenException, Inject, Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'

import type { Stage } from '@crm/contracts'
import { type CrmDatabase, opportunities } from '@crm/db'

import { DRIZZLE_APP, DRIZZLE_SYSTEM } from '../../common/db/db.module'
import { AuditEventService } from '../../common/audit/audit-event-service'
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
 * User-facing messages stay Vietnamese: Sales reads them.
 */
@Injectable()
export class OpportunityService {
  constructor(
    @Inject(DRIZZLE_APP) private readonly dbApp: CrmDatabase,
    @Inject(DRIZZLE_SYSTEM) private readonly dbSystem: CrmDatabase,
    private readonly audit: AuditEventService,
  ) {}

  /**
   * No-go boundaries 1 and 2 (ontology section 5): the stage only changes when a HUMAN acts.
   * Checked on the FIRST line, before any query — checking after a read or write is too late.
   */
  async updateStage(actor: Actor, opportunityId: string, stage: Stage): Promise<void> {
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
    const db = actor.kind === 'system' ? this.dbSystem : this.dbApp

    if (actor.kind === 'system') {
      await this.audit.recordRefusal(actor, 'update_stage', 'opportunity', opportunityId, {
        attemptedStage: stage,
        reason: 'actor=system may not change the stage (ontology section 5, boundary 1)',
      })
      throw new ForbiddenException('Hệ thống không được đổi giai đoạn của cơ hội')
    }

    await db
      .update(opportunities)
      .set({ stage, updatedAt: new Date() })
      .where(eq(opportunities.id, opportunityId))
  }

  /**
   * Autonomy zone 3 — the system MAY set the next step, but I-7 forbids overwriting one a
   * human typed, even when it is overdue ("an overdue human-typed cell is a debt Sales is
   * holding, not a junk cell"). The correct path in that case is to raise a `Proposal`,
   * which belongs to feature group 4 and does not exist in the skeleton yet — so this
   * refuses explicitly instead of silently overwriting.
   */
  async updateNextStep(
    actor: Actor,
    opportunityId: string,
    nextStep: { text: string; dueDate: string | null },
  ): Promise<void> {
    const db = actor.kind === 'system' ? this.dbSystem : this.dbApp

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
}

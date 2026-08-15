import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { and, eq, isNull } from 'drizzle-orm'

import { type DecideProposalDto, type ProposalTargetField } from '@crm/contracts'
import {
  type CrmDatabase,
  claims,
  companies,
  opportunities,
  proposalDecisions,
  proposals,
  timelineEntries,
} from '@crm/db'

import type { Actor } from '../../common/actor/actor-context'
import { ownerScopeFor } from '../../common/actor/owner-scope'
import { AuditEventService } from '../../common/audit/audit-event-service'
import { DRIZZLE_APP } from '../../common/db/db.module'
import { dueDateFor } from '../opportunity/next-step-due-date'

/**
 * Where autonomy zone 2 ends: a PERSON decides, and only that decision changes official data.
 *
 * Every write in this file goes through `DRIZZLE_APP`, and that is not a convenience — it is
 * the point. `crm_system` holds no privilege on `proposal_decisions` and no UPDATE on
 * `proposals`, so the row that says "a human decided this" cannot be written by the AI branch
 * even if a future bug called this method with `SYSTEM_ACTOR`. The guard below makes that
 * refusal explicit and audited rather than a permission error nobody reads.
 *
 * I-12 needs no arithmetic: `accept` and `edit` are two values of one enum, counted separately
 * by default. There is no second column holding "approved" that a report could sum by mistake.
 *
 * ADR-0009: nothing here reads `ai_enabled`. Switching the AI off stops NEW suggestions; a
 * queue that already exists stays decidable, which is what the switch is for.
 */
@Injectable()
export class ProposalDecisionService {
  private readonly logger = new Logger('ProposalDecisionService')

  constructor(
    @Inject(DRIZZLE_APP) private readonly db: CrmDatabase,
    private readonly audit: AuditEventService,
  ) {}

  async decide(actor: Actor, proposalId: string, dto: DecideProposalDto): Promise<void> {
    if (actor.kind === 'system' || !actor.userId) {
      await this.audit.recordRefusal(actor, 'decide_proposal', 'proposal', proposalId, {
        reason: 'deciding a suggestion is a human act (autonomy zone 2)',
      })
      throw new ForbiddenException('Hệ thống không được tự duyệt gợi ý')
    }

    const proposal = await this.loadPending(proposalId, ownerScopeFor(actor))

    /**
     * One transaction for the decision record, the queue flag and the change itself. Split them
     * and a crash in between leaves either a profile edited by nobody or a decision that never
     * took effect — both of which are worse than the request failing.
     */
    await this.db.transaction(async (tx) => {
      await tx.insert(proposalDecisions).values({
        proposalId,
        decision: dto.decision,
        decidedBy: actor.userId as string,
        rejectReason: dto.rejectReason ?? null,
        finalValue: dto.decision === 'edit' ? (dto.finalValue as string) : null,
        secondsToDecide: dto.secondsToDecide ?? null,
      })

      await tx.update(proposals).set({ status: 'decided' }).where(eq(proposals.id, proposalId))

      if (dto.decision === 'reject') return

      /** `edit` applies what the PERSON typed, never `proposed_value` (I-12, ADR-0008). */
      const value = dto.decision === 'edit' ? (dto.finalValue as string) : proposal.proposedValue
      await this.apply(tx, proposal, value)
    })

    this.logger.log(
      `Gợi ý ${proposalId}: ${dto.decision} bởi ${actor.userId}` +
        (dto.rejectReason ? ` (lý do: ${dto.rejectReason})` : '') +
        (dto.secondsToDecide !== undefined ? ` — ${dto.secondsToDecide}s` : ''),
    )
  }

  /**
   * The three shapes of "accepted". All three write under the deciding person's identity, so
   * the resulting row reads as theirs — which is the whole difference between zone 2 and zone 3.
   */
  private async apply(
    tx: CrmDatabase,
    proposal: PendingProposal,
    value: string,
  ): Promise<void> {
    if (proposal.proposalType === 'field_update') {
      const field = proposal.targetField as ProposalTargetField
      await tx
        .update(companies)
        .set({ [field]: value, updatedAt: new Date() })
        .where(eq(companies.id, proposal.companyId))
      return
    }

    if (proposal.proposalType === 'timeline_entry') {
      await tx.insert(timelineEntries).values({
        companyId: proposal.companyId,
        entryType: 'note',
        occurredAt: new Date(),
        description: value,
        /**
         * `human`, not `system`. A person read the evidence and chose to record this, so the
         * entry is theirs and carries no "do hệ thống thêm" label — that label belongs to the
         * watch cycle (zone 4), and using it here would make the two indistinguishable. This is
         * also why I-4 is not in play: I-4 forbids the AI writing a timeline entry from a
         * `manual_ingest` finding, and nothing here is written by the AI.
         */
        createdBy: 'human',
      })
      return
    }

    /**
     * `next_step` (ADR-0023). The due date is computed AT ACCEPT TIME from the urgency table
     * (I-9), not stored when the suggestion was raised: a queue entry may sit for days, and a
     * date measured from then would land in the past.
     *
     * `nextStepSource` becomes `human`. Writing `system` here would drop the cell into autonomy
     * zone 3 and pull in the notification and the 7-day undo, which belong to a write nobody
     * asked for — the opposite of what just happened.
     */
    await tx
      .update(opportunities)
      .set({
        nextStepText: value,
        nextStepDueDate: dueDateFor(proposal.signalType),
        nextStepSource: 'human',
        updatedAt: new Date(),
      })
      .where(eq(opportunities.id, proposal.opportunityId as string))
  }

  /**
   * ADR-0046 — the boundary is part of the lookup, so a suggestion outside it is simply not
   * found. Deciding one used to need nothing but its id: the queue would not SHOW another
   * person's card, but accepting it wrote to their company profile, their timeline or their
   * deal's next step all the same, and recorded the decision as theirs to answer for.
   *
   * Soft-deleted companies drop out here too, matching `listPending`. Accepting a suggestion for
   * a deleted company wrote to a row no screen can display.
   */
  private async loadPending(
    proposalId: string,
    ownerId: string | null,
  ): Promise<PendingProposal> {
    const conditions = [
      eq(proposals.id, proposalId),
      eq(proposals.status, 'pending'),
      isNull(companies.deletedAt),
    ]
    if (ownerId) conditions.push(eq(companies.ownerId, ownerId))

    const [row] = await this.db
      .select({
        id: proposals.id,
        companyId: proposals.companyId,
        opportunityId: proposals.opportunityId,
        proposalType: proposals.proposalType,
        targetField: proposals.targetField,
        proposedValue: proposals.proposedValue,
        signalType: claims.signalType,
      })
      .from(proposals)
      .innerJoin(claims, eq(claims.id, proposals.claimId))
      .innerJoin(companies, eq(companies.id, proposals.companyId))
      .where(and(...conditions))
      .limit(1)

    if (!row) throw new NotFoundException('Không tìm thấy gợi ý đang chờ duyệt')
    return row
  }
}

interface PendingProposal {
  id: string
  companyId: string
  opportunityId: string | null
  proposalType: string
  targetField: string | null
  proposedValue: string
  signalType: string
}

import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'

import type { DeleteSystemTimelineEntryDto } from '@crm/contracts'
import { type CrmDatabase, timelineEntries } from '@crm/db'

import { AuditEventService } from '../common/audit/audit-event-service'
import { DRIZZLE_APP } from '../common/db/db.module'
import type { Actor } from '../common/actor/actor-context'

/** The audit action feature group 6 counts. Renaming it silently empties a dashboard number. */
export const DELETE_SYSTEM_TIMELINE_ENTRY_ACTION = 'delete_system_timeline_entry'

/**
 * I-13 — "Sales vẫn xoá được một mục do hệ thống thêm".
 *
 * This is the counterweight that makes autonomy zone 4 acceptable at all. Zone 4 writes to
 * official data with nobody's approval; what buys that is the write being visible, labelled,
 * traceable, and REMOVABLE more easily than it was made. Rule 3 of CLAUDE.md puts it exactly
 * that way: where the machine acts by itself, undoing it must be easier than the machine's own
 * act, and the number of times it was undone must be measurable.
 *
 * Hence two things that look like friction and are not:
 *   the reason is REQUIRED — it is the numerator of the error-detection rate (ontology 7), and a
 *   deletion nobody explained tells feature group 6 nothing;
 *   the deletion is recorded as an `AuditEvent` carrying the reason, the source claim and the
 *   text that was removed, because the row itself is gone afterwards and an unexplained absence
 *   cannot be reviewed in round 2.
 *
 * ── Scope: entries the SYSTEM wrote, and only those ──────────────────────────────────────
 * A `human`-authored entry gets a 403 here. Specs says Sales may delete a system entry "như mọi
 * mục khác", whose subordinate clause hints that hand-typed entries are deletable too — but no
 * such path exists today and I-13 constrains only the system ones. Widening it in passing would
 * quietly make `stage_change` rows deletable, and those are the EVIDENCE of a stage having moved:
 * removing one erases the record of a human decision, which needs its own ADR rather than a free
 * ride on this one. The narrow scope is a decision, written down here and handed to phase 8.
 *
 * Writes go through `crm_app`. The identity is Sales', because this is Sales' act — and
 * `crm_system` holds no DELETE on the table at all (0001), so the AI cannot tidy away its own
 * mistakes even if this method were called under its name.
 */
@Injectable()
export class SystemTimelineEntryRemovalService {
  private readonly logger = new Logger('SystemTimelineEntryRemoval')

  constructor(
    @Inject(DRIZZLE_APP) private readonly dbApp: CrmDatabase,
    private readonly audit: AuditEventService,
  ) {}

  async remove(
    actor: Actor,
    companyId: string,
    entryId: string,
    dto: DeleteSystemTimelineEntryDto,
  ): Promise<void> {
    /**
     * Refused for `system` FIRST, before anything is read. The AI deleting a timeline entry is
     * one of the absolute boundaries (CLAUDE.md section 4: "không xoá dữ liệu người tạo"), and an
     * AI that could delete its own entries could also delete the evidence that it was wrong —
     * which would leave the error-detection rate looking perfect. Recorded before throwing, or
     * the refusal leaves no trace to show.
     */
    if (actor.kind === 'system') {
      await this.audit.recordRefusal(
        actor,
        DELETE_SYSTEM_TIMELINE_ENTRY_ACTION,
        'timeline_entry',
        entryId,
        { reason: 'xoá mục dòng thời gian là hành động của Sales, không phải của hệ thống' },
      )
      throw new ForbiddenException('Hệ thống không được xoá mục dòng thời gian')
    }

    const entry = await this.load(companyId, entryId)

    if (entry.createdBy !== 'system') {
      throw new ForbiddenException(
        'Đường này chỉ xoá mục do hệ thống thêm. Mục do người gõ chưa có đường xoá.',
      )
    }

    await this.dbApp.delete(timelineEntries).where(eq(timelineEntries.id, entryId))

    /**
     * Written AFTER the delete succeeded, unlike the refusal above. A refusal is recorded before
     * throwing because nothing else will happen; a success is recorded after, so the trail never
     * claims a removal that the database rejected.
     *
     * `detail` keeps the removed text and its source claim. The row is gone, so this event is the
     * only remaining answer to "what did the machine get wrong, and how did the reader know" —
     * the exact question round 2 asks from the log.
     */
    await this.audit.record(
      actor,
      DELETE_SYSTEM_TIMELINE_ENTRY_ACTION,
      'timeline_entry',
      entryId,
      {
        reason: dto.reason,
        companyId,
        sourceClaimId: entry.sourceClaimId,
        description: entry.description,
      },
    )

    this.logger.log(
      `Sales xoá mục hệ thống ${entryId} của công ty ${companyId} — lý do: "${dto.reason}"`,
    )
  }

  private async load(companyId: string, entryId: string) {
    const [entry] = await this.dbApp
      .select({
        id: timelineEntries.id,
        createdBy: timelineEntries.createdBy,
        description: timelineEntries.description,
        sourceClaimId: timelineEntries.sourceClaimId,
      })
      .from(timelineEntries)
      // Scoped by company as well as id: the URL carries both, and trusting only the id would let
      // a mistyped company path delete a row that belongs to a different company's timeline.
      .where(and(eq(timelineEntries.id, entryId), eq(timelineEntries.companyId, companyId)))
      .limit(1)

    if (!entry) throw new NotFoundException('Không tìm thấy mục dòng thời gian')
    return entry
  }
}

import { ForbiddenException, Inject, Injectable } from '@nestjs/common'
import { desc, eq } from 'drizzle-orm'

import type { CreateTimelineEntryDto, TimelineEntryDto } from '@crm/contracts'
import { type CrmDatabase, contacts, timelineEntries } from '@crm/db'

import { DRIZZLE_APP } from '../../common/db/db.module'
import { AuditEventService } from '../../common/audit/audit-event-service'
import type { Actor } from '../../common/actor/actor-context'

/**
 * The company timeline — activities, stage changes and notes read as one stream (ontology
 * 3.1), newest first, because "what happened last" is the question a Sales opens it with.
 *
 * This service handles the entries a PERSON types, so it injects `DRIZZLE_APP` only. The two
 * other writers reach the table by their own paths: `OpportunityService` inserts the
 * `stage_change` row inside the stage transaction, and the watch cycle (autonomy zone 4)
 * writes `system_entry` rows through `crm_system`. Giving this service the system pool would
 * create a third way in, with no rule attached to it.
 *
 * There is no `remove` here on purpose: deleting a system-added entry is Sales' act and the
 * error-detection signal of feature group 5 — it belongs with that feature and its metric,
 * not with the hand-typed note.
 */
@Injectable()
export class TimelineService {
  constructor(
    @Inject(DRIZZLE_APP) private readonly db: CrmDatabase,
    private readonly audit: AuditEventService,
  ) {}

  async add(
    actor: Actor,
    companyId: string,
    dto: CreateTimelineEntryDto,
  ): Promise<TimelineEntryDto> {
    if (actor.kind === 'system') {
      await this.audit.recordRefusal(actor, 'add_timeline_entry', 'timeline_entry', null, {
        reason: 'zone 4 writes `system_entry` through the watch cycle, never this endpoint',
      })
      throw new ForbiddenException('Hệ thống không ghi dòng thời gian qua đường này')
    }

    const [created] = await this.db
      .insert(timelineEntries)
      .values({
        companyId,
        entryType: dto.entryType,
        occurredAt: new Date(dto.occurredAt),
        description: dto.description,
        contactId: dto.contactId ?? null,
        // Typed by a person, so it is `human` — the label on the row is read from this.
        createdBy: 'human',
      })
      .returning({ id: timelineEntries.id })

    const entries = await this.listByCompany(companyId)
    return entries.find((entry) => entry.id === created.id) as TimelineEntryDto
  }

  async listByCompany(companyId: string): Promise<TimelineEntryDto[]> {
    const rows = await this.db
      .select({
        id: timelineEntries.id,
        companyId: timelineEntries.companyId,
        entryType: timelineEntries.entryType,
        occurredAt: timelineEntries.occurredAt,
        description: timelineEntries.description,
        contactId: timelineEntries.contactId,
        contactName: contacts.name,
        createdBy: timelineEntries.createdBy,
        sourceClaimId: timelineEntries.sourceClaimId,
        createdAt: timelineEntries.createdAt,
      })
      .from(timelineEntries)
      // LEFT, not INNER: an entry keeps its place after the contact it named was deleted.
      .leftJoin(contacts, eq(contacts.id, timelineEntries.contactId))
      .where(eq(timelineEntries.companyId, companyId))
      .orderBy(desc(timelineEntries.occurredAt), desc(timelineEntries.createdAt))

    return rows.map((row) => ({
      ...row,
      occurredAt: row.occurredAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    }))
  }
}

import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, asc, desc, eq, ne } from 'drizzle-orm'

import type { ContactDto, CreateContactDto, UpdateContactDto } from '@crm/contracts'
import { type CrmDatabase, contacts, timelineEntries } from '@crm/db'

import { DRIZZLE_APP } from '../../common/db/db.module'
import { AuditEventService } from '../../common/audit/audit-event-service'
import type { Actor } from '../../common/actor/actor-context'

/**
 * People are Sales' data end to end → `DRIZZLE_APP` ONLY. `crm_system` holds SELECT on
 * `contacts` and nothing more: the AI reads who the contact is in order to interpret news,
 * it never writes people data. A system pool injected here would be a door with no use.
 */
@Injectable()
export class ContactService {
  constructor(
    @Inject(DRIZZLE_APP) private readonly db: CrmDatabase,
    private readonly audit: AuditEventService,
  ) {}

  async create(actor: Actor, dto: CreateContactDto): Promise<ContactDto> {
    await this.refuseSystem(actor, 'create_contact', null)

    const created = await this.db.transaction(async (tx) => {
      // Demote first, promote second. The partial unique index below allows exactly one
      // primary per company, so the reverse order would collide with the existing PIC.
      if (dto.isPrimary) await demoteCurrentPrimary(tx, dto.companyId)

      const [row] = await tx
        .insert(contacts)
        .values({
          companyId: dto.companyId,
          name: dto.name,
          title: dto.title ?? null,
          email: dto.email ?? null,
          isPrimary: dto.isPrimary ?? false,
        })
        .returning()

      return row
    })

    return toDto(created)
  }

  /**
   * Setting a new PIC DEMOTES the previous one instead of refusing. Making Sales untick the
   * old person first would be two actions for one intention, and the intention is never
   * ambiguous: "this person is now the main contact" says what happens to the other one.
   *
   * Both writes sit in one transaction because between them the company has no primary
   * contact at all — a state no reader should ever be able to observe.
   */
  async update(actor: Actor, contactId: string, dto: UpdateContactDto): Promise<ContactDto> {
    await this.refuseSystem(actor, 'update_contact', contactId)

    const updated = await this.db.transaction(async (tx) => {
      const [current] = await tx.select().from(contacts).where(eq(contacts.id, contactId))
      if (!current) throw new NotFoundException('Không tìm thấy người liên hệ')

      if (dto.isPrimary) await demoteCurrentPrimary(tx, current.companyId, contactId)

      const [row] = await tx
        .update(contacts)
        .set({
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.email !== undefined ? { email: dto.email } : {}),
          ...(dto.isPrimary !== undefined ? { isPrimary: dto.isPrimary } : {}),
          updatedAt: new Date(),
        })
        .where(eq(contacts.id, contactId))
        .returning()

      return row
    })

    return toDto(updated)
  }

  /**
   * `timeline_entries.contact_id` has NO `ON DELETE` clause, so deleting a person whose name
   * appears on a logged call fails on the foreign key. Detaching the entries in the SAME
   * transaction keeps the history — the call still happened, and losing the record of it to
   * tidy up a contact list would be the worse outcome. It also needs no migration.
   */
  async remove(actor: Actor, contactId: string): Promise<void> {
    await this.refuseSystem(actor, 'delete_contact', contactId)

    await this.db.transaction(async (tx) => {
      await tx
        .update(timelineEntries)
        .set({ contactId: null })
        .where(eq(timelineEntries.contactId, contactId))

      await tx.delete(contacts).where(eq(contacts.id, contactId))
    })
  }

  async listByCompany(companyId: string): Promise<ContactDto[]> {
    const rows = await this.db
      .select()
      .from(contacts)
      .where(eq(contacts.companyId, companyId))
      // The PIC first: it is the one name a Sales opening the company is looking for.
      .orderBy(desc(contacts.isPrimary), asc(contacts.name))

    return rows.map(toDto)
  }

  /** Autonomy: contacts are outside every zone the AI may write in (ontology section 5). */
  private async refuseSystem(actor: Actor, action: string, entityId: string | null): Promise<void> {
    if (actor.kind !== 'system') return

    await this.audit.recordRefusal(actor, action, 'contact', entityId, {
      reason: 'people data is written by Sales only; `crm_system` holds SELECT alone',
    })
    throw new ForbiddenException('Hệ thống không được thay đổi người liên hệ')
  }
}

/** `tx` rather than the pool: the demote and the promote must not be observable apart. */
async function demoteCurrentPrimary(
  tx: Parameters<Parameters<CrmDatabase['transaction']>[0]>[0],
  companyId: string,
  exceptContactId?: string,
): Promise<void> {
  const conditions = [eq(contacts.companyId, companyId), eq(contacts.isPrimary, true)]
  if (exceptContactId) conditions.push(ne(contacts.id, exceptContactId))

  await tx.update(contacts).set({ isPrimary: false, updatedAt: new Date() }).where(and(...conditions))
}

function toDto(row: typeof contacts.$inferSelect): ContactDto {
  return {
    id: row.id,
    companyId: row.companyId,
    name: row.name,
    title: row.title,
    email: row.email,
    isPrimary: row.isPrimary,
  }
}

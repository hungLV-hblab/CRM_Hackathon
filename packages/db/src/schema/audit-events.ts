import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

/**
 * ontology 3.4 and section 4 — "Hệ thống đã từ chối thao tác đổi giai đoạn của actor
 * `system`" (`rejected_action_of`).
 *
 * This is why the domain layer of ADR-0004 is not redundant even with the database layer in
 * place: Postgres only answers `ERROR: permission denied for table opportunities`, an empty
 * sentence that names neither the caller, the intent, nor the row. This table holds the
 * "why it was refused" that round 2 will ask for.
 *
 * `crm_system` has SELECT and INSERT (it must be able to record its own refusals) but no
 * UPDATE or DELETE — an audit trail you can edit is not an audit trail.
 */
export const auditEvents = pgTable('audit_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** `human` | `system` — who the action was performed under. See `Actor` in apps/api. */
  actor: text('actor').notNull(),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: text('entity_id'),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  detail: jsonb('detail'),
})

export type AuditEvent = typeof auditEvents.$inferSelect

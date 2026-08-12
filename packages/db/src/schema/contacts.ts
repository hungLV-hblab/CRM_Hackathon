import { boolean, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

import { companies } from './companies'

/**
 * ontology 3.1 — "Contact làm việc cho Company" (`works_for`).
 *
 * `isPrimary` is the PIC ("đầu mối chính") and the ontology says EXACTLY ONE per company.
 * A plain unique index on `(company_id, is_primary)` would only allow one `false` too, so
 * the constraint has to be PARTIAL: unique on `company_id` among the rows where the flag is
 * set. Everything else is free to be `false`.
 *
 * `crm_system` has SELECT only: the AI reads who the contact is in order to interpret news,
 * it never writes people data.
 */
export const contacts = pgTable(
  'contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    name: text('name').notNull(),
    title: text('title'),
    email: text('email'),
    isPrimary: boolean('is_primary').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('contacts_one_primary_per_company')
      .on(table.companyId)
      .where(sql`${table.isPrimary}`),
  ],
)

export type Contact = typeof contacts.$inferSelect

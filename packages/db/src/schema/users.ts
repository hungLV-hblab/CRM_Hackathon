import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

import { userRoleEnum } from './enums'

/**
 * ontology section 1: exactly two roles — `sales` (owns every company; this module does NOT
 * do per-owner authorization) and `admin` (reads quality metrics, tunes parameters, turns
 * the AI off).
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  role: userRoleEnum('role').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type User = typeof users.$inferSelect

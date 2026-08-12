import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

import { autoNextStepEvents } from './auto-next-step-events'
import { users } from './users'

/**
 * ontology 3.3 — "thông báo trong sản phẩm". The other half of the zone 3 safety mechanism:
 * the AI writing without asking is only acceptable if Sales is told IMMEDIATELY and can undo
 * in one click (CLAUDE.md section 4).
 *
 * `readAt` is nullable with NO default, and `crm_system` has no privilege on it (ADR-0015).
 * That combination is the guarantee behind ontology 3.3's "không tự biến mất trước khi
 * `read_at` có giá trị": the AI can raise a notification but cannot mark it read on Sales'
 * behalf, so a T-6 notification cannot be silently swallowed by the system that caused it.
 *
 * `crm_system` also holds no UPDATE and no DELETE here, for the same reason.
 */
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    /** What happened. Clicking the notification leads to the undo button for this event. */
    autoEventId: uuid('auto_event_id').references(() => autoNextStepEvents.id),
    message: text('message').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    /** NULL means unread. Written by `crm_app` when Sales actually looks at it. */
    readAt: timestamp('read_at', { withTimezone: true }),
  },
  (table) => [index('notifications_user_created_at_idx').on(table.userId, table.createdAt)],
)

export type Notification = typeof notifications.$inferSelect

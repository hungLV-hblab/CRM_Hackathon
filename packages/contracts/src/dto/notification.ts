import { z } from 'zod'

import { booleanQuerySchema, paginationQuerySchema } from './pagination'

/**
 * ontology 3.3 — "thông báo trong sản phẩm". Half of the zone 3 safety mechanism: the system
 * writing to official data without asking is only acceptable if Sales is told immediately and
 * the undo button is one click away (CLAUDE.md section 4).
 *
 * `readAt === null` means unread, and ontology 3.3 forbids a notification from disappearing
 * before it is read — so the list is filtered on the client by this field, never expired by a
 * timer.
 *
 * `undoDeadline` and `canUndo` travel WITH the notification so the row can show a live "Hoàn
 * tác" button without a second request. `canUndo` is computed by the API against server time:
 * a client comparing its own clock to the deadline would offer an undo that then fails.
 */
/**
 * ONE endpoint, two callers. The strip on the deal board asks for the unread ones; `/thong-bao`
 * asks for the history. A second endpoint differing by a `WHERE` would give "a notice does not
 * disappear before it is read" two implementations, and only one of them would stay true.
 *
 * `unreadOnly` uses `booleanQuerySchema`, never `z.coerce.boolean()` — see ADR-0047 for the bug
 * that choice prevents.
 */
export const listNotificationsQuerySchema = paginationQuerySchema.extend({
  unreadOnly: booleanQuerySchema,
})

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>

export interface NotificationDto {
  id: string
  message: string
  createdAt: string
  readAt: string | null
  /** The zone 3 write this notice is about. NULL only for notices with no undoable event. */
  autoEventId: string | null
  undoDeadline: string | null
  canUndo: boolean
}

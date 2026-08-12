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

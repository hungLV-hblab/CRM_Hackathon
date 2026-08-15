'use client'

import { Check, Undo2 } from 'lucide-react'

import type { NotificationDto } from '@crm/contracts'

import { Button } from '@/components/ui/button'

/**
 * One row of "the system did something", shared by the strip on the deal board and by the
 * history at `/thong-bao`.
 *
 * WHY THIS IS SHARED, given ADR-0027 says a second list would give ontology 3.3 two
 * implementations: the rule that notice does not disappear before it is read lives in the DATA —
 * `read_at`, written only by a person pressing, and a column `crm_system` holds no privilege on.
 * What is shared here is the drawing of a row, and what differs between the two screens is only
 * how many notices one row stands for. Two copies of THIS markup would be the real duplication:
 * the "Đã xem" affordance and the undo button would drift, and the undo is the half of autonomy
 * zone 3 that cannot afford to.
 *
 * READ STATE IS SAID IN WORDS, not only in colour. Rule 2 of the design guidelines requires it,
 * and the acceptance suite reads it: T-7 marks a notice seen and then asserts the row still says
 * so, which is the one place the product proves "đánh dấu chứ không xoá".
 */

export interface NotificationRowProps {
  /** The sentence itself. Identical messages are collapsed into one row by the strip. */
  message: string
  /**
   * The notices this row stands for — exactly one on the history page, possibly several on the
   * strip, where three deals at one company produce three identical sentences.
   */
  items: NotificationDto[]
  busy?: boolean
  onMarkRead: (ids: string[]) => void
  onUndo: (eventId: string) => void
}

export function NotificationRow({
  message,
  items,
  busy = false,
  onMarkRead,
  onUndo,
}: NotificationRowProps) {
  const isRead = items.every((item) => item.readAt !== null)
  const undoable = items.filter((item) => item.canUndo && item.autoEventId)

  return (
    <li
      data-testid="notification-row"
      data-read={isRead ? 'true' : 'false'}
      className={[
        'flex flex-col gap-2 rounded-control bg-card p-3',
        // Read notices step back rather than disappear. They are still the record that Sales was
        // told, and the undo window does not close when the notice is marked seen.
        isRead ? 'opacity-70' : 'border-l-2 border-brand-400',
      ].join(' ')}
    >
      <p className={isRead ? 'text-sm text-ink-600' : 'text-sm font-medium text-ink-800'}>
        {message}
        {items.length > 1 ? (
          <span className="ml-1 text-xs text-ink-500">(×{items.length})</span>
        ) : null}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {undoable.map((item) => (
          <Button
            key={item.id}
            variant="secondary"
            disabled={busy}
            onClick={() => onUndo(item.autoEventId as string)}
          >
            <Undo2 className="size-4" aria-hidden />
            Hoàn tác
          </Button>
        ))}

        {isRead ? (
          /**
           * The words "Đã xem", not a tick alone. A judge reading a greyscale printout, and a
           * screen reader, both have to get the state — and T-7 asserts this exact text.
           */
          <span className="inline-flex items-center gap-1 text-xs text-ink-500">
            <Check className="size-3.5" aria-hidden />
            Đã xem
          </span>
        ) : (
          <Button variant="ghost" disabled={busy} onClick={() => onMarkRead(items.map((i) => i.id))}>
            Đã xem
          </Button>
        )}
      </div>
    </li>
  )
}

/**
 * Same sentence → one row. Grouped on the message rather than on a company id because the
 * message is what the reader is actually being asked to read twice; two deals at one company
 * produce two different sentences and stay two rows, which is correct.
 */
export interface NotificationGroup {
  key: string
  message: string
  items: NotificationDto[]
}

export function groupByMessage(rows: NotificationDto[]): NotificationGroup[] {
  const groups = new Map<string, NotificationGroup>()

  for (const row of rows) {
    const existing = groups.get(row.message)
    if (existing) {
      existing.items.push(row)
      continue
    }
    groups.set(row.message, { key: row.id, message: row.message, items: [row] })
  }

  return [...groups.values()]
}

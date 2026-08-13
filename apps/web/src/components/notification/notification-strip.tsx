'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'

import type { NotificationDto } from '@crm/contracts'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api-client'

/**
 * "Thông báo trong sản phẩm" — the half of autonomy zone 3 that says Sales finds out the
 * moment the system writes, not the next time they happen to open the deal.
 *
 * ONE component, TWO places (ADR-0027): a strip at the top of the deal board, and the full
 * history at `/thong-bao`. The strip exists because the app has no shared navigation, so a
 * standalone route would be a page nobody walks past; the route exists because a strip alone
 * loses every notice the moment it is marked seen.
 *
 * GROUPED BY NEWS, not by deal. A company with three open deals gets three writes and three
 * notices — each with its own undo, which ADR-0005 B1 requires — but reading "the system did
 * something" three times in a row is noise. So identical messages collapse into one row with a
 * count, and the row still carries every notice underneath it.
 *
 * `read_at` is written by PRESSING "Đã xem" and by nothing else. Not by scrolling past, not by
 * opening the page. That is what makes ontology 3.3's "không tự biến mất trước khi `read_at` có
 * giá trị" something a judge can watch happen rather than something we assert.
 */

export interface NotificationStripProps {
  /**
   * `unread` — the strip on the deal board, which must not turn into a wall of history.
   * `all` — the `/thong-bao` route, where the point is that nothing was lost.
   */
  show: 'unread' | 'all'
  /** The strip links onward; the full route is already there, so it does not. */
  showLink?: boolean
}

export function NotificationStrip({ show, showLink = false }: NotificationStripProps) {
  const queryClient = useQueryClient()

  const notifications = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.listNotifications(),
  })

  const markRead = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map((id) => api.markNotificationRead(id))),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const undo = useMutation({
    mutationFn: (eventId: string) => api.undoAutoNextStep(eventId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['opportunities'] }),
        queryClient.invalidateQueries({ queryKey: ['auto-next-steps'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      ])
    },
  })

  const rows = notifications.data ?? []
  const visible = show === 'unread' ? rows.filter((row) => row.readAt === null) : rows
  const groups = groupByMessage(visible)

  if (notifications.isLoading) return null

  if (groups.length === 0) {
    return show === 'all' ? (
      <p className="rounded-control bg-ink-50 p-4 text-sm text-ink-600">
        Chưa có thông báo nào. Khi hệ thống tự đặt Việc tiếp theo, thông báo sẽ xuất hiện ở đây và
        ở đầu bảng cơ hội.
      </p>
    ) : null
  }

  return (
    <section
      aria-label="Thông báo"
      data-testid="notification-strip"
      className="flex flex-col gap-2 rounded-card border border-machine-200 bg-machine-50 p-3"
    >
      <header className="flex flex-wrap items-center gap-2">
        <Badge tone="system">Hệ thống đã tự làm {groups.length} việc</Badge>
        {showLink ? (
          <Link
            href="/thong-bao"
            className="ml-auto text-xs text-ink-600 underline underline-offset-2"
          >
            Xem tất cả thông báo
          </Link>
        ) : null}
      </header>

      <ul className="flex flex-col gap-2">
        {groups.map((group) => (
          <li
            key={group.key}
            data-testid="notification-row"
            className="flex flex-col gap-2 rounded-control bg-white p-3"
          >
            <p className="text-sm text-ink-800">
              {group.message}
              {group.items.length > 1 ? (
                <span className="ml-1 text-xs text-ink-500">(×{group.items.length})</span>
              ) : null}
            </p>

            <div className="flex flex-wrap items-center gap-2">
              {group.items
                .filter((item) => item.canUndo && item.autoEventId)
                .map((item) => (
                  <Button
                    key={item.id}
                    variant="secondary"
                    disabled={undo.isPending}
                    onClick={() => undo.mutate(item.autoEventId as string)}
                  >
                    Hoàn tác
                  </Button>
                ))}

              <Button
                variant="ghost"
                disabled={markRead.isPending}
                onClick={() => markRead.mutate(group.items.map((item) => item.id))}
              >
                Đã xem
              </Button>

              {group.items.every((item) => item.readAt !== null) ? (
                <span className="text-xs text-ink-500">Đã xem</span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {undo.isError ? (
        <p role="alert" className="rounded-control bg-danger-surface p-2 text-sm text-danger">
          {(undo.error as Error).message}
        </p>
      ) : null}
    </section>
  )
}

interface NotificationGroup {
  key: string
  message: string
  items: NotificationDto[]
}

/**
 * Same sentence → one row. Grouped on the message rather than on a company id because the
 * message is what the reader is actually being asked to read twice; two deals at one company
 * produce two different sentences and stay two rows, which is correct.
 */
function groupByMessage(rows: NotificationDto[]): NotificationGroup[] {
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

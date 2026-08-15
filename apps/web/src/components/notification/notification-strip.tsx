'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { ErrorState } from '@/components/ui/error-state'
import { NotificationRow, groupByMessage } from './notification-row'
import { api } from '@/lib/api-client'

/**
 * "Thông báo trong sản phẩm" — the half of autonomy zone 3 that says Sales finds out the
 * moment the system writes, not the next time they happen to open the deal.
 *
 * UNREAD ONLY. The strip exists to nag; the history lives at `/thong-bao`, which since ADR-0046's
 * pass has its own screen with paging and a mark-everything control. This component used to serve
 * both through a `show` prop, and dropping it removed a branch that no longer had a second
 * caller — the row markup they really shared is now `NotificationRow`.
 *
 * GROUPED BY NEWS, not by deal. A company with three open deals gets three writes and three
 * notices — each with its own undo, which ADR-0005 B1 requires — but reading "the system did
 * something" three times in a row is noise. Identical messages collapse into one row with a
 * count, and the row still carries every notice underneath it.
 *
 * `read_at` is written by PRESSING "Đã xem" and by nothing else. Not by scrolling past, not by
 * opening the page. That is what makes ontology 3.3's "không tự biến mất trước khi `read_at` có
 * giá trị" something a judge can watch happen rather than something we assert.
 */

/**
 * A ceiling rather than a solution: this component has no pager, so it asks for one large page.
 * If a person ever has more unread notices than this, the problem is the volume the watch cycle
 * is producing, not the strip — and `/thong-bao` is the paged view that still reaches them all.
 */
const PAGE_SIZE = 100

const PARAMS = { page: 1, pageSize: PAGE_SIZE, unreadOnly: true }

export interface NotificationStripProps {
  /** The strip links onward; the history page is already there, so it does not link back. */
  showLink?: boolean
}

export function NotificationStrip({ showLink = false }: NotificationStripProps) {
  const queryClient = useQueryClient()

  /**
   * THE KEY CARRIES THE REQUEST (ADR-0047). A constant key over two different query strings means
   * whichever component mounts first fills the cache for both — opening the deal board and then
   * `/thong-bao` would show the unread subset there as though it were the whole history, the one
   * thing that route exists to prevent.
   */
  const notifications = useQuery({
    queryKey: ['notifications', PARAMS],
    queryFn: () => api.listNotifications(PARAMS),
  })

  /** Prefix match: every page and both modes are stale once a notice changes state. */
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['notifications'] })

  const markRead = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map((id) => api.markNotificationRead(id))),
    onSuccess: invalidate,
  })

  const undo = useMutation({
    mutationFn: (eventId: string) => api.undoAutoNextStep(eventId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['opportunities'] }),
        queryClient.invalidateQueries({ queryKey: ['auto-next-steps'] }),
        invalidate(),
      ])
    },
  })

  // The server applied `unreadOnly`, so there is nothing left to filter here.
  const groups = groupByMessage(notifications.data?.items ?? [])

  if (notifications.isLoading || groups.length === 0) return null

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
          <NotificationRow
            key={group.key}
            message={group.message}
            items={group.items}
            busy={markRead.isPending || undo.isPending}
            onMarkRead={(ids) => markRead.mutate(ids)}
            onUndo={(eventId) => undo.mutate(eventId)}
          />
        ))}
      </ul>

      {undo.isError ? <ErrorState error={undo.error} fallback="Không hoàn tác được" /> : null}
    </section>
  )
}

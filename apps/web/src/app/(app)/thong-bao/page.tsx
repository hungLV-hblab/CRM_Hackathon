'use client'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/ui/error-state'
import { NotificationRow } from '@/components/notification/notification-row'
import { PageBody } from '@/components/shell/page-body'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api-client'

/**
 * The full history of what the system did without asking — read and unread together.
 *
 * WHY THE ROUTE EXISTS (ADR-0027): pressing "Đã xem" removes a notice from the strip on the deal
 * board while the 7-day undo window is still open. Without this page, dismissing the notice would
 * take the only remaining path to the undo with it. So nothing here may filter by read state, and
 * a read notice keeps its Hoàn tác button for as long as the window lasts.
 *
 * WHY IT IS NO LONGER THE STRIP WITH A DIFFERENT PROP: the strip's job is to nag about what is
 * unread, and this page's job is to prove nothing was lost. Those want opposite layouts — one
 * collapses duplicates and hides what is read, the other lists every notice in order and shows
 * its state. What the two genuinely share is the drawing of a row, and that is now
 * `NotificationRow`. The rule ontology 3.3 cares about never lived in the layout: it lives in
 * `read_at`, written only by a person pressing, on a column `crm_system` has no privilege over.
 */

/** Twenty rows is roughly one screen of history without a scroll marathon. */
const PAGE_SIZE = 20

export default function NotificationsPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)

  const params = { page, pageSize: PAGE_SIZE, unreadOnly: false }

  const notifications = useQuery({
    queryKey: ['notifications', params],
    queryFn: () => api.listNotifications(params),
    /** Turning a page keeps the previous one on screen rather than flashing an empty list. */
    placeholderData: keepPreviousData,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['notifications'] })

  const markRead = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map((id) => api.markNotificationRead(id))),
    onSuccess: invalidate,
  })

  const markAllRead = useMutation({
    mutationFn: () => api.markAllNotificationsRead(),
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

  const rows = notifications.data?.items ?? []
  const total = notifications.data?.total ?? 0
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const unreadOnPage = rows.filter((row) => row.readAt === null).length
  const busy = markRead.isPending || markAllRead.isPending || undo.isPending

  return (
    <PageBody>
      <header>
        <Link href="/co-hoi" className="text-sm text-ink-600 underline underline-offset-2">
          ← Cơ hội
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Thông báo</h1>
        <p className="mt-1 text-sm text-ink-600">
          Mọi lần hệ thống tự ghi vào dữ liệu của bạn đều được báo ở đây, kể cả những thông báo
          bạn đã bấm “Đã xem”. Cửa sổ hoàn tác kéo dài 7 ngày, không phụ thuộc vào việc đã xem hay
          chưa.
        </p>
      </header>

      {notifications.isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20 w-full rounded-control" />
          <Skeleton className="h-20 w-full rounded-control" />
        </div>
      ) : null}

      {!notifications.isLoading && total === 0 ? (
        <p className="rounded-control bg-ink-50 p-4 text-sm text-ink-600">
          Chưa có thông báo nào. Khi hệ thống tự đặt Việc tiếp theo, thông báo sẽ xuất hiện ở đây
          và ở đầu bảng cơ hội.
        </p>
      ) : null}

      {total > 0 ? (
        <section
          aria-label="Lịch sử thông báo"
          data-testid="notification-history"
          className="flex flex-col gap-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-ink-600">
              {total} thông báo{unreadOnPage > 0 ? ` · ${unreadOnPage} chưa xem trên trang này` : ''}
            </p>
            {/**
             * One press, many notices — still a person pressing, which is all ontology 3.3 asks.
             * It cannot be undone: nothing records what `read_at` was before. Disabled once this
             * page holds nothing unread, so the button never claims work it will not do.
             */}
            <Button
              variant="secondary"
              className="ml-auto"
              disabled={busy || unreadOnPage === 0}
              onClick={() => markAllRead.mutate()}
            >
              Đánh dấu tất cả đã xem
            </Button>
          </div>

          <ul className="flex flex-col gap-2">
            {rows.map((row) => (
              <NotificationRow
                key={row.id}
                message={row.message}
                items={[row]}
                busy={busy}
                onMarkRead={(ids) => markRead.mutate(ids)}
                onUndo={(eventId) => undo.mutate(eventId)}
              />
            ))}
          </ul>

          {lastPage > 1 ? (
            <nav aria-label="Phân trang thông báo" className="flex items-center gap-3">
              <Button
                variant="ghost"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
              >
                ← Trang trước
              </Button>
              <span className="text-sm text-ink-600">
                Trang {page}/{lastPage}
              </span>
              <Button
                variant="ghost"
                disabled={page >= lastPage}
                onClick={() => setPage((current) => current + 1)}
              >
                Trang sau →
              </Button>
            </nav>
          ) : null}
        </section>
      ) : null}

      {undo.isError ? <ErrorState error={undo.error} fallback="Không hoàn tác được" /> : null}
      {markAllRead.isError ? (
        <ErrorState error={markAllRead.error} fallback="Không đánh dấu được" />
      ) : null}
    </PageBody>
  )
}

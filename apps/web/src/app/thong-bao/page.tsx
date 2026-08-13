'use client'

import Link from 'next/link'

import { NotificationStrip } from '@/components/notification/notification-strip'

/**
 * The full history of what the system did without asking — read and unread together.
 *
 * The strip on the deal board is the same component with `show="unread"`, and that is the whole
 * difference between the two screens. Building a second list here would give "a notice does not
 * disappear before it is read" two implementations, and only one of them would stay true.
 *
 * Why the route exists at all when the strip closes T-6 on its own (ADR-0027): pressing "Đã
 * xem" removes a notice from the strip while the 7-day undo window is still open. Without this
 * page, dismissing the notice would take the only remaining path to the undo with it.
 */
export default function NotificationsPage() {
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
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

      <NotificationStrip show="all" />
    </main>
  )
}

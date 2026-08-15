import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'

import type { ListNotificationsQuery, NotificationDto, Paginated } from '@crm/contracts'
import { type CrmDatabase, autoNextStepEvents, notifications } from '@crm/db'

import type { Actor } from '../../common/actor/actor-context'
import { DRIZZLE_APP } from '../../common/db/db.module'

/**
 * ontology 3.3 — "thông báo trong sản phẩm". The half of the zone 3 safety mechanism that says
 * Sales finds out IMMEDIATELY, not the next time they happen to open the deal.
 *
 * Only `crm_app` is injected here, and that is the design rather than an omission. Everything
 * this service does is a person's act: reading their own notices, and marking one seen. The
 * RAISING of a notice belongs to the write that caused it and runs inside that write's
 * transaction under `crm_system` (`auto-next-step-service.ts`) — a notice committed separately
 * from the change it announces can outlive a rolled-back write, or fail to exist for one that
 * succeeded.
 *
 * `read_at` is written HERE and nowhere else. `crm_system` has no privilege on that column
 * (`0003`, ADR-0015), so the system that wrote to official data cannot mark its own notice as
 * seen — which is what makes ontology 3.3's "không tự biến mất trước khi `read_at` có giá trị"
 * a property of the database rather than a promise in a document.
 */
@Injectable()
export class NotificationService {
  constructor(@Inject(DRIZZLE_APP) private readonly dbApp: CrmDatabase) {}

  /**
   * Everything, newest first — read AND unread.
   *
   * Not filtered to unread on the server: the strip on the deal board shows what is waiting
   * while `/thong-bao` is the history, and two endpoints differing by one `WHERE` would be two
   * places to keep the "does not disappear on its own" rule true.
   */
  async list(actor: Actor, query: ListNotificationsQuery): Promise<Paginated<NotificationDto>> {
    const conditions = [eq(notifications.userId, actor.userId as string)]
    if (query.unreadOnly) conditions.push(isNull(notifications.readAt))

    const where = and(...conditions)

    const [{ total }] = await this.dbApp
      .select({ total: sql<number>`count(*)::int` })
      .from(notifications)
      .where(where)

    const rows = await this.dbApp
      .select({
        id: notifications.id,
        message: notifications.message,
        createdAt: notifications.createdAt,
        readAt: notifications.readAt,
        autoEventId: notifications.autoEventId,
        undoDeadline: autoNextStepEvents.undoDeadline,
        undoneAt: autoNextStepEvents.undoneAt,
      })
      .from(notifications)
      .leftJoin(autoNextStepEvents, eq(autoNextStepEvents.id, notifications.autoEventId))
      .where(where)
      /**
       * `id` is the tiebreaker ADR-0047 makes mandatory, not a flourish. `created_at` is not
       * unique: the watch cycle raises several notices inside one transaction, so they share a
       * timestamp exactly, and without a second key their order between two requests is
       * undefined — a row could be served on two pages, or on neither.
       */
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize)

    const now = Date.now()

    const items = rows.map((row) => ({
      id: row.id,
      message: row.message,
      createdAt: row.createdAt.toISOString(),
      readAt: row.readAt?.toISOString() ?? null,
      autoEventId: row.autoEventId,
      undoDeadline: row.undoDeadline?.toISOString() ?? null,
      /**
       * Computed against SERVER time, and false once the event has already been undone. A
       * client comparing its own clock would offer a button that then fails — the one
       * interaction zone 3 cannot afford to fumble.
       */
      canUndo: Boolean(row.undoDeadline && !row.undoneAt && row.undoDeadline.getTime() > now),
    }))

    return { items, total, page: query.page, pageSize: query.pageSize }
  }

  /**
   * "Đã xem" — and only that. Nothing marks a notice read by scrolling past it or by opening
   * the list, because then "it did not disappear before it was read" would stop being
   * observable and start being a claim.
   *
   * THE OWNER IS PART OF THE `WHERE`. It used to select by id and then update by id, with
   * nothing tying either to the caller — so anyone signed in could mark anyone else's notice
   * seen. That is not a privacy nicety: the strip on the deal board shows unread notices only,
   * so marking someone's notice read removed their one prompt that the machine had written to
   * their deal, while the undo window was still open.
   *
   * One statement instead of select-then-update, so there is no window between the check and
   * the write, and a notice belonging to someone else is indistinguishable from one that does
   * not exist.
   */
  async markRead(actor: Actor, notificationId: string): Promise<void> {
    const updated = await this.dbApp
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, actor.userId as string),
        ),
      )
      .returning({ id: notifications.id })

    if (updated.length === 0) throw new NotFoundException('Không tìm thấy thông báo')
  }

  /**
   * "Đánh dấu tất cả đã xem". Still a person pressing something — the rule ontology 3.3 cares
   * about is that `read_at` is never written by the passage of time or by a screen rendering,
   * and one deliberate press for many notices does not break it.
   *
   * ONE WAY. There is no column holding what `read_at` was before, so this cannot be undone and
   * reverting a deployment will not bring the NULLs back. That is a real cost of the button and
   * it is written here rather than discovered later.
   */
  async markAllRead(actor: Actor): Promise<void> {
    await this.dbApp
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(eq(notifications.userId, actor.userId as string), isNull(notifications.readAt)),
      )
  }
}

import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { desc, eq } from 'drizzle-orm'

import type { NotificationDto } from '@crm/contracts'
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
  async list(actor: Actor): Promise<NotificationDto[]> {
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
      .where(eq(notifications.userId, actor.userId as string))
      .orderBy(desc(notifications.createdAt))

    const now = Date.now()

    return rows.map((row) => ({
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
  }

  /**
   * "Đã xem" — and only that. Nothing marks a notice read by scrolling past it or by opening
   * the list, because then "it did not disappear before it was read" would stop being
   * observable and start being a claim.
   */
  async markRead(actor: Actor, notificationId: string): Promise<void> {
    const [row] = await this.dbApp
      .select({ id: notifications.id })
      .from(notifications)
      .where(eq(notifications.id, notificationId))
      .limit(1)

    if (!row) throw new NotFoundException('Không tìm thấy thông báo')

    await this.dbApp
      .update(notifications)
      .set({ readAt: new Date() })
      .where(eq(notifications.id, notificationId))
  }
}

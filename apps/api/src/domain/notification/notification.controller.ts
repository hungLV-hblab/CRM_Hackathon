import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'

import { type ListNotificationsQuery, listNotificationsQuerySchema } from '@crm/contracts'

import { JwtGuard } from '../../auth/jwt.guard'
import { NotificationService } from './notification-service'
import { ZodValidationPipe } from '../../common/zod-validation.pipe'
import { getCurrentActor } from '../../common/actor/actor-context'

/**
 * Two routes, and there is no third. Notably absent: anything that CREATES a notification.
 * A notice exists because a write happened, so it is raised inside that write's transaction —
 * an endpoint for it would be a way to announce something that never occurred.
 *
 * Equally absent: a way to delete one. The notices are the record that the system told Sales
 * what it had done, which is one third of what buys autonomy zone 3 its privilege.
 */
@Controller('notifications')
@UseGuards(JwtGuard)
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  /**
   * Paginated, and still ONE route for both readers: the strip asks with `unreadOnly=true`, the
   * history page asks without it. Two endpoints differing by a `WHERE` would be two places to
   * keep ontology 3.3 true, and only one of them would stay that way.
   */
  @Get()
  list(@Query(new ZodValidationPipe(listNotificationsQuerySchema)) query: ListNotificationsQuery) {
    return this.notifications.list(this.actor(), query)
  }

  /**
   * DECLARED BEFORE `:id/read`. Nest matches routes in declaration order, so the other way round
   * "read-all" is read as an id and dies in the UUID pipe — cheap to get wrong, and invisible
   * until somebody presses the button.
   */
  @Post('read-all')
  @HttpCode(204)
  async markAllRead(): Promise<void> {
    await this.notifications.markAllRead(this.actor())
  }

  /** "Đã xem", pressed by a person. The only thing that ever writes `read_at`. */
  @Post(':id/read')
  @HttpCode(204)
  async markRead(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.notifications.markRead(this.actor(), id)
  }

  private actor() {
    const actor = getCurrentActor()
    if (!actor) throw new UnauthorizedException('Thiếu ngữ cảnh người dùng')
    return actor
  }
}

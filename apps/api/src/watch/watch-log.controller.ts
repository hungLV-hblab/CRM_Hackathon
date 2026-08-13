import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'

import {
  type DeleteSystemTimelineEntryDto,
  deleteSystemTimelineEntrySchema,
} from '@crm/contracts'

import { JwtGuard } from '../auth/jwt.guard'
import { SystemTimelineEntryRemovalService } from './system-timeline-entry-removal-service'
import { WatchLogService } from './watch-log-service'
import { ZodValidationPipe } from '../common/zod-validation.pipe'
import { getCurrentActor } from '../common/actor/actor-context'

/**
 * The two HTTP surfaces feature group 5 needs — and they live in the API branch, NOT in
 * `WatchModule`.
 *
 * That distinction has teeth: `WatchModule` is what `APP_ROLE=worker` loads, and the worker
 * serves no HTTP at all (ADR-0011). A controller registered there produces no error anywhere —
 * it simply never answers, and every request 404s with nothing to read in any log. Registering
 * it in `AppModule` through `WatchLogModule` is what makes it reachable.
 *
 * The delete route is nested under the company on purpose: it is one entry on one company's
 * timeline, and the service checks both halves of the path rather than trusting the id alone.
 */
@Controller()
@UseGuards(JwtGuard)
export class WatchLogController {
  constructor(
    private readonly watchLog: WatchLogService,
    private readonly removal: SystemTimelineEntryRemovalService,
  ) {}

  /** Newest first, rolled-up rows in the stream and marked, not filtered away. */
  @Get('watch-cycle-runs')
  list() {
    return this.watchLog.list()
  }

  /**
   * I-13. The body is required and carries the reason — a DELETE with a body is unusual, and the
   * alternative (a reason in the query string) would put the text a person wrote about the
   * machine's mistake into every access log and browser history.
   */
  @Delete('companies/:companyId/timeline/:entryId')
  @HttpCode(204)
  async remove(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Body(new ZodValidationPipe(deleteSystemTimelineEntrySchema))
    dto: DeleteSystemTimelineEntryDto,
  ): Promise<void> {
    await this.removal.remove(this.actor(), companyId, entryId, dto)
  }

  private actor() {
    const actor = getCurrentActor()
    if (!actor) throw new UnauthorizedException('Không xác định được người thao tác')
    return actor
  }
}

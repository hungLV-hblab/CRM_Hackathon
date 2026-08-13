import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'

import { AutoNextStepService } from './auto-next-step-service'
import { JwtGuard } from '../../auth/jwt.guard'
import { getCurrentActor } from '../../common/actor/actor-context'

/**
 * Its own controller rather than two more routes on `opportunity.controller.ts` (ADR-0027).
 * Two reasons, one of them scheduling and one of them not:
 *
 *   - `opportunity.controller.ts` belongs to another person's phase and is a file three people
 *     touch on the last day before freeze;
 *   - these two routes are not about an opportunity, they are about a THING THE SYSTEM DID to
 *     one. The undo takes an event id, not a deal id, and that difference is the whole shape of
 *     autonomy zone 3.
 *
 * There is no route that WRITES a next step as the system. That write only ever happens as a
 * reaction to reading a source, so exposing it over HTTP would be an endpoint for making the
 * machine act without evidence.
 */
@Controller()
@UseGuards(JwtGuard)
export class AutoNextStepController {
  constructor(private readonly autoNextSteps: AutoNextStepService) {}

  /**
   * `opportunityId → what the system wrote`, for the deal board to merge onto the cards it
   * already has. A map, not a list: every card looks itself up rather than scanning.
   */
  @Get('opportunities/auto-next-steps')
  listActive() {
    return this.autoNextSteps.listActive()
  }

  /** One click, 7 days. Returns what the cell was put back to, so the client need not refetch blind. */
  @Post('auto-next-step-events/:id/undo')
  undo(@Param('id', ParseUUIDPipe) id: string) {
    return this.autoNextSteps.undo(this.actor(), id)
  }

  private actor() {
    const actor = getCurrentActor()
    if (!actor) throw new UnauthorizedException('Thiếu ngữ cảnh người dùng')
    return actor
  }
}

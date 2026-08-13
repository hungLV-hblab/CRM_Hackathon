import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'

import { type CreateTimelineEntryDto, createTimelineEntrySchema } from '@crm/contracts'

import { JwtGuard } from '../../auth/jwt.guard'
import { TimelineService } from './timeline-service'
import { ZodValidationPipe } from '../../common/zod-validation.pipe'
import { getCurrentActor } from '../../common/actor/actor-context'

@Controller('companies/:companyId/timeline')
@UseGuards(JwtGuard)
export class TimelineController {
  constructor(private readonly timeline: TimelineService) {}

  /** Newest first, all three kinds merged — the Specs ask for one stream, not three tabs. */
  @Get()
  list(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.timeline.listByCompany(companyId)
  }

  /** Only `activity` and `note`: the schema refuses the two kinds nobody types by hand. */
  @Post()
  add(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body(new ZodValidationPipe(createTimelineEntrySchema)) dto: CreateTimelineEntryDto,
  ) {
    return this.timeline.add(this.actor(), companyId, dto)
  }

  private actor() {
    const actor = getCurrentActor()
    if (!actor) throw new UnauthorizedException('Không xác định được người thao tác')
    return actor
  }
}

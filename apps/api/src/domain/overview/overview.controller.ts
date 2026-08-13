import { Controller, Get, UseGuards } from '@nestjs/common'

import { JwtGuard } from '../../auth/jwt.guard'
import { OverviewService } from './overview-service'

/** Read-only, so no actor is passed down: nothing here writes (ADR-0004). */
@Controller('overview')
@UseGuards(JwtGuard)
export class OverviewController {
  constructor(private readonly overview: OverviewService) {}

  @Get()
  summary() {
    return this.overview.summary()
  }
}

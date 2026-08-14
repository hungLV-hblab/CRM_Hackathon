import { Controller, Get, UseGuards } from '@nestjs/common'

import { MetricsService } from './metrics-service'
import { JwtGuard } from '../../auth/jwt.guard'
import { Roles, RolesGuard } from '../../auth/roles.guard'

/**
 * The numbers behind the admin dashboard (ontology section 7).
 *
 * `@Roles('admin')`, unlike `GET /settings/ai-status` next door: the kill switch's state is
 * something every user needs in order to read their own screens correctly, while auto-accept
 * rate and error-detection rate are how the TEAM is measured. Sales does not need them to do
 * the job, and a rate on the wrong screen invites a reading nobody is there to correct.
 */
@Controller('metrics')
@UseGuards(JwtGuard, RolesGuard)
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @Roles('admin')
  summary() {
    return this.metrics.summary()
  }
}

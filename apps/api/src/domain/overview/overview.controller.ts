import { Controller, Get, Query, UseGuards } from '@nestjs/common'

import { overviewQuerySchema, type OverviewQuery } from '@crm/contracts'

import { JwtGuard } from '../../auth/jwt.guard'
import { getCurrentActor } from '../../common/actor/actor-context'
import { ZodValidationPipe } from '../../common/zod-validation.pipe'
import { OverviewService } from './overview-service'

/** Read-only, so no actor is passed down for WRITES (ADR-0004) — it is read here only to
 * decide whose view to compute. */
@Controller('overview')
@UseGuards(JwtGuard)
export class OverviewController {
  constructor(private readonly overview: OverviewService) {}

  /**
   * A sales actor is pinned to their own view no matter what the query string claims — the
   * dashboard answers "what must I do this morning", and "I" is not negotiable via URL. An
   * admin may look through any sales' eyes (`ownerId`) or at everything (no param), and is
   * the only role that gets the per-sales table.
   */
  @Get()
  summary(@Query(new ZodValidationPipe(overviewQuerySchema)) query: OverviewQuery) {
    const actor = getCurrentActor()
    const isAdmin = actor?.role === 'admin'

    return this.overview.summary({
      ownerId: isAdmin ? query.ownerId : actor?.userId,
      includePerSales: isAdmin,
    })
  }
}

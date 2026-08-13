import { Body, Controller, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common'
import { z } from 'zod'

import { DemoSnapshotService } from './demo-snapshot-service'
import { JwtGuard } from '../auth/jwt.guard'
import { ZodValidationPipe } from '../common/zod-validation.pipe'

/**
 * The demo control surface: switch which stored snapshot counts as a company's source.
 *
 * The schema is declared HERE and not in `@crm/contracts` on purpose. Contracts describe what
 * Sales' client and the API agree on; this endpoint drives the demo, and putting it there
 * would hand every screen a way to change the source without meaning to.
 *
 * Behind `JwtGuard` like everything else. Everything arriving over HTTP is a human
 * (`ActorInterceptor`), and the write goes through `crm_app` — the AI identity has no UPDATE
 * on `companies` at all.
 */
const setSnapshotVariantSchema = z.object({
  variant: z.enum(['before', 'after']),
})

type SetSnapshotVariantDto = z.infer<typeof setSnapshotVariantSchema>

@Controller('demo')
@UseGuards(JwtGuard)
export class DemoController {
  constructor(private readonly snapshots: DemoSnapshotService) {}

  @Post('companies/:id/snapshot-variant')
  setVariant(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(setSnapshotVariantSchema)) dto: SetSnapshotVariantDto,
  ) {
    return this.snapshots.setVariant(id, dto.variant)
  }
}

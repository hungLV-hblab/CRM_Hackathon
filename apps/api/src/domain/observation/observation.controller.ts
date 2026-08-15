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

import { type IngestSnapshotDto, ingestSnapshotSchema } from '@crm/contracts'

import { JwtGuard } from '../../auth/jwt.guard'
import { ObservationService } from './observation-service'
import { ZodValidationPipe } from '../../common/zod-validation.pipe'
import { getCurrentActor } from '../../common/actor/actor-context'
import { ownerScopeFor } from '../../common/actor/owner-scope'

/**
 * The read zone of feature group 2.
 *
 * No `actor` is passed down, and that is deliberate rather than an oversight of ADR-0004's
 * "actor is the first parameter of every write". Creating an `Observation` or a `Claim` is
 * autonomy zone 1: the writer is ALWAYS the AI identity, whoever pressed the button. A service
 * that picked its pool by actor here would write Sales' data through `crm_app` on a human
 * click and through `crm_system` on a watch cycle — the same act recorded under two
 * identities. The guard still applies: only a logged-in user may trigger a read.
 */
@Controller('companies/:companyId')
@UseGuards(JwtGuard)
export class ObservationController {
  constructor(private readonly observations: ObservationService) {}

  /** "Đọc lại nguồn". Idempotent by I-3: same content twice costs one row and zero LLM calls. */
  @Post('observations')
  ingest(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body(new ZodValidationPipe(ingestSnapshotSchema)) dto: IngestSnapshotDto,
  ) {
    return this.observations.ingest(companyId, dto.variant, dto.triggerContext)
  }

  @Get('reading-zone')
  readingZone(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.observations.readingZone(companyId, this.ownerScope())
  }

  /**
   * ADR-0046. Note what this does NOT change: the identity a snapshot is WRITTEN under is still
   * the AI's, per the note at the top of this file. This only answers "may this person look at
   * this company at all", which is a different question from "who is recorded as the author".
   */
  private ownerScope(): string | null {
    const actor = getCurrentActor()
    if (!actor) throw new UnauthorizedException('Không xác định được người thao tác')
    return ownerScopeFor(actor)
  }
}

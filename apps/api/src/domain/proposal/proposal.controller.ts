import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'

import { type DecideProposalDto, decideProposalSchema } from '@crm/contracts'

import { JwtGuard } from '../../auth/jwt.guard'
import { ProposalDecisionService } from './proposal-decision-service'
import { ProposalService } from './proposal-service'
import { ZodValidationPipe } from '../../common/zod-validation.pipe'
import { getCurrentActor } from '../../common/actor/actor-context'
import { ownerScopeFor } from '../../common/actor/owner-scope'

/**
 * Feature group 3 over HTTP. There is no endpoint that CREATES a proposal, and that absence is
 * the design: suggestions are raised by the AI branch while reading a source, and a human-facing
 * "create suggestion" route would be a person doing the machine's half of the work.
 *
 * There is also no route to un-decide one. A decision is the audit trail (ADR-0016), so undoing
 * it would mean deleting a measurement — the metrics of feature group 6 read this table.
 */
@Controller('proposals')
@UseGuards(JwtGuard)
export class ProposalController {
  constructor(
    private readonly proposals: ProposalService,
    private readonly decisions: ProposalDecisionService,
  ) {}

  /**
   * The queue itself: everything still waiting, newest first — for the companies this person
   * looks after (ADR-0046).
   *
   * The role question is answered HERE and the answer passed down as a plain value, matching
   * `OverviewController` and the rule ADR-0045 settled: vai trò is a controller concern. A
   * service that read the actor itself could be handed an empty context by a direct-construction
   * test and quietly default to seeing everything.
   */
  @Get()
  listPending() {
    return this.proposals.listPending(ownerScopeFor(this.actor()))
  }

  /** `companyId → count`, for the "đang có gợi ý chờ duyệt" badges. Scoped identically. */
  @Get('pending-summary')
  pendingSummary() {
    return this.proposals.pendingSummary(ownerScopeFor(this.actor()))
  }

  /**
   * Duyệt / Sửa rồi duyệt / Bỏ. The zod schema already refuses a `reject` with no reason and an
   * `edit` with no value (ADR-0008, I-12), so those two cannot be lost by a client bug.
   */
  @Post(':id/decide')
  @HttpCode(204)
  async decide(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(decideProposalSchema)) dto: DecideProposalDto,
  ): Promise<void> {
    await this.decisions.decide(this.actor(), id, dto)
  }

  /** Reads the ambient actor and passes it DOWN explicitly, per ADR-0004. */
  private actor() {
    const actor = getCurrentActor()
    if (!actor) throw new UnauthorizedException('Thiếu ngữ cảnh người dùng')
    return actor
  }
}

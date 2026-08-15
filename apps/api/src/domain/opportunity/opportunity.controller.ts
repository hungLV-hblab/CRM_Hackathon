import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'

import {
  type CreateOpportunityDto,
  type ReorderOpportunityDto,
  type Stage,
  type UpdateOpportunityDto,
  type UpdateStageDto,
  createOpportunitySchema,
  reorderOpportunitySchema,
  updateOpportunitySchema,
  updateStageSchema,
} from '@crm/contracts'

import { JwtGuard } from '../../auth/jwt.guard'
import { OpportunityService } from './opportunity-service'
import { ZodValidationPipe } from '../../common/zod-validation.pipe'
import { getCurrentActor } from '../../common/actor/actor-context'
import { ownerScopeFor } from '../../common/actor/owner-scope'

/**
 * There is no DELETE here. The Specs ask for "tạo và quản lý cơ hội" and nothing more; a deal
 * that went nowhere is moved to `lost` with a reason, which is the record the lost-reason
 * statistics are built from. Deleting it would erase exactly that.
 */
@Controller('opportunities')
@UseGuards(JwtGuard)
export class OpportunityController {
  constructor(private readonly opportunities: OpportunityService) {}

  @Get()
  list(
    @Query('companyId') companyId?: string,
    @Query('stage') stage?: string,
    @Query('overdueOnly') overdueOnly?: string,
  ) {
    return this.opportunities.list(
      {
        companyId,
        stage: stage as Stage | undefined,
        overdueOnly: overdueOnly === 'true',
      },
      ownerScopeFor(this.actor()),
    )
  }

  @Get(':id')
  byId(@Param('id', ParseUUIDPipe) id: string) {
    return this.opportunities.byId(id)
  }

  @Post()
  create(@Body(new ZodValidationPipe(createOpportunitySchema)) dto: CreateOpportunityDto) {
    return this.opportunities.create(this.actor(), dto)
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateOpportunitySchema)) dto: UpdateOpportunityDto,
  ) {
    return this.opportunities.update(this.actor(), id, dto)
  }

  /**
   * Its own endpoint rather than a field on PATCH, because a stage change is not a field
   * edit: it writes a timeline entry in the same transaction, and it is the one action the
   * system identity is refused outright (T-10).
   *
   * The five optional cells arrive from the transition dialog. Sending none of them is a
   * normal, supported request — that is the "Để trống, bổ sung sau" button.
   */
  @Patch(':id/stage')
  updateStage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateStageSchema)) dto: UpdateStageDto,
  ) {
    const { stage, ...cells } = dto
    return this.opportunities.updateStage(this.actor(), id, stage, cells)
  }

  /**
   * Same-column reorder. Separate from `PATCH :id/stage` because the two mean different
   * things: a stage change is a business event that writes a timeline entry, a reorder is
   * Sales arranging their own board and writes nothing but positions.
   */
  @Patch(':id/board-order')
  reorder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(reorderOpportunitySchema)) dto: ReorderOpportunityDto,
  ) {
    return this.opportunities.reorderOnBoard(this.actor(), id, dto.targetId ?? null)
  }

  private actor() {
    const actor = getCurrentActor()
    if (!actor) throw new UnauthorizedException('Không xác định được người thao tác')
    return actor
  }
}

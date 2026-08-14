import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'

import {
  type SaveCompanySourcesDto,
  type ToggleCompanySourceDto,
  saveCompanySourcesSchema,
  toggleCompanySourceSchema,
} from '@crm/contracts'

import { CompanySourceService } from './company-source-service'
import { JwtGuard } from '../../auth/jwt.guard'
import { ZodValidationPipe } from '../../common/zod-validation.pipe'
import { getCurrentActor } from '../../common/actor/actor-context'

/**
 * TWO LISTS behind one company, on separate routes because they mean separate things (ADR-0036,
 * ADR-0037):
 *
 *   POST   :id/source-candidates      → runs the search, stores what it OFFERED, never the reading list
 *   GET    :id/source-candidates      → those stored suggestions, marked with what is already kept
 *   DELETE :id/source-candidates/:id  → drop one suggestion
 *   POST   :id/sources                → a person ticked some; the only route that writes the reading list
 *   GET    :id/sources                → the reading list, including pages currently switched off
 *   PATCH  :id/sources/:id            → pause or resume one kept page
 *   DELETE :id/sources/:id            → remove one kept page
 *
 * Collapsing the first route into the fourth — one "find and save" call — is the mistake this shape
 * exists to prevent: it would let the AI choose which pages it then draws conclusions from, a third
 * self-write path outside the two exceptions Specs opens (CLAUDE.md section 4).
 *
 * `POST` on the candidates route rather than `GET`, because it spends money and takes 10–20
 * seconds: it is an action someone takes, not a resource they read, and nothing should retry it
 * on their behalf. `GET` on the same path IS a read, and is the one that survives a refresh.
 *
 * `PATCH` on a source rather than `POST` somewhere new: one column of a resource that already
 * exists is changing.
 */
@Controller('companies/:companyId')
@UseGuards(JwtGuard)
export class CompanySourceController {
  constructor(private readonly sources: CompanySourceService) {}

  @Post('source-candidates')
  findCandidates(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.sources.findCandidates(this.actor(), companyId)
  }

  @Get('source-candidates')
  listCandidates(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.sources.listCandidates(companyId)
  }

  @Delete('source-candidates/:candidateId')
  @HttpCode(204)
  async removeCandidate(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('candidateId', ParseUUIDPipe) candidateId: string,
  ): Promise<void> {
    await this.sources.removeCandidate(this.actor(), companyId, candidateId)
  }

  @Get('sources')
  list(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.sources.list(companyId)
  }

  @Patch('sources/:sourceId')
  setEnabled(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('sourceId', ParseUUIDPipe) sourceId: string,
    @Body(new ZodValidationPipe(toggleCompanySourceSchema)) dto: ToggleCompanySourceDto,
  ) {
    return this.sources.setEnabled(this.actor(), companyId, sourceId, dto.enabled)
  }

  @Post('sources')
  save(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body(new ZodValidationPipe(saveCompanySourcesSchema)) dto: SaveCompanySourcesDto,
  ) {
    return this.sources.save(this.actor(), companyId, dto.sources)
  }

  @Delete('sources/:sourceId')
  @HttpCode(204)
  async remove(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('sourceId', ParseUUIDPipe) sourceId: string,
  ): Promise<void> {
    await this.sources.remove(this.actor(), companyId, sourceId)
  }

  /** Same as every other controller: read the actor here, pass it down (ADR-0004). */
  private actor() {
    const actor = getCurrentActor()
    if (!actor) throw new UnauthorizedException('Không xác định được người thao tác')
    return actor
  }
}

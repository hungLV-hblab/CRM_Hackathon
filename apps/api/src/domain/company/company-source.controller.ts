import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'

import { type SaveCompanySourcesDto, saveCompanySourcesSchema } from '@crm/contracts'

import { CompanySourceService } from './company-source-service'
import { JwtGuard } from '../../auth/jwt.guard'
import { ZodValidationPipe } from '../../common/zod-validation.pipe'
import { getCurrentActor } from '../../common/actor/actor-context'

/**
 * The reading list of a company — three routes, and the split between the first two is the
 * feature rather than REST tidiness (ADR-0036).
 *
 *   POST :id/source-candidates → runs the search, returns candidates, WRITES NOTHING
 *   POST :id/sources           → a person ticked some; this is the only route that writes
 *   GET  :id/sources           → the list currently being read
 *
 * Collapsing the first two into one "find and save" call is the mistake this shape exists to
 * prevent: it would let the AI choose which pages it then draws conclusions from, which is a
 * third self-write path outside the two exceptions Specs opens (CLAUDE.md section 4).
 *
 * `POST` on the candidates route rather than `GET`, because it spends money and takes 10–20
 * seconds: it is an action someone takes, not a resource they read, and nothing should retry it
 * on their behalf.
 */
@Controller('companies/:companyId')
@UseGuards(JwtGuard)
export class CompanySourceController {
  constructor(private readonly sources: CompanySourceService) {}

  @Post('source-candidates')
  findCandidates(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.sources.findCandidates(this.actor(), companyId)
  }

  @Get('sources')
  list(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.sources.list(companyId)
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

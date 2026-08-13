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
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'

import {
  type CreateCompanyDto,
  type UpdateCompanyDto,
  createCompanySchema,
  updateCompanySchema,
} from '@crm/contracts'

import { CompanyService } from './company-service'
import { JwtGuard } from '../../auth/jwt.guard'
import { ZodValidationPipe } from '../../common/zod-validation.pipe'
import { getCurrentActor } from '../../common/actor/actor-context'

@Controller('companies')
@UseGuards(JwtGuard)
export class CompanyController {
  constructor(private readonly companies: CompanyService) {}

  /**
   * The controller reads the actor from the ambient context and PASSES IT DOWN explicitly
   * (ADR-0004). Services never read the context themselves — see `actor-context.ts` for why.
   */
  @Post()
  create(@Body(new ZodValidationPipe(createCompanySchema)) dto: CreateCompanyDto) {
    return this.companies.create(this.actor(), dto)
  }

  /** Search by name plus the four filters. Absent parameters widen the list, never empty it. */
  @Get()
  list(
    @Query('q') q?: string,
    @Query('industry') industry?: string,
    @Query('companyType') companyType?: string,
    @Query('country') country?: string,
    @Query('isWatched') isWatched?: string,
  ) {
    return this.companies.list({
      q,
      industry,
      companyType,
      country,
      // Query strings have no booleans: only the literal 'true'/'false' means anything, and
      // anything else has to leave the filter off rather than guess.
      isWatched: isWatched === 'true' ? true : isWatched === 'false' ? false : undefined,
    })
  }

  @Get(':id')
  byId(@Param('id', ParseUUIDPipe) id: string) {
    return this.companies.byId(id)
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateCompanySchema)) dto: UpdateCompanyDto,
  ) {
    return this.companies.update(this.actor(), id, dto)
  }

  /** Soft: the row stays, and everything hanging off it disappears through the join. */
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.companies.softDelete(this.actor(), id)
  }

  private actor() {
    const actor = getCurrentActor()
    if (!actor) throw new UnauthorizedException('Không xác định được người thao tác')
    return actor
  }
}

import { Body, Controller, Get, Post, UnauthorizedException, UseGuards } from '@nestjs/common'

import { type CreateCompanyDto, createCompanySchema } from '@crm/contracts'

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

  @Get()
  list() {
    return this.companies.list()
  }

  private actor() {
    const actor = getCurrentActor()
    if (!actor) throw new UnauthorizedException('Không xác định được người thao tác')
    return actor
  }
}

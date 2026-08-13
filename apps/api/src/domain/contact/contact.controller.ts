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
  type CreateContactDto,
  type UpdateContactDto,
  createContactSchema,
  updateContactSchema,
} from '@crm/contracts'

import { ContactService } from './contact-service'
import { JwtGuard } from '../../auth/jwt.guard'
import { ZodValidationPipe } from '../../common/zod-validation.pipe'
import { getCurrentActor } from '../../common/actor/actor-context'

@Controller()
@UseGuards(JwtGuard)
export class ContactController {
  constructor(private readonly contacts: ContactService) {}

  /** Contacts are read as part of a company, so the list hangs off the company path. */
  @Get('companies/:companyId/contacts')
  listByCompany(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.contacts.listByCompany(companyId)
  }

  @Post('contacts')
  create(@Body(new ZodValidationPipe(createContactSchema)) dto: CreateContactDto) {
    return this.contacts.create(this.actor(), dto)
  }

  /** Sending `isPrimary: true` demotes whoever held it — one request for one intention. */
  @Patch('contacts/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateContactSchema)) dto: UpdateContactDto,
  ) {
    return this.contacts.update(this.actor(), id, dto)
  }

  @Delete('contacts/:id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.contacts.remove(this.actor(), id)
  }

  private actor() {
    const actor = getCurrentActor()
    if (!actor) throw new UnauthorizedException('Không xác định được người thao tác')
    return actor
  }
}

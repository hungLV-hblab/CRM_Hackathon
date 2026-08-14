import { Body, Controller, Get, Patch, UnauthorizedException, UseGuards } from '@nestjs/common'

import { type UpdateSystemSettingsDto, updateSystemSettingsSchema } from '@crm/contracts'

import { SystemSettingService } from './system-setting-service'
import { JwtGuard } from '../auth/jwt.guard'
import { Roles, RolesGuard } from '../auth/roles.guard'
import { ZodValidationPipe } from '../common/zod-validation.pipe'
import { getCurrentActor } from '../common/actor/actor-context'

/**
 * Two admin routes and one that is deliberately NOT admin.
 *
 * `GET /settings` and `PATCH /settings` are `@Roles('admin')`: reading and writing the system
 * parameters is the admin dashboard's job, and the GET is also what acceptance check 2 of the
 * walking skeleton exercises ("Sales → 403 on an admin endpoint").
 *
 * `GET /settings/ai-status` carries no `@Roles` at all, so `RolesGuard` waves it through for any
 * authenticated account (ADR-0032). T-9 requires SALES — not an admin — to see that the machine
 * is off, and a banner cannot hang off an endpoint Sales is forbidden to call. It answers ONE
 * boolean, so nothing admin-only leaks with it.
 *
 * Both routes live in this existing controller rather than in a new module, and that is not
 * tidiness: a module declaring a guarded controller must import `AuthModule` itself, and forgetting
 * it takes the whole API container down with a 502 on the login page while every unit test stays
 * green (phase 7 paid for that lesson).
 */
@Controller('settings')
@UseGuards(JwtGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly settings: SystemSettingService) {}

  @Get()
  @Roles('admin')
  read() {
    return this.settings.readForHuman()
  }

  /** Every logged-in account, Sales included. The banner of T-9 reads this. */
  @Get('ai-status')
  aiStatus() {
    return this.settings.aiStatus()
  }

  /**
   * The AI kill switch and the cycle length. Effective on the next read by both the API and the
   * worker — no restart, because neither side caches this table (ADR-0011).
   */
  @Patch()
  @Roles('admin')
  update(
    @Body(new ZodValidationPipe(updateSystemSettingsSchema)) dto: UpdateSystemSettingsDto,
  ) {
    return this.settings.updateParameters(this.actor(), dto)
  }

  private actor() {
    const actor = getCurrentActor()
    if (!actor) throw new UnauthorizedException('Không xác định được người thao tác')
    return actor
  }
}

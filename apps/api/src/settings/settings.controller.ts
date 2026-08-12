import { Controller, Get, UseGuards } from '@nestjs/common'

import { SystemSettingService } from './system-setting-service'
import { JwtGuard } from '../auth/jwt.guard'
import { Roles, RolesGuard } from '../auth/roles.guard'

/**
 * ADMIN-ONLY endpoint. In the walking skeleton it serves two purposes: it is what acceptance
 * check 2 exercises ("Sales gets a 403 on an admin-only endpoint"), and it is where feature
 * group 6 will hang the admin dashboard.
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
}

import { Module } from '@nestjs/common'

import { DbModule } from '../common/db/db.module'
import { SystemSettingService } from '../settings/system-setting-service'
import { WatchCycleService } from './watch-cycle-service'

/**
 * The `APP_ROLE=worker` branch loads exactly this module (ADR-0011).
 *
 * There is no controller here, and that is enforced discipline rather than coincidence: let
 * the worker load controllers and both containers start serving HTTP, which removes the very
 * reason for splitting them.
 */
@Module({
  imports: [DbModule],
  providers: [SystemSettingService, WatchCycleService],
})
export class WatchModule {}

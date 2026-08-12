import { Module } from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'

import { ActorInterceptor } from './common/actor/actor.interceptor'
import { AuditEventService } from './common/audit/audit-event-service'
import { AuthModule } from './auth/auth.module'
import { CompanyController } from './domain/company/company.controller'
import { CompanyService } from './domain/company/company-service'
import { DbModule } from './common/db/db.module'
import { OpportunityService } from './domain/opportunity/opportunity-service'
import { SettingsController } from './settings/settings.controller'
import { SystemSettingService } from './settings/system-setting-service'

/**
 * The module for the `APP_ROLE=api` branch. It does NOT load `WatchModule` — the watch cycle
 * only runs in the worker branch (ADR-0011), so the two processes keep separate logs and so
 * nobody ends up with two watch cycles by scaling the API container.
 */
@Module({
  imports: [DbModule, AuthModule],
  controllers: [CompanyController, SettingsController],
  providers: [
    AuditEventService,
    CompanyService,
    OpportunityService,
    SystemSettingService,
    { provide: APP_INTERCEPTOR, useClass: ActorInterceptor },
  ],
})
export class AppModule {}

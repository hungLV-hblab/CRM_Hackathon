import { Module } from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'

import { ActorInterceptor } from './common/actor/actor.interceptor'
import { AuditEventService } from './common/audit/audit-event-service'
import { AutoNextStepController } from './domain/opportunity/auto-next-step.controller'
import { AutoNextStepService } from './domain/opportunity/auto-next-step-service'
import { AuthModule } from './auth/auth.module'
import { ClaimReactionService } from './domain/claim/claim-reaction-service'
import { ClaimService } from './domain/claim/claim-service'
import { CompanyController } from './domain/company/company.controller'
import { CompanyService } from './domain/company/company-service'
import { ContactController } from './domain/contact/contact.controller'
import { ContactService } from './domain/contact/contact-service'
import { DbModule } from './common/db/db.module'
import { DemoController } from './demo/demo.controller'
import { DemoSnapshotService } from './demo/demo-snapshot-service'
import { DemoSnapshotSource } from './ai/demo-snapshots'
import { MetricsModule } from './domain/metrics/metrics.module'
import { NotificationController } from './domain/notification/notification.controller'
import { NotificationService } from './domain/notification/notification-service'
import { ObservationController } from './domain/observation/observation.controller'
import { ObservationService } from './domain/observation/observation-service'
import { claimExtractorProvider } from './ai/claim-extractor.provider'
import { OpportunityController } from './domain/opportunity/opportunity.controller'
import { OpportunityService } from './domain/opportunity/opportunity-service'
import { OverviewController } from './domain/overview/overview.controller'
import { OverviewService } from './domain/overview/overview-service'
import { ProposalController } from './domain/proposal/proposal.controller'
import { ProposalDecisionService } from './domain/proposal/proposal-decision-service'
import { ProposalService } from './domain/proposal/proposal-service'
import { TimelineController } from './domain/timeline/timeline.controller'
import { TimelineService } from './domain/timeline/timeline-service'
import { SettingsController } from './settings/settings.controller'
import { SystemSettingService } from './settings/system-setting-service'
import { SystemTimelineEntryService } from './watch/system-timeline-entry-service'
import { WatchLogModule } from './watch/watch-log.module'

/**
 * The module for the `APP_ROLE=api` branch. It does NOT load `WatchModule` — the watch cycle
 * only runs in the worker branch (ADR-0011), so the two processes keep separate logs and so
 * nobody ends up with two watch cycles by scaling the API container.
 */
@Module({
  imports: [DbModule, AuthModule, MetricsModule, WatchLogModule],
  controllers: [
    AutoNextStepController,
    CompanyController,
    ContactController,
    DemoController,
    NotificationController,
    ObservationController,
    OpportunityController,
    OverviewController,
    ProposalController,
    SettingsController,
    TimelineController,
  ],
  providers: [
    AuditEventService,
    AutoNextStepService,
    ClaimReactionService,
    ClaimService,
    CompanyService,
    ContactService,
    DemoSnapshotService,
    DemoSnapshotSource,
    NotificationService,
    ObservationService,
    OpportunityService,
    OverviewService,
    ProposalDecisionService,
    ProposalService,
    SystemSettingService,
    SystemTimelineEntryService,
    TimelineService,
    claimExtractorProvider,
    { provide: APP_INTERCEPTOR, useClass: ActorInterceptor },
  ],
})
export class AppModule {}

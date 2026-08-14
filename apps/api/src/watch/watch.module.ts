import { Module } from '@nestjs/common'

import { AuditEventService } from '../common/audit/audit-event-service'
import { AutoNextStepService } from '../domain/opportunity/auto-next-step-service'
import { ClaimReactionService } from '../domain/claim/claim-reaction-service'
import { ClaimService } from '../domain/claim/claim-service'
import { DbModule } from '../common/db/db.module'
import { DemoSnapshotSource } from '../ai/demo-snapshots'
import { ObservationService } from '../domain/observation/observation-service'
import { ProposalService } from '../domain/proposal/proposal-service'
import { SystemSettingService } from '../settings/system-setting-service'
import { SystemTimelineEntryService } from './system-timeline-entry-service'
import { WatchCycleRollup } from './watch-cycle-rollup'
import { WatchCycleService } from './watch-cycle-service'
import { claimExtractorProvider } from '../ai/claim-extractor.provider'

/**
 * The `APP_ROLE=worker` branch loads exactly this module (ADR-0011).
 *
 * There is no controller here, and that is enforced discipline rather than coincidence: let
 * the worker load controllers and both containers start serving HTTP, which removes the very
 * reason for splitting them. The API-side pages about the watch cycle live in `WatchLogModule`.
 *
 * ── Every provider below is required, and a missing one FAILS LIKE A SUCCESS ─────────────
 * The list is the transitive closure of `WatchCycleService` → `ObservationService` → the whole
 * reaction chain, arrived at by reading each constructor rather than by adding names until the
 * boot stopped complaining. It matters because of how the failure looks: Nest throws at boot,
 * the container exits, Docker restarts it, and the log fills with the beginning of a startup
 * over and over — which is very nearly the shape of the `unref()` restart loop ADR-0011
 * describes. So the acceptance criterion is the line `Starting Nest application`, never the
 * NUMBER of log lines, because a restart loop produces plenty of those.
 *
 * `NotificationService` is deliberately NOT here. Group 4 raises its notice with a direct
 * `INSERT INTO notifications` inside its own transaction, so `AutoNextStepService` needs only
 * the two pools and `AuditEventService`. Adding it would work, and would leave a provider nobody
 * can explain.
 */
@Module({
  imports: [DbModule],
  providers: [
    AuditEventService,
    AutoNextStepService,
    ClaimReactionService,
    ClaimService,
    DemoSnapshotSource,
    ObservationService,
    ProposalService,
    SystemSettingService,
    SystemTimelineEntryService,
    WatchCycleRollup,
    WatchCycleService,
    claimExtractorProvider,
  ],
})
export class WatchModule {}

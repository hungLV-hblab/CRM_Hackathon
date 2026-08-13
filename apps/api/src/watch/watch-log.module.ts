import { Module } from '@nestjs/common'

import { AuditEventService } from '../common/audit/audit-event-service'
import { AuthModule } from '../auth/auth.module'
import { DbModule } from '../common/db/db.module'
import { SystemTimelineEntryRemovalService } from './system-timeline-entry-removal-service'
import { WatchLogController } from './watch-log.controller'
import { WatchLogService } from './watch-log-service'

/**
 * The API-side half of feature group 5 — reading the watch-cycle log and removing an entry the
 * cycle added (I-13).
 *
 * Kept SEPARATE from `WatchModule`, which is the worker's module and has no controller by
 * design. Both modules touch the same feature, and the split is the whole point: the worker runs
 * the loop, the API serves the pages about it, and neither can accidentally start doing the
 * other's job by someone adding a provider to the wrong file.
 */
/**
 * `AuthModule` is imported because `WatchLogController` is guarded, and a guard's dependencies are
 * resolved in the module that DECLARES the controller — not in `AppModule`, which happens to
 * import both. Leaving it out took the whole API container down with
 * `Nest can't resolve dependencies of the JwtGuard`, and the symptom was a 502 on the login page:
 * nothing about it pointed at the watch-cycle log. `AuthModule` exports `JwtModule` and both
 * guards precisely so feature modules can be self-sufficient this way.
 */
@Module({
  imports: [AuthModule, DbModule],
  controllers: [WatchLogController],
  providers: [AuditEventService, SystemTimelineEntryRemovalService, WatchLogService],
})
export class WatchLogModule {}

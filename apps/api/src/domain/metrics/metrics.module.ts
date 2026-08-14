import { Module } from '@nestjs/common'

import { AuthModule } from '../../auth/auth.module'
import { DbModule } from '../../common/db/db.module'
import { MetricsController } from './metrics.controller'
import { MetricsService } from './metrics-service'

/**
 * `AuthModule` is imported because `MetricsController` is guarded, and a guard's dependencies are
 * resolved in the module that DECLARES the controller — not in `AppModule`, which happens to
 * import both.
 *
 * That sentence is written out because of what leaving it out costs: the whole API container fails
 * to boot with `Nest can't resolve dependencies of the JwtGuard`, the symptom is a **502 on the
 * login page** with nothing pointing at metrics, and every unit test stays green. Phase 7 lost
 * time to exactly this on `WatchLogModule`. `watch-module-boots.test.ts` resolves this graph so
 * the mistake goes red in milliseconds instead of on the demo stack.
 */
@Module({
  imports: [AuthModule, DbModule],
  controllers: [MetricsController],
  providers: [MetricsService],
})
export class MetricsModule {}

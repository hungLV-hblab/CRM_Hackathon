import { Test } from '@nestjs/testing'
import { afterEach, describe, expect, it } from 'vitest'

import { AppModule } from '../../app.module'
import { MetricsController } from '../../domain/metrics/metrics.controller'
import { ObservationService } from '../../domain/observation/observation-service'
import { WatchCycleRollup } from '../watch-cycle-rollup'
import { WatchCycleService } from '../watch-cycle-service'
import { WatchLogController } from '../watch-log.controller'
import { WatchLogModule } from '../watch-log.module'
import { WatchModule } from '../watch.module'

/**
 * Does the worker's module graph actually RESOLVE?
 *
 * This test exists because of how the failure it catches presents itself. A provider missing from
 * `WatchModule` throws at boot, the container exits, Docker restarts it, and the log fills with
 * the first lines of a startup, over and over — which is very nearly the shape of the `unref()`
 * restart loop ADR-0011 describes. On the compose stack the two are hard to tell apart by eye,
 * and the natural check ("are there `WatchCycleRun` lines in the log?") lies in both directions:
 * a restart loop produces log lines too.
 *
 * So the module is resolved here, in milliseconds, instead of being discovered on the stack on
 * the last evening. `WatchCycleService` is asked for by name — resolving the module without
 * touching its entry point would pass even if the one provider the worker exists to run were
 * absent.
 *
 * `onModuleInit` is NOT run: that would start the real self-scheduling loop against the test
 * database. The cadence has its own file.
 */

let moduleRef: Awaited<ReturnType<typeof buildWatchModule>> | undefined

async function buildWatchModule() {
  return Test.createTestingModule({ imports: [WatchModule] }).compile()
}

afterEach(async () => {
  await moduleRef?.close()
  moduleRef = undefined
})

describe('the worker module graph', () => {
  it('1 · resolves, and hands back the service the worker exists to run', async () => {
    moduleRef = await buildWatchModule()

    expect(moduleRef.get(WatchCycleService)).toBeInstanceOf(WatchCycleService)
    // Its two collaborators specifically: a graph that resolves the service but not what it needs
    // to scan would still boot and then do nothing every 60 seconds.
    expect(moduleRef.get(ObservationService)).toBeInstanceOf(ObservationService)
    expect(moduleRef.get(WatchCycleRollup)).toBeInstanceOf(WatchCycleRollup)
  })

  /**
   * And the API graph, which is a different graph — this is not belt-and-braces.
   *
   * Measured the hard way: `WatchLogModule` declared a guarded controller without importing
   * `AuthModule`, and a guard's dependencies resolve in the module that DECLARES the controller,
   * not in `AppModule` which imports both. The whole API container then failed to boot, and the
   * symptom was a **502 on the login page** — nothing in it pointed at the watch-cycle log. Only
   * the browser test noticed, and only because it happened to log in.
   */
  it('2 · the API graph resolves too, guards included', async () => {
    const apiModule = await Test.createTestingModule({ imports: [AppModule] }).compile()
    try {
      expect(apiModule.get(WatchLogController)).toBeInstanceOf(WatchLogController)
      /**
       * `MetricsModule` is the second module in the API graph that declares a guarded controller,
       * so it is the second one that must import `AuthModule` itself. Asked for by name for the
       * same reason as the log controller above: a graph that compiles but cannot hand back the
       * controller is a container that boots and then 502s.
       */
      expect(apiModule.get(MetricsController)).toBeInstanceOf(MetricsController)
    } finally {
      await apiModule.close()
    }
  })

  it('3 · the worker has no controller — it serves no HTTP (ADR-0011)', async () => {
    moduleRef = await buildWatchModule()

    /**
     * Guards the split rather than a behaviour: a controller registered here would answer nothing
     * (the worker starts no HTTP server) while looking correct in the source, so every request to
     * it 404s with no error anywhere to read. That is why the watch-cycle log endpoints live in
     * `WatchLogModule`, which the API loads.
     */
    const controllers = Reflect.getMetadata('controllers', WatchModule) ?? []
    expect(controllers).toHaveLength(0)

    const logControllers = Reflect.getMetadata('controllers', WatchLogModule) ?? []
    expect(logControllers.length).toBeGreaterThan(0)
  })
})

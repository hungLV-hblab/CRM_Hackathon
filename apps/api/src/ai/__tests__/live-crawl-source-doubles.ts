import { LiveCrawlSource } from '../live-crawl-source'

/**
 * Test doubles for the live reader. Not a `.test.ts` file, so Vitest does not collect it —
 * `apps/api/vitest.config.mts` includes only files whose name ends in `.test.ts`.
 *
 * Every test written before phase 2 reads stored snapshots, and `ObservationService` now takes a
 * live reader as its eighth argument. Handing those tests a reader that WORKS would quietly make
 * "did this test just fetch something?" unanswerable; handing them one that explodes turns the
 * same question into a failed assertion with a stack trace.
 */

/**
 * A live reader that fails loudly if anything reaches it.
 *
 * This is the shape the acceptance suite needs. T-1…T-10 run on the seed companies, and I-16 says
 * a seed company is never crawled — so in every one of those tests the correct number of live
 * reads is zero, and the way to keep it zero is to make one impossible rather than to remember to
 * check afterwards.
 */
export function liveSourceThatMustNotRun(): LiveCrawlSource {
  return new LiveCrawlSource({
    fetchPage: () => {
      throw new Error(
        'Test này không được đọc web thật. Nếu tới đây thì cửa gác I-16/I-17 đã hỏng.',
      )
    },
    assertAllowed: () => {
      throw new Error(
        'Test này không được đọc web thật. Nếu tới đây thì cửa gác I-16/I-17 đã hỏng.',
      )
    },
  })
}

import { Logger, type Provider } from '@nestjs/common'

import { LiveCrawlSource } from './live-crawl-source'
import { assertPublicUrl } from './assert-public-url'
import { fetchPage } from './fetch-page'

/**
 * Wires the live reader and says so at boot — the same shape as `claim-extractor.provider.ts`,
 * and for the same reason: "which source is this instance actually reading" has to be answerable
 * from the log, never inferred from behaviour. A demo that quietly runs on stored snapshots while
 * the team claims a live read is the failure this log line exists to make impossible.
 *
 * It does NOT choose the source. That choice is per company and per read —
 * `resolveObservationSource` needs `companies.live_source_enabled` and the company id, neither of
 * which exists at boot — so `ObservationService` holds both sources and picks per read. What is
 * decided here is only the configuration the live path will use IF it is ever reached.
 */

/** Values below are the operational budget, not policy. Policy is `resolveObservationSource`. */
const TIMEOUT_MS = 8_000
const MAX_BYTES = 512 * 1024

export const liveCrawlSourceProvider: Provider = {
  provide: LiveCrawlSource,
  useFactory: (): LiveCrawlSource => {
    const logger = new Logger('ObservationSource')
    const configured = process.env.OBSERVATION_SOURCE?.trim()

    if (configured === 'live_crawl') {
      /**
       * `warn`, not `log`. This instance may fetch pages nobody on the team has read, so the line
       * has to be visible in a scrolling console. It also states the two gates that still hold,
       * because "live crawl is on" is not the same as "anything can be crawled": every seed
       * company stays on the snapshot (I-16) and every other company is off until someone opts it
       * in (I-17).
       */
      logger.warn(
        `OBSERVATION_SOURCE=live_crawl → đọc trang web thật được BẬT (timeout ${TIMEOUT_MS}ms, ` +
          `tối đa ${Math.round(MAX_BYTES / 1024)}KB). Công ty thuộc bộ seed vẫn chỉ đọc bản chụp, ` +
          'và công ty khác vẫn cần bật công tắc riêng.',
      )
    } else {
      logger.log(
        `OBSERVATION_SOURCE=${configured ? JSON.stringify(configured) : 'trống'} → chỉ đọc bản ` +
          'chụp. Đây là nhánh mặc định: mọi giá trị khác "live_crawl" đều rơi về đây.',
      )
    }

    return new LiveCrawlSource({
      fetchPage,
      /** The real gate. `fetch-page.test.ts` is the only caller allowed to pass anything else. */
      assertAllowed: assertPublicUrl,
      timeoutMs: TIMEOUT_MS,
      maxBytes: MAX_BYTES,
    })
  },
}

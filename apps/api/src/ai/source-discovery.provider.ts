import { Logger, type Provider } from '@nestjs/common'

import { SOURCE_DISCOVERY, type SourceDiscovery } from '@crm/contracts'

import { AnthropicSourceDiscovery } from './anthropic-source-discovery'
import { FixtureSourceDiscovery } from './fixture-source-discovery'

/**
 * Which adapter sits behind `SOURCE_DISCOVERY`, decided by environment — the same shape as
 * `claim-extractor.provider.ts`, and for the same reason: with no `ANTHROPIC_API_KEY` the fixture
 * takes over, which is the documented rollback and the reason a judge who was never given a key
 * can still run everything.
 *
 * The choice is LOGGED at boot because "was that a real search?" must be answerable from the log
 * rather than inferred from how plausible the URLs look. The fixture derives its suggestions from
 * the company's own website and says so in each `reason`, so the two are also distinguishable
 * from the output itself — but the log line is what makes it checkable before anyone clicks.
 */
export const sourceDiscoveryProvider: Provider = {
  provide: SOURCE_DISCOVERY,
  useFactory: (): SourceDiscovery => {
    const logger = new Logger('SourceDiscovery')
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim()

    if (!apiKey) {
      logger.warn(
        'ANTHROPIC_API_KEY trống → dùng FixtureSourceDiscovery (tất định, không gọi mạng). ' +
          'Ứng viên suy ra từ website đã lưu, KHÔNG phải kết quả tìm kiếm thật.',
      )
      return new FixtureSourceDiscovery()
    }

    const model = process.env.ANTHROPIC_MODEL?.trim() || undefined
    logger.log(`Dùng AnthropicSourceDiscovery với web_search (model ${model ?? 'mặc định'})`)
    return AnthropicSourceDiscovery.fromApiKey(apiKey, model)
  },
}

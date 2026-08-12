import { Logger, type Provider } from '@nestjs/common'

import { CLAIM_EXTRACTOR, type ClaimExtractor } from '@crm/contracts'

import { AnthropicClaimExtractor } from './anthropic-claim-extractor'
import { FixtureClaimExtractor } from './fixture-claim-extractor'

/**
 * Which adapter sits behind the `CLAIM_EXTRACTOR` port, decided by environment (ADR-0014).
 *
 * With no `ANTHROPIC_API_KEY` the fixture adapter takes over, and that is the documented
 * rollback path — the 10-point acceptance suite has to be runnable by a judge who was never
 * given a key. It is also why the choice is LOGGED at boot: "which brain is running" must be
 * answerable from the log, not guessed from behaviour, or a demo can silently run on the
 * fixture while the team claims a real LLM.
 */
export const claimExtractorProvider: Provider = {
  provide: CLAIM_EXTRACTOR,
  useFactory: (): ClaimExtractor => {
    const logger = new Logger('ClaimExtractor')
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim()

    if (!apiKey) {
      logger.warn(
        'ANTHROPIC_API_KEY trống → dùng FixtureClaimExtractor (tất định, không gọi mạng). ' +
          'Phát hiện vẫn có câu trích nguyên văn và vẫn qua đủ các cửa kiểm I-1/I-2.',
      )
      return new FixtureClaimExtractor()
    }

    const model = process.env.ANTHROPIC_MODEL?.trim() || undefined
    logger.log(`Dùng AnthropicClaimExtractor (model ${model ?? 'mặc định'})`)
    return new AnthropicClaimExtractor(apiKey, model)
  },
}

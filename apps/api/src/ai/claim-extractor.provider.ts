import { Logger, type Provider } from '@nestjs/common'

import { CLAIM_EXTRACTOR, type ClaimExtractor } from '@crm/contracts'

import { AgentClaimExtractor } from './agent-claim-extractor'
import { AgentRuntimeClient } from './agent-runtime-client'
import { AnthropicClaimExtractor } from './anthropic-claim-extractor'
import { FixtureClaimExtractor } from './fixture-claim-extractor'

/**
 * Which adapter sits behind the `CLAIM_EXTRACTOR` port, decided by environment (ADR-0014).
 *
 * Three of them now, and the order below is the decision:
 *
 *   1. `AgentClaimExtractor`  — the Claude CLI in `apps/agent-runtime`, on an OAuth
 *                               subscription. Only in the `api` process, never the worker.
 *   2. `AnthropicClaimExtractor` — the SDK on an API key. Rate limits are per request, so this
 *                               is what a timed watch cycle can survive.
 *   3. `FixtureClaimExtractor`  — deterministic, no network. The documented rollback: the
 *                               10-point acceptance suite has to run for a judge who was given
 *                               no credential at all.
 *
 * THE WORKER SKIPS BRANCH 1 ON PURPOSE. A subscription is rate limited per session and the
 * runtime runs one job at a time; a scan fanning out over every watched company every 60s would
 * spend the quota in seconds and then fail for the person actually pressing a button. The watch
 * cycle stays on the SDK or the fixture — see `watch-cycle-service.ts` for why a cycle that
 * cannot finish is worse than one that never ran.
 *
 * The choice is LOGGED at boot for the reason it always was: "which brain is running" must be
 * answerable from the log, not guessed from behaviour, or a demo can quietly run on the fixture
 * while the team claims a real model.
 */
export const claimExtractorProvider: Provider = {
  provide: CLAIM_EXTRACTOR,
  useFactory: (): ClaimExtractor => {
    const logger = new Logger('ClaimExtractor')
    const role = process.env.APP_ROLE ?? 'api'

    const agentUrl = process.env.AGENT_RUNTIME_URL?.trim()
    const agentToken = process.env.AGENT_TOKEN?.trim()

    if (agentUrl && agentToken && role !== 'worker') {
      logger.log(`Dùng AgentClaimExtractor qua agent-runtime tại ${agentUrl}`)
      return new AgentClaimExtractor(new AgentRuntimeClient(agentUrl, agentToken))
    }

    if (agentUrl && role === 'worker') {
      logger.log(
        'AGENT_RUNTIME_URL có nhưng đây là worker → bỏ qua agent (hạn mức theo phiên không kham nổi vòng quét)',
      )
    }

    const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
    if (!apiKey) {
      logger.warn(
        'Không có agent-runtime và ANTHROPIC_API_KEY trống → dùng FixtureClaimExtractor ' +
          '(tất định, không gọi mạng). Phát hiện vẫn có câu trích nguyên văn và vẫn qua đủ các cửa kiểm I-1/I-2.',
      )
      return new FixtureClaimExtractor()
    }

    const model = process.env.ANTHROPIC_MODEL?.trim() || undefined
    logger.log(`Dùng AnthropicClaimExtractor (model ${model ?? 'mặc định'})`)
    return new AnthropicClaimExtractor(apiKey, model)
  },
}

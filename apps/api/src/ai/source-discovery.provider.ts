import { Logger, type Provider } from '@nestjs/common'

import { SOURCE_DISCOVERY, type SourceDiscovery } from '@crm/contracts'

import { AgentRuntimeClient } from './agent-runtime-client'
import { AgentSourceDiscovery } from './agent-source-discovery'
import { AnthropicSourceDiscovery } from './anthropic-source-discovery'
import { assertPublicUrl } from './assert-public-url'
import { assertResolvedHostPublic } from './assert-resolved-host-public'
import { fetchPage } from './fetch-page'
import { FixtureSourceDiscovery } from './fixture-source-discovery'
import { verifyCandidatesReachable } from './verify-candidates-reachable'

/**
 * Which adapter sits behind `SOURCE_DISCOVERY`, decided by environment — the same shape and the
 * same order as `claim-extractor.provider.ts`, now that this port has three adapters too:
 *
 *   1. `AgentSourceDiscovery`     — the Claude CLI in `apps/agent-runtime` with `WebSearch`, on an
 *                                   OAuth subscription. Candidates verified by fetching them
 *                                   (ADR-0039).
 *   2. `AnthropicSourceDiscovery` — the SDK's `web_search` server tool. Candidates verified against
 *                                   the search results of the same call.
 *   3. `FixtureSourceDiscovery`   — deterministic, no network. The documented rollback, and the
 *                                   reason a judge given no credential can still run everything.
 *
 * The two live adapters DO NOT verify candidates the same way, and that is not an inconsistency to
 * be tidied away — it is forced. The SDK can compare a URL against `web_search_tool_result` blocks;
 * the CLI transport returns only final text, so branch 1 has no such blocks and fetches each address
 * instead. `verify-candidates-reachable.ts` sets out what each guarantee is worth.
 *
 * The worker skips branch 1 for the reason its sibling gives: a subscription is rate limited per
 * session. Nothing in the worker calls this port today — `findCandidates` refuses `actor.kind ===
 * 'system'` outright — so the guard is a bound on what a future caller can do by accident, not a
 * live branch.
 *
 * The choice is LOGGED at boot because "was that a real search, and who vouched for those URLs?"
 * must be answerable from the log rather than inferred from how plausible the addresses look.
 */
export const sourceDiscoveryProvider: Provider = {
  provide: SOURCE_DISCOVERY,
  useFactory: (): SourceDiscovery => {
    const logger = new Logger('SourceDiscovery')
    const role = process.env.APP_ROLE ?? 'api'

    const agentUrl = process.env.AGENT_RUNTIME_URL?.trim()
    const agentToken = process.env.AGENT_TOKEN?.trim()

    if (agentUrl && agentToken && role !== 'worker') {
      logger.log(
        `Dùng AgentSourceDiscovery qua agent-runtime tại ${agentUrl} — ứng viên được xác minh bằng ` +
          'cách MỞ THẬT từng địa chỉ, không phải đối chiếu kết quả tìm kiếm (ADR-0039)',
      )
      return new AgentSourceDiscovery(
        new AgentRuntimeClient(agentUrl, agentToken),
        (urls) =>
          verifyCandidatesReachable(urls, {
            fetchPage,
            assertAllowed: assertPublicUrl,
            /** The DNS gate, on this path only — see `assert-resolved-host-public.ts` for why. */
            assertHostResolvesPublic: assertResolvedHostPublic,
          }),
      )
    }

    if (agentUrl && role === 'worker') {
      logger.log(
        'AGENT_RUNTIME_URL có nhưng đây là worker → bỏ qua agent (hạn mức theo phiên không kham nổi vòng quét)',
      )
    }

    const apiKey = process.env.ANTHROPIC_API_KEY?.trim()

    if (!apiKey) {
      logger.warn(
        'Không có agent-runtime và ANTHROPIC_API_KEY trống → dùng FixtureSourceDiscovery ' +
          '(tất định, không gọi mạng). Ứng viên suy ra từ website đã lưu, KHÔNG phải kết quả tìm kiếm thật.',
      )
      return new FixtureSourceDiscovery()
    }

    const model = process.env.ANTHROPIC_MODEL?.trim() || undefined
    logger.log(`Dùng AnthropicSourceDiscovery với web_search (model ${model ?? 'mặc định'})`)
    return AnthropicSourceDiscovery.fromApiKey(apiKey, model)
  },
}

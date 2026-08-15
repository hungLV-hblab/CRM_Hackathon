import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ObservationInput } from '@crm/contracts'

import { AgentClaimExtractor } from '../agent-claim-extractor'
import { AgentRuntimeError, type AgentRunResult, type AgentRuntimeClient } from '../agent-runtime-client'
import { AnthropicClaimExtractor } from '../anthropic-claim-extractor'
import { FixtureClaimExtractor } from '../fixture-claim-extractor'
import { claimExtractorProvider } from '../claim-extractor.provider'

/**
 * Two questions, and both of them are about a mistake that would be invisible in a demo:
 *
 *   1. Does the WORKER refuse the agent? A subscription is rate limited per session, so a watch
 *      cycle routed through it spends the quota on a timer and then fails for the person who
 *      actually pressed a button. The failure looks like "the AI is slow today".
 *   2. Does a failed run produce an EMPTY list rather than an exception? Rule 4: an empty row
 *      beats a wrong one, and a thrown request would take a Sales screen down over a token that
 *      expired overnight.
 */

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

/** `useFactory` is the whole decision; calling it directly skips a Nest container we do not need. */
function buildExtractor() {
  const factory = (claimExtractorProvider as { useFactory: () => unknown }).useFactory
  return factory()
}

describe('claimExtractorProvider chọn adapter', () => {
  it('api + đủ hai biến agent → AgentClaimExtractor', () => {
    process.env.APP_ROLE = 'api'
    process.env.AGENT_RUNTIME_URL = 'http://agent-runtime:4700'
    process.env.AGENT_TOKEN = 'test-token'

    expect(buildExtractor()).toBeInstanceOf(AgentClaimExtractor)
  })

  it('WORKER thì KHÔNG dùng agent dù biến có đủ — hạn mức theo phiên không kham nổi vòng quét', () => {
    process.env.APP_ROLE = 'worker'
    process.env.AGENT_RUNTIME_URL = 'http://agent-runtime:4700'
    process.env.AGENT_TOKEN = 'test-token'
    process.env.ANTHROPIC_API_KEY = 'sk-test'

    const extractor = buildExtractor()

    expect(extractor).not.toBeInstanceOf(AgentClaimExtractor)
    expect(extractor).toBeInstanceOf(AnthropicClaimExtractor)
  })

  it('thiếu AGENT_TOKEN thì không đi đường agent, kể cả khi có URL', () => {
    process.env.APP_ROLE = 'api'
    process.env.AGENT_RUNTIME_URL = 'http://agent-runtime:4700'
    delete process.env.AGENT_TOKEN
    delete process.env.ANTHROPIC_API_KEY

    expect(buildExtractor()).toBeInstanceOf(FixtureClaimExtractor)
  })

  it('không có gì cả → Fixture, đúng đường lùi của ADR-0014', () => {
    process.env.APP_ROLE = 'api'
    delete process.env.AGENT_RUNTIME_URL
    delete process.env.AGENT_TOKEN
    delete process.env.ANTHROPIC_API_KEY

    expect(buildExtractor()).toBeInstanceOf(FixtureClaimExtractor)
  })
})

const OBSERVATION: ObservationInput = {
  id: 'obs-1',
  companyId: 'company-1',
  rawContent: 'Sakura vừa hoàn tất vòng Series B huy động 20 triệu USD.',
  companyType: 'it_outsourcing_prospect',
  triggerContext: 'watch_cycle',
  currentProfile: { industry: null, country: null, size: null, website: null },
}

function clientReturning(text: string): AgentRuntimeClient {
  const result: AgentRunResult = {
    text,
    telemetry: {
      skill: 'extract-claims',
      elapsedMs: 1,
      apiMs: 1,
      inputTokens: 0,
      outputTokens: 0,
      sessionId: 'test',
    },
  }
  return { run: vi.fn().mockResolvedValue(result) } as unknown as AgentRuntimeClient
}

describe('AgentClaimExtractor khi có sự cố', () => {
  it('agent-runtime không gọi được → danh sách rỗng, không ném lỗi', async () => {
    const client = {
      run: vi.fn().mockRejectedValue(new AgentRuntimeError('unreachable', 'container đang tắt')),
    } as unknown as AgentRuntimeClient

    await expect(new AgentClaimExtractor(client).extract(OBSERVATION)).resolves.toEqual([])
  })

  it('hết hạn mức → danh sách rỗng, không ném lỗi', async () => {
    const client = {
      run: vi.fn().mockRejectedValue(new AgentRuntimeError('quota_exhausted', 'rate limit')),
    } as unknown as AgentRuntimeClient

    await expect(new AgentClaimExtractor(client).extract(OBSERVATION)).resolves.toEqual([])
  })

  it('model trả văn xuôi thay vì JSON → danh sách rỗng', async () => {
    const extractor = new AgentClaimExtractor(clientReturning('Tôi nghĩ công ty này rất tiềm năng.'))

    await expect(extractor.extract(OBSERVATION)).resolves.toEqual([])
  })

  it('JSON đúng hình dạng → trả đúng phát hiện, không kèm offset nào', async () => {
    const extractor = new AgentClaimExtractor(
      clientReturning(
        '{"claims":[{"statement":"Công ty vừa gọi vốn Series B","signalType":"funding",' +
          '"confidence":"certain","quoteText":"Sakura vừa hoàn tất vòng Series B huy động 20 triệu USD.",' +
          '"quoteStart":0,"quoteEnd":10}]}',
      ),
    )

    const claims = await extractor.extract(OBSERVATION)

    expect(claims).toHaveLength(1)
    expect(claims[0]?.quoteText).toBe('Sakura vừa hoàn tất vòng Series B huy động 20 triệu USD.')
    /** I-2: offsets are computed by code. A model that volunteers them must not get them through. */
    expect(claims[0]).not.toHaveProperty('quoteStart')
    expect(claims[0]).not.toHaveProperty('quoteEnd')
  })
})

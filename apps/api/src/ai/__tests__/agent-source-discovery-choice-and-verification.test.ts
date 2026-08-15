import { afterEach, describe, expect, it, vi } from 'vitest'

import { MAX_CANDIDATES_PER_COMPANY, type SourceDiscoveryInput } from '@crm/contracts'

import { AgentRuntimeError, type AgentRunResult, type AgentRuntimeClient } from '../agent-runtime-client'
import { AgentSourceDiscovery } from '../agent-source-discovery'
import { AnthropicSourceDiscovery } from '../anthropic-source-discovery'
import { FixtureSourceDiscovery } from '../fixture-source-discovery'
import { sourceDiscoveryProvider } from '../source-discovery.provider'
import type { CandidateVerdict, VerifyCandidates } from '../verify-candidates-reachable'

/**
 * The agent path for `SOURCE_DISCOVERY` cannot be a pure transport swap: the SDK adapter's
 * anti-invention check reads `web_search_tool_result` blocks the CLI transport does not return
 * (ADR-0039). So these tests guard the thing that replaced it.
 *
 * The mistake each one is aimed at is invisible in a demo:
 *   - a candidate nobody could open reaching a Sales person, which is rule 1 failing quietly
 *   - a failed run taking the company page down instead of showing "nothing found"
 *   - the model deciding how many sockets we open
 */

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

function buildDiscovery() {
  const factory = (sourceDiscoveryProvider as { useFactory: () => unknown }).useFactory
  return factory()
}

describe('sourceDiscoveryProvider chọn adapter', () => {
  it('api + đủ hai biến agent → AgentSourceDiscovery', () => {
    process.env.APP_ROLE = 'api'
    process.env.AGENT_RUNTIME_URL = 'http://agent-runtime:4700'
    process.env.AGENT_TOKEN = 'test-token'

    expect(buildDiscovery()).toBeInstanceOf(AgentSourceDiscovery)
  })

  it('WORKER thì KHÔNG dùng agent dù biến có đủ — hạn mức theo phiên', () => {
    process.env.APP_ROLE = 'worker'
    process.env.AGENT_RUNTIME_URL = 'http://agent-runtime:4700'
    process.env.AGENT_TOKEN = 'test-token'
    process.env.ANTHROPIC_API_KEY = 'sk-test'

    const discovery = buildDiscovery()

    expect(discovery).not.toBeInstanceOf(AgentSourceDiscovery)
    expect(discovery).toBeInstanceOf(AnthropicSourceDiscovery)
  })

  it('thiếu AGENT_TOKEN thì không đi đường agent, kể cả khi có URL', () => {
    process.env.APP_ROLE = 'api'
    process.env.AGENT_RUNTIME_URL = 'http://agent-runtime:4700'
    delete process.env.AGENT_TOKEN
    delete process.env.ANTHROPIC_API_KEY

    expect(buildDiscovery()).toBeInstanceOf(FixtureSourceDiscovery)
  })

  it('không có gì cả → Fixture, đúng đường lùi của ADR-0014', () => {
    process.env.APP_ROLE = 'api'
    delete process.env.AGENT_RUNTIME_URL
    delete process.env.AGENT_TOKEN
    delete process.env.ANTHROPIC_API_KEY

    expect(buildDiscovery()).toBeInstanceOf(FixtureSourceDiscovery)
  })
})

const COMPANY: SourceDiscoveryInput = {
  companyName: 'Sakura',
  companyWebsite: 'https://sakura.example',
  companyType: 'it_outsourcing_prospect',
}

function clientReturning(text: string): AgentRuntimeClient {
  const result: AgentRunResult = {
    text,
    telemetry: {
      skill: 'discover-sources',
      elapsedMs: 1,
      apiMs: 1,
      inputTokens: 0,
      outputTokens: 0,
      sessionId: 'test',
    },
  }
  return { run: vi.fn().mockResolvedValue(result) } as unknown as AgentRuntimeClient
}

function candidatesJson(urls: readonly string[]): string {
  return JSON.stringify({
    candidates: urls.map((url) => ({
      url,
      sourceTier: 'news',
      snippet: 'đoạn trích',
      reason: 'nói về Sakura',
    })),
  })
}

/** Every address answers — isolates the capping and dedupe behaviour from the verdicts. */
const allReachable: VerifyCandidates = async (urls) => urls.map(() => ({ reachable: true }))

function verifierRejecting(pattern: string): VerifyCandidates {
  return async (urls) =>
    urls.map<CandidateVerdict>((url) =>
      url.includes(pattern) ? { reachable: false, reason: 'http_4xx' } : { reachable: true },
    )
}

describe('AgentSourceDiscovery khi có sự cố', () => {
  it('agent-runtime không gọi được → danh sách rỗng, không ném lỗi', async () => {
    const client = {
      run: vi.fn().mockRejectedValue(new AgentRuntimeError('unreachable', 'container đang tắt')),
    } as unknown as AgentRuntimeClient

    await expect(new AgentSourceDiscovery(client, allReachable).discover(COMPANY)).resolves.toEqual(
      [],
    )
  })

  it('hết hạn mức → danh sách rỗng, không ném lỗi', async () => {
    const client = {
      run: vi.fn().mockRejectedValue(new AgentRuntimeError('quota_exhausted', 'rate limit')),
    } as unknown as AgentRuntimeClient

    await expect(new AgentSourceDiscovery(client, allReachable).discover(COMPANY)).resolves.toEqual(
      [],
    )
  })

  it('model trả văn xuôi thay vì JSON → danh sách rỗng', async () => {
    const discovery = new AgentSourceDiscovery(
      clientReturning('Tôi tìm thấy vài trang khá hay đấy.'),
      allReachable,
    )

    await expect(discovery.discover(COMPANY)).resolves.toEqual([])
  })

  it('không có ứng viên nào thì không gọi xác minh lần nào', async () => {
    const verify = vi.fn(allReachable)
    const discovery = new AgentSourceDiscovery(clientReturning('{"candidates":[]}'), verify)

    await expect(discovery.discover(COMPANY)).resolves.toEqual([])
    expect(verify).not.toHaveBeenCalled()
  })
})

describe('AgentSourceDiscovery — xác minh thay cho việc đối chiếu kết quả tìm kiếm', () => {
  it('ứng viên KHÔNG mở được thì bị bỏ trước khi tới tay người dùng', async () => {
    const discovery = new AgentSourceDiscovery(
      clientReturning(
        candidatesJson(['https://that.example/co-that', 'https://bia.example/khong-co']),
      ),
      verifierRejecting('bia.example'),
    )

    const kept = await discovery.discover(COMPANY)

    expect(kept.map((candidate) => candidate.url)).toEqual(['https://that.example/co-that'])
  })

  it('mọi ứng viên đều chết → rỗng, chứ không phải một danh sách không ai mở được', async () => {
    const discovery = new AgentSourceDiscovery(
      clientReturning(candidatesJson(['https://bia.example/a', 'https://bia.example/b'])),
      verifierRejecting('bia.example'),
    )

    await expect(discovery.discover(COMPANY)).resolves.toEqual([])
  })

  it('giữ tối đa MAX_CANDIDATES_PER_COMPANY, và chỉ xác minh tối đa gấp đôi số đó', async () => {
    const urls = Array.from({ length: 30 }, (_, index) => `https://a.example/tin-${index}`)
    const verify = vi.fn(allReachable)
    const discovery = new AgentSourceDiscovery(clientReturning(candidatesJson(urls)), verify)

    const kept = await discovery.discover(COMPANY)

    expect(kept).toHaveLength(MAX_CANDIDATES_PER_COMPANY)
    /** Model không được quyết định ta mở bao nhiêu socket. */
    expect(verify.mock.calls[0]?.[0]).toHaveLength(MAX_CANDIDATES_PER_COMPANY * 2)
  })

  it('có dư địa: hai ứng viên đầu chết vẫn đủ sáu dòng cho người dùng', async () => {
    const urls = [
      'https://bia.example/a',
      'https://bia.example/b',
      ...Array.from({ length: 8 }, (_, index) => `https://that.example/tin-${index}`),
    ]
    const discovery = new AgentSourceDiscovery(
      clientReturning(candidatesJson(urls)),
      verifierRejecting('bia.example'),
    )

    const kept = await discovery.discover(COMPANY)

    expect(kept).toHaveLength(MAX_CANDIDATES_PER_COMPANY)
    expect(kept.every((candidate) => candidate.url.includes('that.example'))).toBe(true)
  })

  it('URL trùng nhau bị gộp TRƯỚC khi xác minh — không tốn hai lượt fetch cho một trang', async () => {
    const verify = vi.fn(allReachable)
    const discovery = new AgentSourceDiscovery(
      clientReturning(
        candidatesJson([
          'https://a.example/tin',
          'https://a.example/tin/',
          'https://A.EXAMPLE/tin',
          'https://b.example/khac',
        ]),
      ),
      verify,
    )

    const kept = await discovery.discover(COMPANY)

    expect(kept).toHaveLength(2)
    expect(verify.mock.calls[0]?.[0]).toHaveLength(2)
  })

  it('địa chỉ không phải web (javascript:, file:) rụng trước khi có socket nào mở', async () => {
    const verify = vi.fn(allReachable)
    const discovery = new AgentSourceDiscovery(
      clientReturning(
        candidatesJson(['javascript:alert(1)', 'file:///etc/passwd', 'https://that.example/tin']),
      ),
      verify,
    )

    const kept = await discovery.discover(COMPANY)

    expect(kept.map((candidate) => candidate.url)).toEqual(['https://that.example/tin'])
    expect(verify.mock.calls[0]?.[0]).toEqual(['https://that.example/tin'])
  })
})

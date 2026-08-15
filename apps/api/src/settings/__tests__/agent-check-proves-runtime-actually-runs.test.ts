import { Reflector } from '@nestjs/core'
import { ServiceUnavailableException } from '@nestjs/common'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SettingsController } from '../settings.controller'
import type { SystemSettingService } from '../system-setting-service'

/**
 * The one endpoint that makes "Claude Code đang hoạt động" a checked claim instead of a guess.
 *
 * The rule this file defends is not "the happy path works". It is that FOUR different failures
 * stay four different answers all the way down to the browser. `resolveAuthMode()` in the runtime
 * reports whether a credential EXISTS; an expired one, a revoked one, an exhausted quota and a
 * missing binary all look identical from there. If this controller flattens the runtime's `reason`
 * into a generic error — or worse, lets it become a 500 — the admin screen goes back to saying
 * "something is wrong" about four problems with four different fixes, and the feature is pointless.
 */

const controller = new SettingsController({} as SystemSettingService)

const SAVED = { token: process.env.AGENT_TOKEN, url: process.env.AGENT_RUNTIME_URL }

/** A `fetch` that answers whatever the test wants, without a network or a container. */
function stubFetch(status: number, body: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    }),
  )
}

beforeEach(() => {
  process.env.AGENT_TOKEN = 'agent-token-de-test'
  process.env.AGENT_RUNTIME_URL = 'http://agent-runtime:4700'
})

afterEach(() => {
  vi.unstubAllGlobals()
  for (const [key, value] of [
    ['AGENT_TOKEN', SAVED.token],
    ['AGENT_RUNTIME_URL', SAVED.url],
  ] as const) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

describe('chỉ admin ép được một lượt chạy', () => {
  it('route mang @Roles(admin) — lượt chạy này tiêu quota thật của một người', () => {
    const roles = new Reflector().get<string[]>(
      'allowed_roles',
      SettingsController.prototype.agentCheck,
    )
    expect(roles).toEqual(['admin'])
  })
})

describe('thiếu cấu hình là TẮT, không phải hỏng', () => {
  it('thiếu AGENT_TOKEN → 503, không 500 (ADR-0041)', async () => {
    delete process.env.AGENT_TOKEN
    await expect(controller.agentCheck()).rejects.toBeInstanceOf(ServiceUnavailableException)
  })

  it('thiếu AGENT_RUNTIME_URL cũng vậy', async () => {
    delete process.env.AGENT_RUNTIME_URL
    await expect(controller.agentCheck()).rejects.toBeInstanceOf(ServiceUnavailableException)
  })
})

describe('lý do hỏng đi xuống NGUYÊN VẸN', () => {
  it('hết quota giữ đúng tên hết quota', async () => {
    stubFetch(502, { reason: 'quota_exhausted', message: 'Hết lượt' })

    await expect(controller.agentCheck()).resolves.toMatchObject({
      ok: false,
      reason: 'quota_exhausted',
    })
  })

  it('credential bị từ chối KHÔNG bị nhập chung với hết quota — cả tính năng tồn tại vì câu này', async () => {
    stubFetch(502, { reason: 'not_authenticated', message: 'Bị từ chối' })

    await expect(controller.agentCheck()).resolves.toMatchObject({
      ok: false,
      reason: 'not_authenticated',
    })
  })

  it('thiếu binary trong image là lỗi image, và nó có tên riêng', async () => {
    stubFetch(502, { reason: 'spawn_failed', message: 'Không chạy được claude' })

    await expect(controller.agentCheck()).resolves.toMatchObject({ reason: 'spawn_failed' })
  })

  it('runtime chết → trạng thái đọc được, KHÔNG ném 500 làm trắng màn quản trị', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))

    await expect(controller.agentCheck()).resolves.toMatchObject({
      ok: false,
      reason: 'unreachable',
    })
  })

  it('runtime trả 503 vì đang tắt cũng không thành 500', async () => {
    stubFetch(503, { reason: 'disabled', message: 'AGENT_TOKEN chưa đặt' })

    await expect(controller.agentCheck()).resolves.toMatchObject({ ok: false, reason: 'disabled' })
  })
})

describe('lượt chạy được thì trả về bằng chứng, không trả về một chữ OK', () => {
  it('mang theo văn bản model trả lời, thời gian tách đôi, token và credential đã chạy', async () => {
    stubFetch(200, {
      text: 'OK',
      telemetry: {
        skill: 'health-check',
        elapsedMs: 4200,
        apiMs: 1100,
        inputTokens: 16_204,
        outputTokens: 3,
        sessionId: '4f2a-abc',
      },
    })

    await expect(controller.agentCheck()).resolves.toMatchObject({
      ok: true,
      text: 'OK',
      elapsedMs: 4200,
      apiMs: 1100,
      inputTokens: 16_204,
      outputTokens: 3,
      sessionId: '4f2a-abc',
    })
  })

  it('gọi ĐÚNG cửa /run bằng Bearer — không phải cửa vé mà trình duyệt với tới được', async () => {
    stubFetch(200, { text: 'OK', telemetry: {} })

    await controller.agentCheck()

    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://agent-runtime:4700/run/health-check')
    expect((init.headers as Record<string, string>).authorization).toBe(
      'Bearer agent-token-de-test',
    )
  })
})

describe('agent-status chuyển tiếp lastRun', () => {
  it('reload trang vẫn thấy lượt gần nhất vì nó đi kèm /health', async () => {
    stubFetch(200, {
      enabled: true,
      authMode: 'cli_login',
      login: { state: 'idle' },
      lastRun: { at: 1, skill: 'health-check', ok: true, authMode: 'cli_login', text: 'OK' },
    })

    await expect(controller.agentStatus()).resolves.toMatchObject({
      reachable: true,
      enabled: true,
      lastRun: { skill: 'health-check', ok: true },
    })
  })

  it('runtime chưa chạy lượt nào → không có lastRun, và đó không phải lỗi', async () => {
    stubFetch(200, { enabled: true, authMode: null, login: { state: 'idle' } })

    const status = await controller.agentStatus()
    expect(status.reachable).toBe(true)
    expect(status.lastRun).toBeUndefined()
  })
})

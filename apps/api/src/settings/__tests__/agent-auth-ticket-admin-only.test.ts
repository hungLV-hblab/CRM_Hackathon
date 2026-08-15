import { createHmac } from 'node:crypto'

import { Reflector } from '@nestjs/core'
import { ServiceUnavailableException } from '@nestjs/common'
import { afterEach, describe, expect, it } from 'vitest'

import { TICKET_TTL_MS, signTicket } from '../agent-auth-ticket'
import { SettingsController } from '../settings.controller'
import type { SystemSettingService } from '../system-setting-service'

/**
 * The API's entire share of "log Claude in from the interface": sign a ticket for an admin, and
 * refuse to do anything else. Everything this file checks is a boundary — who may ask, what comes
 * back, and that the wire format still matches the process on the other side of Caddy.
 */

const SAVED_AGENT_TOKEN = process.env.AGENT_TOKEN

/** No service call is reachable from the route under test; the controller only needs to exist. */
const controller = new SettingsController({} as SystemSettingService)

afterEach(() => {
  if (SAVED_AGENT_TOKEN === undefined) delete process.env.AGENT_TOKEN
  else process.env.AGENT_TOKEN = SAVED_AGENT_TOKEN
})

describe('chỉ admin xin được vé', () => {
  it('route mang metadata @Roles(admin) — đó là thứ RolesGuard đọc để trả 403 cho Sales', () => {
    /**
     * Asserted through the Reflector rather than by booting Nest and calling over HTTP, because
     * the metadata IS the rule: `RolesGuard` reads exactly this key and throws
     * `ForbiddenException` when the caller's role is not in the list. A route that loses the
     * decorator becomes callable by Sales while every other test in the repo stays green, and
     * this is the assertion that would go red.
     */
    const roles = new Reflector().get<string[]>(
      'allowed_roles',
      SettingsController.prototype.agentAuthTicket,
    )
    expect(roles).toEqual(['admin'])
  })

  it('không phải route công khai như /settings/ai-status', () => {
    /** `ai-status` deliberately carries no roles (ADR-0032). Minting a credential is not that. */
    const openRoute = new Reflector().get<string[]>(
      'allowed_roles',
      SettingsController.prototype.aiStatus,
    )
    expect(openRoute).toBeUndefined()
  })
})

describe('thiếu AGENT_TOKEN', () => {
  it('trả 503 "đang tắt", không phải 500 — ADR-0041', () => {
    delete process.env.AGENT_TOKEN
    expect(() => controller.agentAuthTicket()).toThrow(ServiceUnavailableException)
  })

  it('AGENT_TOKEN chỉ có khoảng trắng cũng là chưa đặt', () => {
    process.env.AGENT_TOKEN = '   '
    expect(() => controller.agentAuthTicket()).toThrow(ServiceUnavailableException)
  })
})

describe('hình dạng vé', () => {
  it('trả đúng hai trường, hạn nằm trong tương lai', () => {
    process.env.AGENT_TOKEN = 'bi-mat-de-test'
    const before = Date.now()
    const result = controller.agentAuthTicket()

    expect(Object.keys(result).sort()).toEqual(['expiresAt', 'ticket'])
    expect(result.expiresAt).toBeGreaterThanOrEqual(before + TICKET_TTL_MS)
  })

  it('KHÔNG trả AGENT_TOKEN ra ngoài — vé được ký bằng bí mật đó, không phải chứa nó', () => {
    process.env.AGENT_TOKEN = 'bi-mat-rat-de-nhan-ra'
    expect(controller.agentAuthTicket().ticket).not.toContain('bi-mat-rat-de-nhan-ra')
  })

  it('hai vé liên tiếp có nonce khác nhau', () => {
    /**
     * `agent-runtime` spends each nonce exactly once. A nonce derived from the clock would repeat
     * inside one millisecond, and the second login of a session would be refused as a replay —
     * a failure that only appears under exactly the timing nobody reproduces by hand.
     */
    const nonces = new Set(
      Array.from({ length: 50 }, () => signTicket('bi-mat-de-test').ticket.split('.')[1]),
    )
    expect(nonces.size).toBe(50)
  })

  it('chữ ký khớp với chính thuật toán agent-runtime kiểm', () => {
    const secret = 'bi-mat-de-test'
    const [exp, nonce, signature] = signTicket(secret).ticket.split('.') as [string, string, string]

    expect(signature).toBe(createHmac('sha256', secret).update(`${exp}.${nonce}`).digest('hex'))
  })
})

describe('hai bản thuật toán không được lệch nhau', () => {
  /**
   * The verifier lives in `apps/agent-runtime/src/auth-ticket.ts` and cannot be imported here —
   * `api` does not depend on that package and should not start now for thirty lines of HMAC. So
   * both sides are pinned to ONE frozen vector instead, and this is the same literal that
   * `apps/agent-runtime/src/__tests__/auth-ticket-guards-browser-routes.test.ts` verifies.
   *
   * Change the wire format on either side and exactly one of the two suites goes red, by name.
   */
  const GOLDEN_TICKET_SECRET = 'bi-mat-chung-cua-hai-goi-chi-de-test'
  const GOLDEN_TICKET =
    '1800000000000.a1b2c3d4e5f60718293a4b5c6d7e8f90.' +
    '5e223aec184a06bff47775855ca3671a312d529d559f36c89392000471d2d264'

  it('hàm ký ở đây sinh đúng vé mẫu mà bên kia verify được', () => {
    const [exp, nonce] = GOLDEN_TICKET.split('.') as [string, string]

    /**
     * Goes through `signTicket` itself. Recomputing the HMAC inline here would assert nothing
     * about this codebase — it would be a statement about `node:crypto` that stays green however
     * the ticket format changes, which is exactly the shape of test that lets two copies of an
     * algorithm drift while both suites look healthy.
     */
    const minted = signTicket(GOLDEN_TICKET_SECRET, Number(exp) - TICKET_TTL_MS, nonce)
    expect(minted.ticket).toBe(GOLDEN_TICKET)
  })

  it('vé thật cũng có đúng ba phần, chữ ký 64 ký tự hex', () => {
    const parts = signTicket('bi-mat-de-test').ticket.split('.')
    expect(parts).toHaveLength(3)
    expect(parts[2]).toMatch(/^[0-9a-f]{64}$/)
  })
})

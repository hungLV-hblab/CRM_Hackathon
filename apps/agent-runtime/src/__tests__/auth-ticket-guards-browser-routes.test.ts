import { createHmac } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import {
  GOLDEN_TICKET,
  GOLDEN_TICKET_SECRET,
  TicketVerifier,
  TicketRejected,
} from '../auth-ticket'

/**
 * The ticket is the only thing standing between the public internet and a login session, because
 * `/agent-auth/*` is the ONE prefix Caddy forwards to this container. `/run/*` is not reachable
 * from `:8080` and must stay that way; these tests are half of what keeps that true.
 */

const SECRET = 'bi-mat-de-test'
const NOW = 1_000_000_000_000

/** Mints a ticket the way `apps/api` does — the algorithm under test, spelled out once. */
function ticket(expMs: number, nonce: string, secret = SECRET): string {
  const payload = `${expMs}.${nonce}`
  return `${payload}.${createHmac('sha256', secret).update(payload).digest('hex')}`
}

function verifier(secret: string | undefined = SECRET, now = NOW): TicketVerifier {
  return new TicketVerifier(secret, () => now)
}

describe('vé hợp lệ', () => {
  it('vé còn hạn, chữ ký đúng thì qua', () => {
    expect(() => verifier().verify(ticket(NOW + 60_000, 'nonce-1'))).not.toThrow()
  })

  it('mỗi nonce chỉ đi qua đúng một lần', () => {
    const v = verifier()
    const one = ticket(NOW + 60_000, 'nonce-dung-lai')

    expect(() => v.verify(one)).not.toThrow()
    expect(() => v.verify(one)).toThrow(TicketRejected)
  })

  it('hai vé khác nonce thì cả hai đều qua', () => {
    const v = verifier()
    expect(() => v.verify(ticket(NOW + 60_000, 'nonce-a'))).not.toThrow()
    expect(() => v.verify(ticket(NOW + 60_000, 'nonce-b'))).not.toThrow()
  })
})

describe('mọi kiểu vé hỏng đều bị từ chối GIỐNG HỆT NHAU', () => {
  /**
   * Same rejection, same words, for every reason. Telling "signature wrong" apart from "expired"
   * hands somebody probing this endpoint the one bit they cannot otherwise get: whether the secret
   * they guessed is right. The 401 body is the same string in all five cases below, and that is a
   * property worth asserting rather than trusting.
   */
  const v = verifier()
  const cases: Array<[string, string | undefined]> = [
    ['chữ ký sai', `${NOW + 60_000}.nonce-x.${'0'.repeat(64)}`],
    ['ký bằng bí mật khác', ticket(NOW + 60_000, 'nonce-y', 'bi-mat-khac')],
    ['đã hết hạn', ticket(NOW - 1, 'nonce-z')],
    /** Hạn quá xa cũng bị từ chối — nếu không thì nonce của nó chiếm chỗ trong `spent` vĩnh viễn. */
    ['hạn xa vô lý', ticket(NOW + 86_400_000, 'nonce-nam-3000')],
    ['thiếu phần', `${NOW + 60_000}.nonce-w`],
    ['rác', 'khong-phai-ve'],
    ['rỗng', ''],
    ['không có header', undefined],
  ]

  const messages = new Set<string>()

  for (const [name, value] of cases) {
    it(`${name} → từ chối`, () => {
      try {
        v.verify(value)
        throw new Error('lẽ ra phải từ chối')
      } catch (error) {
        expect(error).toBeInstanceOf(TicketRejected)
        messages.add((error as Error).message)
      }
    })
  }

  it('tất cả dùng chung đúng một câu chữ', () => {
    expect(messages.size).toBe(1)
  })
})

describe('thiếu AGENT_TOKEN', () => {
  it('không có bí mật thì từ chối MỌI vé — tắt nghĩa là không ai vào được, không phải ai cũng vào được', () => {
    /**
     * The failure mode this guards against is the one that looks like it works: an empty secret
     * signs and verifies perfectly well, so a container booted without `AGENT_TOKEN` would accept
     * tickets anyone could mint. Disabled has to mean closed.
     */
    const v = new TicketVerifier(undefined, () => NOW)
    expect(() => v.verify(ticket(NOW + 60_000, 'nonce-1', ''))).toThrow(TicketRejected)

    const empty = new TicketVerifier('   ', () => NOW)
    expect(() => empty.verify(ticket(NOW + 60_000, 'nonce-2', '   '))).toThrow(TicketRejected)
  })
})

describe('vé lấy từ header', () => {
  it('đọc được `Ticket <vé>`, không nhận `Bearer`', () => {
    const good = ticket(NOW + 60_000, 'nonce-header')

    expect(TicketVerifier.fromHeader(`Ticket ${good}`)).toBe(good)
    /** `Bearer` is the `/run` scheme and carries `AGENT_TOKEN` itself. The two must not blur. */
    expect(TicketVerifier.fromHeader(`Bearer ${good}`)).toBeUndefined()
    expect(TicketVerifier.fromHeader(undefined)).toBeUndefined()
  })
})

describe('hai bản thuật toán không được lệch nhau', () => {
  /**
   * `apps/api` signs and this package verifies, so the algorithm is written twice — it cannot live
   * in `@crm/contracts`, which is zod schemas and enums, not crypto. Two copies drift silently, so
   * both are pinned to ONE frozen vector instead.
   *
   * The same constant is asserted in `apps/api/src/settings/__tests__/agent-auth-ticket-admin-only.test.ts`.
   * Change the format on one side and exactly one of the two suites goes red, by name.
   */
  it('vé mẫu cố định verify được — khoá định dạng vào một hằng số', () => {
    /** Đồng hồ đúng lúc `api` ký ra vé mẫu này: hạn của nó trừ đi TTL 5 phút. */
    const v = new TicketVerifier(GOLDEN_TICKET_SECRET, () => 1_800_000_000_000 - 300_000)
    expect(() => v.verify(GOLDEN_TICKET)).not.toThrow()
  })

  it('vé mẫu có đúng ba phần và chữ ký dài 64 ký tự hex', () => {
    const parts = GOLDEN_TICKET.split('.')
    expect(parts).toHaveLength(3)
    expect(parts[2]).toMatch(/^[0-9a-f]{64}$/)
  })
})

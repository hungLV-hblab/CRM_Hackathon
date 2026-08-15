import { describe, expect, it, vi } from 'vitest'

import { BlockedUrlError } from '../assert-public-url'
import type { FetchPageResult } from '../fetch-page'
import { verifyCandidatesReachable, type VerifyCandidatesDeps } from '../verify-candidates-reachable'

/**
 * This module is the replacement for a guarantee, not a convenience, so the tests are about the
 * two ways it could quietly stop being one:
 *
 *   1. It lets through an address that is not there — the hallucinated URL reaching a Sales person.
 *   2. It refuses an address that IS there — a real source lost with nothing on screen saying why.
 *
 * Plus the one thing that must never happen on a path fed by a model: a request leaving for an
 * address that resolves inside the network.
 */

function depsWith(
  fetchResult: FetchPageResult | ((url: string) => FetchPageResult),
  overrides: Partial<VerifyCandidatesDeps> = {},
): VerifyCandidatesDeps {
  return {
    fetchPage: vi.fn(async (url: string) =>
      typeof fetchResult === 'function' ? fetchResult(url) : fetchResult,
    ),
    assertAllowed: () => undefined,
    assertHostResolvesPublic: async () => undefined,
    ...overrides,
  }
}

const OK: FetchPageResult = { ok: true, html: '<html></html>', finalUrl: 'https://a.example/x' }

describe('verifyCandidatesReachable — địa chỉ có thật thì giữ', () => {
  it('trang trả 200 → reachable', async () => {
    const verdicts = await verifyCandidatesReachable(['https://a.example/x'], depsWith(OK))

    expect(verdicts).toEqual([{ reachable: true }])
  })

  it('trang LỚN hơn hạn mức vẫn là reachable — hạn mức là của ta, không phải tính chất của nguồn', async () => {
    const verdicts = await verifyCandidatesReachable(
      ['https://a.example/big'],
      depsWith({ ok: false, reason: 'too_large' }),
    )

    /** Nếu chỗ này thành false thì mọi bài báo dài đều bị bỏ, và người dùng mất nguồn tốt trong im lặng. */
    expect(verdicts).toEqual([{ reachable: true }])
  })
})

describe('verifyCandidatesReachable — địa chỉ không mở được thì bỏ', () => {
  it('404 → bỏ, kèm đúng lý do (đây là hình dạng thường gặp của URL bịa)', async () => {
    const verdicts = await verifyCandidatesReachable(
      ['https://a.example/khong-co'],
      depsWith({ ok: false, reason: 'http_4xx' }),
    )

    expect(verdicts).toEqual([{ reachable: false, reason: 'http_4xx' }])
  })

  it('tên miền không phân giải được → bỏ, và KHÔNG gửi request nào', async () => {
    const fetchPage = vi.fn()
    const verdicts = await verifyCandidatesReachable(['https://khong-ton-tai.example/'], {
      fetchPage,
      assertAllowed: () => undefined,
      assertHostResolvesPublic: async () => {
        throw new BlockedUrlError('invalid_url', 'không phân giải được')
      },
    })

    expect(verdicts).toEqual([{ reachable: false, reason: 'invalid_url' }])
    expect(fetchPage).not.toHaveBeenCalled()
  })

  it('PDF/ảnh → bỏ: crawler sau này không đọc nổi, đừng để người dùng tick vô ích', async () => {
    const verdicts = await verifyCandidatesReachable(
      ['https://a.example/thong-cao.pdf'],
      depsWith({ ok: false, reason: 'not_html' }),
    )

    expect(verdicts).toEqual([{ reachable: false, reason: 'not_html' }])
  })
})

describe('verifyCandidatesReachable — cổng SSRF trên đường do model cấp', () => {
  it('tên công khai phân giải về địa chỉ nội bộ → bỏ, KHÔNG có request nào ra ngoài', async () => {
    const fetchPage = vi.fn()

    const verdicts = await verifyCandidatesReachable(['https://ten-cong-khai.example/'], {
      fetchPage,
      assertAllowed: () => undefined,
      assertHostResolvesPublic: async () => {
        throw new BlockedUrlError('blocked_url', 'phân giải về 127.0.0.1')
      },
    })

    expect(verdicts).toEqual([{ reachable: false, reason: 'blocked_url' }])
    /** Cổng phải chặn TRƯỚC khi mở socket, không phải phán xử sau khi đã gọi. */
    expect(fetchPage).not.toHaveBeenCalled()
  })

  it('một địa chỉ bị chặn không làm chết lượt xác minh của các địa chỉ còn lại', async () => {
    const verdicts = await verifyCandidatesReachable(
      ['https://xau.example/', 'https://tot.example/'],
      depsWith(OK, {
        assertHostResolvesPublic: async (url) => {
          if (url.includes('xau')) throw new BlockedUrlError('blocked_url', 'nội bộ')
        },
      }),
    )

    expect(verdicts).toEqual([{ reachable: false, reason: 'blocked_url' }, { reachable: true }])
  })
})

describe('verifyCandidatesReachable — thứ tự', () => {
  it('verdict trả về ĐÚNG THỨ TỰ đầu vào, dù chạy song song', async () => {
    const urls = [
      'https://a.example/1',
      'https://b.example/2',
      'https://c.example/3',
      'https://d.example/4',
      'https://e.example/5',
      'https://f.example/6',
    ]

    const verdicts = await verifyCandidatesReachable(
      urls,
      depsWith((url) =>
        url.includes('b.example') || url.includes('e.example')
          ? { ok: false, reason: 'http_4xx' }
          : OK,
      ),
    )

    /** Caller zip verdict lại lên candidate theo index — lệch thứ tự là gán sai lý do cho sai URL. */
    expect(verdicts.map((verdict) => verdict.reachable)).toEqual([
      true,
      false,
      true,
      true,
      false,
      true,
    ])
  })
})

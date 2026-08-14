import { describe, expect, it } from 'vitest'

import type { FetchPage, FetchPageResult } from '../fetch-page'
import { BlockedUrlError } from '../assert-public-url'
import { LiveCrawlSource } from '../live-crawl-source'

/**
 * The seam that joins the pure gate to the I/O — and the only place that knows both.
 *
 * Both halves are injected, so this file needs neither a socket nor a network stack: what it
 * measures is the ORDER of the two, and the order is the invariant. A gate consulted after the
 * request has left is not a gate.
 */

const PAGE = '<html><body><p>Công ty vừa hoàn tất vòng Series B.</p></body></html>'

/** Records every call so "was this ever reached?" is a number, not an inference. */
function countingFetch(result: FetchPageResult): { fetch: FetchPage; urls: string[] } {
  const urls: string[] = []
  const fetch = (async (url: string) => {
    urls.push(url)
    return result
  }) as unknown as FetchPage
  return { fetch, urls }
}

function build(fetch: FetchPage): LiveCrawlSource {
  return new LiveCrawlSource({
    fetchPage: fetch,
    /** The real gate, not a stand-in — its refusals are half of what this file asserts. */
    assertAllowed: (url) => {
      if (url.includes('127.0.0.1') || url.includes('169.254')) {
        throw new BlockedUrlError('blocked_url', 'loopback')
      }
    },
  })
}

describe('the gate runs BEFORE the request, not alongside it', () => {
  it('1 · a refused URL → blocked_url, and fetchPage is called zero times', async () => {
    /**
     * The count is the assertion. A version that fetched first and checked afterwards would
     * return the same `blocked_url` and pass on the reason alone — while the request had already
     * reached the metadata service. SSRF is about the packet leaving, not about the return value.
     */
    const { fetch, urls } = countingFetch({ ok: true, html: PAGE, finalUrl: 'x' })
    const result = await build(fetch).read('http://169.254.169.254/latest/meta-data/')

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('blocked_url')
    expect(urls).toHaveLength(0)
  })

  it('2 · a missing URL → invalid_url, and fetchPage is called zero times', async () => {
    const { fetch, urls } = countingFetch({ ok: true, html: PAGE, finalUrl: 'x' })
    const result = await build(fetch).read(null)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('invalid_url')
    expect(urls).toHaveLength(0)
  })
})

describe('a page that reads becomes a snapshot this codebase owns', () => {
  it('3 · html comes back untouched, under the URL that actually answered', async () => {
    const { fetch, urls } = countingFetch({
      ok: true,
      html: PAGE,
      finalUrl: 'https://example.com/news/final',
    })
    const result = await build(fetch).read('https://example.com/news')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.rawHtml).toBe(PAGE)
    /**
     * The URL that answered, not the one asked for. I-3 compares the next read against
     * `source_url`, so storing the pre-redirect address would make a stable page look new on
     * every cycle — a new row and a new LLM call each time.
     */
    expect(result.sourceUrl).toBe('https://example.com/news/final')
    expect(urls).toEqual(['https://example.com/news'])
  })
})

describe('an empty page after normalisation is its own diagnosis', () => {
  it('4 · markup that normalises to nothing → js_required', async () => {
    /**
     * The most valuable value in the table. Specs group 2 has ONE state for an unreadable
     * source, which cannot separate "the site needs a browser we do not run" from "this company
     * published nothing" — and those two ask a Sales person for opposite next actions.
     *
     * The decision is made HERE and nowhere else, because `normalizeSnapshotText` is what defines
     * "nothing", and `fetchPage` correctly calls a 200-with-no-body a success.
     */
    const shell = '<html><head><script>renderApp()</script></head><body><div id="root"></div></body></html>'
    const { fetch } = countingFetch({ ok: true, html: shell, finalUrl: 'https://spa.example.com' })
    const result = await build(fetch).read('https://spa.example.com')

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('js_required')
    // Still recorded against a real address: a failed read is a fact about a source, and a fact
    // with no subject cannot be shown to anyone.
    expect(result.sourceUrl).toBe('https://spa.example.com')
  })
})

describe('a reason from the I/O layer travels unchanged', () => {
  it.each(['http_4xx', 'http_5xx', 'timeout', 'not_html', 'too_large', 'redirect_loop', 'unreachable'] as const)(
    '5 · %s is passed through, never re-labelled',
    async (reason) => {
      /**
       * Re-labelling is the failure this pins. Collapsing seven diagnoses into one "không đọc
       * được" is precisely the state Specs group 2 already has and the reason column exists to
       * improve on.
       */
      const { fetch } = countingFetch({ ok: false, reason })
      const result = await build(fetch).read('https://example.com/news')

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.reason).toBe(reason)
      expect(result.sourceUrl).toBe('https://example.com/news')
    },
  )
})

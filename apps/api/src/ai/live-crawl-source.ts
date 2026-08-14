import type { FetchErrorReason } from '@crm/contracts'

import { BlockedUrlError } from './assert-public-url'
import type { FetchPage } from './fetch-page'
import { normalizeSnapshotText } from './normalize-snapshot-text'

/**
 * Reading a real public page — the port that stands where `DemoSnapshotSource` stands, which
 * `demo-snapshots.ts:240-244` said it was leaving room for: "a future real crawler can be swapped
 * in without touching the service".
 *
 * The whole class is thirty lines because the interesting work is in the two pieces it joins, and
 * joining them is itself the invariant: the gate is consulted BEFORE the request, never after.
 * Both pieces arrive through the constructor so that order can be measured without a socket.
 *
 * What this class must never become: a caller of Anthropic's `web_fetch`. ADR-0012 measures
 * `content_hash` and every `quote_start`/`quote_end` against OUR normalisation of OUR bytes — let
 * a model fetch and summarise the page and there are no bytes of ours left, so I-2 ("the quote is
 * a verbatim substring") has nothing to stand on and rule 1 goes with it.
 */

export type LiveCrawlResult =
  | { ok: true; sourceUrl: string; rawHtml: string }
  | { ok: false; sourceUrl: string; reason: FetchErrorReason }

export interface LiveCrawlDeps {
  fetchPage: FetchPage
  /** Throws `BlockedUrlError` when the address may not be requested. */
  assertAllowed: (url: string) => void
  timeoutMs?: number
  maxBytes?: number
}

/** Shown instead of an empty string when there is no address at all — `source_url` is NOT NULL. */
const NO_URL = 'không có địa chỉ nguồn'

export class LiveCrawlSource {
  constructor(private readonly deps: LiveCrawlDeps) {}

  async read(url: string | null | undefined): Promise<LiveCrawlResult> {
    const candidate = (url ?? '').trim()
    if (candidate === '') {
      /** No website on file. A fact about the company, recorded as one — never guessed at. */
      return { ok: false, sourceUrl: NO_URL, reason: 'invalid_url' }
    }

    try {
      this.deps.assertAllowed(candidate)
    } catch (error) {
      /**
       * Returned BEFORE `fetchPage` is reached, and `live-crawl-source.test.ts` counts the calls
       * to prove it. A gate that runs after the request has left is not a gate — the packet is
       * what SSRF is about, not the return value.
       */
      const reason = error instanceof BlockedUrlError ? error.reason : 'blocked_url'
      return { ok: false, sourceUrl: candidate, reason }
    }

    const fetched = await this.deps.fetchPage(candidate, {
      assertAllowed: this.deps.assertAllowed,
      timeoutMs: this.deps.timeoutMs,
      maxBytes: this.deps.maxBytes,
    })

    if (!fetched.ok) {
      /** Passed through, never re-labelled: the reason IS the product feature. */
      return { ok: false, sourceUrl: candidate, reason: fetched.reason }
    }

    /**
     * The one diagnosis only this layer can make. `fetchPage` is right to call a 200 with no body
     * a success — the server did answer — and `normalizeSnapshotText` is what defines "nothing".
     * Put them together and a single-page app that renders in the browser stops being
     * indistinguishable from a company that published nothing, which is the distinction Specs
     * group 2 cannot express and the reason this column was worth adding.
     */
    if (normalizeSnapshotText(fetched.html).trim() === '') {
      return { ok: false, sourceUrl: fetched.finalUrl, reason: 'js_required' }
    }

    /**
     * The URL that ANSWERED, not the one asked for. I-3 compares the next read against
     * `source_url`, so storing the pre-redirect address after a permanent move would make a
     * stable page look new on every cycle — a fresh row and a fresh LLM call each time.
     */
    return { ok: true, sourceUrl: fetched.finalUrl, rawHtml: fetched.html }
  }
}

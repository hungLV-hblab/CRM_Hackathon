import type { FetchErrorReason } from '@crm/contracts'

import { BlockedUrlError } from './assert-public-url'
import type { FetchPage } from './fetch-page'

/**
 * Asking the web whether a candidate address is really there.
 *
 * WHAT THIS REPLACES, and why the replacement is not a like-for-like. `AnthropicSourceDiscovery`
 * earns its trust from the SDK's `web_search_tool_result` blocks: every URL the model names is
 * compared against the results of the same call and dropped if it was not among them, so the
 * guarantee is "a search engine vouched for this address". The Claude CLI transport returns only
 * the final text (`claude-cli.ts` reads `result`, `session_id`, `duration_api_ms`, `usage` — no
 * content blocks), so those results do not exist on the agent path and that guarantee cannot be
 * reproduced. This module supplies a DIFFERENT one: "the address answers, and it answers to us".
 *
 * Which is weaker in one way and stronger in another, and both belong on the record:
 *   weaker   — a fabricated URL that happens to land on a catch-all host still passes here, where
 *              the search comparison would have caught it.
 *   stronger — it is checked by our code against the live web rather than inferred from a payload
 *              the model also authored.
 *
 * IT DOES NOT ASK WHETHER THE PAGE IS ABOUT THE COMPANY. That is deliberate and it is the port's
 * own division of labour: `ports/source-discovery.ts` says a person ticks the ones that are really
 * about their company. Matching the company name here would silently drop legitimate sources — a
 * Japanese name in kanji against a romaji record, an article that names only the parent group — and
 * would take a judgement the human is meant to make. Reachability is a fact; aboutness is a call.
 *
 * NOTHING FETCHED HERE IS EVER STORED OR RETURNED. The bytes are read to learn that they exist and
 * then dropped. `ports/source-discovery.ts` forbids this port from returning page CONTENT, because
 * ADR-0012 measures `content_hash` and every quote offset over OUR normalisation of OUR bytes at
 * crawl time; a page read here and remembered would put a second, unquotable copy in play.
 */

export type CandidateVerdict =
  | { reachable: true }
  | { reachable: false; reason: FetchErrorReason }

export interface VerifyCandidatesDeps {
  fetchPage: FetchPage
  /** Sync gate, consulted by `fetchPage` for the first URL and every redirect hop. */
  assertAllowed: (url: string) => void
  /** Async gate: refuses a public NAME that resolves to a private ADDRESS. */
  assertHostResolvesPublic: (url: string) => Promise<void>
  timeoutMs?: number
  maxBytes?: number
  maxRedirects?: number
  concurrency?: number
}

/** Shorter than the crawl path's 8s: six of these sit on a button a Sales person is waiting on. */
const DEFAULT_TIMEOUT_MS = 5_000
/**
 * Deliberately TINY, and safe only because `too_large` counts as reachable below. We are asking
 * "did a server answer with a real resource", so there is no reason to pull a whole news page —
 * and every reason not to, on a path that fans out over addresses a model chose.
 */
const DEFAULT_MAX_BYTES = 16 * 1024
/** Each hop is re-gated, but a click path should not sit through five of them. */
const DEFAULT_MAX_REDIRECTS = 3
/** Enough to hide the latency of six sequential fetches, few enough not to look like a burst. */
const DEFAULT_CONCURRENCY = 4

export type VerifyCandidates = (urls: readonly string[]) => Promise<CandidateVerdict[]>

/**
 * Verdicts in the SAME ORDER as the input, so the caller can zip them back onto the candidates it
 * already holds without matching on URL strings.
 */
export async function verifyCandidatesReachable(
  urls: readonly string[],
  deps: VerifyCandidatesDeps,
): Promise<CandidateVerdict[]> {
  return mapWithConcurrency(urls, deps.concurrency ?? DEFAULT_CONCURRENCY, (url) =>
    verifyOne(url, deps),
  )
}

async function verifyOne(url: string, deps: VerifyCandidatesDeps): Promise<CandidateVerdict> {
  try {
    await deps.assertHostResolvesPublic(url)
  } catch (error) {
    /**
     * A refused address is a verdict, never an exception that escapes: one hostile or malformed
     * suggestion must not take down the search for the other five (rule 4).
     */
    const reason: FetchErrorReason =
      error instanceof BlockedUrlError ? error.reason : 'blocked_url'
    return { reachable: false, reason }
  }

  const result = await deps.fetchPage(url, {
    assertAllowed: deps.assertAllowed,
    timeoutMs: deps.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxBytes: deps.maxBytes ?? DEFAULT_MAX_BYTES,
    maxRedirects: deps.maxRedirects ?? DEFAULT_MAX_REDIRECTS,
  })

  if (result.ok) return { reachable: true }

  /**
   * A page bigger than our cap IS there — that is the whole question being asked, and the cap is
   * ours rather than a property of the source. Treating this as a failure would drop real articles
   * for being long, which is the false rejection this feature can least afford: the person loses a
   * good source and nothing on screen says why.
   */
  if (result.reason === 'too_large') return { reachable: true }

  return { reachable: false, reason: result.reason }
}

/**
 * Bounded parallel map. `Promise.all` over every candidate would open as many sockets as the model
 * named, which is a number no one on our side chose.
 */
async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  run: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0

  const workers = Array.from({ length: Math.min(Math.max(limit, 1), items.length) }, async () => {
    for (;;) {
      const index = next
      next += 1
      if (index >= items.length) return
      results[index] = await run(items[index] as T)
    }
  })

  await Promise.all(workers)
  return results
}

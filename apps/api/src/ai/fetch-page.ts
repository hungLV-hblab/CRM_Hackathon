import type { FetchErrorReason } from '@crm/contracts'

/**
 * The I/O half of reading a live source: bytes in, one HTML string or one reason out.
 *
 * It never throws. Every way a fetch can go wrong is a value in a closed list, because the caller
 * writes that value into `observations.fetch_error_reason` and the screen turns it into a
 * Vietnamese sentence. An exception escaping here would collapse ten diagnoses back into one
 * "could not read", which is the state Specs group 2 already has and this column exists to
 * improve on.
 *
 * It deliberately does NOT own the SSRF gate — see `assert-public-url.ts`. The gate arrives as
 * `assertAllowed` and is consulted for the first URL and for EVERY redirect target, which is why
 * redirects are followed by hand below instead of by `redirect: 'follow'`.
 */

export type FetchPageResult =
  | { ok: true; html: string; finalUrl: string }
  | { ok: false; reason: FetchErrorReason }

export interface FetchPageOptions {
  /**
   * Throws if this URL may not be requested. REQUIRED, with no default, and that is the point:
   * fetching without a gate has to be an explicit line someone wrote — `fetch-page.test.ts` is
   * the only place that does it, because the server it talks to IS loopback.
   */
  assertAllowed: (url: string) => void
  /** Whole-request budget. A source that has not answered by then is not worth the wait. */
  timeoutMs?: number
  /** Hard cap on the body. Enforced by counting bytes, not by trusting `content-length`. */
  maxBytes?: number
  maxRedirects?: number
}

export type FetchPage = (url: string, options: FetchPageOptions) => Promise<FetchPageResult>

const DEFAULT_TIMEOUT_MS = 8_000
/** ~512KB. A company page above this is not prose, and the LLM bill scales with what we keep. */
const DEFAULT_MAX_BYTES = 512 * 1024
const DEFAULT_MAX_REDIRECTS = 5

/** What counts as a page a text normaliser can work on. Everything else is `not_html`. */
const READABLE_CONTENT_TYPES = ['text/html', 'application/xhtml+xml', 'text/plain']

export const fetchPage: FetchPage = async (url, options) => {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS

  /**
   * One deadline for the WHOLE chain, not one per hop. Five redirects each given the full budget
   * would let a hostile chain hold a worker for five times as long as anybody agreed to.
   */
  const deadline = AbortSignal.timeout(timeoutMs)

  let current = url

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    try {
      options.assertAllowed(current)
    } catch {
      /**
       * Covers the first URL and every redirect target alike. A public page that 302s to
       * `169.254.169.254` is the textbook SSRF, and checking only the address a person typed
       * leaves the metadata service exactly one redirect away.
       */
      return { ok: false, reason: 'blocked_url' }
    }

    let response: Response
    try {
      response = await fetch(current, {
        redirect: 'manual',
        signal: deadline,
        headers: {
          /**
           * Honest about what we are. A site that refuses robots is entitled to, and the refusal
           * is information about the source (`http_4xx`) rather than something to disguise.
           */
          'user-agent': 'CRM-Hackathon-Reader/1.0 (+doc: docs/ontology.md)',
          accept: 'text/html,application/xhtml+xml',
        },
      })
    } catch (error) {
      return { ok: false, reason: classifyNetworkError(error) }
    }

    if (isRedirect(response.status)) {
      const location = response.headers.get('location')
      // A redirect with nowhere to go. Not a loop, but equally unreadable, and the same dead end.
      if (!location) return { ok: false, reason: 'redirect_loop' }
      try {
        current = new URL(location, current).toString()
      } catch {
        return { ok: false, reason: 'invalid_url' }
      }
      continue
    }

    if (response.status >= 500) return { ok: false, reason: 'http_5xx' }
    if (response.status >= 400) return { ok: false, reason: 'http_4xx' }

    const contentType = response.headers.get('content-type') ?? ''
    if (contentType !== '' && !READABLE_CONTENT_TYPES.some((type) => contentType.includes(type))) {
      /** A PDF or an image is a real source that this reader cannot read. Say which. */
      return { ok: false, reason: 'not_html' }
    }

    const declared = Number(response.headers.get('content-length'))
    if (Number.isFinite(declared) && declared > maxBytes) {
      return { ok: false, reason: 'too_large' }
    }

    try {
      const html = await readBounded(response, maxBytes)
      if (html === null) return { ok: false, reason: 'too_large' }
      return { ok: true, html, finalUrl: response.url || current }
    } catch (error) {
      return { ok: false, reason: classifyNetworkError(error) }
    }
  }

  /**
   * The budget ran out. `redirect_loop` covers both a true cycle and a chain that is merely too
   * long, because from here they are the same fact: this address never resolves to a page.
   */
  return { ok: false, reason: 'redirect_loop' }
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308
}

/**
 * Reads the body while counting bytes, returning `null` the moment the cap is passed.
 *
 * `content-length` is a claim a server makes, not a fact — omit it, or lie, and a size check
 * based on the header alone lets the stream run until the process runs out of memory. The header
 * is only a way to fail sooner; THIS is the enforcement.
 */
async function readBounded(response: Response, maxBytes: number): Promise<string | null> {
  const body = response.body
  if (!body) return ''

  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel()
        return null
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  return new TextDecoder('utf-8').decode(concat(chunks, total))
}

function concat(chunks: Uint8Array[], total: number): Uint8Array {
  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return merged
}

/**
 * Separates "the clock ran out" from "there was nothing at that address".
 *
 * They are different sentences on screen and different actions for the person reading them, so
 * folding a refused connection into `timeout` would put a false statement in front of Sales —
 * rule 4. `unreachable` was added in `0009` for exactly this branch, after the first real read
 * found that the original list of nine had no room for it.
 */
function classifyNetworkError(error: unknown): FetchErrorReason {
  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
    return 'timeout'
  }
  /** `fetch` wraps the real cause; the DNS/ECONNREFUSED/TLS detail is one level down. */
  const cause = error instanceof Error ? (error.cause as { code?: string } | undefined) : undefined
  if (cause?.code === 'UND_ERR_HEADERS_TIMEOUT' || cause?.code === 'UND_ERR_BODY_TIMEOUT') {
    return 'timeout'
  }
  /** A URL `new URL()` accepted but the stack cannot dial — an unbracketed IPv6, say. */
  if (cause?.code === 'ERR_INVALID_URL') return 'invalid_url'

  return 'unreachable'
}

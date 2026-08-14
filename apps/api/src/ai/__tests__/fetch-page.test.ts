import { type Server, createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { Socket } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { fetchPage } from '../fetch-page'

/**
 * The I/O half of the live source, measured against a real HTTP server on `127.0.0.1` — never
 * against the internet. A test that reaches the internet fails on a train and passes at a desk,
 * so it measures the network, not the code.
 *
 * Which is exactly why `fetchPage` does not call the SSRF gate itself: the gate blocks loopback,
 * so a combined function could only be tested by dialling a public host for real. The gate is
 * passed IN (`assertAllowed`) and this file passes a deliberate no-op — see `ALLOW_LOOPBACK`.
 * `LiveCrawlSource` is the one caller that supplies the real gate, and
 * `live-crawl-source.test.ts` is where that wiring is measured.
 *
 * The option is REQUIRED rather than defaulted for that reason: opting out of the gate has to be
 * a visible line in a test file, never something a production caller can forget.
 */

/**
 * The opt-out, named so it reads as one at every call site. Legal here and nowhere else: the
 * server under test IS loopback.
 */
const ALLOW_LOOPBACK = () => {}

let server: Server
let base: string
const sockets = new Set<Socket>()

/**
 * One server, routed by path — cheaper than eight servers and it keeps each case a single line.
 * Every branch below is a failure mode the error table has a Vietnamese sentence for.
 */
beforeAll(async () => {
  server = createServer((request, response) => {
    const path = request.url ?? '/'

    if (path === '/ok') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      response.end('<html><body><p>Công ty vừa gọi vốn.</p></body></html>')
      return
    }
    if (path === '/empty') {
      response.writeHead(200, { 'content-type': 'text/html' })
      response.end('')
      return
    }
    if (path === '/forbidden') {
      response.writeHead(403).end('no robots')
      return
    }
    if (path === '/gone') {
      response.writeHead(404).end('gone')
      return
    }
    if (path === '/boom') {
      response.writeHead(500).end('boom')
      return
    }
    if (path === '/pdf') {
      response.writeHead(200, { 'content-type': 'application/pdf' })
      response.end('%PDF-1.4')
      return
    }
    /** Declares its size up front — the cheap rejection, before a single byte of body arrives. */
    if (path === '/huge-declared') {
      const body = 'x'.repeat(4096)
      response.writeHead(200, { 'content-type': 'text/html', 'content-length': String(body.length) })
      response.end(body)
      return
    }
    /**
     * Chunked, so `content-length` is absent and the cheap check cannot fire. A server that lies
     * about its size — or simply does not say — must still be cut off mid-stream.
     */
    if (path === '/huge-streamed') {
      response.writeHead(200, { 'content-type': 'text/html', 'transfer-encoding': 'chunked' })
      for (let index = 0; index < 40; index += 1) response.write('y'.repeat(512))
      response.end()
      return
    }
    /** Accepts the connection and then says nothing, which is what a hung site does. */
    if (path === '/hang') {
      return
    }
    /** `/redirect/3` → `/redirect/2` → … → `/ok`, so the hop budget can be walked up to. */
    const redirect = /^\/redirect\/(\d+)$/.exec(path)
    if (redirect) {
      const remaining = Number(redirect[1])
      const target = remaining <= 1 ? '/ok' : `/redirect/${remaining - 1}`
      response.writeHead(302, { location: target }).end()
      return
    }
    if (path === '/redirect-to-private') {
      response.writeHead(302, { location: 'http://169.254.169.254/latest/meta-data/' }).end()
      return
    }

    response.writeHead(404).end()
  })

  server.on('connection', (socket) => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(async () => {
  // `/hang` leaves a socket open; without this the server never closes and the run stalls.
  for (const socket of sockets) socket.destroy()
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  )
})

describe('a page that reads cleanly comes back whole', () => {
  it('1 · 200 text/html → ok, with the body untouched', async () => {
    const result = await fetchPage(`${base}/ok`, { assertAllowed: ALLOW_LOOPBACK })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    // Untouched on purpose: ADR-0012 measures `content_hash` and every quote offset against OUR
    // normalisation of OUR bytes, so this layer must not rewrite them on the way past.
    expect(result.html).toContain('Công ty vừa gọi vốn.')
    expect(result.finalUrl).toBe(`${base}/ok`)
  })

  it('2 · 200 with an empty body is a SUCCESS here, not an error', async () => {
    /**
     * The distinction the whole error table exists for. "The server answered, with nothing" is
     * not a fetch failure — it becomes `js_required` one layer up, after normalisation, and only
     * `LiveCrawlSource` is in a position to say so. Calling it an error here would erase the one
     * value that separates "the site refused our reader" from "nothing was published".
     */
    const result = await fetchPage(`${base}/empty`, { assertAllowed: ALLOW_LOOPBACK })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.html).toBe('')
  })
})

describe('an HTTP status maps to exactly one reason', () => {
  it.each([
    ['403', '/forbidden', 'http_4xx'],
    ['404', '/gone', 'http_4xx'],
    ['500', '/boom', 'http_5xx'],
  ] as const)('3 · %s → %s', async (_label, path, reason) => {
    const result = await fetchPage(`${base}${path}`, { assertAllowed: ALLOW_LOOPBACK })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe(reason)
  })
})

describe('redirects are followed, but only so far', () => {
  it('4 · a chain inside the budget is followed to the end', async () => {
    const result = await fetchPage(`${base}/redirect/2`, {
      assertAllowed: ALLOW_LOOPBACK,
      maxRedirects: 5,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.html).toContain('Công ty vừa gọi vốn.')
    // The URL that actually answered, not the one asked for — it is what gets stored, and I-3
    // compares the next read against it.
    expect(result.finalUrl).toBe(`${base}/ok`)
  })

  it('5 · a chain past the budget → redirect_loop', async () => {
    const result = await fetchPage(`${base}/redirect/9`, {
      assertAllowed: ALLOW_LOOPBACK,
      maxRedirects: 3,
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('redirect_loop')
  })

  it('6 · the gate is asked again for every hop, not only for the first URL', async () => {
    /**
     * The bypass this test exists to close: a public URL that 302s to `169.254.169.254`. Check
     * the first address only and the metadata service is one redirect away, which is the textbook
     * SSRF. So the redirect is followed BY HAND rather than by `redirect: 'follow'` — the
     * built-in follower never offers a place to ask.
     */
    const seen: string[] = []
    const result = await fetchPage(`${base}/redirect-to-private`, {
      assertAllowed: (url) => {
        seen.push(url)
        if (url.includes('169.254.169.254')) throw new Error('refused by the gate')
      },
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('blocked_url')
    expect(seen).toHaveLength(2)
    expect(seen[1]).toContain('169.254.169.254')
  })
})

describe('anything that is not a readable web page is refused before it is read', () => {
  it('7 · a non-HTML content-type → not_html', async () => {
    const result = await fetchPage(`${base}/pdf`, { assertAllowed: ALLOW_LOOPBACK })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('not_html')
  })

  it('8 · a declared content-length over the cap → too_large', async () => {
    const result = await fetchPage(`${base}/huge-declared`, {
      assertAllowed: ALLOW_LOOPBACK,
      maxBytes: 1024,
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('too_large')
  })

  it('9 · a chunked body over the cap is cut off mid-stream → too_large', async () => {
    /**
     * `content-length` is a claim, not a fact. Trusting it alone means a server that omits it can
     * stream until the process runs out of memory, so the byte counter is what actually enforces
     * the cap and the header is only a way to fail sooner.
     */
    const result = await fetchPage(`${base}/huge-streamed`, {
      assertAllowed: ALLOW_LOOPBACK,
      maxBytes: 1024,
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('too_large')
  })
})

describe('a source that never answers is bounded by the clock', () => {
  it('10 · no response inside the timeout → timeout', async () => {
    const result = await fetchPage(`${base}/hang`, {
      assertAllowed: ALLOW_LOOPBACK,
      timeoutMs: 300,
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('timeout')
  })
})

describe('a host that cannot be reached is not the same as a host that refused', () => {
  it('11 · nothing listening on the port → unreachable', async () => {
    /**
     * A port bound and released, so it is genuinely closed rather than merely unusual. The low
     * reserved ports are no good here: `fetch` refuses them outright as "bad ports" before it
     * dials, so a test using one would pass without ever proving a refused connection.
     *
     * The reason is its own value rather than being folded into `timeout` because the two
     * sentences a Sales person reads are different claims about the world — "the page did not
     * answer in time" is not something this code can say about a connection refused in three
     * milliseconds. Rule 4: a wrong line is worse than a missing one.
     */
    const closedPort = await portNobodyIsListeningOn()
    const result = await fetchPage(`http://127.0.0.1:${closedPort}/`, {
      assertAllowed: ALLOW_LOOPBACK,
      timeoutMs: 2000,
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('unreachable')
  })
})

/** Binds an ephemeral port and immediately gives it back, so the number is known to be free. */
async function portNobodyIsListeningOn(): Promise<number> {
  const idle = createServer()
  await new Promise<void>((resolve) => idle.listen(0, '127.0.0.1', resolve))
  const port = (idle.address() as AddressInfo).port
  await new Promise<void>((resolve) => idle.close(() => resolve()))
  return port
}

describe('a string that is not a URL never reaches the socket', () => {
  it('12 · unparseable → invalid_url', async () => {
    const result = await fetchPage('not a url', { assertAllowed: ALLOW_LOOPBACK })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('invalid_url')
  })
})

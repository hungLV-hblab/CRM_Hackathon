import { describe, expect, it } from 'vitest'

import { BlockedUrlError, assertPublicUrl } from '../assert-public-url'

/**
 * The SSRF gate, as a table. No I/O anywhere in this file — that is the whole point of the
 * function being pure (phase 2, "Tách ba mảnh").
 *
 * A gate that can only be observed by watching a socket is a gate nobody re-checks. This one is
 * a list of strings, so the list can be exhaustive: every address family that reaches something
 * on the machine or the private network, every scheme that is not the web, and every notation a
 * WHATWG `URL` will happily normalise back into `127.0.0.1`.
 *
 * The last group is the one worth staring at. `http://2130706433/` and `http://0x7f.0.0.1/` are
 * loopback written in decimal and hex; a hand-rolled string check for "starts with 127." lets
 * both straight through, while `new URL()` has already turned them into `127.0.0.1` before this
 * function looks at anything. Normalising FIRST and matching SECOND is the design.
 */

const ALLOWED = [
  ['plain https', 'https://example.com'],
  ['http with a port, path and query', 'http://example.com:8080/a?b=c'],
  ['a public IPv4 literal', 'http://93.184.216.34/'],
  ['a public IPv6 literal', 'http://[2606:2800:220:1:248:1893:25c8:1946]/'],
  ['a subdomain that merely contains "localhost"', 'https://localhostel.example.com/'],
] as const

const BLOCKED_HOSTS = [
  ['loopback IPv4', 'http://127.0.0.1/'],
  ['loopback, any address in the /8', 'http://127.99.12.7/'],
  ['the name localhost', 'http://localhost/'],
  ['localhost, upper case', 'http://LOCALHOST/'],
  ['a .localhost subdomain', 'http://api.localhost/'],
  ['the unspecified address', 'http://0.0.0.0/'],
  ['private 10/8', 'http://10.0.0.1/'],
  ['private 172.16/12', 'http://172.16.0.1/'],
  ['private 172.31/12, the far end of the range', 'http://172.31.255.254/'],
  ['private 192.168/16', 'http://192.168.1.1/'],
  ['link-local, the cloud metadata address', 'http://169.254.169.254/latest/meta-data/'],
  ['carrier-grade NAT', 'http://100.64.0.1/'],
  ['IPv6 loopback', 'http://[::1]/'],
  ['IPv6 unspecified', 'http://[::]/'],
  ['IPv6 unique local fd00::/8', 'http://[fd00::1]/'],
  ['IPv6 unique local fc00::/7', 'http://[fc00::1]/'],
  ['IPv6 link-local', 'http://[fe80::1]/'],
  /** fe80::/10 runs to febf, so the three quarters above fe80 are link-local as well. */
  ['IPv6 link-local, upper half of the /10', 'http://[feb0::1]/'],
  ['IPv6 link-local, mid range', 'http://[fe9a::1]/'],
  ['IPv4-mapped IPv6 loopback', 'http://[::ffff:127.0.0.1]/'],
] as const

/**
 * Loopback in five other notations. Each of these is a real bypass against a naive prefix check,
 * and each is neutralised by parsing before matching rather than by a longer regex.
 */
const BLOCKED_NOTATIONS = [
  ['decimal integer', 'http://2130706433/'],
  ['octal', 'http://0177.0.0.1/'],
  ['hex', 'http://0x7f.0.0.1/'],
  ['short form', 'http://127.1/'],
  ['percent-encoded host', 'http://%31%32%37.0.0.1/'],
] as const

const BLOCKED_SCHEMES = [
  ['file', 'file:///etc/passwd'],
  ['ftp', 'ftp://example.com/pub'],
  ['gopher', 'gopher://example.com/'],
  ['data', 'data:text/html,<h1>hi</h1>'],
  ['javascript', 'javascript:alert(1)'],
] as const

describe('a public http(s) URL passes', () => {
  it.each(ALLOWED)('1 · %s', (_label, url) => {
    expect(() => assertPublicUrl(url)).not.toThrow()
  })
})

describe('anything that resolves inside the network is refused', () => {
  it.each(BLOCKED_HOSTS)('2 · %s → blocked_url', (_label, url) => {
    expect(() => assertPublicUrl(url)).toThrow(BlockedUrlError)
    expect(reasonOf(url)).toBe('blocked_url')
  })

  it.each(BLOCKED_NOTATIONS)('3 · loopback written as %s → blocked_url', (_label, url) => {
    expect(reasonOf(url)).toBe('blocked_url')
  })
})

describe('only http and https are the web', () => {
  it.each(BLOCKED_SCHEMES)('4 · %s → blocked_url', (_label, url) => {
    expect(reasonOf(url)).toBe('blocked_url')
  })
})

describe('credentials in a URL are refused whatever the host', () => {
  /**
   * `http://user:pass@127.0.0.1/` is the classic form, and the host check already covers it. The
   * case that matters is the PUBLIC host: a URL carrying credentials is either an attempt to
   * reuse someone's session or a secret about to be written into `observations.source_url` in
   * plain text, and neither belongs in a company's source list.
   */
  it('5 · credentials on a public host → blocked_url', () => {
    expect(reasonOf('http://user:pass@example.com/')).toBe('blocked_url')
  })

  it('6 · a username alone is still credentials', () => {
    expect(reasonOf('http://user@example.com/')).toBe('blocked_url')
  })

  it('7 · credentials on a loopback host → blocked_url', () => {
    expect(reasonOf('http://user:pass@127.0.0.1/')).toBe('blocked_url')
  })
})

describe('a string that is not a URL is a different failure from a refused one', () => {
  /**
   * Two reasons, not one. `invalid_url` says the company has no usable address on file — Sales
   * fixes that by typing one. `blocked_url` says the address was understood and refused. Reading
   * "Địa chỉ không được phép đọc" on an empty website field would send someone hunting for a
   * permission problem that does not exist.
   */
  const unparseable = [
    ['empty', ''],
    ['blank', '   '],
    ['no scheme', 'example.com'],
    ['nonsense', 'ht!tp://['],
  ] as const

  it.each(unparseable)('8 · %s → invalid_url', (_label, url) => {
    expect(reasonOf(url)).toBe('invalid_url')
  })
})

/** Reads the reason off the thrown error, and fails loudly if nothing was thrown at all. */
function reasonOf(url: string): string {
  try {
    assertPublicUrl(url)
  } catch (error) {
    if (error instanceof BlockedUrlError) return error.reason
    throw error
  }
  return 'NOTHING WAS THROWN'
}

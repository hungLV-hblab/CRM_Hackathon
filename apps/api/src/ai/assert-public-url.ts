import type { FetchErrorReason } from '@crm/contracts'

/**
 * The SSRF gate — the one thing between "Sales typed a URL" and "our server sends a request to
 * whatever that URL names".
 *
 * PURE, and that is the design rather than a convenience (phase 2, "Tách ba mảnh"). The half of
 * the live source that touches a socket cannot be tested against a loopback server if the gate
 * lives inside it, because the gate blocks loopback — so the two are separate functions and
 * `LiveCrawlSource` is the only place that joins them.
 *
 * WHAT THIS GATE ACTUALLY BUYS, stated plainly so nobody over-trusts it: it refuses addresses
 * that NAME something inside the network — literal private/loopback/link-local IPs in every
 * notation a `URL` normalises, plus `localhost`. It does NOT resolve DNS, so a public hostname
 * whose A record points at `127.0.0.1` still passes here. Closing that needs the resolved address
 * checked at connect time, which is I/O and belongs with `fetchPage`; what is closed today is the
 * redirect hop, because `fetchPage` asks this function again for every hop.
 *
 * The residual risk is bounded by what this feature is: one fetch of an address a signed-in
 * person chose for their own company, never a URL from an untrusted party, and the result only
 * ever reaches a review queue (I-15). That is the trade being made, and it is written down here
 * rather than assumed.
 */

/**
 * Two reasons, not one, because they ask a Sales person for different things. `invalid_url` says
 * there is no usable address on file — type one. `blocked_url` says the address was understood
 * and refused — a different address is needed.
 */
export class BlockedUrlError extends Error {
  constructor(
    readonly reason: Extract<FetchErrorReason, 'blocked_url' | 'invalid_url'>,
    detail: string,
  ) {
    super(`URL bị từ chối (${reason}): ${detail}`)
    this.name = 'BlockedUrlError'
  }
}

/** The web, and nothing else. `file:`, `data:` and `javascript:` are not sources of company news. */
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])

/**
 * IPv4 ranges that never leave the machine or the local network. Written as [first octet, mask,
 * value] tests below rather than as regexes — `169.254.169.254` is one string edit away from
 * `169.255.…` in a regex, and the numeric form cannot drift like that.
 */
function isPrivateIpv4(host: string): boolean {
  const parts = host.split('.')
  if (parts.length !== 4) return false

  const octets = parts.map(Number)
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return false

  const [a, b] = octets

  if (a === 0) return true /** 0.0.0.0/8 — "this network", and 0.0.0.0 itself reaches localhost. */
  if (a === 10) return true /** private */
  if (a === 127) return true /** loopback, the whole /8 and not just .0.1 */
  if (a === 169 && b === 254) return true /** link-local — the cloud metadata service lives here */
  if (a === 172 && b >= 16 && b <= 31) return true /** private */
  if (a === 192 && b === 168) return true /** private */
  if (a === 100 && b >= 64 && b <= 127) return true /** carrier-grade NAT */
  if (a === 192 && b === 0) return true /** IETF protocol assignments */
  if (a === 198 && (b === 18 || b === 19)) return true /** benchmarking */
  if (a >= 224) return true /** multicast, reserved, and 255.255.255.255 */

  return false
}

/**
 * IPv6, on the normalised form a `URL` produces: lower case, `[]`-wrapped, zero-compressed. An
 * IPv4-mapped address arrives as `::ffff:7f00:1` rather than `::ffff:127.0.0.1`, so the mapped
 * range is unpacked back into its four octets instead of being string-matched.
 */
function isPrivateIpv6(host: string): boolean {
  const address = host.slice(1, -1).toLowerCase()

  if (address === '::1' || address === '::') return true
  /**
   * Link-local is fe80::/10, which is fe80 THROUGH febf — not the literal string `fe80:`.
   * `fe90::1` and `feb0::1` are link-local too, and matching only the first of the four would
   * leave three quarters of the range open.
   */
  if (/^fe[89ab][0-9a-f]{0,2}:/.test(address)) return true
  if (/^f[cd][0-9a-f]{0,2}:/.test(address)) return true /** unique local, fc00::/7 */

  const mapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(address)
  if (mapped) {
    const high = Number.parseInt(mapped[1], 16)
    const low = Number.parseInt(mapped[2], 16)
    return isPrivateIpv4([high >> 8, high & 0xff, low >> 8, low & 0xff].join('.'))
  }
  /** The dotted spelling, in case a future parser keeps it verbatim. */
  const dotted = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(address)
  if (dotted) return isPrivateIpv4(dotted[1])

  return false
}

/**
 * Throws `BlockedUrlError` unless this URL is a plain public web address.
 *
 * Parse FIRST, match SECOND. `http://2130706433/`, `http://0x7f.0.0.1/` and `http://127.1/` are
 * all loopback, and a string check for "starts with 127." lets every one of them through — while
 * `new URL()` has already rewritten them to `127.0.0.1` before this function sees the host.
 */
export function assertPublicUrl(url: string): void {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new BlockedUrlError('invalid_url', `không phân tích được: ${JSON.stringify(url)}`)
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new BlockedUrlError('blocked_url', `giao thức ${parsed.protocol} không phải web`)
  }

  /**
   * Credentials in a source URL are refused whatever the host. On a private host the host check
   * would have caught it anyway; on a public one this is the case that matters, because
   * `observations.source_url` is stored and shown, and a password does not belong on a screen.
   */
  if (parsed.username !== '' || parsed.password !== '') {
    throw new BlockedUrlError('blocked_url', 'URL chứa tài khoản/mật khẩu')
  }

  const host = parsed.hostname.toLowerCase()

  if (host === 'localhost' || host.endsWith('.localhost')) {
    throw new BlockedUrlError('blocked_url', 'localhost')
  }
  if (host.startsWith('[') ? isPrivateIpv6(host) : isPrivateIpv4(host)) {
    throw new BlockedUrlError('blocked_url', `địa chỉ nội bộ ${host}`)
  }
}

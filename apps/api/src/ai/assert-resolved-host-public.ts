import { lookup } from 'node:dns/promises'

import { BlockedUrlError, assertPublicUrl, isPrivateAddress } from './assert-public-url'

/**
 * The gate `assert-public-url.ts` says it is NOT: the resolved address, checked before we dial.
 *
 * WHY IT EXISTS NOW AND NOT BEFORE. That file states its own residual risk plainly — it does not
 * resolve DNS, so `http://public-name.example/` whose A record points at `127.0.0.1` passes it —
 * and states the bound that made the risk acceptable: "one fetch of an address a signed-in person
 * chose for their own company, never a URL from an untrusted party".
 *
 * `AgentSourceDiscovery` breaks that bound. The addresses it verifies come from a MODEL reading
 * search results, and a search result is content from a party nobody vetted. Prompt injection on a
 * page that ranks for a company name is a real way to get a URL of someone else's choosing into
 * that list. So the premise the old gate rested on is gone on this path, and the gap it documented
 * has to be closed HERE rather than left as a comment.
 *
 * Confined to this path on purpose: the person-typed crawl path keeps using `assertPublicUrl`
 * alone, so closing this gap costs `LiveCrawlSource` no behaviour change and no new failure mode
 * a day before the demo.
 *
 * WHAT THIS STILL DOES NOT CLOSE, stated so nobody over-trusts it: the resolver is asked here and
 * the socket is opened later by `fetchPage`, so a record whose TTL expires in between can answer
 * differently the second time. Closing that needs the check at connect time, inside the agent that
 * dials. What is closed is the ordinary case — a name that resolves internally right now is refused
 * before any request leaves.
 */

/**
 * A host `URL` already normalised to a literal address needs no resolver: `assertPublicUrl` has
 * checked it directly, and `lookup` on a literal just echoes it back.
 */
function isIpLiteral(host: string): boolean {
  return host.includes(':') || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)
}

/**
 * Throws `BlockedUrlError` unless the URL is public AND every address its host resolves to is
 * public.
 *
 * EVERY address, not the first: a name with both a public and a private A record would otherwise
 * pass here and then be dialled on whichever one the stack happened to pick.
 */
export async function assertResolvedHostPublic(url: string): Promise<void> {
  /** Protocol, credentials and literal-address checks first — cheap, and no resolver needed. */
  assertPublicUrl(url)

  const hostname = new URL(url).hostname.toLowerCase()
  const host = hostname.startsWith('[') ? hostname.slice(1, -1) : hostname
  if (isIpLiteral(host)) return

  let addresses: { address: string }[]
  try {
    addresses = await lookup(host, { all: true })
  } catch {
    /**
     * A name that does not resolve is `invalid_url`, not `blocked_url`, and the difference is the
     * whole point of two reasons: this is the ordinary shape of a hallucinated address, and it
     * should read in the log as "there is nothing at that name" rather than as "we refused it".
     */
    throw new BlockedUrlError('invalid_url', `không phân giải được tên miền ${host}`)
  }

  if (addresses.length === 0) {
    throw new BlockedUrlError('invalid_url', `tên miền ${host} không có địa chỉ nào`)
  }

  for (const { address } of addresses) {
    if (isPrivateAddress(address)) {
      throw new BlockedUrlError('blocked_url', `${host} phân giải về địa chỉ nội bộ ${address}`)
    }
  }
}

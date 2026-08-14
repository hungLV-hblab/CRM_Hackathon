import { Injectable } from '@nestjs/common'

import type { SourceCandidate, SourceDiscovery, SourceDiscoveryInput } from '@crm/contracts'

/**
 * The deterministic stand-in behind `SOURCE_DISCOVERY` when there is no `ANTHROPIC_API_KEY`
 * (ADR-0014's pattern, applied to the second port).
 *
 * It exists for the same reason `FixtureClaimExtractor` does: the ten acceptance checks have to
 * be runnable by a judge who was never given a key, and every integration test has to run without
 * a network. It is NOT a fake that pretends to have searched — the candidates it returns are
 * derived from the company's own record, and the `reason` on each says plainly that no search
 * happened. A fixture that produced convincing-looking third-party URLs would teach a reader to
 * trust output that came from nowhere.
 */
@Injectable()
export class FixtureSourceDiscovery implements SourceDiscovery {
  async discover(input: SourceDiscoveryInput): Promise<SourceCandidate[]> {
    /**
     * No website on file means nothing honest to suggest. Rule 4: an empty list beats an invented
     * address, and the screen already has a sentence for "nothing found".
     */
    if (!input.companyWebsite) return []

    let origin: string
    try {
      origin = new URL(input.companyWebsite).origin
    } catch {
      return []
    }

    /**
     * Derived from the address someone already typed, and labelled as derived. Both are plausible
     * paths on a company's own site, which makes them useful for a demo of the tick-and-save flow
     * without implying a search took place.
     */
    return [
      {
        url: `${origin}/news`,
        sourceTier: 'company_website',
        snippet: `Trang tin của ${input.companyName}`,
        reason: 'Suy ra từ website đã lưu — chưa chạy tìm kiếm thật vì thiếu ANTHROPIC_API_KEY',
      },
      {
        url: `${origin}/press`,
        sourceTier: 'company_website',
        snippet: `Trang thông cáo báo chí của ${input.companyName}`,
        reason: 'Suy ra từ website đã lưu — chưa chạy tìm kiếm thật vì thiếu ANTHROPIC_API_KEY',
      },
    ]
  }
}

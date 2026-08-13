import { describe, expect, it } from 'vitest'

import { DemoSnapshotSource } from '../demo-snapshots'

/**
 * The demo dataset carries two properties that the acceptance run silently depends on, and
 * both are easy to break by editing a paragraph. Neither is visible from reading one snapshot.
 */

const SAKURA = 'aaaaaaaa-0001-4000-8000-000000000001'
const MARLIN = 'aaaaaaaa-0005-4000-8000-000000000005'
const OHARA = 'aaaaaaaa-0004-4000-8000-000000000004'

const FUNDING = 'vòng Series B huy động 20 triệu USD do Mizuho Capital dẫn dắt'

const source = new DemoSnapshotSource()

describe('the company-type lens has exactly one variable to be the difference', () => {
  it('Sakura and Marlin carry the SAME funding news in their "after" snapshot', () => {
    const sakura = source.read(SAKURA, 'after')
    const marlin = source.read(MARLIN, 'after')

    expect(sakura?.rawHtml).toContain(FUNDING)
    expect(marlin?.rawHtml).toContain(FUNDING)
    // `traditional` and `it_product`. Same news, two lenses — if the two readings come out the
    // same, `company_type` is decoration, and that is the question this pair exists to ask.
  })

  it('neither "before" snapshot mentions the funding yet', () => {
    expect(source.read(SAKURA, 'before')?.rawHtml).not.toContain(FUNDING)
    expect(source.read(MARLIN, 'before')?.rawHtml).not.toContain(FUNDING)
  })

  it('each "after" snapshot adds exactly ONE paragraph', () => {
    for (const companyId of [SAKURA, MARLIN]) {
      const before = source.read(companyId, 'before')?.rawHtml ?? ''
      const after = source.read(companyId, 'after')?.rawHtml ?? ''
      // More than one new paragraph and a finding has several passages it could be quoting
      // from, which makes provenance assertions pass for the wrong reason.
      expect(paragraphCount(after) - paragraphCount(before)).toBe(1)
    }
  })
})

describe('an unreadable source stays unreadable', () => {
  it('Ohara returns null in both variants, so `fetch_status = failed` has a real case', () => {
    expect(source.read(OHARA, 'before')).toBeNull()
    expect(source.read(OHARA, 'after')).toBeNull()
  })

  it('a company with no snapshot at all is a failed read, not a crash', () => {
    expect(source.read('00000000-0000-4000-8000-000000000000', 'after')).toBeNull()
  })
})

function paragraphCount(html: string): number {
  return html.match(/<p>/g)?.length ?? 0
}

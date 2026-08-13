import { describe, expect, it } from 'vitest'

import {
  hashSnapshotContent,
  locateVerbatimQuote,
  normalizeSnapshotText,
} from '../normalize-snapshot-text'

/**
 * Guards the property phase 2 lists as a risk: "offsets drift because the text was normalised
 * twice by slightly different rules". The mitigation is that there is ONE function — these
 * tests are what stops a second one from appearing, and what proves the round trip
 * (normalise → locate → slice) lands on the same characters.
 */

const MESSY_HTML = `<html><head><script>track('x')</script><style>.a{color:red}</style></head>
  <body><div class="news">
  <h1>Sakura Manufacturing KK</h1>
  <p>Sakura vừa hoàn tất vòng Series B huy động 20 triệu USD.</p>
  <p>Nhà máy tại Aichi vận hành ba dây chuyền&nbsp;lắp ráp.</p>
  </div></body></html>`

describe('normalizeSnapshotText', () => {
  const text = normalizeSnapshotText(MESSY_HTML)

  it('drops script and style CONTENT, not just their tags', () => {
    expect(text).not.toContain('track')
    expect(text).not.toContain('color:red')
  })

  it('keeps paragraphs apart so two sentences never fuse into one', () => {
    // A blank line between paragraphs, not a single newline: `</p><p>` is two boundaries. What
    // matters for the read zone is that the two sentences stay separated by SOMETHING — fused
    // text would make the "Văn bản" tab unreadable and shift every offset after the join.
    expect(text).toContain('20 triệu USD.\n\nNhà máy tại Aichi')
    expect(text).not.toContain('USD.Nhà máy')
  })

  it('decodes the entities that actually occur in article text', () => {
    expect(text).toContain('dây chuyền lắp ráp')
    expect(text).not.toContain('&nbsp;')
  })

  it('is idempotent — the highlighter re-runs it on stored raw_content', () => {
    expect(normalizeSnapshotText(text)).toBe(text)
  })
})

describe('hashSnapshotContent', () => {
  it('ignores markup-only changes, which is the whole point of hashing the TEXT (I-3)', () => {
    const reordered = MESSY_HTML.replace('<div class="news">', '<div  class = "news" >')
    expect(hashSnapshotContent(normalizeSnapshotText(reordered))).toBe(
      hashSnapshotContent(normalizeSnapshotText(MESSY_HTML)),
    )
  })

  it('changes when a single word changes', () => {
    const edited = MESSY_HTML.replace('20 triệu USD', '30 triệu USD')
    expect(hashSnapshotContent(normalizeSnapshotText(edited))).not.toBe(
      hashSnapshotContent(normalizeSnapshotText(MESSY_HTML)),
    )
  })
})

describe('locateVerbatimQuote — the round trip that makes highlighting honest', () => {
  const text = normalizeSnapshotText(MESSY_HTML)

  it('offsets slice back to exactly the quote', () => {
    const quote = 'vòng Series B huy động 20 triệu USD'
    const span = locateVerbatimQuote(text, quote)

    expect(span).not.toBeNull()
    // This is the assertion the UI depends on: highlight [start, end) of raw_content and the
    // user sees the quote, character for character.
    expect(text.slice(span!.quoteStart, span!.quoteEnd)).toBe(quote)
  })

  it('rejects a paraphrase (I-2) — the field is non-empty, so I-1 alone would let it pass', () => {
    expect(locateVerbatimQuote(text, 'Sakura huy động được 20 triệu đô')).toBeNull()
  })

  it('rejects a blank quote', () => {
    expect(locateVerbatimQuote(text, '   ')).toBeNull()
  })

  it('rejects a quote that only matches the HTML, not the normalised text', () => {
    expect(locateVerbatimQuote(text, 'dây chuyền&nbsp;lắp ráp')).toBeNull()
  })
})

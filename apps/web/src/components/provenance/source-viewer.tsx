'use client'

import { useState } from 'react'

import type { ObservationDto } from '@crm/contracts'

/**
 * The source, with the quoted span marked. This is what makes rule 1 of CLAUDE.md checkable
 * rather than aspirational: clicking a finding lands here, on the exact characters.
 *
 * Two tabs, per ADR-0012:
 *   Văn bản  → `rawContent`, the string the offsets were measured against
 *   Bản gốc  → `rawHtml`, shown as ESCAPED TEXT, never rendered
 *
 * The original is deliberately not rendered as HTML. Rendering a stored snapshot would run
 * whatever markup the page contained inside our origin, and the point of the tab is to let a
 * reader audit what was captured — for which the markup itself is the thing to look at.
 */

type Tab = 'text' | 'source'

export interface SourceViewerProps {
  observation: ObservationDto
  /** Offsets into `observation.rawContent`. Absent → nothing is marked. */
  highlight?: { quoteStart: number; quoteEnd: number }
}

export function SourceViewer({ observation, highlight }: SourceViewerProps) {
  const [tab, setTab] = useState<Tab>('text')

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-xs">
        <TabButton active={tab === 'text'} onClick={() => setTab('text')}>
          Văn bản
        </TabButton>
        <TabButton active={tab === 'source'} onClick={() => setTab('source')}>
          Bản gốc
        </TabButton>
        <span className="ml-auto text-slate-500">
          Chụp lúc {new Date(observation.capturedAt).toLocaleString('vi-VN')}
        </span>
      </div>

      {tab === 'text' ? (
        <HighlightedText content={observation.rawContent} highlight={highlight} />
      ) : (
        <pre className="max-h-80 overflow-auto rounded-md bg-slate-900 p-3 text-xs leading-relaxed text-slate-100">
          {observation.rawHtml ?? 'Không đọc được nguồn — không có bản gốc để hiển thị.'}
        </pre>
      )}
    </div>
  )
}

/**
 * Splits the text into before / quote / after and marks the middle. Slicing by the SAME
 * offsets the API computed is the whole point: if the two ever disagree the highlight lands on
 * the wrong sentence, which looks exactly like working provenance.
 *
 * `<mark>` carries the meaning in the markup, not only in the colour — a judge on a black and
 * white printout still sees which span was quoted.
 */
function HighlightedText({
  content,
  highlight,
}: {
  content: string
  highlight?: { quoteStart: number; quoteEnd: number }
}) {
  if (content.length === 0) {
    return (
      <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-500">
        Nguồn không đọc được nên không có nội dung. Hệ thống không đoán nội dung thay nguồn.
      </p>
    )
  }

  const isUsable =
    highlight !== undefined &&
    highlight.quoteStart >= 0 &&
    highlight.quoteEnd > highlight.quoteStart &&
    highlight.quoteEnd <= content.length

  return (
    <div
      data-testid="source-text"
      className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm leading-relaxed text-fact"
    >
      {isUsable ? (
        <>
          {content.slice(0, highlight.quoteStart)}
          <mark
            data-testid="quote-highlight"
            className="rounded bg-amber-200 px-0.5 font-medium text-slate-900 underline decoration-amber-600 decoration-2"
          >
            {content.slice(highlight.quoteStart, highlight.quoteEnd)}
          </mark>
          {content.slice(highlight.quoteEnd)}
        </>
      ) : (
        content
      )}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? 'rounded-md bg-slate-800 px-2 py-1 font-medium text-white'
          : 'rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100'
      }
    >
      {children}
    </button>
  )
}

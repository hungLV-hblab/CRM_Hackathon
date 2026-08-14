'use client'

import { useState } from 'react'

import {
  FETCH_ERROR_REASON,
  SIGNAL_TYPE,
  SOURCE_KIND,
  SOURCE_TIER,
  type ClaimDto,
  type ObservationWithClaimsDto,
} from '@crm/contracts'

import { Badge } from '@/components/ui/badge'
import { ConfidenceBadge } from '@/components/provenance/quote-block'
import { SourceViewer } from '@/components/provenance/source-viewer'
import { EmptyState } from '@/components/ui/empty-state'

/**
 * The READ ZONE — everything on this screen was produced by the AI, and it is kept visually
 * separate from the company profile and the timeline (rule 2 of CLAUDE.md: a reader must never
 * have to guess which is data and which is something the AI concluded).
 *
 * Findings sit UNDER the snapshot they came from, not in a flat list. That layout is what makes
 * rule 1 auditable by eye: a finding with no snapshot above it has nowhere to sit, so an
 * unsourced finding cannot be rendered by accident — the shape of the data forbids it.
 */
export function ReadingZone({ observations }: { observations: ObservationWithClaimsDto[] }) {
  if (observations.length === 0) {
    return (
      <EmptyState message="Chưa đọc nguồn nào cho công ty này. Bấm “Đọc lại nguồn” để hệ thống đọc bản chụp." compact />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {observations.map((observation) => (
        <SnapshotCard key={observation.id} observation={observation} />
      ))}
    </div>
  )
}

function SnapshotCard({ observation }: { observation: ObservationWithClaimsDto }) {
  /** Which finding is currently being traced back to the source. Null → nothing marked. */
  const [openClaim, setOpenClaim] = useState<ClaimDto | null>(null)

  return (
    <article className="rounded-card border border-machine-200 bg-machine-50 p-4">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <Badge tone="inference">Vùng đọc — do AI sinh</Badge>
        {/*
          Rule 2 applied to the SOURCE, not only to fact-versus-inference. A finding drawn from a
          public page nobody on the team has read carries a different weight from one drawn from
          the vetted snapshot set, and the reader has to see which is which without opening a
          drawer. `warning` on the live kind is not decoration: it is the visual half of I-15,
          whose other half is that these findings can only ever reach the review queue.
        */}
        <Badge tone={observation.sourceKind === 'live_crawl' ? 'warning' : 'neutral'}>
          {SOURCE_KIND[observation.sourceKind]}
        </Badge>
        <Badge tone="neutral">{sourceTierLabel(observation.sourceTier)}</Badge>
        {observation.fetchStatus === 'failed' ? (
          <Badge tone="neutral">Không đọc được nguồn</Badge>
        ) : null}
        <a
          href={observation.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-ink-600 underline underline-offset-2"
        >
          {observation.sourceUrl}
        </a>
      </header>

      {observation.claims.length === 0 ? (
        <p className="mb-3 text-sm text-ink-500">
          {observation.fetchStatus === 'failed'
            ? failedReadSentence(observation.fetchErrorReason)
            : 'Đã đọc nguồn, không có phát hiện nào đáng chú ý.'}
        </p>
      ) : (
        <ul className="mb-3 flex flex-col gap-2">
          {observation.claims.map((claim) => (
            <li
              key={claim.id}
              className="rounded-control border border-machine-200 bg-card p-3 text-sm"
            >
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <ConfidenceBadge confidence={claim.confidence} />
                <Badge tone="neutral">
                  {SIGNAL_TYPE[claim.signalType as keyof typeof SIGNAL_TYPE]}
                </Badge>
              </div>

              <p className="text-suy-luan">{claim.statement}</p>

              {/*
                The button is the ONLY way this finding is presented — there is no branch that
                renders a statement without it, which is rule 1 enforced at the component layer
                rather than by remembering to add a link.
              */}
              <button
                type="button"
                onClick={() => setOpenClaim(openClaim?.id === claim.id ? null : claim)}
                className="mt-1 text-xs text-ink-600 underline underline-offset-2"
              >
                {openClaim?.id === claim.id ? 'Đóng nguồn' : 'Xem câu trích trong nguồn'}
              </button>
            </li>
          ))}
        </ul>
      )}

      <SourceViewer
        observation={observation}
        highlight={
          openClaim
            ? { quoteStart: openClaim.quoteStart, quoteEnd: openClaim.quoteEnd }
            : undefined
        }
      />
    </article>
  )
}

/**
 * Unknown tiers print themselves rather than vanishing. A tier added to the database before this
 * map catches up would otherwise render as an empty badge — a blank where a word belongs reads as
 * a bug in the page, not as a gap in a lookup table.
 */
function sourceTierLabel(sourceTier: string): string {
  return SOURCE_TIER[sourceTier as keyof typeof SOURCE_TIER] ?? sourceTier
}

/**
 * Why the read failed, in a sentence a Sales person can act on — never an HTTP code.
 *
 * This is the payoff for the whole `fetch_error_reason` column. Specs group 2 has ONE state for
 * an unreadable source, and "không đọc được" sends the reader nowhere: a site that blocks
 * automated readers needs a different source, a page that renders in the browser needs a
 * different URL, and a company that published nothing needs neither. A blocked page is
 * INFORMATION about that source, not a broken product, and it has to read that way.
 */
function failedReadSentence(fetchErrorReason: string | null): string {
  const label = FETCH_ERROR_REASON[fetchErrorReason as keyof typeof FETCH_ERROR_REASON]
  if (!label) {
    // No reason on file — every stored snapshot predates the column. Say only what is known.
    return 'Nguồn không đọc được nên không có phát hiện nào. Hệ thống không đoán.'
  }
  return `${label}. Không có phát hiện nào được sinh — hệ thống không đoán.`
}

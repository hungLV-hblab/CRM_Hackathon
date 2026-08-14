'use client'

import { SOURCE_TIER, type CompanySourceCandidateDto } from '@crm/contracts'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * The SUGGESTION LIST — what a search offered, on the machine surface because that is who produced
 * it (design-guidelines section 1: tím = máy sinh ra).
 *
 * These rows are stored now (ADR-0037), and the heading had to change because of it: it used to say
 * "chưa lưu gì", which stopped being true the moment the table existed. A label that is one version
 * behind the data is exactly the wrong line rule 4 is about — worse here than a blank, because it
 * tells a reader their list is about to vanish when it is not.
 *
 * Stored, however, still does not mean IN USE. A candidate is a page nobody has kept, no reader ever
 * fetches it, and the AI identity cannot even read this table — so the badge says what is actually
 * true: found, not yet in the reading list.
 */
export function SourceCandidatePanel({
  candidates,
  isPending,
  picked,
  onTogglePick,
  onUnsave,
  onRemove,
  busy,
}: {
  candidates: CompanySourceCandidateDto[] | undefined
  isPending: boolean
  picked: Set<string>
  onTogglePick: (url: string) => void
  onUnsave: (savedSourceId: string) => void
  onRemove: (candidateId: string) => void
  busy: boolean
}) {
  if (isPending) return <Skeleton className="h-24 w-full rounded-card" />

  return (
    <div className="flex flex-col gap-2 rounded-card border border-machine-200 bg-machine-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-ink-900">Ứng viên do máy tìm</h3>
        <Badge tone="inference">Máy đã tìm được — chưa đưa vào danh sách đọc</Badge>
      </div>

      {!candidates || candidates.length === 0 ? (
        <p className="text-sm text-ink-600">
          Chưa có ứng viên nào. Bấm “Tìm nguồn công khai” để máy đi tìm; không tìm thấy cũng là câu
          trả lời hợp lệ — hệ thống không đoán.
        </p>
      ) : (
        <ul className="grid gap-2 xl:grid-cols-2">
          {candidates.map((candidate) => (
            <li
              key={candidate.id}
              data-testid="source-candidate"
              className="flex flex-col gap-2 rounded-control bg-surface p-3"
            >
              {candidate.savedSourceId ? (
                /**
                 * Already kept. No checkbox, because the tick is not what holds this URL in the
                 * reading list any more — the row in `company_sources` is, and undoing it is a
                 * deletion rather than an unticking. Showing a ticked box would suggest the state
                 * lives in this panel.
                 */
                <div className="flex flex-col gap-1">
                  <CandidateFacts candidate={candidate} />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge tone="fact">Đã trong danh sách đọc</Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => onUnsave(candidate.savedSourceId as string)}
                      disabled={busy}
                    >
                      Bỏ khỏi danh sách đọc
                    </Button>
                  </div>
                </div>
              ) : (
                /**
                 * The 44px target is the whole ROW, not the box — the words are what a finger aims
                 * at, and three lines of them clear the minimum comfortably. Same shape as
                 * `company-profile-section.tsx`, so every checkbox on this screen behaves alike.
                 */
                <label className="flex min-h-11 cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 accent-brand-500"
                    checked={picked.has(candidate.url)}
                    onChange={() => onTogglePick(candidate.url)}
                  />
                  <span className="flex min-w-0 flex-col gap-1">
                    <CandidateFacts candidate={candidate} />
                  </span>
                </label>
              )}

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onRemove(candidate.id)}
                  disabled={busy}
                >
                  Bỏ ứng viên này
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Tier, URL, why, and the quoted fragment — in that order, because that is the order of a decision. */
function CandidateFacts({ candidate }: { candidate: CompanySourceCandidateDto }) {
  return (
    <>
      <span className="flex flex-wrap items-center gap-2">
        <Badge tone="neutral">{tierLabel(candidate.sourceTier)}</Badge>
        <span className="truncate text-xs text-ink-600">{candidate.url}</span>
      </span>
      {/* Why this URL is about THIS company — the sentence a person decides on. Never empty: the
          column is NOT NULL precisely so this line cannot be missing. */}
      <span className="text-sm text-ink-900">{candidate.reason}</span>
      {candidate.snippet && <span className="text-xs text-ink-500">“{candidate.snippet}”</span>}
    </>
  )
}

function tierLabel(sourceTier: string): string {
  return SOURCE_TIER[sourceTier as keyof typeof SOURCE_TIER] ?? sourceTier
}

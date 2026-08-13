'use client'

import { useState } from 'react'

import {
  PROPOSAL_TYPE,
  REJECT_REASON,
  type Decision,
  type ProposalDto,
  type RejectReason,
} from '@crm/contracts'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfidenceBadge } from '@/components/provenance/quote-block'
import { Input } from '@/components/ui/input'

/**
 * One suggestion, with all FOUR things Specs group 3 demands visible in place — no second
 * screen, no tooltip, no expander:
 *
 *   hiện tại → đề nghị · câu trích · mức chắc chắn · hệ quả nếu sai
 *
 * STEP COUNT, which is the requirement people misread (ADR-0008):
 *   Duyệt          1 step  — press it
 *   Bỏ             1 step  — press it, the five reasons unfold IN PLACE, picking one IS the act
 *   Sửa rồi duyệt  2 steps — open the field, then approve. The expensive branch, honestly priced
 *
 * There is no confirm dialog on any branch. Adding one to Duyệt to "balance" the counts was
 * considered and rejected: it punishes the correct action and inflates time-to-decide, the very
 * metric feature group 6 reads.
 *
 * Colour follows the token rule: amber marks what a HUMAN is about to press, machine purple
 * marks what the machine produced. So the buttons are amber and the proposed value is not.
 */

export interface ProposalCardProps {
  proposal: ProposalDto
  /** Called with the decision. The parent owns the clock and the request. */
  onDecide: (decision: Decision, extra: { rejectReason?: RejectReason; finalValue?: string }) => void
  busy: boolean
  onOpenSource: () => void
}

export function ProposalCard({ proposal, onDecide, busy, onOpenSource }: ProposalCardProps) {
  const [reasonsOpen, setReasonsOpen] = useState(false)
  const [editValue, setEditValue] = useState<string | null>(null)

  const isEditing = editValue !== null

  return (
    <article
      data-testid="proposal-card"
      className="flex flex-col gap-3 rounded-control border border-ink-200 bg-card p-4"
    >
      <header className="flex flex-wrap items-center gap-2">
        <Badge tone="inference">{PROPOSAL_TYPE[proposal.proposalType]}</Badge>
        <span className="text-sm font-medium text-ink-900">{proposal.companyName}</span>
        {proposal.opportunityName ? (
          <span className="text-sm text-ink-600">· {proposal.opportunityName}</span>
        ) : null}
        <span className="ml-auto">
          <ConfidenceBadge confidence={proposal.claim.confidence} />
        </span>
      </header>

      <ChangePreview proposal={proposal} />

      {/* Câu trích: the evidence, with a way back to the exact characters of the source. */}
      <figure className="border-l-4 border-machine-200 pl-3">
        <blockquote className="text-sm text-fact">“{proposal.claim.quoteText}”</blockquote>
        <figcaption className="mt-1 text-xs text-ink-500">
          <button
            type="button"
            onClick={onOpenSource}
            className="min-h-11 underline underline-offset-2"
          >
            Xem nguồn
          </button>
        </figcaption>
      </figure>

      {/**
       * Hệ quả nếu sai. Written by the API from a fixed table per field, never by the model —
       * and shown as plain text next to the buttons, because a consequence hidden behind a
       * hover is a consequence nobody read before pressing.
       */}
      {proposal.impactIfWrong ? (
        <p className="rounded-control bg-warning-surface p-2 text-xs text-warning">
          Nếu sai: {proposal.impactIfWrong}
        </p>
      ) : null}

      {isEditing ? (
        <div className="flex flex-wrap items-end gap-2">
          <Input
            label="Sửa lại giá trị"
            value={editValue}
            autoFocus
            onChange={(event) => setEditValue(event.target.value)}
          />
          <Button
            disabled={busy || editValue.trim().length === 0}
            onClick={() => onDecide('edit', { finalValue: editValue.trim() })}
          >
            Duyệt giá trị đã sửa
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => setEditValue(null)}>
            Huỷ sửa
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={busy} onClick={() => onDecide('accept', {})}>
            Duyệt
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => setEditValue(proposal.proposedValue)}
          >
            Sửa rồi duyệt
          </Button>

          {/* Bỏ: one step. The menu unfolds here and choosing a reason completes the act. */}
          <div className="relative">
            <Button
              variant="secondary"
              disabled={busy}
              aria-expanded={reasonsOpen}
              onClick={() => setReasonsOpen((open) => !open)}
            >
              Bỏ
            </Button>
            {reasonsOpen ? (
              <ul
                data-testid="reject-reasons"
                className="absolute left-0 top-full z-10 mt-1 w-64 rounded-control border border-ink-200 bg-card p-1 shadow-lg"
              >
                {(Object.keys(REJECT_REASON) as RejectReason[]).map((reason) => (
                  <li key={reason}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onDecide('reject', { rejectReason: reason })}
                      className="min-h-11 w-full rounded-control px-3 text-left text-sm text-ink-800 hover:bg-ink-100"
                    >
                      {REJECT_REASON[reason]}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      )}
    </article>
  )
}

/**
 * "hiện tại → đề nghị". An empty current value is shown as an explicit "(đang trống)" rather
 * than as blank space: a blank cell and a cell nobody looked at read the same otherwise.
 */
function ChangePreview({ proposal }: { proposal: ProposalDto }) {
  if (proposal.proposalType === 'timeline_entry') {
    return (
      <p className="text-sm">
        <span className="text-ink-500">Thêm vào dòng thời gian: </span>
        <span className="font-medium text-machine-700">{proposal.proposedValue}</span>
      </p>
    )
  }

  return (
    <dl className="flex flex-wrap items-baseline gap-2 text-sm">
      <dt className="text-ink-500">{fieldLabel(proposal.targetField)}:</dt>
      <dd className="text-fact">
        {proposal.currentValue ?? <span className="italic text-ink-400">(đang trống)</span>}
      </dd>
      <dd aria-hidden className="text-ink-400">
        →
      </dd>
      <dd className="font-medium text-machine-700">{proposal.proposedValue}</dd>
    </dl>
  )
}

const FIELD_LABELS: Record<string, string> = {
  industry: 'Ngành',
  country: 'Quốc gia',
  size: 'Quy mô',
  website: 'Website',
  next_step_text: 'Việc tiếp theo',
}

function fieldLabel(field: string | null): string {
  return field ? (FIELD_LABELS[field] ?? field) : 'Nội dung'
}

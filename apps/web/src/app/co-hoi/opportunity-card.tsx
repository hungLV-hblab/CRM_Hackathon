'use client'

import { useSortable } from '@dnd-kit/sortable'
import Link from 'next/link'

import { STAGE, type OpportunityDto } from '@crm/contracts'

import { OverdueFlag, WarningFlags } from '@/components/ui/warning-flag'
import {
  PendingProposalMarker,
  usePendingProposalCounts,
} from '@/components/proposal/pending-proposal-marker'

/**
 * One deal on the board. Draggable by pointer AND by keyboard — `useSortable` wires both, and
 * the keyboard path is the one the acceptance run uses, so it is not a nice-to-have.
 *
 * Nothing here is violet. Feature group 1 contains no AI at all, and a card that borrowed the
 * machine hue would tell Sales the deal was written by the system.
 */
export function OpportunityCard({ opportunity }: { opportunity: OpportunityDto }) {
  /**
   * Read here rather than drilled down from the board: every card shares ONE cache entry under
   * the `pending-proposals` key, so this is one request for the whole screen, and the board
   * does not have to carry a prop it has no use for.
   */
  const pendingProposals = usePendingProposalCounts()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: opportunity.id,
  })

  return (
    <article
      ref={setNodeRef}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        transition,
        opacity: isDragging ? 0.4 : undefined,
      }}
      className="flex flex-col gap-2 rounded-card border border-ink-200 bg-white p-3 shadow-card"
    >
      <div
        {...attributes}
        {...listeners}
        /**
         * The whole body is the grab handle, and it carries `min-h-11` for the 44px touch
         * target. The link below sits outside it so opening a deal does not start a drag.
         */
        className="min-h-11 cursor-grab touch-none rounded-control focus:outline-2 focus:outline-offset-2 focus:outline-brand-600 active:cursor-grabbing"
        aria-label={`Kéo cơ hội ${opportunity.name}, đang ở ${STAGE[opportunity.stage]}`}
      >
        <p className="text-sm font-medium text-ink-900">{opportunity.name}</p>
        <p className="text-xs text-ink-600">{opportunity.companyName}</p>
      </div>

      <PendingProposalMarker count={pendingProposals[opportunity.companyId]} />

      {opportunity.expectedValue ? (
        <p className="tabular text-sm text-ink-700">
          {Number(opportunity.expectedValue).toLocaleString('vi-VN')} ₫
        </p>
      ) : (
        // Rule 4: the empty cell says what is missing rather than showing a bare dash.
        <p className="text-xs text-ink-500">Chưa có giá trị dự kiến</p>
      )}

      <NextStep opportunity={opportunity} />
      <WarningFlags warnings={opportunity.warnings} />

      <Link
        href={`/cong-ty/${opportunity.companyId}`}
        className="text-xs text-ink-600 underline underline-offset-2 hover:text-ink-900"
      >
        Mở công ty
      </Link>
    </article>
  )
}

/** Rule 5 — the next step is the heartbeat, so it is on the card, not behind a click. */
function NextStep({ opportunity }: { opportunity: OpportunityDto }) {
  if (!opportunity.nextStepText || !opportunity.nextStepDueDate) return null

  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm text-ink-800">{opportunity.nextStepText}</p>
      {opportunity.isOverdue ? (
        <OverdueFlag dueDate={opportunity.nextStepDueDate} />
      ) : (
        <p className="tabular text-xs text-ink-600">Hạn {opportunity.nextStepDueDate}</p>
      )}
    </div>
  )
}

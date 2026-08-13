'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import type { AutoNextStepDto } from '@crm/contracts'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfidenceBadge } from '@/components/provenance/quote-block'
import { Dialog } from '@/components/ui/dialog'
import { SourceViewer } from '@/components/provenance/source-viewer'
import { api } from '@/lib/api-client'

/**
 * A Việc tiếp theo the SYSTEM wrote, on the deal card — autonomy zone 3 as Sales meets it.
 *
 * Four things are on screen at once, and none of them is optional:
 *
 *   1. that a machine wrote this. Violet border + a filled violet bar + the words "do hệ thống
 *      điền". Rule 2 says a reader must never have to guess, and design-guidelines section 4
 *      says colour may not be the only carrier — so the bar, the label and the hue all say it,
 *      and the cell survives a greyscale screenshot.
 *   2. the evidence. Rule 1 does not soften in zone 3: the quote is right there and one press
 *      opens the source at the exact characters it came from.
 *   3. why THIS date. Read from the urgency table (I-9), never from the model, and shown as a
 *      sentence — an unexplained date is a number Sales has to take on trust.
 *   4. the way out. "Hoàn tác" is a first-class button next to the cell, never behind a ⋯ menu,
 *      with the days left counted out. CLAUDE.md section 4: undoing must be EASIER than the
 *      write was, and the write cost nobody a single click.
 *
 * Past the 7-day window the button goes and the countdown goes; the machine mark stays. The
 * cell is still something the system wrote, and that fact does not expire.
 */

export interface AutoNextStepCellProps {
  autoNextStep: AutoNextStepDto
  /** The deal's name, for the source dialog title — the card knows it, this component does not. */
  opportunityName: string
}

export function AutoNextStepCell({ autoNextStep, opportunityName }: AutoNextStepCellProps) {
  const queryClient = useQueryClient()
  const [sourceOpen, setSourceOpen] = useState(false)

  const undo = useMutation({
    mutationFn: () => api.undoAutoNextStep(autoNextStep.eventId),
    onSuccess: async () => {
      /**
       * Four caches, because one press changes four things a screen can be showing: the cell
       * itself, the machine mark on it, the undo button in the notification strip, and the
       * notice's own state. Guessing which one the user is looking at is how a stale undo
       * button survives a successful undo.
       */
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['opportunities'] }),
        queryClient.invalidateQueries({ queryKey: ['auto-next-steps'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      ])
    },
  })

  const daysLeft = daysUntil(autoNextStep.undoDeadline)

  return (
    <div
      data-testid="auto-next-step-cell"
      className="flex flex-col gap-2 rounded-control border border-machine-200 bg-machine-50 p-2"
    >
      <div className="flex flex-wrap items-center gap-2">
        {/* The glyph is the colour-blind and greyscale channel for "a machine wrote this". */}
        <Badge tone="system">
          <span aria-hidden className="mr-1">
            ▮
          </span>
          Do hệ thống điền
        </Badge>
        <ConfidenceBadge confidence={autoNextStep.claim.confidence} />
      </div>

      <p className="text-sm font-medium text-ink-900">{autoNextStep.newText}</p>

      {autoNextStep.newDueDate ? (
        <p className="text-xs text-ink-600">
          <span className="tabular">Hạn {autoNextStep.newDueDate}</span> — {autoNextStep.dueReason}{' '}
          (hạn {autoNextStep.dueDays} ngày)
        </p>
      ) : (
        /** Rule 4: an empty cell says why it is empty rather than showing a bare dash. */
        <p className="text-xs text-ink-500">Chưa có ngày hạn — bảng độ gấp không có mục này</p>
      )}

      {/* Rule 1: the finding behind the cell, quoted, with a way back to the source. */}
      <figure className="border-l-4 border-machine-200 pl-2">
        <blockquote className="text-xs text-fact">“{autoNextStep.claim.quoteText}”</blockquote>
        <figcaption className="mt-1">
          <button
            type="button"
            onClick={() => setSourceOpen(true)}
            className="min-h-11 text-xs text-ink-600 underline underline-offset-2"
          >
            Xem câu trích trong nguồn
          </button>
        </figcaption>
      </figure>

      {autoNextStep.canUndo ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            disabled={undo.isPending}
            onClick={() => undo.mutate()}
            data-testid="undo-auto-next-step"
          >
            {undo.isPending ? 'Đang hoàn tác…' : 'Hoàn tác'}
          </Button>
          <span className="text-xs text-ink-600">
            {daysLeft > 0 ? `Còn ${daysLeft} ngày để hoàn tác` : 'Hôm nay là ngày cuối để hoàn tác'}
          </span>
        </div>
      ) : (
        <p className="text-xs text-ink-500">
          Đã quá 7 ngày nên không hoàn tác được nữa. Sửa trực tiếp ô Việc tiếp theo nếu cần.
        </p>
      )}

      {undo.isError ? (
        <p role="alert" className="rounded-control bg-danger-surface p-2 text-xs text-danger">
          {(undo.error as Error).message}
        </p>
      ) : null}

      {sourceOpen ? (
        <SourceDialog
          autoNextStep={autoNextStep}
          opportunityName={opportunityName}
          onClose={() => setSourceOpen(false)}
        />
      ) : null}
    </div>
  )
}

/**
 * The snapshot the finding was drawn from, with the quoted span marked. Fetched on OPEN rather
 * than carried on the card: a snapshot is a whole page, and a board of ten deals would pull ten
 * of them for evidence that is read once.
 */
function SourceDialog({
  autoNextStep,
  opportunityName,
  onClose,
}: {
  autoNextStep: AutoNextStepDto
  opportunityName: string
  onClose: () => void
}) {
  const zone = useQuery({
    queryKey: ['reading-zone', autoNextStep.claim.companyId],
    queryFn: () => api.readingZone(autoNextStep.claim.companyId),
  })

  const observation = zone.data?.find((row) => row.id === autoNextStep.claim.observationId)

  return (
    <Dialog open title={`Nguồn của Việc tiếp theo — ${opportunityName}`} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink-700">{autoNextStep.claim.statement}</p>
        {zone.isLoading ? <p className="text-sm text-ink-500">Đang tải nguồn…</p> : null}
        {observation ? (
          <SourceViewer
            observation={observation}
            highlight={{
              quoteStart: autoNextStep.claim.quoteStart,
              quoteEnd: autoNextStep.claim.quoteEnd,
            }}
          />
        ) : null}
        {!zone.isLoading && !observation ? (
          <p className="text-sm text-ink-600">
            Không tìm thấy bản lưu gốc của phát hiện này. Nếu không xem được nguồn thì nên hoàn tác.
          </p>
        ) : null}
      </div>
    </Dialog>
  )
}

/** One shared cache entry for the whole board: one request, however many cards read it. */
export function useAutoNextSteps(): Record<string, AutoNextStepDto> {
  const query = useQuery({ queryKey: ['auto-next-steps'], queryFn: () => api.autoNextSteps() })
  return query.data ?? {}
}

/** Whole days remaining, rounded UP: half a day left still reads as "còn 1 ngày". */
function daysUntil(deadline: string): number {
  return Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000))
}

'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useRef, useState } from 'react'

import type { Decision, ProposalDto, RejectReason } from '@crm/contracts'

import { Dialog } from '@/components/ui/dialog'
import { ProposalCard } from './proposal-card'
import { SourceViewer } from '@/components/provenance/source-viewer'
import { api } from '@/lib/api-client'

/**
 * Hàng đợi gợi ý — autonomy zone 2 on screen. Nothing on this page happens until a person
 * presses something, and nothing here expires into an action.
 *
 * THE CLOCK (ADR-0025). `seconds_to_decide` is measured from the moment the reviewer became
 * free: the screen opening for the first decision, and the previous decision completing for
 * every one after it. A single shared start would make the tenth card's number include the nine
 * decisions before it, and the median would then measure the length of the queue rather than the
 * time a decision takes.
 *
 * It lives in a ref rather than state on purpose: re-rendering must not restart the clock, and
 * the value is never rendered.
 */
export default function ProposalQueuePage() {
  const queryClient = useQueryClient()
  const [source, setSource] = useState<ProposalDto | null>(null)
  const clockStartedAt = useRef<number>(Date.now())

  const proposals = useQuery({
    queryKey: ['proposals'],
    queryFn: () => api.listPendingProposals(),
  })

  const decide = useMutation({
    mutationFn: ({
      id,
      decision,
      extra,
    }: {
      id: string
      decision: Decision
      extra: { rejectReason?: RejectReason; finalValue?: string }
    }) =>
      api.decideProposal(id, {
        decision,
        ...extra,
        secondsToDecide: Math.max(0, Math.round((Date.now() - clockStartedAt.current) / 1000)),
      }),
    onSuccess: async () => {
      // The next card is timed from here, not from when the page opened.
      clockStartedAt.current = Date.now()

      /**
       * Accepting can change a company profile, a timeline entry or a deal's next step, and the
       * badges elsewhere read the pending count. Invalidate all four rather than guessing which
       * branch ran — a stale profile after an approval is the one thing that would make Sales
       * distrust the queue.
       */
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['proposals'] }),
        queryClient.invalidateQueries({ queryKey: ['pending-proposals'] }),
        queryClient.invalidateQueries({ queryKey: ['companies'] }),
        queryClient.invalidateQueries({ queryKey: ['opportunities'] }),
        queryClient.invalidateQueries({ queryKey: ['timeline'] }),
      ])
    },
  })

  const rows = proposals.data ?? []

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <header>
        <Link href="/cong-ty" className="text-sm text-ink-600 underline underline-offset-2">
          ← Công ty
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Hàng đợi gợi ý</h1>
        <p className="mt-1 text-sm text-ink-600">
          Máy chuẩn bị sẵn, bạn là người quyết. Không duyệt thì hồ sơ giữ nguyên — gợi ý không tự
          hết hạn thành hành động.
        </p>
      </header>

      {decide.isError ? (
        <p role="alert" className="rounded-control bg-danger-surface p-3 text-sm text-danger">
          {(decide.error as Error).message}
        </p>
      ) : null}

      {proposals.isLoading ? <p className="text-sm text-ink-500">Đang tải…</p> : null}

      {!proposals.isLoading && rows.length === 0 ? (
        <p className="rounded-control bg-ink-50 p-4 text-sm text-ink-600" data-testid="queue-empty">
          Không có gợi ý nào đang chờ. Hàng đợi trống là trạng thái bình thường — hệ thống chỉ đề
          xuất khi đọc được nguồn mới.
        </p>
      ) : null}

      <section className="flex flex-col gap-3">
        {rows.map((proposal) => (
          <ProposalCard
            key={proposal.id}
            proposal={proposal}
            busy={decide.isPending}
            onOpenSource={() => setSource(proposal)}
            onDecide={(decision, extra) =>
              decide.mutate({ id: proposal.id, decision, extra })
            }
          />
        ))}
      </section>

      {source ? <SourceDialog proposal={source} onClose={() => setSource(null)} /> : null}
    </main>
  )
}

/**
 * "Xem nguồn" — the observation the finding was drawn from, with the quoted span marked.
 *
 * Fetched on open rather than embedded in the queue response: a snapshot is the whole page and
 * ten of them would make the queue heavy for evidence the reviewer usually reads once.
 */
function SourceDialog({ proposal, onClose }: { proposal: ProposalDto; onClose: () => void }) {
  const zone = useQuery({
    queryKey: ['reading-zone', proposal.companyId],
    queryFn: () => api.readingZone(proposal.companyId),
  })

  const observation = zone.data?.find((row) => row.id === proposal.claim.observationId)

  return (
    <Dialog open title={`Nguồn của gợi ý — ${proposal.companyName}`} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink-700">{proposal.claim.statement}</p>
        {zone.isLoading ? <p className="text-sm text-ink-500">Đang tải nguồn…</p> : null}
        {observation ? (
          <SourceViewer
            observation={observation}
            highlight={{
              quoteStart: proposal.claim.quoteStart,
              quoteEnd: proposal.claim.quoteEnd,
            }}
          />
        ) : null}
        {!zone.isLoading && !observation ? (
          <p className="text-sm text-ink-600">
            Không tìm thấy bản lưu gốc. Gợi ý này không nên duyệt khi chưa xem được nguồn.
          </p>
        ) : null}
      </div>
    </Dialog>
  )
}

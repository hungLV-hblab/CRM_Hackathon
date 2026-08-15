'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useRef, useState } from 'react'

import type { Decision, ProposalDto, RejectReason } from '@crm/contracts'

import { toast } from 'sonner'

import { PageHeader } from '@/components/shell/page-header'
import { Dialog } from '@/components/ui/dialog'
import { FilterBar, type FilterChip } from '@/components/ui/filter-bar'
import { Select } from '@/components/ui/input'
import { ProposalCard } from './proposal-card'
import { SourceViewer } from '@/components/provenance/source-viewer'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { PageBody } from '@/components/shell/page-body'
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
  const [companyFilter, setCompanyFilter] = useState('')
  const [ownerFilter, setOwnerFilter] = useState('')

  const proposals = useQuery({
    queryKey: ['proposals'],
    queryFn: () => api.listPendingProposals(),
  })

  /**
   * The filters narrow the VIEW; the permission boundary already narrowed the DATA (ADR-0046).
   * Two different jobs: a Sales person who looks after eight companies still wants to see one of
   * them at a time, and an administrator looking at the whole team needs to pick a person.
   *
   * Deliberately NOT part of the query key. The rows are already scoped by the server, so
   * filtering further is a client-side narrowing of what is on screen; putting it in the key
   * would mint a cache entry per combination and refetch for nothing.
   */
  const me = useQuery({ queryKey: ['me'], queryFn: () => api.me() })
  const isAdmin = me.data?.role === 'admin'

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
    onSuccess: async (_data, variables) => {
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

      /**
       * Confirms the decision that was just recorded. It carries NO action of its own — a
       * proposal decision is already logged and measured, and an "undo" hidden in a toast
       * would be a second, weaker path to something the queue itself should own.
       */
      toast.success(
        variables.decision === 'accept'
          ? 'Đã duyệt gợi ý'
          : variables.decision === 'edit'
            ? 'Đã lưu giá trị bạn sửa'
            : 'Đã bỏ gợi ý',
      )
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Không ghi được quyết định')
    },
  })

  const all = proposals.data ?? []

  /**
   * Options come from what is actually in the queue, not from a fixed list — a company with
   * nothing waiting is not worth an entry that can only ever empty the list. For the sales
   * dropdown that also means an administrator sees exactly the people who have work pending.
   */
  const companies = useMemo(() => uniqueBy(all, (row) => [row.companyId, row.companyName]), [all])
  const owners = useMemo(
    () => uniqueBy(all, (row) => (row.ownerId ? [row.ownerId, row.ownerName ?? '—'] : null)),
    [all],
  )

  const rows = useMemo(
    () =>
      all.filter(
        (row) =>
          (companyFilter === '' || row.companyId === companyFilter) &&
          (ownerFilter === '' || row.ownerId === ownerFilter),
      ),
    [all, companyFilter, ownerFilter],
  )

  const chips: FilterChip[] = [
    companyFilter
      ? {
          label: `Công ty: ${companies.find(([id]) => id === companyFilter)?.[1] ?? ''}`,
          onRemove: () => setCompanyFilter(''),
        }
      : null,
    ownerFilter
      ? {
          label: `Phụ trách: ${owners.find(([id]) => id === ownerFilter)?.[1] ?? ''}`,
          onRemove: () => setOwnerFilter(''),
        }
      : null,
  ].filter((chip): chip is FilterChip => chip !== null)

  const isFiltered = companyFilter !== '' || ownerFilter !== ''

  function resetFilters() {
    setCompanyFilter('')
    setOwnerFilter('')
  }

  return (
    <PageBody>
      <PageHeader
        title="Hàng đợi gợi ý"
        description="Máy chuẩn bị sẵn, bạn là người quyết. Không duyệt thì hồ sơ giữ nguyên — gợi ý không tự hết hạn thành hành động."
      />

      {decide.isError ? (
        <ErrorState error={decide.error} fallback="Không ghi được quyết định" />
      ) : null}

      {proposals.isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-36 w-full rounded-control" />
          <Skeleton className="h-36 w-full rounded-control" />
        </div>
      ) : null}

      {!proposals.isLoading && all.length > 0 ? (
        <FilterBar chips={chips} onReset={isFiltered ? resetFilters : undefined}>
          <Select
            label="Lọc theo công ty"
            value={companyFilter}
            onChange={(event) => setCompanyFilter(event.target.value)}
          >
            <option value="">Tất cả công ty</option>
            {companies.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </Select>

          {/**
           * Admin only, and HIDDEN rather than disabled for Sales — a control that names other
           * people's work would be the only place on this screen suggesting there is more of it.
           * This is a convenience, not the boundary: the boundary is in the server (ADR-0046),
           * which is why hiding a control is enough here.
           */}
          {isAdmin ? (
            <Select
              label="Lọc theo người phụ trách"
              value={ownerFilter}
              onChange={(event) => setOwnerFilter(event.target.value)}
            >
              <option value="">Tất cả người phụ trách</option>
              {owners.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </Select>
          ) : null}
        </FilterBar>
      ) : null}

      {/**
       * TWO different sentences, on purpose. "The queue is empty" and "your filter matched
       * nothing" are different facts, and saying the first when the second is true would tell the
       * reader their work is done when it is not.
       */}
      {!proposals.isLoading && all.length === 0 ? (
        <p className="rounded-control bg-ink-50 p-4 text-sm text-ink-600" data-testid="queue-empty">
          Không có gợi ý nào đang chờ. Hàng đợi trống là trạng thái bình thường — hệ thống chỉ đề
          xuất khi đọc được nguồn mới.
        </p>
      ) : null}

      {!proposals.isLoading && all.length > 0 && rows.length === 0 ? (
        <p
          className="rounded-control bg-ink-50 p-4 text-sm text-ink-600"
          data-testid="queue-filtered-empty"
        >
          Không có gợi ý nào khớp bộ lọc đang bật. Bỏ bộ lọc để xem lại {all.length} gợi ý đang
          chờ.
        </p>
      ) : null}

      <section className="flex flex-col gap-3">
        {rows.map((proposal) => (
          <ProposalCard
            key={proposal.id}
            proposal={proposal}
            busy={decide.isPending}
            showOwner={isAdmin}
            onOpenSource={() => setSource(proposal)}
            onDecide={(decision, extra) =>
              decide.mutate({ id: proposal.id, decision, extra })
            }
          />
        ))}
      </section>

      {source ? <SourceDialog proposal={source} onClose={() => setSource(null)} /> : null}
    </PageBody>
  )
}

/**
 * Distinct `[id, label]` pairs in the order they appear, skipping rows the picker returns `null`
 * for — that is how a company with no assigned owner stays out of the sales dropdown instead of
 * becoming a blank option that filters to nothing.
 */
function uniqueBy(
  rows: ProposalDto[],
  pick: (row: ProposalDto) => [string, string] | null,
): [string, string][] {
  const seen = new Map<string, string>()
  for (const row of rows) {
    const pair = pick(row)
    if (pair && !seen.has(pair[0])) seen.set(pair[0], pair[1])
  }
  return [...seen.entries()]
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
        {zone.isLoading ? <Skeleton className="h-24 w-full rounded-control" /> : null}
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

'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { SOURCE_TIER, type CompanyDto, type SourceCandidateDto } from '@crm/contracts'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api-client'

/**
 * Where this company's pages are chosen — and the screen where rule 3 of CLAUDE.md is visible:
 * **máy chuẩn bị sẵn, người quyết định ghi.**
 *
 * The two buttons are deliberately not one. "Tìm nguồn công khai" runs the search and shows what
 * came back; nothing is stored until someone ticks rows and presses "Lưu nguồn đã chọn". A single
 * find-and-save button would be less clicking and would hand the AI the choice of which pages it
 * later draws conclusions from — the one thing this whole feature is arranged to prevent.
 *
 * The cost of that split is visible here too: a refresh loses the candidate list, because there is
 * nowhere to keep it. That is the trade, and it is the right way round.
 */
export function SourceDiscoverySection({ company }: { company: CompanyDto }) {
  const queryClient = useQueryClient()
  const [candidates, setCandidates] = useState<SourceCandidateDto[] | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())

  const sources = useQuery({
    queryKey: ['company-sources', company.id],
    queryFn: () => api.listCompanySources(company.id),
  })

  const liveSource = useMutation({
    mutationFn: (enabled: boolean) => api.setLiveSource(company.id, enabled),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['company', company.id] })
    },
  })

  const discover = useMutation({
    mutationFn: () => api.findSourceCandidates(company.id),
    onSuccess: (found) => {
      setCandidates(found)
      setPicked(new Set())
    },
  })

  const save = useMutation({
    mutationFn: () =>
      api.saveCompanySources(company.id, {
        sources: (candidates ?? [])
          .filter((candidate) => picked.has(candidate.url))
          .map((candidate) => ({
            url: candidate.url,
            sourceTier: candidate.sourceTier as 'company_website' | 'news' | 'social',
            searchSnippet: candidate.snippet,
          })),
      }),
    onSuccess: async () => {
      setCandidates(null)
      setPicked(new Set())
      await queryClient.invalidateQueries({ queryKey: ['company-sources', company.id] })
    },
  })

  const remove = useMutation({
    mutationFn: (sourceId: string) => api.removeCompanySource(company.id, sourceId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['company-sources', company.id] })
    },
  })

  function togglePicked(url: string): void {
    setPicked((current) => {
      const next = new Set(current)
      if (next.has(url)) next.delete(url)
      else next.add(url)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/*
        The switch first, because everything below it is inert until it is on. Stating the two
        gates in the same breath keeps "I turned it on and nothing happened" from being a mystery:
        a seed company is refused outright, and the server has to be started with the live source
        configured at all.
      */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-control bg-ink-100 px-3 py-2">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink-900">
            Đọc nguồn web thật cho công ty này
          </span>
          <span className="text-xs text-ink-600">
            {company.liveSourceEnabled
              ? 'Đang bật. Phát hiện từ nguồn thật chỉ vào hàng đợi duyệt, không tự ghi vào dòng thời gian.'
              : 'Đang tắt. Công ty này chỉ đọc bản chụp đã lưu.'}
          </span>
        </div>
        <Button
          type="button"
          variant={company.liveSourceEnabled ? 'secondary' : 'primary'}
          onClick={() => liveSource.mutate(!company.liveSourceEnabled)}
          disabled={liveSource.isPending}
        >
          {company.liveSourceEnabled ? 'Tắt nguồn thật' : 'Bật nguồn thật'}
        </Button>
      </div>

      {liveSource.isError && (
        <p className="rounded-control bg-danger-surface px-3 py-2 text-sm text-danger">
          {errorText(liveSource.error)}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-ink-900">Nguồn đang dùng để đọc</h3>
          <Button
            type="button"
            variant="secondary"
            onClick={() => discover.mutate()}
            disabled={discover.isPending}
          >
            {discover.isPending ? 'Đang tìm… (10–20 giây)' : 'Tìm nguồn công khai'}
          </Button>
        </div>

        {sources.isPending && <Skeleton className="h-16 w-full rounded-card" />}

        {sources.data?.length === 0 && (
          <EmptyState
            message="Chưa chọn nguồn nào. Hệ thống sẽ đọc website trong hồ sơ; bấm “Tìm nguồn công khai” để thêm trang khác."
            compact
          />
        )}

        {sources.data && sources.data.length > 0 && (
          <ul className="flex flex-col gap-2">
            {sources.data.map((source) => (
              <li
                key={source.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-ink-200 px-3 py-2"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">{tierLabel(source.sourceTier)}</Badge>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-xs text-ink-600 underline underline-offset-2"
                    >
                      {source.url}
                    </a>
                  </div>
                  {source.searchSnippet && (
                    <p className="text-xs text-ink-500">{source.searchSnippet}</p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => remove.mutate(source.id)}
                  disabled={remove.isPending}
                >
                  Bỏ nguồn này
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {discover.isError && (
        <p className="rounded-control bg-danger-surface px-3 py-2 text-sm text-danger">
          {errorText(discover.error)}
        </p>
      )}

      {candidates !== null && (
        <div className="flex flex-col gap-2 rounded-card border border-machine-200 bg-machine-50 p-3">
          {/*
            The machine hue marks the whole block: everything in it was produced by a search, and
            none of it is stored. The heading says so in words as well — colour is never the only
            carrier (design-guidelines section 7).
          */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge tone="inference">Ứng viên do máy tìm — chưa lưu gì</Badge>
            <Button
              type="button"
              onClick={() => save.mutate()}
              disabled={picked.size === 0 || save.isPending}
            >
              Lưu {picked.size} nguồn đã chọn
            </Button>
          </div>

          {candidates.length === 0 ? (
            <p className="text-sm text-ink-600">
              Không tìm được trang nào chắc chắn nói về công ty này. Không tìm thấy là câu trả lời
              hợp lệ — hệ thống không đoán.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {candidates.map((candidate) => (
                <li key={candidate.url} className="rounded-control bg-surface p-3">
                  {/*
                    The 44px target is the whole ROW, not the box — the words are what a finger
                    aims at, and three lines of them clear the minimum comfortably. Same shape as
                    `company-profile-section.tsx`, so the two checkboxes on this screen behave
                    identically.
                  */}
                  <label className="flex min-h-11 cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 size-4 accent-brand-500"
                      checked={picked.has(candidate.url)}
                      onChange={() => togglePicked(candidate.url)}
                    />
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <Badge tone="neutral">{tierLabel(candidate.sourceTier)}</Badge>
                        <span className="truncate text-xs text-ink-600">{candidate.url}</span>
                      </span>
                      {/* Why this URL is about THIS company — the sentence a person decides on. */}
                      <span className="text-sm text-ink-900">{candidate.reason}</span>
                      {candidate.snippet && (
                        <span className="text-xs text-ink-500">“{candidate.snippet}”</span>
                      )}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {save.isError && (
        <p className="rounded-control bg-danger-surface px-3 py-2 text-sm text-danger">
          {errorText(save.error)}
        </p>
      )}
    </div>
  )
}

function tierLabel(sourceTier: string): string {
  return SOURCE_TIER[sourceTier as keyof typeof SOURCE_TIER] ?? sourceTier
}

/** The server's Vietnamese sentence, not a status code — an I-16 refusal has to read as one. */
function errorText(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Không thực hiện được thao tác'
}

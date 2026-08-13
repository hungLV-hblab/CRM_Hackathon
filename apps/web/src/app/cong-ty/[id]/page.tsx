'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useParams } from 'next/navigation'

import { COMPANY_TYPE, type IngestResultDto } from '@crm/contracts'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ReadingZone } from '@/components/provenance/reading-zone'
import { api, ApiError } from '@/lib/api-client'

/**
 * Company detail. TWO clearly separated regions, which is the point of the screen:
 *
 *   Hồ sơ    — Sales' official data. Facts.
 *   Vùng đọc — everything the AI produced, on an amber background, each finding sitting under
 *              its own snapshot with a link back to the quoted characters.
 *
 * Rule 2 of CLAUDE.md says a reader must tell the two apart WITHOUT reading an explanation, so
 * the separation is structural (different sections, different framing) rather than a note.
 *
 * The profile fields and the timeline belong to feature group 1 and land here later; this page
 * currently renders the profile read-only.
 */
export default function CompanyDetailPage() {
  const params = useParams<{ id: string }>()
  const companyId = params.id
  const queryClient = useQueryClient()

  /**
   * There is no `GET /companies/:id` yet, so the name comes from the list the app already
   * fetches. Deliberately not inventing an endpoint feature group 1 will design properly —
   * four companies make this free.
   */
  const companies = useQuery({ queryKey: ['companies'], queryFn: api.listCompanies })
  const company = companies.data?.find((candidate) => candidate.id === companyId)

  const readingZone = useQuery({
    queryKey: ['reading-zone', companyId],
    queryFn: () => api.readingZone(companyId),
  })

  const ingest = useMutation({
    mutationFn: (variant: 'before' | 'after') =>
      api.ingestSnapshot(companyId, { variant, triggerContext: 'manual_ingest' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['reading-zone', companyId] })
    },
  })

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href="/cong-ty" className="text-sm text-slate-600 underline underline-offset-2">
            ← Danh sách công ty
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">{company?.name ?? 'Công ty'}</h1>
        </div>
        {company?.isWatched ? <Badge tone="fact">Đang theo dõi</Badge> : null}
      </header>

      <section className="rounded-lg border border-slate-200 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Hồ sơ
        </h2>
        {company ? (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Ngành" value={company.industry} />
            <Field
              label="Loại hình"
              value={COMPANY_TYPE[company.companyType as keyof typeof COMPANY_TYPE]}
            />
            <Field label="Quốc gia" value={company.country} />
            <Field label="Quy mô" value={company.size} />
            <Field label="Website" value={company.website} />
          </dl>
        ) : (
          <p className="text-sm text-slate-500">Đang tải…</p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Vùng đọc
          </h2>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              disabled={ingest.isPending}
              onClick={() => ingest.mutate('before')}
            >
              Đọc bản chụp trước
            </Button>
            <Button disabled={ingest.isPending} onClick={() => ingest.mutate('after')}>
              {ingest.isPending ? 'Đang đọc…' : 'Đọc bản chụp sau'}
            </Button>
          </div>
        </div>

        {ingest.isError && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {ingest.error instanceof ApiError ? ingest.error.message : 'Không đọc được nguồn'}
          </p>
        )}
        {ingest.data && <IngestSummary result={ingest.data} />}

        {readingZone.isPending && <p className="text-sm text-slate-500">Đang tải vùng đọc…</p>}
        {readingZone.data && <ReadingZone observations={readingZone.data} />}
      </section>
    </main>
  )
}

/**
 * What the last read produced, in numbers. The dropped count is shown even when it is zero:
 * ADR-0014 makes the share of findings rejected for an unverifiable quote a METRIC, and a
 * number that only appears when it is inconvenient is not a metric.
 */
function IngestSummary({ result }: { result: IngestResultDto }) {
  if (result.skippedReason === 'ai_disabled') {
    return (
      <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">
        AI đang tắt nên không đọc nguồn. Dữ liệu đã có vẫn còn nguyên.
      </p>
    )
  }

  if (result.unchanged) {
    return (
      <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">
        Đã đọc, nội dung không đổi — không tạo bản lưu mới, không gọi LLM.
      </p>
    )
  }

  if (result.fetchStatus === 'failed') {
    return (
      <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">
        Không đọc được nguồn. Đã ghi lại lần đọc này, không có phát hiện nào được sinh.
      </p>
    )
  }

  return (
    <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">
      Lưu {result.claimsSaved}/{result.claimsProposed} phát hiện ·{' '}
      {result.claimsDroppedNoVerbatimQuote} bị bỏ vì câu trích không khớp nguyên văn ·{' '}
      {result.claimsDowngradedFromCertain} bị hạ từ mức Chắc
    </p>
  )
}

/** Rule 4: an empty cell says it is empty. It never gets a plausible filler. */
function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-fact">{value ?? <span className="text-slate-400">—</span>}</dd>
    </div>
  )
}

'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'

import type { CompanyDto } from '@crm/contracts'

import { PageHeader } from '@/components/shell/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api, ApiError } from '@/lib/api-client'

/**
 * "Đang theo dõi" — the screen where a person hands the machine permission to write.
 *
 * Turning this flag on is the single most consequential click in the product: it moves a company
 * from autonomy zone 2 (the AI proposes, a person decides) into zone 4 (the AI writes news onto
 * the official timeline with nobody's approval). ADR-0006 is explicit that the flag IS the
 * delegation, which is why two things on this page are requirements rather than polish:
 *
 *   the switch is ONE action — Specs asks for it, and the reason is symmetry. Zone 4 is bought by
 *   "undoing is easier than the machine's own act"; a two-step confirm to switch it OFF would put
 *   the friction on exactly the wrong side.
 *
 *   the consequence is spelled out in words, next to the switch, before it is pressed. Without
 *   that sentence the label reads like a bookmark, and a person would be delegating write access
 *   to their CRM believing they had subscribed to a newsletter. That is the trap ADR-0006 names.
 */
export default function WatchedCompaniesPage() {
  const queryClient = useQueryClient()

  const companies = useQuery({
    queryKey: ['companies', {}],
    queryFn: () => api.listCompanies(),
  })

  const toggle = useMutation({
    mutationFn: ({ companyId, isWatched }: { companyId: string; isWatched: boolean }) =>
      api.setWatched(companyId, isWatched),
    onSuccess: async () => {
      // The company detail screen renders the same flag, so both caches are stale from here.
      await queryClient.invalidateQueries({ queryKey: ['companies'] })
      await queryClient.invalidateQueries({ queryKey: ['company'] })
    },
  })

  const rows = companies.data ?? []
  const watched = rows.filter((row) => row.isWatched)
  const unwatched = rows.filter((row) => !row.isWatched)

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      {/* The "← Danh sách công ty" link that used to open this header is the shell's job now:
          the sidebar reaches every screen and the breadcrumb says where this one sits. */}
      <PageHeader
        title="Đang theo dõi"
        actions={
          <Link
            href="/quan-tri/nhat-ky-vong-quet"
            className="text-sm text-ink-600 underline underline-offset-2"
          >
            Nhật ký vòng quét →
          </Link>
        }
      />

      {/**
       * The delegation warning. Machine-hued because it describes what the MACHINE will do, and
       * placed above the list so it is read before any switch is pressed rather than after.
       */}
      <section className="rounded-card border border-machine-200 bg-machine-50 p-4">
        <div className="mb-2 flex items-center gap-2">
          <Badge tone="system">Uỷ quyền cho hệ thống</Badge>
        </div>
        <p className="text-sm text-ink-900">
          Bật <strong>Đang theo dõi</strong> nghĩa là hệ thống sẽ tự ghi tin mới vào dòng thời gian
          của công ty đó, <strong>không hỏi duyệt</strong>.
        </p>
        <p className="mt-2 text-sm text-ink-700">
          Mỗi mục hệ thống thêm đều mang nhãn “do hệ thống thêm”, bấm ra được đoạn nguồn đã trích,
          và bạn xoá được kèm một lý do ngắn. Tin của công ty <em>không</em> theo dõi vẫn đi vào
          hàng đợi chờ bạn duyệt.
        </p>
      </section>

      {toggle.isError && (
        <p role="alert" className="rounded-control bg-red-50 px-3 py-2 text-sm text-red-700">
          {toggle.error instanceof ApiError
            ? toggle.error.message
            : 'Không đổi được trạng thái theo dõi'}
        </p>
      )}

      {companies.isPending && <p className="text-sm text-ink-500">Đang tải…</p>}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">
          Hệ thống đang tự ghi tin cho {watched.length} công ty
        </h2>
        {watched.length === 0 ? (
          <p className="rounded-control border border-dashed border-ink-300 p-3 text-sm text-ink-600">
            Chưa uỷ quyền cho công ty nào. Vòng quét vẫn chạy nhưng không có gì để đọc, và mọi tin
            đi vào hàng đợi duyệt.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {watched.map((company) => (
              <CompanyRow
                key={company.id}
                company={company}
                pending={toggle.isPending}
                onToggle={() => toggle.mutate({ companyId: company.id, isWatched: false })}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">
          Chưa theo dõi — tin đi vào hàng đợi duyệt
        </h2>
        {unwatched.length === 0 ? (
          <p className="rounded-control border border-dashed border-ink-300 p-3 text-sm text-ink-600">
            Mọi công ty đều đang được theo dõi.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {unwatched.map((company) => (
              <CompanyRow
                key={company.id}
                company={company}
                pending={toggle.isPending}
                onToggle={() => toggle.mutate({ companyId: company.id, isWatched: true })}
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

/**
 * One row, one button, one click either way.
 *
 * The button carries the brand hue because amber marks what a person is about to press
 * (docs/design-guidelines.md), and `aria-pressed` states the flag rather than leaving it to the
 * label — a switch whose only cue is the verb on it reads ambiguously to a screen reader.
 */
function CompanyRow({
  company,
  pending,
  onToggle,
}: {
  company: CompanyDto
  pending: boolean
  onToggle: () => void
}) {
  return (
    <li
      className={`flex flex-wrap items-center gap-3 rounded-card border p-3 ${
        company.isWatched ? 'border-machine-200 bg-machine-50' : 'border-ink-200 bg-white'
      }`}
    >
      <div className="min-w-0 flex-1">
        <Link
          href={`/cong-ty/${company.id}`}
          className="text-sm font-medium text-ink-900 underline underline-offset-2"
        >
          {company.name}
        </Link>
        <p className="text-xs text-ink-600">{company.industry}</p>
      </div>

      {company.isWatched ? <Badge tone="system">Hệ thống tự ghi tin</Badge> : null}

      <Button
        variant={company.isWatched ? 'secondary' : 'primary'}
        disabled={pending}
        aria-pressed={company.isWatched}
        onClick={onToggle}
      >
        {company.isWatched ? 'Tắt theo dõi' : 'Bật theo dõi'}
      </Button>
    </li>
  )
}

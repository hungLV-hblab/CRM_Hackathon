'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import type { CompanyDto } from '@crm/contracts'

import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/ui/error-state'
import { SectionCard } from '@/components/ui/section-card'
import { api } from '@/lib/api-client'

/**
 * Which stored snapshot counts as a company's source right now — the demo control (ADR-0021/0022).
 *
 * It is here so a live demo never has to leave the browser for a terminal: flipping Sakura to
 * `after` is what makes the funding item appear, and doing that in a shell beside the projector
 * turns a product demonstration into a database demonstration.
 *
 * The current variant is shown only for companies flipped IN THIS SESSION, and that restraint is
 * deliberate: `CompanyDto` does not carry `snapshot_variant` because it is scaffolding rather than
 * part of Sales' data model (`DemoSnapshotService`). Widening the DTO to render one label on one
 * admin screen would put the demo's plumbing on every screen that reads a company.
 */
export function SnapshotVariantSwitch() {
  const companies = useQuery({ queryKey: ['companies', {}], queryFn: () => api.listCompanies() })
  const [variants, setVariants] = useState<Record<string, 'before' | 'after'>>({})

  const flip = useMutation({
    mutationFn: ({ companyId, variant }: { companyId: string; variant: 'before' | 'after' }) =>
      api.setSnapshotVariant(companyId, variant),
    // The response is authoritative; the button state follows what the API stored, not the click.
    onSuccess: (result) =>
      setVariants((current) => ({ ...current, [result.id]: result.snapshotVariant })),
  })

  // No `page` was requested, so the envelope carries every company in one page.
  const rows = companies.data?.items ?? []

  return (
    <SectionCard title="Bản chụp nguồn (dùng khi demo)">
      <p className="text-sm text-ink-600">
        Đổi bản chụp là <strong>nguồn của công ty đổi</strong>, không phải AI đổi ý. Bản{' '}
        <code className="rounded bg-ink-100 px-1 py-0.5 text-xs">sau</code> mang tin mới; vòng quét
        đọc lại ở nhịp kế tiếp và tự thêm mục dòng thời gian cho công ty Đang theo dõi.
      </p>

      {companies.isPending && <p className="text-sm text-ink-500">Đang tải…</p>}

      <ul className="flex flex-col gap-2">
        {rows.map((company) => (
          <CompanyRow
            key={company.id}
            company={company}
            variant={variants[company.id]}
            busy={flip.isPending}
            onFlip={(variant) => flip.mutate({ companyId: company.id, variant })}
          />
        ))}
      </ul>

      {flip.isError && (
        <ErrorState error={flip.error} fallback="Không đổi được bản chụp" />
      )}
    </SectionCard>
  )
}

function CompanyRow({
  company,
  variant,
  busy,
  onFlip,
}: {
  company: CompanyDto
  /** Undefined until this session flips it — see the note about `CompanyDto` above. */
  variant?: 'before' | 'after'
  busy: boolean
  onFlip: (next: 'before' | 'after') => void
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-ink-200 p-2">
      <span className="text-sm text-ink-900">
        {company.name}
        <span className="ml-2 text-xs text-ink-600">
          {variant ? (
            <>
              vừa đặt sang bản <strong>{variant === 'after' ? 'sau' : 'trước'}</strong>
            </>
          ) : (
            /** Rule 4 again: say the value is unknown here rather than print a plausible guess. */
            'chưa đổi trong phiên này'
          )}
        </span>
      </span>
      <span className="flex gap-2">
        <Button
          variant={variant === 'before' ? 'primary' : 'secondary'}
          disabled={busy}
          onClick={() => onFlip('before')}
        >
          Bản trước
        </Button>
        <Button
          variant={variant === 'after' ? 'primary' : 'secondary'}
          disabled={busy}
          onClick={() => onFlip('after')}
        >
          Bản sau
        </Button>
      </span>
    </li>
  )
}

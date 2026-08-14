'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api-client'

/**
 * "Đang có gợi ý chờ duyệt" — the marker Specs group 3 asks for on the company screen and the
 * deal list, so nobody has to remember to go and look at the queue.
 *
 * One shared hook for all three call sites. The count comes from `/proposals/pending-summary`,
 * a `companyId → count` map, rather than from a field on `CompanyDto`: the deal list needs the
 * count per company too, and widening two DTOs to carry the same number would give the marker
 * two sources that can disagree.
 *
 * Machine purple, never amber: this is something the machine produced. The amber lives on the
 * buttons inside the queue, where a person actually acts (docs/design-guidelines.md).
 */
export function usePendingProposalCounts(): Record<string, number> {
  const summary = useQuery({
    queryKey: ['pending-proposals'],
    queryFn: () => api.pendingProposalSummary(),
  })
  return summary.data ?? {}
}

export function PendingProposalMarker({ count }: { count: number | undefined }) {
  if (!count) return null

  return (
    <Link href="/hang-doi" className="rounded-pill" data-testid="pending-proposal-marker">
      <Badge tone="system">
        {count} gợi ý chờ duyệt
      </Badge>
    </Link>
  )
}

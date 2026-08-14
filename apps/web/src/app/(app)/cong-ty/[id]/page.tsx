'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useParams } from 'next/navigation'

import { Badge } from '@/components/ui/badge'
import {
  PendingProposalMarker,
  usePendingProposalCounts,
} from '@/components/proposal/pending-proposal-marker'
import { Button } from '@/components/ui/button'
import { CompanyProfileSection } from './company-profile-section'
import { ContactSection } from './contact-section'
import { IngestSummary } from './ingest-summary'
import { ReadingZone } from '@/components/provenance/reading-zone'
import { TimelineSection } from './timeline-section'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { PageBody } from '@/components/shell/page-body'
import { SectionCard } from '@/components/ui/section-card'
import { SourceDiscoverySection } from './source-discovery-section'
import { api } from '@/lib/api-client'

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
 * This file only ASSEMBLES. Each of the three feature-group-1 regions lives in its own file
 * and owns its own queries, so the read zone below keeps its position on the page and its
 * components stay untouched while group 1 grows.
 */
export default function CompanyDetailPage() {
  const params = useParams<{ id: string }>()
  const companyId = params.id
  const queryClient = useQueryClient()

  const companyQuery = useQuery({
    queryKey: ['company', companyId],
    queryFn: () => api.getCompany(companyId),
  })
  const company = companyQuery.data

  const readingZone = useQuery({
    queryKey: ['reading-zone', companyId],
    queryFn: () => api.readingZone(companyId),
  })

  /** Specs group 3: this screen says when something is waiting, so nobody has to remember. */
  const pendingProposals = usePendingProposalCounts()

  const ingest = useMutation({
    mutationFn: (variant: 'before' | 'after') =>
      api.ingestSnapshot(companyId, { variant, triggerContext: 'manual_ingest' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['reading-zone', companyId] })
      // Reading a source can raise suggestions, so the marker below is stale from this moment.
      await queryClient.invalidateQueries({ queryKey: ['pending-proposals'] })
    },
  })

  return (
    <PageBody>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href="/cong-ty" className="text-sm text-ink-600 underline underline-offset-2">
            ← Danh sách công ty
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">{company?.name ?? 'Công ty'}</h1>
        </div>
        <div className="flex items-center gap-2">
          <PendingProposalMarker count={pendingProposals[companyId]} />
          {company?.isWatched ? <Badge tone="fact">Đang theo dõi</Badge> : null}
        </div>
      </header>

      {company && <CompanyProfileSection company={company} />}
      {!company && <Skeleton className="h-40 w-full rounded-card" />}

      {/**
       * Two columns from `lg` up; below that everything stacks in DOM order, which is also the
       * reading order. The split uses grid columns rather than `order-*` on purpose: reordering
       * visually while leaving the DOM alone is exactly what makes a screen reader and a sighted
       * reader disagree about what comes next.
       *
       * The timeline takes the wide column because it is the thing being read. The contacts and
       * the read zone are reference material beside it — and on a 1440px display they used to be
       * a thousand pixels further down while 40% of the screen sat empty.
       */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
        <TimelineSection companyId={companyId} />

        <div className="flex flex-col gap-6">
          <ContactSection companyId={companyId} />

          <SectionCard
            title="Vùng đọc"
            actions={
              <>
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
              </>
            }
          >
            {ingest.isError && <ErrorState error={ingest.error} fallback="Không đọc được nguồn" />}
            {ingest.data && <IngestSummary result={ingest.data} />}

            {readingZone.isPending && <Skeleton className="h-40 w-full rounded-card" />}
            {readingZone.data && <ReadingZone observations={readingZone.data} />}
          </SectionCard>
        </div>
      </div>

      {/*
        AFTER the grid, so it gets the full width — and still after the read zone in DOM order,
        which is the order someone thinks in: what was found, then where it was found. Nothing above
        moves, so the read zone keeps the position it had.

        It was inside the 24rem column until 14/08 and could not fit what it holds: every candidate
        carries a tier, a URL, a reason and a quoted snippet, which is three or four lines each, and
        the two lists are only useful when they can be read side by side.
      */}
      {company && (
        <SectionCard title="Nguồn đọc">
          <SourceDiscoverySection company={company} />
        </SectionCard>
      )}
    </PageBody>
  )
}


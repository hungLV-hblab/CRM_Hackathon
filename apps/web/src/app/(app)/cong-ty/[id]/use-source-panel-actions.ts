'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { CompanyDto, CompanySourceDto } from '@crm/contracts'

import { api } from '@/lib/api-client'

/**
 * Every read and every write behind the "Nguồn đọc" panel, in one place — so the section itself is
 * layout and this file is the answer to "what happens when that button is pressed".
 *
 * The split is not cosmetic. Which queries get invalidated after which write is the part that goes
 * wrong silently: a save that refreshes the reading list but not the suggestion list leaves the
 * candidate that was just kept still showing a tick box, and the screen contradicts the database
 * without anything failing. Those decisions are gathered here rather than scattered through JSX.
 */
export function useSourcePanelActions(company: CompanyDto) {
  const queryClient = useQueryClient()

  const sources = useQuery({
    queryKey: ['company-sources', company.id],
    queryFn: () => api.listCompanySources(company.id),
  })

  /**
   * A QUERY, not `useState` — this is the line that makes candidates survive a reload. Before
   * ADR-0037 the list only existed inside the component, so a refresh threw away a paid search.
   */
  const candidates = useQuery({
    queryKey: ['company-source-candidates', company.id],
    queryFn: () => api.listSourceCandidates(company.id),
  })

  const refreshCandidates = () =>
    queryClient.invalidateQueries({ queryKey: ['company-source-candidates', company.id] })
  const refreshSources = () =>
    queryClient.invalidateQueries({ queryKey: ['company-sources', company.id] })
  /** Both, for a write that can change whether a candidate is in the reading list. */
  const refreshBoth = () => Promise.all([refreshSources(), refreshCandidates()])

  const liveSource = useMutation({
    mutationFn: (enabled: boolean) => api.setLiveSource(company.id, enabled),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['company', company.id] })
    },
  })

  const discover = useMutation({
    mutationFn: () => api.findSourceCandidates(company.id),
    onSuccess: refreshCandidates,
  })

  /**
   * The read that follows saving a list, so nobody waits out a watch cycle to see what their
   * choice produced.
   *
   * A SEPARATE mutation rather than a second step inside `save`, because the two can fail
   * independently and a reader has to be able to tell which one did: the URLs are stored the
   * moment `save` returns, and a page that then times out must not read as "nothing was saved"
   * (rule 4 — a wrong line is worse than a blank one).
   *
   * `manual_ingest`, not `watch_cycle`, and that is the invariant rather than a default: I-4 bars
   * a manually triggered finding from becoming a timeline entry. Someone pressed a button here,
   * so borrowing the watch cycle's context to get the extra autonomy would be autonomy zone 4
   * taken without Specs opening it (CLAUDE.md section 4).
   *
   * `variant` is required by the contract and ignored on the live path — the live reader takes its
   * URLs from the saved list, never from a stored snapshot.
   */
  const readAfterSave = useMutation({
    mutationFn: () =>
      api.ingestSnapshot(company.id, { variant: 'after', triggerContext: 'manual_ingest' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['reading-zone', company.id] })
      // A live-source read can only raise suggestions (I-15), so the queue marker is stale now.
      await queryClient.invalidateQueries({ queryKey: ['pending-proposals'] })
    },
  })

  const save = useMutation({
    mutationFn: (urls: Set<string>) =>
      api.saveCompanySources(company.id, {
        sources: (candidates.data ?? [])
          .filter((candidate) => urls.has(candidate.url))
          .map((candidate) => ({
            url: candidate.url,
            sourceTier: candidate.sourceTier as 'company_website' | 'news' | 'social',
            searchSnippet: candidate.snippet ?? undefined,
          })),
      }),
    onSuccess: async () => {
      /**
       * The candidate list is REFRESHED, never cleared. Keeping it is the point: the rows that were
       * just kept come back carrying `savedSourceId`, so the panel can say "đã trong danh sách đọc"
       * instead of quietly losing the search that produced them.
       */
      await refreshBoth()

      /**
       * Only when the switch is on, because only then does the saved list get read at all:
       * `ObservationService.collectReads` consults the reading list on the live branch and nowhere
       * else. With the switch off the list is inert, and reading anyway would re-read the stored
       * snapshot — a read whose result has nothing to do with what was just saved.
       */
      if (company.liveSourceEnabled) readAfterSave.mutate()
    },
  })

  const remove = useMutation({
    mutationFn: (sourceId: string) => api.removeCompanySource(company.id, sourceId),
    // Both lists: dropping a source clears the `savedSourceId` of any candidate sharing its URL.
    onSuccess: refreshBoth,
  })

  const toggleSource = useMutation({
    mutationFn: (source: CompanySourceDto) =>
      api.setCompanySourceEnabled(company.id, source.id, !source.enabled),
    onSuccess: refreshSources,
  })

  const removeCandidate = useMutation({
    mutationFn: (candidateId: string) => api.removeSourceCandidate(company.id, candidateId),
    onSuccess: refreshCandidates,
  })

  return {
    sources,
    candidates,
    liveSource,
    discover,
    save,
    readAfterSave,
    remove,
    toggleSource,
    removeCandidate,
  }
}

'use client'

import { useState } from 'react'

import type { CompanyDto } from '@crm/contracts'

import { Button } from '@/components/ui/button'
import { IngestSummary } from './ingest-summary'
import { SourceCandidatePanel } from './source-candidate-panel'
import { SourceListPanel } from './source-list-panel'
import { useSourcePanelActions } from './use-source-panel-actions'

/**
 * Where this company's pages are chosen — and the screen where rule 3 of CLAUDE.md is visible:
 * **máy chuẩn bị sẵn, người quyết định ghi.**
 *
 * TWO LISTS, side by side, because they mean two different things (ADR-0037):
 *
 *   left  — the READING LIST. Every row was kept by a person; this is what the crawler fetches.
 *   right — the SUGGESTION LIST. What a search offered. Stored, so a refresh no longer costs
 *           10–20 seconds and a paid search — in a table the AI identity holds no privilege on.
 *
 * The two buttons are deliberately not one. "Tìm nguồn công khai" searches and shows what came back;
 * nothing reaches the reading list until somebody ticks rows and presses "Lưu nguồn đã chọn". A
 * single find-and-save button would be less clicking and would hand the AI the choice of which pages
 * it later draws conclusions from — the one thing this whole feature is arranged to prevent.
 *
 * WHY THE BATCH BUTTON STAYS, now that a candidate's state lives on the server: one save triggers
 * one read, and a read is a fetch plus an LLM call for every URL in the list. Ticking four
 * candidates one at a time would buy four reads. So the tick stays local and the save is the event.
 *
 * `picked` is the ONLY state this component owns. Everything else is server state, which is what
 * makes a reload harmless.
 */
export function SourceDiscoverySection({ company }: { company: CompanyDto }) {
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const actions = useSourcePanelActions(company)
  const { sources, candidates, liveSource, discover, save, readAfterSave } = actions

  function togglePicked(url: string): void {
    setPicked((current) => {
      const next = new Set(current)
      if (next.has(url)) next.delete(url)
      else next.add(url)
      return next
    })
  }

  /** A fresh search invalidates every tick: those URLs may not be on the new list at all. */
  function runSearch(): void {
    setPicked(new Set())
    discover.mutate()
  }

  function savePicked(): void {
    const urls = picked
    setPicked(new Set())
    save.mutate(urls)
  }

  const saving = save.isPending || readAfterSave.isPending

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
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={company.liveSourceEnabled ? 'secondary' : 'primary'}
            onClick={() => liveSource.mutate(!company.liveSourceEnabled)}
            disabled={liveSource.isPending}
          >
            {company.liveSourceEnabled ? 'Tắt nguồn thật' : 'Bật nguồn thật'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={runSearch}
            disabled={discover.isPending}
          >
            {discover.isPending ? 'Đang tìm… (10–20 giây)' : 'Tìm nguồn công khai'}
          </Button>
        </div>
      </div>

      {/* Every failure in this panel reports in the same shape, so no branch invents its own. */}
      {[
        liveSource.error,
        discover.error,
        save.error,
        actions.remove.error,
        actions.toggleSource.error,
        actions.removeCandidate.error,
      ]
        .filter(Boolean)
        .map((error, index) => (
          <Problem key={index}>{errorText(error)}</Problem>
        ))}

      {/*
        Two columns from `lg`, in DOM order rather than with `order-*`: reordering visually while
        leaving the DOM alone is what makes a screen reader and a sighted reader disagree about what
        comes first. Kept pages on the left because they are what the system acts on.
      */}
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <SourceListPanel
          sources={sources.data}
          isPending={sources.isPending}
          onToggle={(source) => actions.toggleSource.mutate(source)}
          onRemove={(sourceId) => actions.remove.mutate(sourceId)}
          busy={actions.toggleSource.isPending || actions.remove.isPending}
        />

        <div className="flex flex-col gap-2">
          <SourceCandidatePanel
            candidates={candidates.data}
            isPending={candidates.isPending}
            picked={picked}
            onTogglePick={togglePicked}
            onUnsave={(savedSourceId) => actions.remove.mutate(savedSourceId)}
            onRemove={(candidateId) => actions.removeCandidate.mutate(candidateId)}
            busy={actions.remove.isPending || actions.removeCandidate.isPending}
          />

          <div className="flex justify-end">
            <Button type="button" onClick={savePicked} disabled={picked.size === 0 || saving}>
              {save.isPending
                ? 'Đang lưu…'
                : readAfterSave.isPending
                  ? 'Đã lưu — đang đọc nguồn…'
                  : `Lưu ${picked.size} nguồn đã chọn`}
            </Button>
          </div>
        </div>
      </div>

      {/*
        The read that follows the save reports itself HERE rather than up in the read zone, next to
        the click that caused it. Its failure names the save as having succeeded, because it did —
        the URLs are in the list and the button above is what to press to try reading them again.
      */}
      {readAfterSave.isPending && (
        <p className="rounded-control bg-ink-100 px-3 py-2 text-sm text-ink-700">
          Đã lưu nguồn. Đang đọc ngay, không chờ vòng quét…
        </p>
      )}

      {readAfterSave.isError && (
        <Problem>Đã lưu nguồn, nhưng chưa đọc được: {errorText(readAfterSave.error)}</Problem>
      )}

      {readAfterSave.data && <IngestSummary result={readAfterSave.data} />}
    </div>
  )
}

function Problem({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-control bg-danger-surface px-3 py-2 text-sm text-danger">
      {children}
    </p>
  )
}

/** The server's Vietnamese sentence, not a status code — an I-16 refusal has to read as one. */
function errorText(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Không thực hiện được thao tác'
}

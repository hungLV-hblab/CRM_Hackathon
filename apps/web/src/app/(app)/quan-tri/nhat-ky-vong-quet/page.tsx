'use client'

import { useQuery } from '@tanstack/react-query'

import type { WatchCycleRunDto } from '@crm/contracts'

import { PageHeader } from '@/components/shell/page-header'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api-client'

/**
 * "Nhật ký vòng quét" — one line per cycle, and the reason it is a required screen rather than a
 * debugging aid is autonomy zone 4: the watch cycle writes to Sales' official timeline without
 * asking, so the log is the only place the loop can be inspected after the fact. Round 2 asks its
 * questions from this table.
 *
 * FOUR NUMBERS PER CYCLE, always, including the zeroes. The pair that carries the most
 * information is `newContentCount` next to `entriesAdded`:
 *
 *   read 3, wrote 0  → the filter or the prompt is wrong. Phase 5 measured exactly this failure
 *                      and it looked identical to "the model found nothing" until the per-gate
 *                      counts existed.
 *   read 0, wrote 0  → "đã đọc, không đổi" — I-3 doing its job, not a quiet system.
 *
 * Those two states must never render the same way, which is why the zero case gets its own words
 * instead of a row of dashes.
 */

/** Vietnamese for what the skip reasons mean. A raw enum on screen is a shrug at the reader. */
const SKIP_REASON_TEXT: Record<string, string> = {
  ai_disabled: 'Bỏ nhịp — AI đang tắt',
  previous_cycle_running: 'Bỏ nhịp — vòng trước chưa xong',
}

export default function WatchCycleLogPage() {
  const runs = useQuery({
    queryKey: ['watch-cycle-runs'],
    queryFn: () => api.listWatchCycleRuns(),
    /** The worker writes a row every cycle; a static page would look like a stopped system. */
    refetchInterval: 10_000,
  })

  const rows = runs.data ?? []

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      {/* The "← Đang theo dõi" link that used to open this header is the shell's job now — the
          sidebar reaches that screen in one press from here. */}
      <PageHeader title="Nhật ký vòng quét" actions={<Badge tone="system">Do hệ thống ghi</Badge>} />

      <p className="text-sm text-ink-600">
        Mỗi vòng quét ghi một dòng, kể cả vòng bị bỏ nhịp — không có dòng thì không phân biệt được
        “hệ thống đang tắt” với “hệ thống đã chết”. Mỗi 10 vòng có thêm một dòng cộng dồn.
      </p>

      {runs.isPending && <p className="text-sm text-ink-500">Đang tải…</p>}

      {rows.length === 0 && !runs.isPending && (
        <p className="rounded-control border border-dashed border-ink-300 p-4 text-sm text-ink-600">
          Chưa có vòng quét nào được ghi. Nếu worker đang chạy thì dòng đầu tiên xuất hiện trong
          vòng một chu kỳ.
        </p>
      )}

      <ol className="flex flex-col gap-2">
        {rows.map((run) => (
          <RunRow key={run.id} run={run} />
        ))}
      </ol>
    </main>
  )
}

function RunRow({ run }: { run: WatchCycleRunDto }) {
  const skipText = run.skippedReason ? SKIP_REASON_TEXT[run.skippedReason] : null

  return (
    <li
      className={
        /** The rolled-up line is made prominent — it is the one a reader scans for. */
        run.isRollup
          ? 'rounded-card border-2 border-machine-300 bg-machine-50 p-3'
          : 'rounded-card border border-ink-200 bg-white p-3'
      }
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {run.isRollup && <Badge tone="system">Cộng dồn {run.cyclesCovered} vòng</Badge>}
        <span className="tabular text-xs text-ink-700">
          {new Date(run.startedAt).toLocaleString('vi-VN')}
        </span>
        {run.durationMs !== null && (
          <span className="tabular text-xs text-ink-500">{run.durationMs} ms</span>
        )}
        {skipText && <Badge tone="warning">{skipText}</Badge>}
        {run.errorCount > 0 && <Badge tone="warning">{run.errorCount} lỗi</Badge>}
      </div>

      {skipText ? (
        <p className="text-sm text-ink-600">
          Vòng này không đọc nguồn nào. Dòng vẫn được ghi để nhìn thấy nhịp không bị mất.
        </p>
      ) : (
        <>
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <Number label="Công ty đã quét" value={run.companiesScanned} />
            <Number label="Có nội dung mới" value={run.newContentCount} />
            <Number label="Mục tự thêm" value={run.entriesAdded} />
            <Number label="Lỗi" value={run.errorCount} />
          </dl>

          {/**
           * The two zero-states, told apart in words. Rendering both as "0" would hide the one
           * that means something is broken behind the one that means everything is fine.
           */}
          {run.companiesScanned > 0 && run.newContentCount === 0 && (
            <p className="mt-2 text-sm text-ink-600">
              Đã đọc, không đổi — không tạo bản lưu mới và không gọi LLM (I-3).
            </p>
          )}
          {run.newContentCount > 0 && run.entriesAdded === 0 && (
            <p className="mt-2 rounded-control bg-warning-surface px-3 py-2 text-sm text-warning">
              Có nội dung mới nhưng không mục nào được thêm. Đáng xem lại bộ lọc hoặc prompt —
              đây <strong>không</strong> đồng nghĩa với “không tìm được gì”.
            </p>
          )}
        </>
      )}

      {run.errorDetail && (
        <p className="mt-2 rounded-control bg-warning-surface px-3 py-2 text-sm text-warning">
          {run.errorDetail}
        </p>
      )}
    </li>
  )
}

function Number({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs text-ink-500">{label}</dt>
      <dd className="tabular text-sm font-medium text-ink-900">{value}</dd>
    </div>
  )
}

import type { IngestResultDto } from '@crm/contracts'

/**
 * What the last read produced, in numbers. The dropped count is shown even when it is zero:
 * ADR-0014 makes the share of findings rejected for an unverifiable quote a METRIC, and a
 * number that only appears when it is inconvenient is not a metric.
 *
 * Its own file because TWO screens report a read now — the "Đọc bản chụp" buttons at the top of
 * the company page, and the read that follows saving a reading list. A second copy would drift,
 * and the copy that drifts is the one that stops mentioning the dropped findings.
 */
export function IngestSummary({ result }: { result: IngestResultDto }) {
  if (result.skippedReason === 'ai_disabled') {
    return (
      <p className="rounded-control bg-ink-100 px-3 py-2 text-sm text-ink-700">
        AI đang tắt nên không đọc nguồn. Dữ liệu đã có vẫn còn nguyên.
      </p>
    )
  }

  if (result.unchanged) {
    return (
      <p className="rounded-control bg-ink-100 px-3 py-2 text-sm text-ink-700">
        Đã đọc, nội dung không đổi — không tạo bản lưu mới, không gọi LLM.
      </p>
    )
  }

  if (result.fetchStatus === 'failed') {
    return (
      <p className="rounded-control bg-ink-100 px-3 py-2 text-sm text-ink-700">
        Không đọc được nguồn. Đã ghi lại lần đọc này, không có phát hiện nào được sinh.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="rounded-control bg-ink-100 px-3 py-2 text-sm text-ink-700">
        Lưu {result.claimsSaved}/{result.claimsProposed} phát hiện ·{' '}
        {result.claimsDroppedNoVerbatimQuote} bị bỏ vì câu trích không khớp nguyên văn ·{' '}
        {result.claimsDowngradedFromCertain} bị hạ từ mức Chắc
      </p>

      {/**
        * Autonomy zone 4 said out loud, at the moment it happens.
        *
        * On a company carrying Đang theo dõi, this read just wrote to the official timeline with
        * nobody approving it (ADR-0028) — and the person who pressed the button is standing right
        * here. Saying nothing would mean the only way to notice is to scroll up and spot a new row,
        * which is not what "máy tự làm thì phải nói" means. The machine hue marks who wrote it.
        */}
      {result.systemEntriesAdded > 0 && (
        <p className="rounded-control bg-machine-50 px-3 py-2 text-sm text-ink-900">
          Hệ thống đã tự thêm {result.systemEntriesAdded} mục vào dòng thời gian vì công ty này
          đang được theo dõi. Mỗi mục có câu trích bấm ra được, và bạn xoá được kèm lý do.
        </p>
      )}
    </div>
  )
}

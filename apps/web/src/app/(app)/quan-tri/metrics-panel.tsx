'use client'

import { CONFIDENCE, REJECT_REASON, type DistributionRow, type MetricsDto, type RateDto } from '@crm/contracts'

/**
 * The seven measurements of ontology section 7, under the names the ontology gives them.
 *
 * Two display rules run through everything below, and both exist because a number on this screen
 * is read out loud in a room where nobody can check it:
 *
 *   - **Every rate shows its denominator.** "100%" over one decision is not the same claim as
 *     "100%" over forty, and a tile that prints only the percentage invites the second reading.
 *   - **An empty denominator says "chưa có dữ liệu", never `0%`.** `0%` beside "Error-detection
 *     rate" reads as "the AI is wrong every time"; beside "Auto-accept rate" it reads as "nobody
 *     accepts anything". Both are fabrications, which rule 4 forbids more strongly than it
 *     forbids a gap.
 *
 * No chart library. The two distributions are CSS bars — a dependency added the evening before
 * the freeze buys a nicer rectangle and risks the build.
 */
export function MetricsPanel({ metrics }: { metrics: MetricsDto }) {
  const edr = metrics.errorDetectionRate

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <RateTile
          label="Auto-accept rate"
          rate={metrics.autoAcceptRate}
          meaning="Hệ thống có khôn lên không"
          formula="duyệt / (duyệt + sửa-rồi-duyệt + bỏ)"
        />
        <RateTile
          label="Tỉ lệ sửa-rồi-duyệt"
          rate={metrics.editRate}
          meaning="Tách bạch khỏi duyệt (I-12) — gợi ý phải sửa lại không phải gợi ý đúng"
          formula="sửa-rồi-duyệt / tổng quyết định"
        />
        <RateTile
          label="Error-detection rate"
          rate={edr}
          meaning="Người có khôn lên không"
          formula="(bỏ vì sai · bỏ vì hiểu sai ngữ cảnh · hoàn tác · xoá mục hệ thống) / tổng output AI đưa ra trước mặt người"
        />
        <RateTile
          label="Tỉ lệ hoàn tác"
          rate={metrics.undoRate}
          meaning="Vùng tự chủ 3 có đáng tin không"
          formula="số lần hoàn tác / tổng lần hệ thống tự đặt Việc tiếp theo"
        />
      </section>

      {/*
        The error-detection rate itemised, because its denominator is a DECISION (ADR-0031) and
        not an obvious total. Anyone reading the number is entitled to see which rows are in it.
      */}
      <section className="flex flex-col gap-3 rounded-card border border-ink-200 bg-surface p-5 shadow-card">
        <h2 className="text-base font-semibold text-ink-900">Error-detection rate — đếm những gì</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Breakdown
            title="Tử số · người bác lại máy"
            rows={[
              { key: 'Bỏ vì thông tin sai', count: edr.numeratorBreakdown.rejectedWrongInfo },
              { key: 'Bỏ vì hiểu sai ngữ cảnh', count: edr.numeratorBreakdown.rejectedMisreadContext },
              { key: 'Hoàn tác Việc tiếp theo máy đặt', count: edr.numeratorBreakdown.undoneAutoNextSteps },
              { key: 'Xoá mục dòng thời gian máy thêm', count: edr.numeratorBreakdown.deletedSystemEntries },
            ]}
            total={edr.numerator}
          />
          <Breakdown
            title="Mẫu số · những gì máy đưa ra trước mặt người"
            rows={[
              { key: 'Gợi ý chờ duyệt', count: edr.denominatorBreakdown.proposals },
              { key: 'Lần tự đặt Việc tiếp theo', count: edr.denominatorBreakdown.autoNextStepEvents },
              { key: 'Mục dòng thời gian do máy thêm', count: edr.denominatorBreakdown.systemTimelineEntries },
            ]}
            total={edr.denominator}
          />
        </div>
        <p className="text-sm text-ink-600">
          <strong>Phát hiện</strong> không nằm trong mẫu số. Chúng chưa đến tay ai nên không ai bác
          được — cộng vào thì mẫu số phồng 5–10 lần và tỉ lệ nằm gần 0 vĩnh viễn.
        </p>
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <DistributionCard
          title="Thời gian quyết trung bình"
          description="Chỉ đọc CÙNG error-detection rate: quyết nhanh có thể là giao diện tốt, cũng có thể là bấm mù."
        >
          {metrics.decisionTime.medianSeconds === null ? (
            <Empty reason="Chưa có gợi ý nào được quyết kèm mốc thời gian." />
          ) : (
            <>
              <p className="tabular text-3xl font-semibold text-ink-900">
                {formatSeconds(metrics.decisionTime.medianSeconds)}
              </p>
              <p className="text-xs text-ink-600">
                trung vị trên <span className="tabular">{metrics.decisionTime.sampleSize}</span> quyết
                định
              </p>
            </>
          )}
          {/*
            ADR-0025 lets the mark be lost on a page reload, and the column is left EMPTY rather
            than guessed. A median quoted without saying how many rows had no mark is unauditable.
          */}
          <p className="text-xs text-ink-500">
            <span className="tabular">{metrics.decisionTime.missingTimestamps}</span> bản ghi mất mốc
            (tải lại trang giữa lúc quyết) — để trống, không gửi số bịa.
          </p>
        </DistributionCard>

        <DistributionCard
          title="Phân bố lý do bỏ"
          description="Máy sai ở đâu. Lý do lấy tại chỗ lúc bấm Bỏ, không phải hộp thoại riêng."
        >
          <Bars rows={metrics.rejectReasons} label={(key) => REJECT_REASON[key as keyof typeof REJECT_REASON] ?? key} />
        </DistributionCard>

        <DistributionCard
          title="Phân bố mức chắc chắn"
          description="AI có đang tự tin quá mức không — đọc cùng tỉ lệ bỏ."
        >
          <Bars rows={metrics.confidences} label={(key) => CONFIDENCE[key as keyof typeof CONFIDENCE] ?? key} />
        </DistributionCard>
      </section>

      <DistributionCard
        title="Lý do xoá mục do hệ thống thêm"
        description="Vùng tự chủ 4 ghi thẳng vào dữ liệu chính thức; đây là chỗ duy nhất đọc được máy đã sai chuyện gì."
      >
        <Bars rows={metrics.systemEntryDeleteReasons} label={(key) => key} />
      </DistributionCard>
    </div>
  )
}

function RateTile({
  label,
  rate,
  meaning,
  formula,
}: {
  label: string
  rate: RateDto
  meaning: string
  formula: string
}) {
  return (
    <div className="flex flex-col gap-1 rounded-card border border-ink-200 bg-surface p-4 shadow-card">
      <p className="text-sm font-medium text-ink-700">{label}</p>
      {rate.rate === null ? (
        // Rule 4 — an empty cell says WHY it is empty, and never gets filled with a stand-in.
        <p className="text-lg font-semibold text-ink-500">Chưa có dữ liệu</p>
      ) : (
        <p className="tabular text-3xl font-semibold text-ink-900">
          {(rate.rate * 100).toFixed(1)}%
        </p>
      )}
      {/* The denominator travels with every rate — 1 of 1 is 100% and means nothing. */}
      <p className="tabular text-xs text-ink-600">
        {rate.numerator}/{rate.denominator} {rate.denominator === 0 ? '(mẫu số 0)' : '(tử số/mẫu số)'}
      </p>
      <p className="mt-1 text-xs text-ink-600">{meaning}</p>
      <p className="text-xs text-ink-500">{formula}</p>
    </div>
  )
}

function Breakdown({
  title,
  rows,
  total,
}: {
  title: string
  rows: DistributionRow[]
  total: number
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-medium text-ink-700">{title}</p>
      <dl className="flex flex-col gap-1">
        {rows.map((row) => (
          <div key={row.key} className="flex justify-between gap-3 text-sm">
            <dt className="text-ink-600">{row.key}</dt>
            <dd className="tabular text-ink-900">{row.count}</dd>
          </div>
        ))}
        <div className="mt-1 flex justify-between gap-3 border-t border-ink-200 pt-1 text-sm font-medium">
          <dt className="text-ink-700">Tổng</dt>
          <dd className="tabular text-ink-900">{total}</dd>
        </div>
      </dl>
    </div>
  )
}

function DistributionCard({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-2 rounded-card border border-ink-200 bg-surface p-5 shadow-card">
      <h2 className="text-base font-semibold text-ink-900">{title}</h2>
      <p className="text-xs text-ink-600">{description}</p>
      {children}
    </section>
  )
}

/** CSS bars, no chart library. Each bar carries its count in text — the width alone is a guess. */
function Bars({ rows, label }: { rows: DistributionRow[]; label: (key: string) => string }) {
  if (rows.length === 0) return <Empty reason="Chưa có bản ghi nào." />

  const max = Math.max(...rows.map((row) => row.count))

  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <li key={row.key} className="flex flex-col gap-1">
          <div className="flex justify-between gap-3 text-sm">
            <span className="min-w-0 text-ink-700">{label(row.key)}</span>
            <span className="tabular text-ink-900">{row.count}</span>
          </div>
          <div className="h-2 w-full rounded-pill bg-ink-100">
            <div
              className="h-2 rounded-pill bg-ink-400"
              style={{ width: `${Math.round((row.count / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

function Empty({ reason }: { reason: string }) {
  return <p className="text-sm text-ink-500">{reason}</p>
}

/** Seconds up to a minute, then minutes — "132 giây" is a number nobody converts while reading. */
function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(0)} giây`
  return `${(seconds / 60).toFixed(1)} phút`
}

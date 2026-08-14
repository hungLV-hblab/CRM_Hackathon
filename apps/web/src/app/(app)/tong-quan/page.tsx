'use client'

import { CircleCheck } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'

import { STAGE, type OverviewDto } from '@crm/contracts'

import { Cell, Table } from '@/components/ui/table'
import { OverdueFlag, WarningFlags } from '@/components/ui/warning-flag'
import { PageHeader } from '@/components/shell/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { EmptyState } from '@/components/ui/empty-state'
import { PageBody } from '@/components/shell/page-body'
import { api } from '@/lib/api-client'
import { cn } from '@/lib/utils'

/**
 * The overview. Four blocks, and two of them exist to keep a number honest:
 *
 * - the pipeline block reports "Tạm dừng" SEPARATELY. A paused deal folded into the running
 *   total inflates the figure somebody reads out in a meeting.
 * - the lost-reason block puts deals with no reason on their own line, OUTSIDE the table, so
 *   the reasons add up to the deals that actually have one.
 *
 * No AI on this screen, therefore no machine hue anywhere on it.
 */
export default function OverviewPage() {
  const overview = useQuery({ queryKey: ['overview'], queryFn: api.overview })

  return (
    <PageBody>
      <PageHeader title="Tổng quan" />

      {/* Skeletons shaped like the four blocks that are coming, so the page does not jump
          when they arrive. A single line of "Đang tải…" reflows the whole screen. */}
      {overview.isPending && (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-28 w-full rounded-card" />
          ))}
        </div>
      )}
      {overview.isError && (
        <ErrorState error={overview.error} fallback={'Không tải được màn tổng quan'} />
      )}

      {overview.data && <Blocks data={overview.data} />}
    </PageBody>
  )
}

function Blocks({ data }: { data: OverviewDto }) {
  return (
    <>
      <MetricRow data={data} />
      {/* Rule 5: what to do this morning comes FIRST, above every count. */}
      <OverdueBlock data={data} />
      <PipelineBlock data={data} />
      <IndustryBlock data={data} />
      <LostReasonBlock data={data} />
    </>
  )
}

/**
 * Won and lost deals are finished, so neither belongs in a figure describing what is still in
 * play. Declared once because two callers need it, and two copies of one sum is how the tile
 * and the table below it start disagreeing.
 */
function runningPipelineTotal(data: OverviewDto): number {
  return data.pipelineByStage
    .filter((row) => row.stage !== 'won' && row.stage !== 'lost')
    .reduce((sum, row) => sum + Number(row.totalValue), 0)
}

/**
 * The three numbers this screen exists to say, at a size you can read from behind a chair.
 *
 * The screen used to open with four stacked tables — a report, not an overview. Rule 5 calls the
 * next step "the heartbeat of a deal", and a heartbeat rendered as an unremarkable table row is
 * not one. The overdue count is therefore the first thing on the page and the largest type in
 * the app.
 *
 * EVERY NUMBER HERE COMES FROM `OverviewDto`. The one sum this screen performs lives in a single
 * helper shared with the table below, because a second arithmetic path at the presentation layer
 * is a second place for the figure someone reads out in a meeting to drift from the database.
 *
 * No amber and no violet. There is no AI on this screen at all, and amber marks what a person is
 * about to press — a tile is read, not pressed.
 */
function MetricRow({ data }: { data: OverviewDto }) {
  const runningTotal = runningPipelineTotal(data)

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <MetricTile
        label="Việc tiếp theo quá hạn"
        value={String(data.overdueNextSteps.length)}
        note={
          data.overdueNextSteps.length === 0
            ? 'Không còn việc nào trễ hạn'
            : 'Cần xử lý trước khi làm việc khác'
        }
        alarming={data.overdueNextSteps.length > 0}
      />
      <MetricTile
        label="Pipeline đang chạy"
        value={`${runningTotal.toLocaleString('vi-VN')} ₫`}
        note="Không gồm Thắng, Thua, Tạm dừng"
      />
      <MetricTile
        label="Tạm dừng"
        value={String(data.onHold.count)}
        note={`${Number(data.onHold.totalValue).toLocaleString('vi-VN')} ₫ — không cộng vào con số mang đi họp`}
      />
    </div>
  )
}

function MetricTile({
  label,
  value,
  note,
  alarming,
}: {
  label: string
  value: string
  note: string
  alarming?: boolean
}) {
  return (
    <div className="flex flex-col gap-1 rounded-card border border-ink-200 bg-surface p-5 shadow-card">
      {/* Label above the number, not below it: the reader needs to know what they are looking
          at before the number means anything. */}
      <p className="text-caption font-medium text-ink-600">{label}</p>
      <p
        className={cn(
          'tabular text-metric leading-none font-semibold',
          alarming ? 'text-warning' : 'text-ink-900',
        )}
      >
        {value}
      </p>
      {/* Never a bare number: rule 4 says a figure has to say what it does and does not cover. */}
      <p className="text-caption text-ink-600">{note}</p>
    </div>
  )
}

function OverdueBlock({ data }: { data: OverviewDto }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-section font-semibold text-ink-900">
        Việc tiếp theo quá hạn
      </h2>
      {data.overdueNextSteps.length === 0 ? (
        <EmptyState message="Không có việc nào quá hạn. Cơ hội chưa có Việc tiếp theo không nằm ở đây — chúng mang cờ cảnh báo trên bảng cơ hội." icon={CircleCheck} />
      ) : (
        <Table headers={['Cơ hội', 'Công ty', 'Việc tiếp theo', 'Hạn', 'Cờ']}>
          {data.overdueNextSteps.map((opportunity) => (
            <tr key={opportunity.id}>
              <Cell>{opportunity.name}</Cell>
              <Cell>
                <Link
                  href={`/cong-ty/${opportunity.companyId}`}
                  className="underline underline-offset-2"
                >
                  {opportunity.companyName}
                </Link>
              </Cell>
              <Cell>{opportunity.nextStepText}</Cell>
              <Cell>
                {opportunity.nextStepDueDate && (
                  <OverdueFlag dueDate={opportunity.nextStepDueDate} />
                )}
              </Cell>
              <Cell>
                <WarningFlags warnings={opportunity.warnings} />
              </Cell>
            </tr>
          ))}
        </Table>
      )}
    </section>
  )
}

function PipelineBlock({ data }: { data: OverviewDto }) {
  const runningTotal = runningPipelineTotal(data)

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-section font-semibold text-ink-900">
        Cơ hội theo giai đoạn
      </h2>
      <Table headers={['Giai đoạn', 'Số cơ hội', 'Tổng giá trị']}>
        {data.pipelineByStage.map((row) => (
          <tr key={row.stage}>
            <Cell>{STAGE[row.stage]}</Cell>
            <Cell>
              <span className="tabular">{row.count}</span>
            </Cell>
            <Cell>
              <span className="tabular">{Number(row.totalValue).toLocaleString('vi-VN')} ₫</span>
            </Cell>
          </tr>
        ))}
      </Table>

      <div className="rounded-card border border-ink-200 bg-surface p-4">
        <p className="text-sm font-medium text-ink-900">
          Pipeline đang chạy:{' '}
          <span className="tabular">{runningTotal.toLocaleString('vi-VN')} ₫</span>
        </p>
        {/* The separated block. Adding it back into the number above is the mistake this
            screen exists to prevent, so it is stated rather than merely omitted. */}
        <p className="mt-1 text-sm text-ink-600">
          Chưa gồm <span className="tabular">{data.onHold.count}</span> cơ hội Tạm dừng
          (<span className="tabular">{Number(data.onHold.totalValue).toLocaleString('vi-VN')}</span>{' '}
          ₫) — deal tạm dừng không cộng vào con số mang đi họp.
        </p>
      </div>
    </section>
  )
}

function IndustryBlock({ data }: { data: OverviewDto }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-section font-semibold text-ink-900">
        Công ty theo ngành
      </h2>
      <Table headers={['Ngành', 'Số công ty']}>
        {data.companiesByIndustry.map((row) => (
          <tr key={row.industry}>
            <Cell>{row.industry}</Cell>
            <Cell>
              <span className="tabular">{row.count}</span>
            </Cell>
          </tr>
        ))}
      </Table>
    </section>
  )
}

function LostReasonBlock({ data }: { data: OverviewDto }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-section font-semibold text-ink-900">Lý do thua</h2>
      {data.lostReasons.length === 0 ? (
        <EmptyState message="Chưa có cơ hội Thua nào có lý do được ghi." icon={CircleCheck} />
      ) : (
        <Table headers={['Lý do', 'Số cơ hội']}>
          {data.lostReasons.map((row) => (
            <tr key={row.reason}>
              <Cell>{row.reason}</Cell>
              <Cell>
                <span className="tabular">{row.count}</span>
              </Cell>
            </tr>
          ))}
        </Table>
      )}

      {data.lostWithoutReason > 0 && (
        <p className="rounded-card border border-ink-200 bg-surface p-4 text-sm text-ink-700">
          <span className="tabular">{data.lostWithoutReason}</span> cơ hội Thua chưa ghi lý do —
          đứng ngoài bảng trên, không được cộng vào bất kỳ dòng nào.
        </p>
      )}
    </section>
  )
}

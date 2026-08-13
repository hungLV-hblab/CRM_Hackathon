'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'

import { STAGE, type OverviewDto } from '@crm/contracts'

import { Cell, Table } from '@/components/ui/table'
import { OverdueFlag, WarningFlags } from '@/components/ui/warning-flag'
import { api, ApiError } from '@/lib/api-client'

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
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <header>
        <Link href="/cong-ty" className="text-sm text-ink-600 underline underline-offset-2">
          ← Công ty
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Tổng quan</h1>
      </header>

      {overview.isPending && <p className="text-sm text-ink-500">Đang tải…</p>}
      {overview.isError && (
        <p role="alert" className="rounded-control bg-danger-surface px-3 py-2 text-sm text-danger">
          {overview.error instanceof ApiError
            ? overview.error.message
            : 'Không tải được màn tổng quan'}
        </p>
      )}

      {overview.data && <Blocks data={overview.data} />}
    </main>
  )
}

function Blocks({ data }: { data: OverviewDto }) {
  return (
    <>
      {/* Rule 5: what to do this morning comes FIRST, above every count. */}
      <OverdueBlock data={data} />
      <PipelineBlock data={data} />
      <IndustryBlock data={data} />
      <LostReasonBlock data={data} />
    </>
  )
}

function OverdueBlock({ data }: { data: OverviewDto }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">
        Việc tiếp theo quá hạn
      </h2>
      {data.overdueNextSteps.length === 0 ? (
        <p className="rounded-card border border-dashed border-ink-300 p-4 text-sm text-ink-600">
          Không có việc nào quá hạn. Cơ hội chưa có Việc tiếp theo không nằm ở đây — chúng mang
          cờ cảnh báo trên bảng cơ hội.
        </p>
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
  const running = data.pipelineByStage.filter(
    (row) => row.stage !== 'won' && row.stage !== 'lost',
  )
  const runningTotal = running.reduce((sum, row) => sum + Number(row.totalValue), 0)

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">
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

      <div className="rounded-card border border-ink-200 bg-white p-4">
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
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">
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
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">Lý do thua</h2>
      {data.lostReasons.length === 0 ? (
        <p className="rounded-card border border-dashed border-ink-300 p-4 text-sm text-ink-600">
          Chưa có cơ hội Thua nào có lý do được ghi.
        </p>
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
        <p className="rounded-card border border-ink-200 bg-white p-4 text-sm text-ink-700">
          <span className="tabular">{data.lostWithoutReason}</span> cơ hội Thua chưa ghi lý do —
          đứng ngoài bảng trên, không được cộng vào bất kỳ dòng nào.
        </p>
      )}
    </section>
  )
}

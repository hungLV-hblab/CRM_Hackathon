'use client'

import { CircleCheck } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

import { STAGE, type OverviewDto } from '@crm/contracts'

import { Cell, Table } from '@/components/ui/table'
import { OverdueFlag, WarningFlags } from '@/components/ui/warning-flag'
import { PageHeader } from '@/components/shell/page-header'
import { Select } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { EmptyState } from '@/components/ui/empty-state'
import { PageBody } from '@/components/shell/page-body'
import { api } from '@/lib/api-client'
import { cn } from '@/lib/utils'

import { PerSalesTable } from './per-sales-table'

/**
 * The overview. Four blocks, and two of them exist to keep a number honest:
 *
 * - the pipeline block reports "Tạm dừng" SEPARATELY. A paused deal folded into the running
 *   total inflates the figure somebody reads out in a meeting.
 * - the lost-reason block puts deals with no reason on their own line, OUTSIDE the table, so
 *   the reasons add up to the deals that actually have one.
 *
 * WHOSE numbers depends on who is looking (BTC addendum 3.3): a sales sees their own data,
 * always — the screen answers "what must I do this morning" and the server pins the view. An
 * admin sees the whole team, may narrow to one sales (`?sales=` in the URL, so a filtered
 * view can be shared as a link), and gets a per-sales progress table.
 *
 * The proposal column of that table is the one machine-hued thing here; everything else is
 * people's data and stays ink.
 */
export default function OverviewPage() {
  return (
    /* `useSearchParams` needs a Suspense boundary to keep the standalone build prerendering. */
    <Suspense fallback={<PageBody><PageHeader title="Tổng quan" /></PageBody>}>
      <OverviewScreen />
    </Suspense>
  )
}

function OverviewScreen() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const me = useQuery({ queryKey: ['me'], queryFn: () => api.me(), retry: false })
  const isAdmin = me.data?.role === 'admin'

  // Only an admin's choice reaches the server; for sales the server pins the view anyway.
  const selectedSales = isAdmin ? (searchParams.get('sales') ?? undefined) : undefined

  const overview = useQuery({
    queryKey: ['overview', selectedSales ?? 'all'],
    queryFn: () => api.overview(selectedSales),
    /**
     * Held until the role is known. `selectedSales` is forced to `undefined` while `me` is in
     * flight, so firing early would fetch whole-team numbers, paint them, and only then
     * refetch the scoped view — an admin opening a shared `?sales=` link would watch someone
     * else's totals flash past first.
     */
    enabled: !me.isPending,
  })

  function selectSales(userId: string | undefined) {
    router.replace(userId ? `${pathname}?sales=${userId}` : pathname)
  }

  return (
    <PageBody>
      <PageHeader title="Tổng quan" />

      {/* A sales' screen is ALWAYS their own — said outright so nobody mistakes the smaller
          numbers for missing data. This is a view default, not authorization. */}
      {me.data && !isAdmin && (
        <p className="text-sm text-ink-600">Đang xem: dữ liệu của bạn.</p>
      )}

      {isAdmin && overview.data?.perSales && (
        <SalesFilter
          rows={overview.data.perSales}
          selected={selectedSales}
          onSelect={selectSales}
        />
      )}

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

      {overview.data && (
        <Blocks
          data={overview.data}
          scoped={Boolean(selectedSales) || (me.data ? !isAdmin : false)}
          onSelectSales={isAdmin ? selectSales : undefined}
        />
      )}
    </PageBody>
  )
}

function SalesFilter({
  rows,
  selected,
  onSelect,
}: {
  rows: { userId: string; name: string }[]
  selected: string | undefined
  onSelect: (userId: string | undefined) => void
}) {
  return (
    <div className="max-w-xs">
      <Select
        label="Xem theo Sales"
        value={selected ?? ''}
        onChange={(event) => onSelect(event.target.value || undefined)}
      >
        <option value="">Tất cả</option>
        {rows.map((row) => (
          <option key={row.userId} value={row.userId}>
            {row.name}
          </option>
        ))}
      </Select>
    </div>
  )
}

function Blocks({
  data,
  scoped,
  onSelectSales,
}: {
  data: OverviewDto
  scoped: boolean
  onSelectSales?: (userId: string) => void
}) {
  return (
    <>
      <MetricRow data={data} />
      {/* Rule 4: a narrowed view says what it CANNOT count instead of silently shrinking. */}
      {scoped && data.unassignedCompanies > 0 && (
        <p className="rounded-card border border-ink-200 bg-surface p-4 text-sm text-ink-700">
          Không gồm <span className="tabular">{data.unassignedCompanies}</span> công ty chưa gán
          cho Sales nào.
        </p>
      )}
      {/* Rule 5: what to do this morning comes FIRST, above every count — late things, then
          things about to be due, then deals whose heartbeat is missing entirely. */}
      <OverdueBlock data={data} />
      <DueSoonBlock data={data} />
      <MissingNextStepBlock data={data} />
      {data.perSales && onSelectSales && (
        <PerSalesTable rows={data.perSales} onSelect={onSelectSales} />
      )}
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
        <EmptyState message="Không có việc nào quá hạn. Cơ hội chưa có Việc tiếp theo không nằm ở đây — chúng có khối riêng phía dưới." icon={CircleCheck} />
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

/** Today through +3 days. Late rows are NOT here — they are in the block above, exactly once. */
function DueSoonBlock({ data }: { data: OverviewDto }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-section font-semibold text-ink-900">
        Đến hạn trong 3 ngày tới
      </h2>
      {data.dueSoon.length === 0 ? (
        <EmptyState message="Không có việc nào đến hạn từ hôm nay tới 3 ngày tới." icon={CircleCheck} />
      ) : (
        <Table caption="Đến hạn trong 3 ngày tới" headers={['Cơ hội', 'Công ty', 'Việc tiếp theo', 'Hạn']}>
          {data.dueSoon.map((opportunity) => (
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
                {opportunity.nextStepDueDate &&
                  new Date(opportunity.nextStepDueDate).toLocaleDateString('vi-VN')}
              </Cell>
            </tr>
          ))}
        </Table>
      )}
    </section>
  )
}

/**
 * Rule 5 calls the next step the deal's heartbeat — these open deals have none. Sorted by
 * value on the server: the biggest silent deal is the most expensive silence.
 */
function MissingNextStepBlock({ data }: { data: OverviewDto }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-section font-semibold text-ink-900">
        Cơ hội thiếu Việc tiếp theo
      </h2>
      {data.missingNextStep.length === 0 ? (
        <EmptyState message="Mọi cơ hội đang mở đều có Việc tiếp theo." icon={CircleCheck} />
      ) : (
        <Table
          caption="Cơ hội thiếu Việc tiếp theo"
          headers={['Cơ hội', 'Công ty', 'Giai đoạn', { label: 'Giá trị', align: 'right' }, 'Cờ']}
        >
          {data.missingNextStep.map((opportunity) => (
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
              <Cell>{STAGE[opportunity.stage]}</Cell>
              <Cell numeric>
                {opportunity.expectedValue
                  ? `${Number(opportunity.expectedValue).toLocaleString('vi-VN')} ₫`
                  : '—'}
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
      <Table
        caption="Cơ hội theo giai đoạn"
        headers={[
          'Giai đoạn',
          { label: 'Số cơ hội', align: 'right' },
          { label: 'Tổng giá trị', align: 'right' },
        ]}
      >
        {data.pipelineByStage.map((row) => (
          <tr key={row.stage}>
            <Cell>{STAGE[row.stage]}</Cell>
            <Cell numeric>{row.count}</Cell>
            <Cell numeric>{Number(row.totalValue).toLocaleString('vi-VN')} ₫</Cell>
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
      <Table caption="Công ty theo ngành" headers={['Ngành', { label: 'Số công ty', align: 'right' }]}>
        {data.companiesByIndustry.map((row) => (
          <tr key={row.industry}>
            <Cell>{row.industry}</Cell>
            <Cell numeric>{row.count}</Cell>
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
        <Table caption="Lý do thua" headers={['Lý do', { label: 'Số cơ hội', align: 'right' }]}>
          {data.lostReasons.map((row) => (
            <tr key={row.reason}>
              <Cell>{row.reason}</Cell>
              <Cell numeric>{row.count}</Cell>
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

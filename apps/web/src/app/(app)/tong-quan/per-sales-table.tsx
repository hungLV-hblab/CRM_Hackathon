'use client'

import type { OverviewPerSalesRow } from '@crm/contracts'

import { Badge } from '@/components/ui/badge'
import { Cell, Table } from '@/components/ui/table'

/**
 * The admin's whole-team table: one row per sales, columns ordered so the two BEHAVIORAL
 * numbers (overdue, missing next step — rule 5's health signals) sit right after the money.
 * Pressing a name narrows the whole screen to that sales — the same thing the filter above
 * does, offered where the admin's eye already is.
 *
 * The proposal column wears machine purple: a pending proposal is something the machine
 * produced and a person has not answered yet. Everything else on the row is people's data.
 */
export function PerSalesTable({
  rows,
  onSelect,
}: {
  rows: OverviewPerSalesRow[]
  onSelect: (userId: string) => void
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-section font-semibold text-ink-900">Tiến độ theo Sales</h2>
      <Table
        caption="Tiến độ theo Sales"
        headers={[
          'Sales',
          { label: 'Pipeline đang chạy', align: 'right' },
          // "Đang chạy", not "mở": this count and the money beside it cover the SAME deals,
          // and both leave out the paused ones. Two words that disagree here would put a
          // total next to a count it does not add up to.
          { label: 'Cơ hội đang chạy', align: 'right' },
          { label: 'Việc quá hạn', align: 'right' },
          { label: 'Thiếu việc tiếp theo', align: 'right' },
          'Gợi ý chờ duyệt',
        ]}
      >
        {rows.map((row) => (
          <tr key={row.userId}>
            <Cell>
              <button
                type="button"
                onClick={() => onSelect(row.userId)}
                // The visible text is small; the tap target is grown past it, not the text.
                className="relative cursor-pointer underline underline-offset-2 before:absolute before:-inset-3 before:content-['']"
              >
                {row.name}
              </button>
            </Cell>
            <Cell numeric>{Number(row.runningPipeline).toLocaleString('vi-VN')} ₫</Cell>
            <Cell numeric>{row.openCount}</Cell>
            {/* Warning color only when the number is a problem: zero late items is not one. */}
            <Cell numeric>
              <span className={row.overdueCount > 0 ? 'font-semibold text-warning' : undefined}>
                {row.overdueCount}
              </span>
            </Cell>
            <Cell numeric>
              <span className={row.missingNextStepCount > 0 ? 'font-semibold text-warning' : undefined}>
                {row.missingNextStepCount}
              </span>
            </Cell>
            <Cell>
              {row.pendingProposals > 0 ? (
                <Badge tone="system">
                  {row.pendingProposals} chờ duyệt
                  {row.oldestPendingProposalDays !== null && row.oldestPendingProposalDays > 0
                    ? ` · cũ nhất ${row.oldestPendingProposalDays} ngày`
                    : ''}
                </Badge>
              ) : (
                <span className="text-ink-600">0</span>
              )}
            </Cell>
          </tr>
        ))}
      </Table>
    </section>
  )
}

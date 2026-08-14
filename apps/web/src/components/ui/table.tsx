'use client'

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * The `headers[]` + `Cell` surface is unchanged, and a plain `string[]` still means exactly what
 * it meant before: five specs find rows with `getByRole('cell', { name })`, and the surface those
 * specs read is the contract. Columns opt into alignment, width or sorting one at a time.
 *
 * Corners stay square inside a rounded container: on a screen this dense a straight edge is what
 * the eye uses to line columns up. The wrapper carries `rounded-card`.
 */
export interface TableColumn {
  label: string
  /** Numeric columns: the HEADER moves right too, so it sits over the digits it names. */
  align?: 'right'
  /** A CSS width for the `<th>`, e.g. `'28%'`. Stops one long column from starving the rest. */
  width?: string
  /** Present → the header becomes a sort button. Absent → a plain header, as before. */
  sortKey?: string
}

export type TableHeader = string | TableColumn

export interface TableSort {
  key: string
  direction: 'asc' | 'desc'
}

/**
 * THE STICKY HEADER ACTUALLY STICKS NOW, and it is worth saying why it did not.
 *
 * The wrapper declared only `overflow-x-auto` and had no height limit, so its height always
 * equalled the table's: nothing ever scrolled inside it, and `sticky top-0` on the `<thead>` had
 * no scroll of its own to stick against. Meanwhile the page scrolled behind the app header, so
 * the column titles left the screen — and every number below them went on being read under a
 * heading nobody could see any more. That is the worst kind of broken, because nothing looks it.
 *
 * `max-h` plus `overflow-auto` gives the wrapper its own scroll, which is also why `top-0` is
 * correct here rather than an offset for the 56px app header: the header now sticks to the top of
 * THIS box, not to the viewport.
 */
export function Table({
  headers,
  children,
  caption,
  sort,
  onSort,
}: {
  headers: TableHeader[]
  children: ReactNode
  /** Screen-reader only. Says which table this is and how big, without adding words on screen. */
  caption?: string
  sort?: TableSort
  onSort?: (key: string) => void
}) {
  const columns = headers.map(toColumn)

  return (
    <div className="max-h-[calc(100vh-16rem)] overflow-auto rounded-card border border-ink-200 bg-surface shadow-card">
      <table className="w-full text-left text-body">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="sticky top-0 z-(--z-sticky) bg-ink-100">
          <tr className="border-b border-ink-200">
            {columns.map((column) => (
              <HeaderCell
                key={column.label}
                column={column}
                sort={sort}
                onSort={onSort}
              />
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-200 [&>tr]:transition-colors [&>tr:hover]:bg-ink-50">
          {children}
        </tbody>
      </table>
    </div>
  )
}

function HeaderCell({
  column,
  sort,
  onSort,
}: {
  column: TableColumn
  sort?: TableSort
  onSort?: (key: string) => void
}) {
  const sortable = Boolean(column.sortKey && onSort)
  const active = sortable && sort?.key === column.sortKey
  const SortIcon = !active ? ArrowUpDown : sort?.direction === 'asc' ? ArrowUp : ArrowDown

  return (
    <th
      scope="col"
      style={column.width ? { width: column.width } : undefined}
      // `aria-sort` is how a screen reader learns the table is ordered at all; the arrow only
      // tells the people who can see it.
      aria-sort={active ? (sort?.direction === 'asc' ? 'ascending' : 'descending') : undefined}
      className={cn(
        'font-medium text-ink-600',
        // Only numeric headers refuse to wrap. Forcing every header onto one line — which is
        // what this component used to do — is what pushed the table wider than a phone.
        column.align === 'right' && 'text-right whitespace-nowrap',
        sortable ? 'p-0' : 'px-4 py-3',
      )}
    >
      {sortable ? (
        <button
          type="button"
          onClick={() => onSort?.(column.sortKey!)}
          className={cn(
            'flex min-h-11 w-full items-center gap-1 px-4 py-3 text-left transition-colors hover:bg-ink-200 hover:text-ink-900',
            column.align === 'right' && 'justify-end',
          )}
        >
          {column.label}
          <SortIcon className={cn('size-3.5 shrink-0', active ? 'text-ink-900' : 'text-ink-400')} aria-hidden />
        </button>
      ) : (
        column.label
      )}
    </th>
  )
}

/** `numeric` opts a column into tabular figures so money and counts stop jittering. */
export function Cell({ children, numeric }: { children: ReactNode; numeric?: boolean }) {
  return (
    <td className={cn('px-4 py-3 align-top break-words', numeric && 'tabular text-right')}>
      {children}
    </td>
  )
}

function toColumn(header: TableHeader): TableColumn {
  return typeof header === 'string' ? { label: header } : header
}

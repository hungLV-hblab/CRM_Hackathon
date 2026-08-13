import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Restyled onto the project's tokens, with the `headers[]` + `Cell` API left exactly as it
 * was: five specs find rows with `getByRole('cell', { name })`, and the surface those specs
 * read is the contract.
 *
 * The corners stay square inside a rounded container: on a screen this dense, a straight edge
 * is what the eye uses to line columns up. The wrapper is what carries `rounded-card`.
 *
 * `sticky` header, so scrolling a long list never leaves a reader guessing which column is
 * which — the failure mode is silent, because nothing looks broken while every number is read
 * under the wrong heading.
 */
export function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-card border border-ink-200 bg-card shadow-card">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 z-[1] bg-ink-100">
          <tr className="border-b border-ink-200">
            {headers.map((header) => (
              <th
                key={header}
                scope="col"
                className="px-4 py-3 font-medium whitespace-nowrap text-ink-600"
              >
                {header}
              </th>
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

/** `numeric` opts a column into tabular figures so money and counts stop jittering. */
export function Cell({ children, numeric }: { children: ReactNode; numeric?: boolean }) {
  return <td className={cn('px-4 py-3 align-top', numeric && 'tabular text-right')}>{children}</td>
}

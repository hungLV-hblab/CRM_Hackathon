import type { ReactNode } from 'react'

export function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-card border border-ink-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-ink-200 bg-ink-100">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-4 py-3 font-medium text-ink-600">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-200">{children}</tbody>
      </table>
    </div>
  )
}

export function Cell({ children }: { children: ReactNode }) {
  return <td className="px-4 py-3">{children}</td>
}

import type { ReactNode } from 'react'

export function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-100">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-4 py-3 font-medium text-slate-600">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  )
}

export function Cell({ children }: { children: ReactNode }) {
  return <td className="px-4 py-3">{children}</td>
}

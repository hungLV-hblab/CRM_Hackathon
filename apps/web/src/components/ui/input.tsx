import type { InputHTMLAttributes, SelectHTMLAttributes } from 'react'
import { useId } from 'react'

const FIELD =
  'w-full rounded-control border border-ink-300 bg-white px-3 py-2 text-sm outline-none focus:border-ink-900'

/**
 * The label is bound to the control with a generated `id` instead of being left as loose
 * text next to it. That is what makes `getByLabel('Mật khẩu')` work in the end-to-end suite,
 * and it is the same wiring a screen reader needs — one mechanism, both jobs.
 */
export function Input({
  label,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-ink-700">
        {label}
      </label>
      <input id={id} {...props} className={FIELD} />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

export function Select({
  label,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-ink-700">
        {label}
      </label>
      <select id={id} {...props} className={FIELD}>
        {children}
      </select>
    </div>
  )
}

import type { InputHTMLAttributes, SelectHTMLAttributes } from 'react'
import { useId } from 'react'

import { cn } from '@/lib/utils'

const FIELD =
  'w-full rounded-control border border-ink-300 bg-card px-3 py-2 text-sm outline-none transition-colors focus:border-ink-900 aria-[invalid=true]:border-danger'

/**
 * The label is bound to the control with a generated `id` instead of being left as loose
 * text next to it. That is what makes `getByLabel('Mật khẩu')` work in the end-to-end suite,
 * and it is the same wiring a screen reader needs — one mechanism, both jobs. The `label`
 * prop stays REQUIRED: a placeholder disappears the moment someone types, which is exactly
 * when they most need to know what the field was.
 *
 * The error message is tied to the field with `aria-describedby` and the field marked
 * `aria-invalid`, so a screen reader reaches the message instead of a sighted-only red line.
 * Its colour is the `danger` token rather than a raw Tailwind red.
 */
export function Input({
  label,
  error,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const id = useId()
  const errorId = `${id}-loi`

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-ink-700">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...props}
        className={cn(FIELD, className)}
      />
      {/* Directly under the field it belongs to, never collected at the top of the form. */}
      {error && (
        <p id={errorId} className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

export function Select({
  label,
  children,
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const id = useId()

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-ink-700">
        {label}
      </label>
      <select id={id} {...props} className={cn(FIELD, className)}>
        {children}
      </select>
    </div>
  )
}

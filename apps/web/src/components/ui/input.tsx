import { ChevronDown } from 'lucide-react'
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { useId } from 'react'

import { cn } from '@/lib/utils'

/**
 * `--size-control` is 44px, the same number the Button carries. A filter row puts a field and
 * a button side by side, so if the two disagree the row looks broken in a way that is hard to
 * name — and on a phone the shorter one is the one a thumb misses.
 *
 * `hover:` and `disabled:` are here because they were missing: a disabled field used to look
 * exactly like an editable one, which is the worst kind of disabled state — it invites the tap
 * and then swallows it.
 */
const FIELD =
  'w-full min-h-(--size-control) rounded-control border border-ink-300 bg-surface px-3 text-sm text-ink-900 outline-none transition-colors duration-(--duration-state) placeholder:text-ink-400 hover:border-ink-400 focus:border-ink-900 disabled:cursor-not-allowed disabled:bg-ink-100 disabled:text-ink-400 aria-[invalid=true]:border-danger'

/**
 * The shell every control shares: the visible label, the required marker, one line of help,
 * and the error. Pulling it out of `Input` and `Select` is what stops the two drifting apart
 * — they had already started, and a third control would have made three shapes.
 *
 * The label is bound with a generated `id` rather than left as loose text beside the control.
 * That is what makes `getByLabel('Mật khẩu')` work in the end-to-end suite, and it is the same
 * wiring a screen reader needs — one mechanism, both jobs. The `label` prop stays REQUIRED: a
 * placeholder disappears the moment someone types, which is exactly when they most need to
 * know what the field was.
 */
function Field({
  id,
  label,
  required,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  required?: boolean
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-ink-700">
        {label}
        {/* The asterisk is decoration for the eye only — a screen reader hears `aria-required`
            on the control itself, and reading out "sao" would be noise on top of the fact. */}
        {required && (
          <span aria-hidden className="ml-0.5 text-danger">
            *
          </span>
        )}
      </label>
      {children}
      {/* One secondary line at a time: while a field is wrong, the fix matters more than the
          hint that failed to prevent it. */}
      {error ? (
        <p id={`${id}-loi`} className="text-xs text-danger">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-goi-y`} className="text-xs text-ink-600">
            {hint}
          </p>
        )
      )}
    </div>
  )
}

export function Input({
  label,
  error,
  hint,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }) {
  const id = useId()

  return (
    <Field id={id} label={label} required={props.required} hint={hint} error={error}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        {...props}
        className={cn(FIELD, className)}
      />
    </Field>
  )
}

export function Select({
  label,
  error,
  hint,
  children,
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string; hint?: string }) {
  const id = useId()

  return (
    <Field id={id} label={label} required={props.required} hint={hint} error={error}>
      <div className="relative">
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, hint)}
          {...props}
          // `appearance-none` drops the arrow the operating system draws, which is the one
          // part of this control that could not be given a token colour and rendered a
          // different shape on every machine. `pr-10` reserves the space the icon takes.
          className={cn(FIELD, 'appearance-none pr-10', className)}
        >
          {children}
        </select>
        {/* `pointer-events-none` matters more than it looks: the arrow is exactly where people
            aim, and an icon that swallows the click makes the select feel broken. */}
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-600"
        />
      </div>
    </Field>
  )
}

function describedBy(id: string, error?: string, hint?: string): string | undefined {
  if (error) return `${id}-loi`
  if (hint) return `${id}-goi-y`
  return undefined
}

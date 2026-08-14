'use client'

import { Check } from 'lucide-react'
import { Checkbox as CheckboxPrimitive } from 'radix-ui'

import { cn } from '@/lib/utils'

/**
 * Replaces a bare `<input type="checkbox">` with `accent-brand-500`, which was the last raw
 * browser control left in a designed interface: 16px in a system whose minimum touch target
 * is 44, and `accent` is the only thing about it that could be coloured at all.
 *
 * The 44px belongs to the LABEL, not the box. Making the box itself 44px would put a huge
 * empty square next to three words; wrapping the whole row means the words are the target,
 * which is both easier to hit and what people already try to click.
 *
 * Checked state is `brand-400` with an ink tick — amber marks what a human did or is about to
 * do (docs/design-guidelines.md), and a checkbox is the clearest case of that. The tick is ink
 * rather than white on purpose: white on brand-400 is 1.7:1 and effectively invisible, ink is
 * 11.36:1. This is the same place the shadcn translation layer contradicts upstream.
 */
export function Checkbox({
  label,
  checked,
  onCheckedChange,
  disabled,
  className,
}: {
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
}) {
  return (
    <label
      className={cn(
        'flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink-700 select-none',
        disabled && 'cursor-not-allowed text-ink-400',
        className,
      )}
    >
      <CheckboxPrimitive.Root
        checked={checked}
        onCheckedChange={(next) => onCheckedChange(next === true)}
        disabled={disabled}
        className="flex size-5 shrink-0 items-center justify-center rounded-control border border-ink-300 bg-surface transition-colors duration-(--duration-state) hover:border-ink-400 disabled:cursor-not-allowed disabled:bg-ink-100 data-[state=checked]:border-brand-500 data-[state=checked]:bg-brand-400"
      >
        <CheckboxPrimitive.Indicator className="flex items-center justify-center text-ink-900">
          <Check className="size-3.5" strokeWidth={3} aria-hidden />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      {label}
    </label>
  )
}

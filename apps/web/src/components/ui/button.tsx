import type { ButtonHTMLAttributes } from 'react'

/**
 * Hand-written rather than pulled from shadcn/ui, and deliberately kept at the SAME import
 * path shadcn would use (`@/components/ui/button`).
 *
 * Variants map to the token rule "amber means a human acts" (docs/design-guidelines.md):
 * `primary` is the brand surface with ink on top (11.36:1), so the one action a screen wants
 * is the one thing wearing the brand colour. A screen with two amber buttons has no primary
 * action — pick one and make the rest `secondary`.
 */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand-400 text-ink-900 hover:bg-brand-300 active:bg-brand-500 disabled:bg-ink-200 disabled:text-ink-400',
  secondary:
    'border border-ink-300 bg-white text-ink-900 hover:bg-ink-50 active:bg-ink-100 disabled:text-ink-400',
  ghost: 'text-ink-600 hover:bg-ink-100 active:bg-ink-200 disabled:text-ink-400',
  /** Destructive actions never share the brand colour — see the CLAUDE.md forbidden list. */
  danger: 'bg-danger text-white hover:brightness-110 active:brightness-95 disabled:bg-ink-200',
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      /**
       * `min-h-11` is the 44px touch target, not decoration: the acceptance run happens on a
       * judge's laptop but the Sales team opens this on a phone between meetings.
       */
      className={`inline-flex min-h-11 cursor-pointer items-center justify-center rounded-control px-4 py-2 text-sm font-medium transition-colors duration-(--duration-state) disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
    />
  )
}

import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

/**
 * Built on `cva` now instead of a hand-rolled record — but NOT on shadcn's Button, and the
 * two places it diverges are the whole reason this file still has comments:
 *
 *   - `min-h-11` is the 44px touch target. shadcn's default is `h-9`, which is 36px. The
 *     acceptance run happens on a judge's laptop, but the Sales team opens this on a phone
 *     between meetings, and 36px is the size a thumb misses. `e2e/ui-invariants` measures it.
 *   - The variant names stay `primary | secondary | ghost | danger` rather than becoming
 *     `default | destructive | outline`. Every call site in the app passes the old names, and
 *     renaming them would push a cosmetic change into thirty files that have nothing to do
 *     with styling.
 *
 * Variants map to the token rule "amber means a human acts" (docs/design-guidelines.md):
 * `primary` is the brand surface with ink on top (11.36:1), so the one action a screen wants
 * is the one thing wearing the brand colour. A screen with two amber buttons has no primary
 * action — pick one and make the rest `secondary`.
 */
const buttonVariants = cva(
  'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-control px-4 py-2 text-sm font-medium transition-colors duration-(--duration-state) disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        primary:
          'bg-brand-400 text-ink-900 hover:bg-brand-300 active:bg-brand-500 disabled:bg-ink-200 disabled:text-ink-400',
        secondary:
          'border border-ink-300 bg-card text-ink-900 hover:bg-ink-50 active:bg-ink-100 disabled:text-ink-400',
        ghost: 'text-ink-600 hover:bg-ink-100 active:bg-ink-200 disabled:text-ink-400',
        /** Destructive actions never share the brand colour — see the CLAUDE.md forbidden list. */
        danger: 'bg-danger text-white hover:brightness-110 active:brightness-95 disabled:bg-ink-200',
      },
    },
    defaultVariants: { variant: 'primary' },
  },
)

export type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>['variant']>

export function Button({
  variant,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button {...props} className={cn(buttonVariants({ variant }), className)} />
}

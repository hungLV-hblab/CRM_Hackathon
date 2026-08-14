import { cva, type VariantProps } from 'class-variance-authority'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * On `cva` now, but the API is still `tone`, and that is deliberate rather than lazy.
 *
 * shadcn's Badge offers `default | secondary | destructive | outline` — four names that can
 * describe how loud a badge is and none that can say WHO PRODUCED THE ROW. Rule 2 of
 * CLAUDE.md requires a reader to tell a fact from an AI inference without reading any
 * explanation, and `tone` is where that rule is enforced. Taking shadcn's vocabulary would
 * have deleted the distinction while every existing test stayed green.
 *
 * Note what is still missing: there is no brand-amber tone. Amber marks what a human should
 * click (docs/design-guidelines.md); a badge is read, not clicked, so it never wears the brand.
 *
 * Colour is never the only carrier — every caller passes words too, and `e2e/ui-invariants`
 * measures the violet on a machine badge and its absence on a human one.
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-xs font-medium',
  {
    variants: {
      tone: {
        neutral: 'bg-ink-100 text-ink-700',
        fact: 'bg-ink-200 text-fact',
        inference: 'bg-machine-100 text-machine-700',
        system: 'bg-machine-100 text-machine-700 ring-1 ring-machine-200',
        warning: 'bg-warning-surface text-warning',
        success: 'bg-success-surface text-success',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>['tone']>

export function Badge({
  tone,
  className,
  children,
}: {
  tone?: BadgeTone
  className?: string
  children: ReactNode
}) {
  return <span className={cn(badgeVariants({ tone }), className)}>{children}</span>
}

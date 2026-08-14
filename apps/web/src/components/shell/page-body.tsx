import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * The one place a screen's width and gutters are decided.
 *
 * Ten screens had grown five different `max-w` values — 3xl, 4xl, 5xl, 6xl and 100rem — none of
 * them chosen against the others. The queue screen, which is the centre of the demo, was using
 * 62% of a 1440px display while the rest was empty grey.
 *
 * There are three tiers rather than one because there are genuinely three kinds of screen here,
 * and rather than four because nothing in the product needs a fourth:
 *
 *   reading   long-form prose. Past ~75 characters a line the eye loses the return sweep.
 *   standard  the CRM screens. Dense rows want the width; 896px was throwing it away.
 *   wide      the seven-column deal board, which needs every pixel it can get.
 *
 * The gutters shrink on small screens. A flat `p-6` — what every screen used to carry — spends
 * 13% of a 375px display on empty margins.
 */
const WIDTHS = {
  reading: 'max-w-3xl',
  standard: 'max-w-7xl',
  wide: 'max-w-[100rem]',
} as const

export function PageBody({
  width = 'standard',
  children,
  className,
}: {
  width?: keyof typeof WIDTHS
  children: ReactNode
  className?: string
}) {
  return (
    <main
      className={cn(
        'mx-auto flex w-full flex-col gap-6 px-4 py-5 sm:px-6 sm:py-6 lg:px-8',
        WIDTHS[width],
        className,
      )}
    >
      {children}
    </main>
  )
}

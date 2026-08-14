'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { usePendingProposalCounts } from '@/components/proposal/pending-proposal-marker'
import { cn } from '@/lib/utils'

import { NAV_ITEMS, activeHref } from './nav-items'

/**
 * The navigation itself, shared by the desktop sidebar and the mobile drawer. Rendering it
 * twice from one component is what keeps the two surfaces honest: a link added for desktop
 * cannot go missing on a phone.
 *
 * `onNavigate` lets the drawer close itself after a tap. The sidebar passes nothing.
 */
export function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const current = activeHref(pathname)

  /**
   * Reused from the marker that already sits on the company and deal screens — the same
   * `/proposals/pending-summary` response, already cached by React Query under one key. A
   * second query here would be a second source for one number, free to disagree with the first.
   */
  const pendingCounts = usePendingProposalCounts()
  const pendingTotal = Object.values(pendingCounts).reduce((sum, count) => sum + count, 0)

  return (
    <nav aria-label="Điều hướng chính" className="flex flex-col gap-1 p-3">
      {NAV_ITEMS.map((item) => {
        const isActive = item.href === current
        const Icon = item.icon
        const badgeCount = item.showsPendingCount ? pendingTotal : 0

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            data-tour={item.showsPendingCount ? "queue" : undefined}
            // `aria-current` rather than a class a screen reader cannot see. Colour is never
            // the only signal either: the active item gets a filled background AND the amber
            // indicator bar below, so the state survives a greyscale print.
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'relative flex min-h-11 items-center gap-3 rounded-pill px-3 text-sm font-medium transition-colors',
              isActive ? 'bg-ink-100 text-ink-900' : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900',
            )}
          >
            {isActive && (
              <span
                aria-hidden
                className="absolute top-1/2 left-0 h-6 w-1 -translate-y-1/2 rounded-pill bg-brand-400"
              />
            )}
            <Icon className="size-5 shrink-0" aria-hidden />
            <span className="flex-1">{item.label}</span>
            {badgeCount > 0 && (
              /**
               * Machine violet, not amber: this number is something the machine produced.
               * Amber is reserved for what a person is about to press.
               */
              <span className="rounded-pill bg-machine-100 px-2 py-0.5 text-xs font-semibold text-machine-700 tabular">
                {badgeCount}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}

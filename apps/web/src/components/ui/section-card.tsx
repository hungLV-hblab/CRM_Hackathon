import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * The white panel a screen is built out of. It existed thirteen times as a hand-written class
 * string, and the copies had already split into `p-4` and `p-5` — a four-pixel disagreement
 * that reads as sloppiness without ever looking like a bug.
 *
 * `title` renders the `<h2>` and names the region. The heading text is passed through
 * unchanged because several specs find screens with `getByRole('heading', { name })` and
 * `getByRole('region', { name })` — the words on screen are the contract.
 *
 * Untitled panels render a plain `<div>` rather than a `<section>` with an invented label. A
 * landmark with a made-up name is worse for a screen reader than no landmark: it adds a stop
 * on the tour that says nothing.
 */
export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  const body = (
    <>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {/* 18px, semibold, ink — the tier the app was missing. Section headings used to be
                14px uppercase grey, i.e. SMALLER than the text they introduced and told apart
                by colour, which the guidelines rule out as a hierarchy device. */}
            {title && <h2 className="text-section font-semibold text-ink-900">{title}</h2>}
            {description && <p className="mt-1 text-sm text-ink-600">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </>
  )

  const shell = 'flex flex-col gap-3 rounded-card border border-ink-200 bg-surface p-5 shadow-card'

  if (!title) return <div className={cn(shell, className)}>{body}</div>

  return (
    <section aria-label={title} className={cn(shell, className)}>
      {body}
    </section>
  )
}

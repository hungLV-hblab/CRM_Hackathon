import type { ReactNode } from 'react'

/**
 * Title, one optional line of context, and a slot for the screen's actions. Shared by every
 * screen so the heading sits in the same place on all of them — before this existed, each
 * page built its own header row and they drifted apart by a few pixels each.
 *
 * The `<h1>` stays here rather than moving into the shell: five specs find screens with
 * `getByRole('heading', { name })`, and more importantly a page's own title is what a screen
 * reader reads first. The shell's breadcrumb says where you are; this says what this is.
 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-ink-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  )
}

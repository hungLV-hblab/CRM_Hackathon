import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * One shape for "there is nothing here", because there were ten of them.
 *
 * The ten hand-written versions had drifted to two radii, four paddings, two text sizes and
 * two greys — for a single idea. None of that was a decision; it was ten people reaching for
 * plausible values, which is what happens when there is nowhere to put the decision.
 *
 * `message` is REQUIRED and has to be a sentence. Rule 4 of CLAUDE.md says an empty cell must
 * say why it is empty, and this component is where that stops depending on goodwill: there is
 * no branch that renders an empty box with no words in it.
 */
export function EmptyState({
  message,
  icon: Icon,
  action,
  compact,
}: {
  message: string
  icon?: LucideIcon
  action?: ReactNode
  /** For narrow places — a kanban column, a cell — where a centred block with an icon would
   *  be bigger than the thing it is standing in for. */
  compact?: boolean
}) {
  if (compact) {
    return (
      <p className="rounded-control border border-dashed border-ink-300 p-3 text-xs text-ink-600">
        {message}
      </p>
    )
  }

  return (
    <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-ink-300 p-6 text-center">
      {/* SVG from the one icon family, never an emoji: an emoji changes shape per operating
          system and cannot take a token colour. */}
      {Icon && <Icon className="size-6 text-ink-400" aria-hidden />}
      <p className="text-sm text-ink-600">{message}</p>
      {action}
    </div>
  )
}

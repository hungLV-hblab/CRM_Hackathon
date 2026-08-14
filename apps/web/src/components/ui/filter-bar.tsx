import { X } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'

export interface FilterChip {
  /** Reads as a sentence fragment on screen: "Ngành: Bán lẻ". */
  label: string
  onRemove: () => void
}

/**
 * The filter controls, grouped, plus the two things a filter row needs and this app's rows did
 * not have:
 *
 *   - a statement of what is currently filtered, so scrolling past the controls does not mean
 *     losing track of why the list is short;
 *   - a way back to everything, available WHENEVER a filter is on. The company screen only
 *     offered "Xoá bộ lọc" once the filters had matched nothing at all, which is the one case
 *     where the user has already worked out something is wrong.
 *
 * The chips are ink, not amber and not violet. Amber is reserved for the thing a person is
 * about to press and violet for what a machine produced; a filter is neither — it is a record
 * of what the person already did.
 */
export function FilterBar({
  children,
  chips = [],
  onReset,
}: {
  children: ReactNode
  chips?: FilterChip[]
  onReset?: () => void
}) {
  return (
    <section
      aria-label="Bộ lọc"
      className="flex flex-col gap-3 rounded-card border border-ink-200 bg-surface p-4 shadow-card"
    >
      {/* Four columns, not five. Five 44px fields across 1024px leaves each about 180px, and
          "Lọc theo loại hình" does not fit in 180px — the row was cheaper to read wrapped. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-ink-200 pt-3">
          <span className="text-xs text-ink-600">Đang lọc:</span>
          {chips.map((chip) => (
            <span
              key={chip.label}
              className="inline-flex items-center gap-1 rounded-pill bg-ink-100 py-0.5 pr-0.5 pl-2.5 text-xs font-medium text-ink-700"
            >
              {chip.label}
              <button
                type="button"
                onClick={chip.onRemove}
                // The visible chip is small, so the hit area is grown past it rather than the
                // chip being grown to match: 44px of tappable area, 24px of drawn button.
                aria-label={`Bỏ lọc ${chip.label}`}
                className="relative inline-flex size-6 items-center justify-center rounded-pill text-ink-600 transition-colors before:absolute before:-inset-2.5 before:content-[''] hover:bg-ink-200 hover:text-ink-900"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </span>
          ))}
          {onReset && (
            <Button variant="ghost" onClick={onReset} className="ml-auto">
              <X className="size-4" aria-hidden />
              Xoá bộ lọc
            </Button>
          )}
        </div>
      )}
    </section>
  )
}

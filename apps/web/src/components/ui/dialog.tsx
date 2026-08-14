'use client'

import { X } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import type { ReactNode } from 'react'

/**
 * On Radix now, replacing the native `<dialog>` element. The prop surface is unchanged —
 * `open`, `onClose`, `title`, `children` — because six call sites pass exactly those, and the
 * point of this migration was never to touch them.
 *
 * WHY MOVE AT ALL, when `showModal()` already gave focus trapping, Escape-to-close and
 * inertness for free: it did not give an ACCESSIBLE NAME. The title rendered as a plain `<h2>`
 * that nothing pointed at, so a screen reader announced "dialog" and stopped, and
 * `e2e/ui-invariants` T-E caught it. Radix requires a `DialogTitle` and wires
 * `aria-labelledby` itself, which turns a rule that depended on remembering into one the
 * library enforces.
 *
 * The cost, stated plainly: Radix renders through a PORTAL, so the markup lands at the end of
 * `<body>` instead of where it was written. That is the heaviest DOM change in this migration,
 * which is why it shipped on its own commit with the whole suite run against it.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  return (
    <DialogPrimitive.Root
      open={open}
      // Escape and an outside click close it inside Radix without React knowing, so the
      // parent's `open` state has to be told or reopening silently stops working — the same
      // trap the native element had.
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[var(--z-overlay)] bg-ink-900/50" />
        <DialogPrimitive.Content className="fixed top-1/2 left-1/2 z-[var(--z-modal)] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-card bg-card p-6 shadow-float">
          <div className="flex items-start justify-between gap-4">
            <DialogPrimitive.Title className="text-lg font-semibold text-ink-900">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label="Đóng"
              className="-mt-1 -mr-1 inline-flex size-11 shrink-0 items-center justify-center rounded-pill text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900"
            >
              <X className="size-5" aria-hidden />
            </DialogPrimitive.Close>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

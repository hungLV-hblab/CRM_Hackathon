'use client'

import { useEffect, useRef, type ReactNode } from 'react'

/**
 * Built on the native `<dialog>` element instead of a portal plus a focus trap of our own.
 * `showModal()` already gives focus trapping, Escape-to-close, inertness of the page behind
 * it, and the correct `role="dialog"` — all the parts that are laborious to get right by
 * hand and easy to get subtly wrong.
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
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      // Escape and the backdrop close the dialog without React knowing, so the parent's
      // `open` state has to be told, or reopening it silently stops working.
      onClose={onClose}
      className="m-auto w-full max-w-md rounded-lg p-0 backdrop:bg-slate-900/40"
    >
      <div className="flex flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </dialog>
  )
}

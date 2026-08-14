'use client'

import { CircleCheckIcon, InfoIcon, OctagonXIcon, TriangleAlertIcon } from 'lucide-react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

/**
 * Rewritten from what the CLI generated, for two reasons worth keeping on the record:
 *
 *   - It imported `next-themes` and read a theme off it. This product ships LIGHT ONLY
 *     (docs/design-guidelines.md, "Phạm vi đã chốt"), so that pulled in a dependency to
 *     answer a question that has one fixed answer, and left a half-wired dark mode behind it.
 *   - It styled itself from `var(--popover)` and `var(--radius)`, neither of which exists
 *     here — the project's tokens are `--color-popover` and `--radius-card`. Those would have
 *     resolved to nothing and the toast would have rendered unstyled.
 *
 * What a toast is allowed to do here is narrow, and the limit is a rule rather than taste:
 * a toast CONFIRMS something that already happened. It never carries the only copy of an
 * action. The 7-day Hoàn tác button on an auto-filled cell stays a first-class button on the
 * screen — a 5-second toast cannot hold a 7-day undo, and rule 3 of CLAUDE.md says undoing
 * has to be easier than the machine's original write.
 */
export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      position="bottom-right"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
      }}
      style={
        {
          '--normal-bg': 'var(--color-card)',
          '--normal-text': 'var(--color-ink-900)',
          '--normal-border': 'var(--color-ink-200)',
          '--border-radius': 'var(--radius-card)',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

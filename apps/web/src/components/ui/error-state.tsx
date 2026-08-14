import { TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'

import { ApiError } from '@/lib/api-client'

import { cn } from '@/lib/utils'

/**
 * A failed request, said once. This exact block — `role="alert"`, the danger surface, and the
 * `error instanceof ApiError ? error.message : fallback` ternary — was copied into twelve
 * places, and every copy is a chance to write the ternary the wrong way round and show the
 * fallback where the server had already explained itself.
 *
 * `role="alert"` stays: a screen reader has to be told, and drawing the text in red tells only
 * the people who can see red.
 *
 * There is deliberately no built-in "Thử lại" button. Each caller refetches through a
 * different React Query hook, so a shared button would have to guess — and a retry that
 * silently does nothing is worse than no retry. Callers that have a real one pass `action`.
 */
export function ErrorState({
  error,
  fallback,
  action,
  compact,
}: {
  error: unknown
  /** Shown when the server did not explain itself. Always a full sentence about THIS screen. */
  fallback: string
  action?: ReactNode
  compact?: boolean
}) {
  const message = messageOf(error, fallback)

  return (
    <p
      role="alert"
      className={cn(
        'flex items-start gap-2 rounded-control bg-danger-surface text-danger',
        compact ? 'p-2 text-xs' : 'px-3 py-2 text-sm',
      )}
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span className="min-w-0">{message}</span>
      {action}
    </p>
  )
}

/**
 * Only an `ApiError` carries a sentence written for Sales — the API composes those in
 * Vietnamese. Anything else that lands here is a transport failure or a programming mistake,
 * and its `message` is an English string from the browser ("Failed to fetch"), so the caller's
 * fallback is shown instead. Rule 4 again: a sentence that explains nothing to the reader is
 * worse than the one we chose deliberately.
 */
function messageOf(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message
  if (typeof error === 'string') return error
  return fallback
}

'use client'

import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api-client'

/**
 * Whether the AI kill switch is on, shown next to the logo — but ONLY when it can actually
 * be read.
 *
 * `GET /settings` is `@Roles('admin')`. Sales, who is the person using this product all day,
 * gets a 403. The tempting fallback is to render "AI đang bật" whenever the request fails,
 * and that is exactly the line rule 4 of CLAUDE.md forbids: the real state lives in
 * `system_settings.ai_enabled` and can be flipped at any moment, so a hard-coded "on" is a
 * status line that lies at the worst possible time — while the machine is silently off.
 *
 * So: readable → show it. Not readable → show NOTHING. No placeholder, no "không rõ" (a pill
 * saying "unknown" on every screen is noise, not information), no guess.
 *
 * This pill is a convenience, not a guarantee. Acceptance check 9 is served by the banner on
 * the screens that generate AI output, which does not depend on this component at all.
 */
export function AiStatusPill() {
  const me = useQuery({ queryKey: ['me'], queryFn: () => api.me(), retry: false })
  const isAdmin = me.data?.role === 'admin'

  const settings = useQuery({
    queryKey: ['system-settings'],
    queryFn: () => api.systemSettings(),
    // Never fired for a non-admin: a 403 per page load is noise in the API log and buys
    // nothing, since the answer is already known to be unreadable.
    enabled: isAdmin,
    retry: false,
  })

  if (!isAdmin || settings.data === undefined) return null

  const { aiEnabled } = settings.data

  return (
    <span
      className={
        aiEnabled
          ? 'inline-flex items-center gap-1.5 rounded-pill bg-machine-100 px-3 py-1 text-xs font-medium text-machine-700'
          : 'inline-flex items-center gap-1.5 rounded-pill bg-warning-surface px-3 py-1 text-xs font-medium text-warning'
      }
    >
      {/* A dot alone would make colour the only carrier. The words say it too. */}
      <span aria-hidden className="text-sm leading-none">
        {aiEnabled ? '●' : '■'}
      </span>
      {aiEnabled ? 'AI đang bật' : 'AI đang tắt'}
    </span>
  )
}

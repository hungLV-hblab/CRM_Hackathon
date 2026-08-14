'use client'

import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api-client'

/**
 * "AI đang tắt" — the notice T-9 requires SALES to see, not just the admin who flipped the switch.
 *
 * Three decisions are baked in here and each one is a rule rather than a preference:
 *
 * 1. **Global.** It is mounted once in `app/(app)/layout.tsx`, not on the four screens that show
 *    AI output. Four separate mounts means one of them gets forgotten, and then T-9 fails because
 *    of the screen nobody remembered — a harness failure wearing a product bug's clothes.
 *
 * 2. **Renders ONLY on a confirmed `false`.** Loading, offline, 401, a shape it did not expect:
 *    nothing renders. The mirror of `ai-status-pill`, and the same rule 4 reason — a banner that
 *    appeared whenever the request failed would announce "the machine is off" while it was
 *    happily running, which is worse than saying nothing at all.
 *
 * 3. **`warning`, never `machine`.** Violet means "a machine produced this content"
 *    (design-guidelines). This is a statement about the SYSTEM's state, not a machine-written
 *    sentence, and borrowing the hue would teach the reader the wrong thing about every violet
 *    element on every other screen.
 *
 * Polled rather than fetched once: the admin flips the switch in another tab or another laptop
 * mid-demo, and a Sales screen that only learned the state at mount would keep generating trust
 * in output the system stopped producing.
 */
export function AiDisabledBanner() {
  const status = useQuery({
    queryKey: ['ai-status'],
    queryFn: () => api.aiStatus(),
    refetchInterval: 15_000,
    retry: false,
  })

  if (status.data?.aiEnabled !== false) return null

  return (
    <div
      role="status"
      data-testid="ai-disabled-banner"
      className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-warning/30 bg-warning-surface px-4 py-2 text-sm text-warning"
    >
      {/* Colour is never the only carrier — the glyph and the words say it on a greyscale print. */}
      <span aria-hidden className="leading-none">
        ■
      </span>
      <strong className="font-semibold">AI đang tắt.</strong>
      <span>
        Hệ thống dừng sinh mới: không rút phát hiện, không sinh gợi ý, không tự đặt Việc tiếp theo,
        vòng quét bỏ nhịp. Dữ liệu AI đã sinh <strong>vẫn còn nguyên</strong> và gợi ý đang chờ
        <strong> vẫn duyệt được</strong>.
      </span>
    </div>
  )
}

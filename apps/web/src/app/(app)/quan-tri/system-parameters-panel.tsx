'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import {
  WATCH_CYCLE_SECONDS_MAX,
  WATCH_CYCLE_SECONDS_MIN,
  type SystemParametersDto,
  type UpdateSystemSettingsDto,
} from '@crm/contracts'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api-client'

/**
 * The two system parameters, and one of them is the brake.
 *
 * **The AI kill switch** is required by CLAUDE.md section 4 ("có nút tắt sạch vùng 1–4, hiệu lực
 * ngay, dữ liệu đã sinh không bị xoá") and is measured by T-9. Its scope is ADR-0009: it stops
 * NEW generation and nothing else. Proposals already in the queue stay decidable, findings
 * already drawn stay on screen. The sentence next to the button says so, because "tắt AI" reads
 * to most people like "erase what it did".
 *
 * **The cycle length** takes effect from the next tick with no restart, which is not a nicety —
 * it is the property `e2e/t8` relies on to run the loop at 10 seconds. Hence the floor of 5s
 * rather than 60s: a control that could not express the state the acceptance suite runs in would
 * be a control that lies about the system.
 */
export function SystemParametersPanel({ settings }: { settings: SystemParametersDto }) {
  const queryClient = useQueryClient()
  const [seconds, setSeconds] = useState(String(settings.watchCycleSeconds))

  const save = useMutation({
    mutationFn: (dto: UpdateSystemSettingsDto) => api.updateSystemSettings(dto),
    onSuccess: async (updated) => {
      setSeconds(String(updated.watchCycleSeconds))
      /**
       * Both keys. `system-settings` is this screen; `ai-status` is the banner every OTHER screen
       * reads, and leaving it stale would let an admin turn the machine off and still see a page
       * behaving as though it were on.
       */
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['system-settings'] }),
        queryClient.invalidateQueries({ queryKey: ['ai-status'] }),
      ])
    },
  })

  const parsedSeconds = Number(seconds)
  const secondsError =
    Number.isInteger(parsedSeconds) &&
    parsedSeconds >= WATCH_CYCLE_SECONDS_MIN &&
    parsedSeconds <= WATCH_CYCLE_SECONDS_MAX
      ? undefined
      : `Nhập số nguyên từ ${WATCH_CYCLE_SECONDS_MIN} đến ${WATCH_CYCLE_SECONDS_MAX} giây`

  return (
    <section className="flex flex-col gap-4 rounded-card border border-ink-200 bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-base font-semibold text-ink-900">Tham số hệ thống</h2>
        <Badge tone={settings.aiEnabled ? 'inference' : 'warning'}>
          <span aria-hidden className="mr-1">
            {settings.aiEnabled ? '●' : '■'}
          </span>
          {settings.aiEnabled ? 'AI đang bật' : 'AI đang tắt'}
        </Badge>
      </div>

      <div className="flex flex-col gap-2">
        <Button
          /** Turning the machine off is not destructive — it is the safety control. */
          variant={settings.aiEnabled ? 'secondary' : 'primary'}
          disabled={save.isPending}
          data-testid="toggle-ai"
          onClick={() => save.mutate({ aiEnabled: !settings.aiEnabled })}
        >
          {settings.aiEnabled ? 'Tắt toàn bộ AI' : 'Bật lại AI'}
        </Button>
        <p className="text-sm text-ink-600">
          Hiệu lực <strong>ngay</strong>, không cần chạy lại gì: cả API lẫn vòng quét đọc lại{' '}
          <code className="rounded bg-ink-100 px-1 py-0.5 text-xs">system_settings</code> ở mỗi lần
          gọi, không cache. Tắt thì hệ thống <strong>dừng sinh mới</strong> — không rút phát hiện,
          không sinh gợi ý, không tự đặt Việc tiếp theo, vòng quét bỏ nhịp và vẫn ghi một dòng nhật
          ký. Dữ liệu đã sinh <strong>không bị xoá</strong> và hàng đợi tồn <strong>vẫn duyệt
          được</strong>. Mỗi lần bật/tắt đều ghi vết.
        </p>
      </div>

      <div className="flex flex-col gap-2 border-t border-ink-200 pt-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <Input
              label="Chu kỳ vòng quét (giây)"
              type="number"
              inputMode="numeric"
              min={WATCH_CYCLE_SECONDS_MIN}
              max={WATCH_CYCLE_SECONDS_MAX}
              value={seconds}
              error={secondsError}
              onChange={(event) => setSeconds(event.target.value)}
            />
          </div>
          <Button
            variant="secondary"
            disabled={save.isPending || secondsError !== undefined}
            data-testid="save-watch-cycle-seconds"
            onClick={() => save.mutate({ watchCycleSeconds: parsedSeconds })}
          >
            Lưu chu kỳ
          </Button>
        </div>
        <p className="text-sm text-ink-600">
          Đang chạy <span className="tabular">{settings.watchCycleSeconds}</span> giây một vòng. Đổi
          thì <strong>nhịp quét đổi từ vòng sau</strong>, không cần chạy lại worker. Vòng quét đọc
          nguồn của mọi công ty Đang theo dõi; đặt quá ngắn thì vòng trước chưa xong, vòng sau bị bỏ
          nhịp và ghi <code className="rounded bg-ink-100 px-1 py-0.5 text-xs">previous_cycle_running</code>
          {' '}vào nhật ký — đó là trạng thái bình thường, không phải lỗi.
        </p>
      </div>

      {save.isError && (
        <p role="alert" className="rounded-control bg-danger-surface p-2 text-sm text-danger">
          {(save.error as Error).message}
        </p>
      )}
    </section>
  )
}

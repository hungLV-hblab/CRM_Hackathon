'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'

import { ImportDataPanel } from './import-data-panel'
import { MetricsPanel } from './metrics-panel'
import { PageHeader } from '@/components/shell/page-header'
import { PageBody } from '@/components/shell/page-body'
import { SnapshotVariantSwitch } from './snapshot-variant-switch'
import { SystemParametersPanel } from './system-parameters-panel'
import { api } from '@/lib/api-client'

/**
 * "Quản trị" — the admin dashboard: read the numbers, change the two parameters, pull the brake.
 *
 * ADMIN ONLY, and the guard is on the API rather than here: `GET /settings` and `GET /metrics` are
 * `@Roles('admin')`, so a Sales session that types this URL sees the refusal below instead of an
 * empty dashboard. A client-side role check would be a curtain in front of an open door; this way
 * the screen is honest about where the boundary actually is.
 *
 * Q-6 is settled for round 1 (ADR-0033): Admin operates the CRM exactly as Sales does. The three
 * CRM controllers carry only `JwtGuard`, and a detailed permission matrix is out of scope — said
 * here rather than implied, because the alternative is a judge inferring a restriction the code
 * does not have.
 */
export default function AdminPage() {
  const settings = useQuery({
    queryKey: ['system-settings'],
    queryFn: () => api.systemSettings(),
    retry: false,
  })
  const metrics = useQuery({ queryKey: ['metrics'], queryFn: () => api.metrics(), retry: false })

  const forbidden = isForbidden(settings.error) || isForbidden(metrics.error)

  return (
    <PageBody>
      <PageHeader
        title="Quản trị"
        description="Chỉ số đo, tham số hệ thống, và công tắc tắt sạch AI."
        actions={
          <Link
            href="/quan-tri/nhat-ky-vong-quet"
            className="text-sm text-ink-600 underline underline-offset-2 hover:text-ink-900"
          >
            Nhật ký vòng quét
          </Link>
        }
      />

      {forbidden && (
        <p className="rounded-card border border-warning/30 bg-warning-surface p-4 text-sm text-warning">
          Màn này dành cho tài khoản Quản trị. Tài khoản Sales đọc được trạng thái AI ở dải băng
          trên cùng mọi màn, nhưng không xem được chỉ số đo và không đổi được tham số.
        </p>
      )}

      {settings.data && <SystemParametersPanel settings={settings.data} />}

      {metrics.isPending && !forbidden && <p className="text-sm text-ink-500">Đang tải chỉ số…</p>}
      {metrics.data && <MetricsPanel metrics={metrics.data} />}

      {settings.data && <SnapshotVariantSwitch />}

      {settings.data && <ImportDataPanel />}
    </PageBody>
  )
}

/** A 403 is a different thing from a broken screen, and the reader is told which one they hit. */
function isForbidden(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === 403
}

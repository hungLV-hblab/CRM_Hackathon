'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'

import type { ImportSummaryDto } from '@crm/contracts'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { ErrorState } from '@/components/ui/error-state'
import { SectionCard } from '@/components/ui/section-card'
import { api } from '@/lib/api-client'

/**
 * Spec 7 condition 5 — nạp dữ liệu BTC qua giao diện, không gõ tay, không sửa mã. Nạp lại đúng
 * file thì hệ thống về đúng trạng thái ban đầu (I-14): TRUNCATE toàn bộ rồi nạp lại, y hệt
 * `pnpm seed`, chỉ khác là chạy từ trình duyệt.
 *
 * Modal xác nhận là bắt buộc — đây là hành động phá huỷ (xoá sạch dữ liệu hiện tại), không phải
 * kiểm tra hình thức: bấm nhầm không có đường lùi trong phiên đó.
 */
export function ImportDataPanel() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [summary, setSummary] = useState<ImportSummaryDto | null>(null)

  const importData = useMutation({
    mutationFn: (file: File) => api.importData(file),
    onSuccess: async (result) => {
      setSummary(result)
      setPendingFile(null)
      // Every screen reading companies/contacts/opportunities now shows stale data otherwise.
      await queryClient.invalidateQueries()
    },
  })

  function onFileChosen(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) setPendingFile(file)
    event.target.value = ''
  }

  function confirmImport() {
    if (pendingFile) importData.mutate(pendingFile)
  }

  return (
    <SectionCard title="Nạp dữ liệu mẫu">
      <p className="text-sm text-ink-600">
        Chọn file zip ban tổ chức phát (công ty, liên hệ, cơ hội, bản chụp web). Nạp lại đúng file
        này bất cứ lúc nào để đưa hệ thống về đúng trạng thái ban đầu, diễn lại kịch bản demo từ
        đầu.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={onFileChosen}
      />
      <Button
        variant="secondary"
        onClick={() => fileInputRef.current?.click()}
        disabled={importData.isPending}
      >
        Chọn file zip…
      </Button>

      {importData.isError && (
        <ErrorState error={importData.error} fallback="Không nạp được dữ liệu" />
      )}

      {summary && (
        <div className="rounded-control border border-ink-200 bg-surface p-3 text-sm text-ink-900">
          <p className="font-medium">Đã nạp xong:</p>
          <ul className="mt-1 list-disc pl-5">
            <li>{summary.companies} công ty</li>
            <li>{summary.contacts} liên hệ</li>
            <li>{summary.opportunities} cơ hội</li>
            <li>{summary.snapshotPages} trang bản chụp</li>
          </ul>
          {summary.warnings.length > 0 && (
            <div className="mt-2 rounded-control border border-warning/30 bg-warning-surface p-2 text-warning">
              <p className="font-medium">Cảnh báo ({summary.warnings.length}):</p>
              <ul className="mt-1 list-disc pl-5">
                {summary.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <Dialog
        open={pendingFile !== null}
        onClose={() => setPendingFile(null)}
        title="Nạp lại toàn bộ dữ liệu?"
      >
        <p className="text-sm text-ink-700">
          Toàn bộ dữ liệu hiện tại (công ty, liên hệ, cơ hội, bản chụp, gợi ý đang chờ duyệt) sẽ bị{' '}
          <strong>xoá sạch</strong> và thay bằng dữ liệu trong file{' '}
          <code className="rounded bg-ink-100 px-1 py-0.5 text-xs">{pendingFile?.name}</code>. Không
          hoàn tác được trong phiên này.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setPendingFile(null)}>
            Huỷ
          </Button>
          <Button variant="danger" onClick={confirmImport} disabled={importData.isPending}>
            {importData.isPending ? 'Đang nạp…' : 'Xoá và nạp lại'}
          </Button>
        </div>
      </Dialog>
    </SectionCard>
  )
}

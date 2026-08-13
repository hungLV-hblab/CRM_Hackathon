'use client'

import { useState, type FormEvent } from 'react'

import { STAGE, type Stage, type UpdateStageDto } from '@crm/contracts'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

/**
 * THE PLACE THE NEVER-BLOCK RULE BECOMES VISIBLE.
 *
 * Dropping into "Đủ điều kiện" or "Thua" opens this dialog to ask for the cells the Specs
 * want, and it always carries a second button: **"Để trống, bổ sung sau"**. That button is
 * not a courtesy — it is the rule. The deal moves either way, and the incomplete one comes
 * back wearing a warning flag instead of being refused.
 *
 * So: no `required` on any field here, and no disabled submit. If either ever appears, the
 * screen has started blocking Sales while the API still does not.
 */
export function StageTransitionDialog({
  open,
  stage,
  opportunityName,
  onCancel,
  onConfirm,
}: {
  open: boolean
  stage: Stage | null
  opportunityName: string
  onCancel: () => void
  onConfirm: (cells: Omit<UpdateStageDto, 'stage'>) => void
}) {
  const [cells, setCells] = useState<Record<string, string>>({})

  function close() {
    setCells({})
    onCancel()
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    onConfirm(trimmed(cells))
    setCells({})
  }

  function skip() {
    // Deliberately sends nothing at all rather than empty strings: "I have not filled this
    // in" and "I cleared this cell" are different intentions and the API reads them apart.
    onConfirm({})
    setCells({})
  }

  if (!stage) return null

  return (
    <Dialog open={open} onClose={close} title={`Chuyển sang ${STAGE[stage]}`}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-sm text-ink-600">
          {opportunityName} · {promptFor(stage)}
        </p>

        {stage === 'lost' ? (
          <Input
            label="Lý do thua"
            value={cells.lostReason ?? ''}
            onChange={(event) => setCells({ ...cells, lostReason: event.target.value })}
          />
        ) : (
          <>
            <Input
              label="Dấu hiệu nhu cầu"
              value={cells.needSignal ?? ''}
              onChange={(event) => setCells({ ...cells, needSignal: event.target.value })}
            />
            <Input
              label="Nguồn của dấu hiệu nhu cầu"
              value={cells.needSignalSource ?? ''}
              onChange={(event) => setCells({ ...cells, needSignalSource: event.target.value })}
            />
            <Input
              label="Dấu hiệu ngân sách"
              value={cells.budgetSignal ?? ''}
              onChange={(event) => setCells({ ...cells, budgetSignal: event.target.value })}
            />
            <Input
              label="Nguồn của dấu hiệu ngân sách"
              value={cells.budgetSignalSource ?? ''}
              onChange={(event) => setCells({ ...cells, budgetSignalSource: event.target.value })}
            />
            <p className="text-xs text-ink-600">
              Đủ cả bốn ô thì cờ cảnh báo mới mất — một câu không có nguồn thì chưa kiểm được
              hai chiều.
            </p>
          </>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={close}>
            Huỷ
          </Button>
          <Button type="button" variant="secondary" onClick={skip}>
            Để trống, bổ sung sau
          </Button>
          <Button type="submit">Lưu và chuyển</Button>
        </div>
      </form>
    </Dialog>
  )
}

function promptFor(stage: Stage): string {
  return stage === 'lost'
    ? 'Ghi lý do thua nếu đã biết. Không ghi thì cơ hội vẫn chuyển, nhưng đứng ngoài bảng thống kê lý do thua.'
    : 'Điền dấu hiệu nhu cầu và ngân sách nếu đã có. Không điền thì cơ hội vẫn chuyển, kèm cờ cảnh báo.'
}

/** Blank boxes are dropped entirely, so an untouched field never overwrites a stored value. */
function trimmed(cells: Record<string, string>): Omit<UpdateStageDto, 'stage'> {
  return Object.fromEntries(
    Object.entries(cells)
      .map(([key, value]) => [key, value.trim()])
      .filter(([, value]) => value.length > 0),
  )
}

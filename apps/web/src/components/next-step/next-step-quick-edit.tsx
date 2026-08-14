'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import type { OpportunityDto } from '@crm/contracts'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ErrorState } from '@/components/ui/error-state'
import { api } from '@/lib/api-client'

/**
 * Sales typing their OWN Việc tiếp theo, on the deal card.
 *
 * Rule 5 calls the next step the heartbeat of a deal, and until this existed there was no way to
 * write one from the browser at all — the cell could only be filled by the seed or by the machine.
 * Feature group 4 made that worse rather than better: pressing "Hoàn tác" returns the cell to what
 * a human last typed, which is empty when nobody ever could, and then nothing can fill it again.
 * Half of autonomy zone 3's promise ("sửa lại phải dễ hơn cả lúc máy làm") lives here.
 *
 * Typing over a cell the SYSTEM filled is allowed and intended: `OpportunityService.update` sets
 * `next_step_source = 'human'` whenever text arrives, which hands ownership of the cell back to
 * the person (I-7 then stops the machine from overwriting it again).
 *
 * No new endpoint and no new DTO — `PATCH /opportunities/:id` already writes both columns and
 * already stamps the source.
 */
export function NextStepQuickEdit({ opportunity }: { opportunity: OpportunityDto }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(opportunity.nextStepText ?? '')
  const [dueDate, setDueDate] = useState(opportunity.nextStepDueDate ?? '')

  const save = useMutation({
    mutationFn: () =>
      api.updateOpportunity(opportunity.id, {
        // Empty means "clear this cell", which the contract models as null rather than ''.
        nextStepText: text.trim() ? text.trim() : null,
        nextStepDueDate: dueDate ? dueDate : null,
      }),
    onSuccess: async () => {
      setOpen(false)
      /**
       * BOTH caches. `opportunities` holds the cell; `auto-next-steps` holds the machine mark and
       * its undo button, which is a SEPARATE endpoint (ADR-0027). Invalidating only the first
       * leaves the violet "do hệ thống điền" badge sitting on a cell the person just typed —
       * exactly the confusion rule 2 exists to prevent.
       */
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['opportunities'] }),
        queryClient.invalidateQueries({ queryKey: ['auto-next-steps'] }),
      ])
    },
  })

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setText(opportunity.nextStepText ?? '')
          setDueDate(opportunity.nextStepDueDate ?? '')
          setOpen(true)
        }}
        className="min-h-11 self-start text-xs text-ink-600 underline underline-offset-2 hover:text-ink-900"
      >
        {opportunity.nextStepText ? 'Sửa Việc tiếp theo' : 'Đặt Việc tiếp theo'}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-control border border-ink-300 p-2">
      <Input
        label="Việc tiếp theo"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Gọi lại sau buổi demo"
      />
      <Input
        label="Ngày hạn"
        type="date"
        value={dueDate}
        onChange={(event) => setDueDate(event.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? 'Đang lưu…' : 'Lưu'}
        </Button>
        <Button variant="ghost" disabled={save.isPending} onClick={() => setOpen(false)}>
          Huỷ
        </Button>
      </div>
      {save.isError && (
        <ErrorState error={save.error} fallback="Không lưu được Việc tiếp theo" compact />
      )}
    </div>
  )
}

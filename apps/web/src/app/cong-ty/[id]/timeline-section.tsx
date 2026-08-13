'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'

import { ENTRY_TYPE, type CreateTimelineEntryDto, type TimelineEntryDto } from '@crm/contracts'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { api, ApiError } from '@/lib/api-client'

/**
 * "Dòng thời gian" — activities, stage changes and notes in ONE stream, newest first.
 *
 * Rows the system wrote (autonomy zone 4, feature group 5) carry the machine hue and the
 * "do hệ thống thêm" label; rows a person typed stay on white. That is rule 2 applied to a
 * mixed list, and it is why `createdBy` is on the DTO rather than being inferred from the
 * entry type.
 */
export function TimelineSection({ companyId }: { companyId: string }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ entryType: 'activity', description: '', occurredAt: today() })

  const timeline = useQuery({
    queryKey: ['timeline', companyId],
    queryFn: () => api.listTimeline(companyId),
  })

  const add = useMutation({
    mutationFn: (dto: CreateTimelineEntryDto) => api.addTimelineEntry(companyId, dto),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['timeline', companyId] })
      setForm({ entryType: 'activity', description: '', occurredAt: today() })
    },
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    add.mutate({
      entryType: form.entryType as 'activity' | 'note',
      // A date input gives a day; the API stores an instant, so midday local time keeps the
      // day from sliding backwards once it is converted to UTC.
      occurredAt: new Date(`${form.occurredAt}T12:00:00`).toISOString(),
      description: form.description,
    })
  }

  return (
    <section className="rounded-card border border-ink-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">
        Dòng thời gian
      </h2>

      <form onSubmit={submit} className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <Select
          label="Loại"
          value={form.entryType}
          onChange={(event) => setForm({ ...form, entryType: event.target.value })}
        >
          <option value="activity">{ENTRY_TYPE.activity}</option>
          <option value="note">{ENTRY_TYPE.note}</option>
        </Select>
        <Input
          label="Ngày xảy ra"
          type="date"
          value={form.occurredAt}
          onChange={(event) => setForm({ ...form, occurredAt: event.target.value })}
        />
        <div className="flex-1">
          <Input
            label="Nội dung"
            required
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
        </div>
        <Button type="submit" variant="secondary" disabled={add.isPending}>
          {add.isPending ? 'Đang ghi…' : 'Ghi lại'}
        </Button>
      </form>

      {add.isError && (
        <p role="alert" className="mb-2 text-sm text-danger">
          {add.error instanceof ApiError ? add.error.message : 'Không ghi được vào dòng thời gian'}
        </p>
      )}

      {timeline.isPending && <p className="text-sm text-ink-500">Đang tải…</p>}

      {timeline.data?.length === 0 && (
        <p className="rounded-control border border-dashed border-ink-300 p-3 text-sm text-ink-600">
          Chưa có gì trong dòng thời gian. Ghi lại cuộc gọi hoặc buổi gặp đầu tiên.
        </p>
      )}

      <ol className="flex flex-col gap-2">
        {timeline.data?.map((entry) => (
          <TimelineRow key={entry.id} entry={entry} />
        ))}
      </ol>
    </section>
  )
}

function TimelineRow({ entry }: { entry: TimelineEntryDto }) {
  const isSystem = entry.createdBy === 'system'

  return (
    <li
      className={`rounded-card border p-3 ${
        isSystem ? 'border-machine-200 bg-machine-50' : 'border-ink-200 bg-white'
      }`}
    >
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <Badge tone={isSystem ? 'system' : 'neutral'}>
          {isSystem ? 'Do hệ thống thêm' : ENTRY_TYPE[entry.entryType]}
        </Badge>
        <span className="tabular text-xs text-ink-600">{entry.occurredAt.slice(0, 10)}</span>
        {entry.contactName && <span className="text-xs text-ink-600">· {entry.contactName}</span>}
      </div>
      <p className="text-sm text-ink-900">{entry.description}</p>
    </li>
  )
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

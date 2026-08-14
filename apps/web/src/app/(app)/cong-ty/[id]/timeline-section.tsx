'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, type FormEvent } from 'react'

import {
  ENTRY_TYPE,
  type ClaimDto,
  type CreateTimelineEntryDto,
  type ObservationDto,
  type ObservationWithClaimsDto,
  type TimelineEntryDto,
} from '@crm/contracts'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input, Select } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { SourceViewer } from '@/components/provenance/source-viewer'
import { EmptyState } from '@/components/ui/empty-state'
import { SectionCard } from '@/components/ui/section-card'
import { api, ApiError } from '@/lib/api-client'

/**
 * "Dòng thời gian" — activities, stage changes and notes in ONE stream, newest first.
 *
 * Rows the system wrote (autonomy zone 4, feature group 5) carry the machine hue and the
 * "do hệ thống thêm" label; rows a person typed stay on white. That is rule 2 applied to a
 * mixed list, and it is why `createdBy` is on the DTO rather than being inferred from the
 * entry type.
 *
 * ── Where the quote comes from ──────────────────────────────────────────────────────────
 * A system row must be clickable back to the exact characters it was drawn from (rule 1), and
 * `TimelineEntryDto` carries only `sourceClaimId`. Rather than widening the DTO or adding an
 * endpoint, the claim is looked up in the READ ZONE query this screen already runs — it fetches
 * observations with their claims, and `SourceViewer` needs the whole observation anyway, not just
 * the claim id. So the cost of provenance here is zero requests and zero contract changes.
 *
 * The case where the lookup misses is handled explicitly rather than hopefully: an entry whose
 * snapshot has scrolled out of the read zone renders the label plus "không tra được bản lưu", and
 * NOT a button that opens nothing. Rule 1 says an unsourced assertion is not displayed; a dead
 * button is the worst version of displaying it, because it claims provenance exists.
 */
export function TimelineSection({ companyId }: { companyId: string }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ entryType: 'activity', description: '', occurredAt: today() })

  const timeline = useQuery({
    queryKey: ['timeline', companyId],
    queryFn: () => api.listTimeline(companyId),
  })

  /**
   * The SAME query key the read zone uses, so this is a cache read in practice rather than a
   * second fetch. Kept `enabled` unconditionally: the read zone renders lower on the same page.
   */
  const readingZone = useQuery({
    queryKey: ['reading-zone', companyId],
    queryFn: () => api.readingZone(companyId),
  })

  /** `claimId → { claim, observation }`, built once per read-zone change. */
  const provenanceByClaimId = useMemo(
    () => indexClaims(readingZone.data ?? []),
    [readingZone.data],
  )

  const add = useMutation({
    mutationFn: (dto: CreateTimelineEntryDto) => api.addTimelineEntry(companyId, dto),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['timeline', companyId] })
      setForm({ entryType: 'activity', description: '', occurredAt: today() })
    },
  })

  const remove = useMutation({
    mutationFn: ({ entryId, reason }: { entryId: string; reason: string }) =>
      api.deleteSystemTimelineEntry(companyId, entryId, reason),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['timeline', companyId] })
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
    <SectionCard title="Dòng thời gian">

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

      {remove.isError && (
        <p role="alert" className="mb-2 text-sm text-danger">
          {remove.error instanceof ApiError ? remove.error.message : 'Không xoá được mục này'}
        </p>
      )}

      {timeline.isPending && <Skeleton className="h-40 w-full rounded-card" />}

      {timeline.data?.length === 0 && (
        <EmptyState message="Chưa có gì trong dòng thời gian. Ghi lại cuộc gọi hoặc buổi gặp đầu tiên." compact />
      )}

      <ol className="flex flex-col gap-2">
        {timeline.data?.map((entry) => (
          <TimelineRow
            key={entry.id}
            entry={entry}
            provenance={entry.sourceClaimId ? provenanceByClaimId[entry.sourceClaimId] : undefined}
            removing={remove.isPending}
            onRemove={(reason) => remove.mutate({ entryId: entry.id, reason })}
          />
        ))}
      </ol>
    </SectionCard>
  )
}

interface Provenance {
  claim: ClaimDto
  observation: ObservationDto
}

function TimelineRow({
  entry,
  provenance,
  removing,
  onRemove,
}: {
  entry: TimelineEntryDto
  provenance?: Provenance
  removing: boolean
  onRemove: (reason: string) => void
}) {
  const isSystem = entry.createdBy === 'system'
  const [showSource, setShowSource] = useState(false)
  const [isRemoveOpen, setRemoveOpen] = useState(false)

  return (
    <li
      // The violet border on a system entry is the zone-4 label, not decoration, so hover
      // brightens only the human rows — darkening the machine ones would blur the one signal
      // that says who wrote the row.
      className={`rounded-card border p-3 transition-colors duration-(--duration-state) ${
        isSystem ? 'border-machine-200 bg-machine-50' : 'border-ink-200 bg-surface hover:border-ink-300'
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

      {isSystem && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {provenance ? (
            <Button variant="ghost" onClick={() => setShowSource((open) => !open)}>
              {showSource ? 'Ẩn câu trích' : 'Xem câu trích'}
            </Button>
          ) : (
            /**
             * No claim in the read zone → say so. Never a button that opens nothing: a dead
             * control asserts that provenance exists, which is worse than admitting it is out
             * of reach (rule 1 of CLAUDE.md).
             */
            <span className="text-xs text-ink-600">
              Không tra được bản lưu cho mục này — bản lưu đã ra khỏi vùng đọc.
            </span>
          )}

          {/** Destructive, so never the brand hue — amber is for the action a person wants. */}
          <Button variant="secondary" disabled={removing} onClick={() => setRemoveOpen(true)}>
            Xoá mục này
          </Button>
        </div>
      )}

      {showSource && provenance && (
        <div className="mt-3 rounded-control border border-machine-200 bg-surface p-3">
          <p className="mb-2 text-xs text-ink-600">
            Mục này được rút từ đoạn dưới đây, phần được đánh dấu là câu trích nguyên văn.
          </p>
          <SourceViewer
            observation={provenance.observation}
            highlight={{
              quoteStart: provenance.claim.quoteStart,
              quoteEnd: provenance.claim.quoteEnd,
            }}
          />
        </div>
      )}

      {/**
        * Mounted only while open, and that is load-bearing rather than an optimisation. A closed
        * `<dialog>` still lives in the DOM with its content, so a permanently-mounted dialog would
        * put every entry's description on the page TWICE — once in the row, once inside the hidden
        * dialog. T-1 caught exactly that: `getByText(<activity>)` matched two elements and the
        * acceptance check for "ghi hoạt động" went red on a screen that looked perfectly correct.
        *
        * Conditional mounting also resets the reason field between openings, so a reason typed and
        * then abandoned cannot be submitted against a different entry later.
        */}
      {isRemoveOpen && (
        <RemoveDialog
          description={entry.description}
          pending={removing}
          onClose={() => setRemoveOpen(false)}
          onConfirm={(reason) => {
            onRemove(reason)
            setRemoveOpen(false)
          }}
        />
      )}
    </li>
  )
}

/**
 * I-13 — the reason is mandatory, and it is the only field.
 *
 * It is not a confirmation step dressed up as a form. The number of times Sales removed a
 * machine-written entry, and why, is the error-detection signal feature group 5 produces
 * (ontology section 7 counts it), so a deletion with no reason would leave the metric populated
 * and meaningless. One line, and the submit button stays disabled until there is one.
 */
function RemoveDialog({
  description,
  pending,
  onClose,
  onConfirm,
}: {
  description: string
  pending: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState('')

  return (
    <Dialog open onClose={onClose} title="Xoá mục do hệ thống thêm">
      <p className="text-sm text-ink-700">
        Mục sắp xoá: <span className="font-medium text-ink-900">{description}</span>
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onConfirm(reason.trim())
          setReason('')
        }}
        className="flex flex-col gap-3"
      >
        <Input
          label="Lý do ngắn"
          required
          maxLength={280}
          value={reason}
          placeholder="Ví dụ: tin này của công ty khác"
          onChange={(event) => setReason(event.target.value)}
        />
        <p className="text-xs text-ink-600">
          Lý do được lưu lại để đo hệ thống sai bao nhiêu lần — một dòng là đủ.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Giữ lại
          </Button>
          <Button type="submit" variant="danger" disabled={pending || reason.trim().length === 0}>
            {pending ? 'Đang xoá…' : 'Xoá mục này'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

/** Flattens the read zone into a claim-id index, keeping each claim's observation beside it. */
function indexClaims(observations: ObservationWithClaimsDto[]): Record<string, Provenance> {
  const index: Record<string, Provenance> = {}

  for (const observation of observations) {
    const { claims, ...rest } = observation
    for (const claim of claims) {
      index[claim.id] = { claim, observation: rest }
    }
  }

  return index
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

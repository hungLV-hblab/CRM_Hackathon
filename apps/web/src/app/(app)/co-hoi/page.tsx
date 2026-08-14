'use client'

import { Plus } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'

import { STAGE, type CreateOpportunityDto, type Stage, type UpdateStageDto } from '@crm/contracts'

import { PageHeader } from '@/components/shell/page-header'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog } from '@/components/ui/dialog'
import { FilterBar } from '@/components/ui/filter-bar'
import { Input, Select } from '@/components/ui/input'
import { NotificationStrip } from '@/components/notification/notification-strip'
import { StageBoard } from './stage-board'
import { StageTransitionDialog } from './stage-transition-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { PageBody } from '@/components/shell/page-body'
import { api, ApiError } from '@/lib/api-client'

/** The two stages the Specs want extra cells for. Everything else moves with no questions. */
const STAGES_THAT_ASK: Stage[] = ['qualified', 'lost']

export default function OpportunityBoardPage() {
  const queryClient = useQueryClient()
  const [stageFilter, setStageFilter] = useState<'' | Stage>('')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [pending, setPending] = useState<{ id: string; stage: Stage; name: string } | null>(null)
  const [isCreateOpen, setCreateOpen] = useState(false)

  const opportunities = useQuery({
    queryKey: ['opportunities'],
    queryFn: () => api.listOpportunities(),
  })
  const companies = useQuery({ queryKey: ['companies'], queryFn: () => api.listCompanies() })

  const changeStage = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateStageDto }) =>
      api.updateOpportunityStage(id, dto),
    onSuccess: async () => {
      // The stage move also writes a timeline entry, so both caches are stale.
      await queryClient.invalidateQueries({ queryKey: ['opportunities'] })
      await queryClient.invalidateQueries({ queryKey: ['timeline'] })
      setPending(null)
    },
  })

  /**
   * Dropping into a stage that asks for cells opens the dialog; every other stage moves
   * immediately. The dialog can only ADD information — it can never stop the move.
   */
  function onStageChange(id: string, stage: Stage) {
    const opportunity = opportunities.data?.find((row) => row.id === id)
    if (STAGES_THAT_ASK.includes(stage)) {
      setPending({ id, stage, name: opportunity?.name ?? 'Cơ hội' })
      return
    }
    changeStage.mutate({ id, dto: { stage } })
  }

  const visible = (opportunities.data ?? []).filter((row) => {
    if (stageFilter && row.stage !== stageFilter) return false
    if (overdueOnly && !row.isOverdue) return false
    return true
  })

  return (
    <PageBody width="wide">
      {/* The hand-rolled "← Công ty" link is gone: the shell's breadcrumb says where this
          screen sits, and three screens each inventing their own idea of "up" is how they
          came to disagree about it. */}
      <PageHeader
        title="Cơ hội"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" aria-hidden />
            Thêm cơ hội
          </Button>
        }
      />

      {/*
        Autonomy zone 3 announces itself HERE, above the deals it changed. The app has no shared
        navigation, so a notification route on its own would be a page nobody walks past — and a
        machine write Sales does not notice is a machine write with no safety mechanism at all
        (ADR-0027). Renders nothing when there is nothing unread.
      */}
      <NotificationStrip show="unread" showLink />

      <FilterBar
        chips={[
          ...(stageFilter
            ? [{ label: `Giai đoạn: ${STAGE[stageFilter]}`, onRemove: () => setStageFilter('') }]
            : []),
          ...(overdueOnly ? [{ label: 'Chỉ quá hạn', onRemove: () => setOverdueOnly(false) }] : []),
        ]}
        onReset={() => {
          setStageFilter('')
          setOverdueOnly(false)
        }}
      >
        <Select
          label="Giai đoạn"
          value={stageFilter}
          onChange={(event) => setStageFilter(event.target.value as '' | Stage)}
        >
          <option value="">Tất cả</option>
          {Object.entries(STAGE).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </Select>
        {/* Sits on the grid row with the select, so it lines up instead of floating beside it. */}
        <div className="flex items-end">
          <Checkbox
            label="Chỉ hiện quá hạn"
            checked={overdueOnly}
            onCheckedChange={setOverdueOnly}
          />
        </div>
      </FilterBar>

      {opportunities.isPending && <BoardSkeleton />}
      {opportunities.isError && (
        <ErrorState error={opportunities.error} fallback={'Không tải được danh sách cơ hội'} />
      )}
      {changeStage.isError && (
        <ErrorState error={changeStage.error} fallback={'Không đổi được giai đoạn'} />
      )}

      {opportunities.data && <StageBoard opportunities={visible} onStageChange={onStageChange} />}

      <StageTransitionDialog
        open={pending !== null}
        stage={pending?.stage ?? null}
        opportunityName={pending?.name ?? ''}
        onCancel={() => setPending(null)}
        onConfirm={(cells) => {
          if (!pending) return
          changeStage.mutate({ id: pending.id, dto: { stage: pending.stage, ...cells } })
        }}
      />

      <CreateOpportunityDialog
        open={isCreateOpen}
        companies={(companies.data ?? []).map((row) => ({ id: row.id, name: row.name }))}
        onClose={() => setCreateOpen(false)}
      />
    </PageBody>
  )
}

/** Shaped like the board: four columns at column width, two cards each. */
function BoardSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden">
      {[0, 1, 2, 3].map((column) => (
        <div key={column} className="flex w-72 shrink-0 flex-col gap-2 rounded-card bg-ink-50 p-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ))}
    </div>
  )
}

/** Only the name and the company are required — everything else can be filled in later. */
function CreateOpportunityDialog({
  open,
  companies,
  onClose,
}: {
  open: boolean
  companies: { id: string; name: string }[]
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<{ companyId: string; name: string; expectedValue: string }>({
    companyId: '',
    name: '',
    expectedValue: '',
  })

  const create = useMutation({
    mutationFn: (dto: CreateOpportunityDto) => api.createOpportunity(dto),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['opportunities'] })
      setForm({ companyId: '', name: '', expectedValue: '' })
      onClose()
    },
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    create.mutate({
      companyId: form.companyId || companies[0]?.id,
      name: form.name,
      ...(form.expectedValue.trim() ? { expectedValue: form.expectedValue.trim() } : {}),
    })
  }

  return (
    <Dialog open={open} onClose={onClose} title="Thêm cơ hội">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Select
          label="Công ty"
          value={form.companyId}
          onChange={(event) => setForm({ ...form, companyId: event.target.value })}
        >
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </Select>
        <Input
          label="Tên cơ hội"
          required
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
        <Input
          label="Giá trị dự kiến (để trống nếu chưa biết)"
          inputMode="decimal"
          value={form.expectedValue}
          onChange={(event) => setForm({ ...form, expectedValue: event.target.value })}
        />

        {create.isError && (
          <p role="alert" className="text-sm text-danger">
            {create.error instanceof ApiError ? create.error.message : 'Không tạo được cơ hội'}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Huỷ
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Đang lưu…' : 'Lưu'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

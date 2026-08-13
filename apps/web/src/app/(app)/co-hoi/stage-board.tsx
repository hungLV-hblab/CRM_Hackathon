'use client'

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'

import { STAGE, type OpportunityDto, type Stage } from '@crm/contracts'

import { OpportunityCard } from './opportunity-card'

const STAGES = Object.keys(STAGE) as Stage[]

/**
 * The seven-column board. Drag and drop with dnd-kit, and NO stage dropdown beside it: two
 * ways to do one thing means two code paths to keep honest, and the second one always rots.
 *
 * The KEYBOARD path is therefore load-bearing rather than an accessibility afterthought — it
 * is how the acceptance run moves a deal through three stages (Tab to a card, Space to lift,
 * arrow keys to move, Space to drop). `sortableKeyboardCoordinates` is what makes an arrow
 * key land in the next COLUMN instead of nudging a virtual pointer by 25 pixels.
 */
export function StageBoard({
  opportunities,
  onStageChange,
}: {
  opportunities: OpportunityDto[]
  onStageChange: (opportunityId: string, stage: Stage) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Without a small threshold every click on a card starts a drag, and the "Mở công ty"
      // link underneath becomes unreachable by mouse.
      activationConstraint: { distance: 4 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return

    const target = stageOf(over.id as string, opportunities)
    const current = opportunities.find((row) => row.id === active.id)
    if (!target || !current || current.stage === target) return

    onStageChange(current.id, target)
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {STAGES.map((stage) => (
          <StageColumn
            key={stage}
            stage={stage}
            opportunities={opportunities.filter((row) => row.stage === stage)}
          />
        ))}
      </div>
    </DndContext>
  )
}

/**
 * `over.id` is either a column or another card, depending on where the pointer landed. Both
 * have to resolve to the same stage, or dropping onto a card in a column would do nothing.
 */
function stageOf(overId: string, opportunities: OpportunityDto[]): Stage | null {
  if ((STAGES as string[]).includes(overId)) return overId as Stage
  return opportunities.find((row) => row.id === overId)?.stage ?? null
}

function StageColumn({ stage, opportunities }: { stage: Stage; opportunities: OpportunityDto[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })
  const total = opportunities.reduce((sum, row) => sum + Number(row.expectedValue ?? 0), 0)

  return (
    <section
      ref={setNodeRef}
      aria-label={STAGE[stage]}
      className={`flex w-72 shrink-0 flex-col gap-2 rounded-card border p-3 transition-colors duration-(--duration-state) ${
        // Amber marks where a human is about to act — dropping is exactly that.
        isOver ? 'border-brand-400 bg-brand-50' : 'border-ink-200 bg-ink-50'
      }`}
    >
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink-900">{STAGE[stage]}</h2>
        <span className="tabular text-xs text-ink-600">{opportunities.length}</span>
      </header>
      {total > 0 && (
        <p className="tabular text-xs text-ink-600">{total.toLocaleString('vi-VN')} ₫</p>
      )}

      <SortableContext
        items={opportunities.map((row) => row.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex min-h-24 flex-col gap-2">
          {opportunities.map((opportunity) => (
            <OpportunityCard key={opportunity.id} opportunity={opportunity} />
          ))}
          {opportunities.length === 0 && (
            <p className="rounded-control border border-dashed border-ink-300 p-3 text-xs text-ink-500">
              Chưa có cơ hội nào ở giai đoạn này
            </p>
          )}
        </div>
      </SortableContext>
    </section>
  )
}

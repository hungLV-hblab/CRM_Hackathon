import { OPPORTUNITY_WARNING, type OpportunityWarning } from '@crm/contracts'

import { Badge } from '@/components/ui/badge'

/**
 * ONE component for all three warning flags, and the reason it exists is the colour.
 *
 * A flag wears `warning`, NEVER `machine-*`. Violet means "a machine produced this"
 * (design-guidelines section 1); a flag means "a person has not filled this in yet" — the
 * exact opposite. Painting it violet would tell Sales the AI wrote the gap it is pointing at,
 * which breaks rule 2 of CLAUDE.md in the one place the rule matters most.
 *
 * The label is always a SENTENCE, never a bare `—` or a lone icon: rule 4 of
 * design-guidelines section 5 says an empty cell has to say why it is empty.
 */
export function WarningFlag({ warning }: { warning: OpportunityWarning }) {
  return (
    <Badge tone="warning">
      <WarningIcon />
      {OPPORTUNITY_WARNING[warning]}
    </Badge>
  )
}

export function WarningFlags({ warnings }: { warnings: OpportunityWarning[] }) {
  if (warnings.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1">
      {warnings.map((warning) => (
        <WarningFlag key={warning} warning={warning} />
      ))}
    </div>
  )
}

/** Overdue is not a warning flag: it is a state of a cell that IS filled in. */
export function OverdueFlag({ dueDate }: { dueDate: string }) {
  return (
    <Badge tone="warning">
      <WarningIcon />
      Quá hạn từ {dueDate}
    </Badge>
  )
}

/** SVG, not an emoji: an emoji changes shape per OS and cannot take a token colour. */
function WarningIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="size-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    >
      <path d="M8 2.8 1.8 13.2h12.4L8 2.8Z" strokeLinejoin="round" />
      <path d="M8 6.6v3.1M8 11.6h.01" />
    </svg>
  )
}

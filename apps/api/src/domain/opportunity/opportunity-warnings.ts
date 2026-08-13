import {
  OPEN_STAGES,
  QUALIFICATION_CHECKED_STAGES,
  type OpportunityWarning,
  type Stage,
} from '@crm/contracts'

/**
 * THE definition of the three warning flags and of "overdue", in one pure function with no
 * database access, so list · detail · overview all answer identically.
 *
 * Warnings are DERIVED, never stored. A `has_warning` column would be a second source of
 * truth that starts lying the moment a cell is filled in through SQL, and it would cost a
 * migration to add.
 *
 * Read the two accepted trade-offs on `QUALIFICATION_CHECKED_STAGES` in @crm/contracts
 * before changing the stage set here.
 */

/** The columns a warning can be inferred from — a subset of the `opportunities` row. */
export interface WarningSource {
  stage: Stage
  needSignal: string | null
  needSignalSource: string | null
  budgetSignal: string | null
  budgetSignalSource: string | null
  lostReason: string | null
  nextStepText: string | null
  /** `YYYY-MM-DD`, the shape Postgres `date` hands back. */
  nextStepDueDate: string | null
}

function isOpen(stage: Stage): boolean {
  return (OPEN_STAGES as readonly string[]).includes(stage)
}

/**
 * A warning is never a refusal. Feature group 1 must not block ANY action of Sales' — the
 * flag is how an incomplete row stays visible instead of being rejected, which is the whole
 * point of "một dòng dữ liệu sai tệ hơn một dòng để trống".
 */
export function opportunityWarnings(row: WarningSource): OpportunityWarning[] {
  const warnings: OpportunityWarning[] = []

  if ((QUALIFICATION_CHECKED_STAGES as readonly string[]).includes(row.stage)) {
    // All FOUR cells, sentence and source alike: a claim nobody can be traced back to has
    // not been checked in both directions, which is what the Specs' qualify gate asks for.
    const complete =
      row.needSignal && row.needSignalSource && row.budgetSignal && row.budgetSignalSource
    if (!complete) warnings.push('missing_qualification_signals')
  }

  if (row.stage === 'lost' && !row.lostReason) {
    warnings.push('missing_lost_reason')
  }

  if (isOpen(row.stage) && (!row.nextStepText || !row.nextStepDueDate)) {
    warnings.push('missing_next_step')
  }

  return warnings
}

/**
 * Overdue and "missing next step" are ONE proposition, not two rules that can drift apart:
 * with no due date there is nothing to be late for, so an opportunity missing its next step
 * warns and is automatically absent from the to-do list rather than being filtered out of it
 * by a second condition somebody has to remember.
 *
 * `today` is passed in rather than read from the clock, so the callers of a screen and the
 * tests of that screen agree on what day it is.
 */
export function isOverdue(row: WarningSource, today: string): boolean {
  if (!row.nextStepDueDate) return false
  if (!isOpen(row.stage)) return false
  return row.nextStepDueDate < today
}

/** `YYYY-MM-DD` in the server's local zone — the same shape a Postgres `date` compares as. */
export function todayIso(now: Date = new Date()): string {
  const offsetMinutes = now.getTimezoneOffset()
  return new Date(now.getTime() - offsetMinutes * 60_000).toISOString().slice(0, 10)
}

import { SIGNAL_DUE_DAYS, SIGNAL_DUE_REASON } from '@crm/contracts'

/**
 * I-9 — the due date of a next step comes from the urgency table (`signal_type` → days), never
 * from the model. Shared by the TWO paths that write a next step, and that sharing is the whole
 * point of the file existing:
 *
 *   - a human accepting a `next_step` suggestion (`proposal-decision-service.ts`)
 *   - the system setting one itself (`auto-next-step-service.ts`, autonomy zone 3)
 *
 * With a copy on each side, "change the urgency table and the due date follows" would be true
 * of half the system, and the half it was false for would be the half nobody is watching.
 *
 * The table itself stays in `@crm/contracts` because the WEB reads it too — the cell shows why
 * a date is what it is, and a reason computed in the API and a table read in the browser would
 * be two answers to the same question.
 */

/**
 * `YYYY-MM-DD` in the LOCAL calendar, which is the calendar Sales works in.
 *
 * Not `toISOString().slice(0, 10)`: that reports the UTC day, and Vietnam is UTC+7, so every
 * write made after 17:00 local would get a due date one day early — silently, and only in the
 * evening. A next step that appears to be due sooner than the urgency table says is exactly the
 * kind of wrong data rule 4 ranks below no data at all.
 */
export function dueDateFor(signalType: string, from: Date = new Date()): string {
  const days = SIGNAL_DUE_DAYS[signalType as keyof typeof SIGNAL_DUE_DAYS] ?? 14
  const due = new Date(from)
  due.setDate(due.getDate() + days)

  return [
    due.getFullYear(),
    String(due.getMonth() + 1).padStart(2, '0'),
    String(due.getDate()).padStart(2, '0'),
  ].join('-')
}

/**
 * The sentence shown next to the date. A date with no reason is a number Sales has to trust;
 * with the reason it is a number they can disagree with, which is the difference rule 1 is
 * after even where the value itself was computed by code rather than by a model.
 */
export function dueReasonFor(signalType: string): string {
  return (
    SIGNAL_DUE_REASON[signalType as keyof typeof SIGNAL_DUE_REASON] ?? SIGNAL_DUE_REASON.other
  )
}

/** How many days the table grants this signal — shown as "hạn N ngày" beside the reason. */
export function dueDaysFor(signalType: string): number {
  return SIGNAL_DUE_DAYS[signalType as keyof typeof SIGNAL_DUE_DAYS] ?? SIGNAL_DUE_DAYS.other
}

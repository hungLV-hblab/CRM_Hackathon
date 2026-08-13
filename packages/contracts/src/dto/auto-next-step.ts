import type { ClaimDto } from './claim'

/**
 * ontology 3.3 — what the system wrote into a deal's Việc tiếp theo on its own (autonomy zone
 * 3), everything the card needs to SHOW that it did, and the one click that takes it back.
 *
 * Its own DTO on its own endpoint (ADR-0027 · B1), NOT extra fields on `OpportunityDto`. Two
 * reasons, and only the second one is about the deadline:
 *
 *   - `OpportunityDto` / `OPPORTUNITY_SELECTION` / `toDto` are also what the overview screen
 *     reads. Widening them makes five screens that never show a machine-written cell carry the
 *     join anyway.
 *   - the deal board and the overview both went green in phases 3 and 5; the cheapest change
 *     that keeps them that way is the one that does not touch their query.
 *
 * The price, written down rather than discovered later: the deal board calls two endpoints and
 * merges them in the client.
 */
export interface AutoNextStepDto {
  /** The `AutoNextStepEvent`. What `POST /auto-next-step-events/:id/undo` takes. */
  eventId: string
  opportunityId: string
  /** What the system wrote. Compare against `OpportunityDto.nextStepText` to spot a later edit. */
  newText: string
  newDueDate: string | null
  /**
   * The evidence. Rule 1 holds in zone 3 exactly as it does in zone 1 — a cell the machine
   * filled with no way back to the sentence that justified it is a cell Sales cannot audit.
   */
  claim: ClaimDto
  /** I-9, in words: why THIS date and not another. Read from the urgency table, never guessed. */
  dueReason: string
  dueDays: number
  createdAt: string
  /** End of the 7-day window, ISO. Shown as a countdown so "còn mấy ngày" needs no arithmetic. */
  undoDeadline: string
  /**
   * Computed by the API against SERVER time. A client comparing its own clock to the deadline
   * would offer an undo that then fails — the one interaction zone 3 cannot afford to fumble.
   */
  canUndo: boolean
}

/**
 * `opportunityId → the newest un-undone auto write`. A map because the deal board merges it onto
 * a list it already has, and a list would make every card scan it.
 */
export type AutoNextStepMap = Record<string, AutoNextStepDto>

/** What the undo returned the cell to (I-8): the last HUMAN-typed value, empty if there never was one. */
export interface UndoResultDto {
  opportunityId: string
  restoredText: string | null
  restoredDueDate: string | null
}

/**
 * ontology 3.3 — one line of "Nhật ký vòng quét".
 *
 * Every number here is on the DTO because the screen shows all of them, per cycle, and that is a
 * requirement rather than a layout choice: autonomy zone 4 writes to official data with nobody's
 * approval, so the log is the only place the loop can be audited afterwards. The pair that
 * matters most is `newContentCount` alongside `entriesAdded` — content read but nothing written
 * is the shape of a wrong filter or a wrong prompt, and phase 5 measured exactly that failure
 * looking like "the model found nothing".
 */
export interface WatchCycleRunDto {
  id: string
  /** ISO 8601. For a rolled-up row this is the LAST of the cycles it covers, not the first. */
  startedAt: string
  durationMs: number | null
  companiesScanned: number
  /** Companies whose source really differed from the previous snapshot (I-3). */
  newContentCount: number
  /** Timeline entries the cycle added by itself — autonomy zone 4. */
  entriesAdded: number
  errorCount: number
  /** One source failing must not hide the others, so the reasons are kept, joined. */
  errorDetail: string | null
  /**
   * `ai_disabled` | `previous_cycle_running` | null. A skipped tick still writes a row: with no
   * row at all, "switched off" and "dead" read identically (T-9, I-10).
   */
  skippedReason: string | null
  /** True for the summary line the log adds every ten cycles. */
  isRollup: boolean
  cyclesCovered: number
}

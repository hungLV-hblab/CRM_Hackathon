/**
 * ontology section 7 — the numbers the admin dashboard shows, under the names the ontology
 * gives them. The judges are not meant to infer what a number is from its position on a page.
 *
 * ── Why every rate is an OBJECT and not a number ──────────────────────────────────────────
 * `rate: null` means the denominator is 0, and the screen must then say "chưa có dữ liệu"
 * rather than render `0%`. That is not pedantry: `0%` next to "Error-detection rate" reads as
 * "the AI is wrong 100% of the time" to someone scanning the page, and `0%` next to
 * "Auto-accept rate" reads as "nobody accepts anything". Both would be a fabricated fact
 * (CLAUDE.md rule 4: an empty cell beats a wrong one).
 *
 * `numerator` and `denominator` travel with every rate for the same reason: 1 accept out of 1
 * decision is 100%, and a screen that only prints "100%" invites a conclusion the sample size
 * does not support.
 */

export interface RateDto {
  /** `numerator / denominator`, or NULL when the denominator is 0. Never 0-as-a-stand-in. */
  rate: number | null
  numerator: number
  denominator: number
}

export interface DistributionRow {
  /** The enum code. The UI maps it to its Vietnamese label; the API never sends prose. */
  key: string
  count: number
}

/**
 * The denominator of error-detection rate, itemised (ADR-0031).
 *
 * It is the three sets the AI put IN FRONT OF A PERSON — a proposal in the queue, a next step
 * it wrote by itself, a timeline entry it added by itself — because those are exactly what a
 * person is in a position to reject. `claims` was deliberately left out: adding it inflates the
 * denominator five- to tenfold with findings that never reached anybody, and a ratio that can
 * only ever sit near zero measures nothing.
 */
export interface ErrorDetectionBreakdown {
  rejectedWrongInfo: number
  rejectedMisreadContext: number
  undoneAutoNextSteps: number
  deletedSystemEntries: number
}

export interface ErrorDetectionDenominator {
  proposals: number
  autoNextStepEvents: number
  systemTimelineEntries: number
}

export interface ErrorDetectionRateDto extends RateDto {
  numeratorBreakdown: ErrorDetectionBreakdown
  denominatorBreakdown: ErrorDetectionDenominator
}

/**
 * Median time-to-decide, with the two numbers that make it readable.
 *
 * `missingTimestamps` is not a footnote: ADR-0025 allows `seconds_to_decide` to be NULL when a
 * page reload loses the mark, and a median quoted without saying how many rows had no mark at
 * all is a number nobody can check. ontology section 7 also warns this metric is only read
 * ALONGSIDE error-detection rate — fast decisions can mean a good interface or blind clicking.
 */
export interface DecisionTimeDto {
  medianSeconds: number | null
  sampleSize: number
  missingTimestamps: number
}

export interface MetricsDto {
  /** `accept / (accept + edit + reject)` — the system getting smarter. */
  autoAcceptRate: RateDto
  /** `edit / total`, kept SEPARATE from accept. I-12: an edited suggestion was not accepted. */
  editRate: RateDto
  /** The PERSON getting smarter — see the breakdowns above. */
  errorDetectionRate: ErrorDetectionRateDto
  /** `undone / total AutoNextStepEvent` — how trustworthy autonomy zone 3 turned out to be. */
  undoRate: RateDto
  /** `GROUP BY reject_reason` — where the machine is wrong. */
  rejectReasons: DistributionRow[]
  /** `GROUP BY confidence` on claims — is the model overconfident. */
  confidences: DistributionRow[]
  decisionTime: DecisionTimeDto
  /** `audit_events.detail->>'reason'` on removed system entries (the I-13 contract). */
  systemEntryDeleteReasons: DistributionRow[]
}

import type { FetchStatus } from '../enums'

/**
 * ontology 3.2 — "bản lưu". What the provenance drawer renders when Sales clicks a finding.
 *
 * Both representations travel, per ADR-0012: `rawContent` backs the "Văn bản" tab and is the
 * string quote offsets are measured against, `rawHtml` backs the "Bản gốc" tab. Sending only
 * the HTML would make the offsets meaningless on the client.
 *
 * `rawHtml` is nullable because a failed fetch (`fetchStatus = 'failed'`) has no body to keep.
 * In that case the screen says the source could not be read — it never guesses (ontology 3.5).
 */
export interface ObservationDto {
  id: string
  companyId: string
  sourceUrl: string
  /** `'company_website'` today; the tier tower has only one level so far. */
  sourceTier: string
  /** ISO 8601. Every observation carries a timestamp — that is what makes it a `bản lưu`. */
  capturedAt: string
  rawContent: string
  rawHtml: string | null
  fetchStatus: FetchStatus
}

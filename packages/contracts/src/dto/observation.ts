import { z } from 'zod'

import type { ClaimDto } from './claim'
import { TRIGGER_CONTEXT, enumCodes } from '../enums'
import type { FetchErrorReason, FetchStatus, SourceKind } from '../enums'

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
  /** `company_website`, and from the live path also `news` / `social`. */
  sourceTier: string
  /** ISO 8601. Every observation carries a timestamp — that is what makes it a `bản lưu`. */
  capturedAt: string
  rawContent: string
  rawHtml: string | null
  fetchStatus: FetchStatus
  /**
   * Which kind of source this came from. It travels to the client because rule 2 of CLAUDE.md
   * applies to the SOURCE as much as to fact-versus-inference: a finding drawn from an unvetted
   * public page has to be distinguishable by eye from one drawn from the vetted snapshot set.
   * The screen cannot draw that distinction if the field never leaves the server.
   */
  sourceKind: SourceKind
  /**
   * Why the read failed, when it did — `null` on every successful read.
   *
   * The reason is the point, not a debugging aid: "Trang cần chạy JavaScript mới hiện nội dung"
   * and "Trang từ chối máy đọc tự động" send a Sales person to two different actions, and the one
   * state Specs group 2 offers ("could not read") sends them to neither.
   */
  fetchErrorReason: FetchErrorReason | null
}

/**
 * The read zone renders findings UNDER the snapshot they came from, never in a flat list:
 * that layout is what makes rule 1 checkable by eye — a finding with no snapshot above it has
 * nowhere to sit.
 */
export interface ObservationWithClaimsDto extends ObservationDto {
  claims: ClaimDto[]
}

/**
 * Reading a source again is an explicit act, so the caller says which snapshot to read and
 * under which context. `triggerContext` is not cosmetic: I-4 forbids a `manual_ingest`
 * finding from ever becoming a timeline entry, so the value chosen here decides what the
 * finding is allowed to cause later.
 */
export const ingestSnapshotSchema = z.object({
  /** Which stored snapshot to read. Live crawling is out of scope for this module. */
  variant: z.enum(['before', 'after']),
  triggerContext: z.enum(enumCodes(TRIGGER_CONTEXT)).default('manual_ingest'),
})

export type IngestSnapshotDto = z.infer<typeof ingestSnapshotSchema>

/**
 * What reading a source produced. Every field here is a number the team has to be able to
 * defend, per ADR-0014: the share of findings dropped for an unverifiable quote is a METRIC
 * proving rule 1 is doing something, not a silent failure.
 */
export interface IngestResultDto {
  /** null when the content was unchanged — I-3 means no snapshot row and no LLM call. */
  observationId: string | null
  /** True when `content_hash` matched the previous snapshot: "đã đọc, không đổi". */
  unchanged: boolean
  /**
   * `'ai_disabled'` when the kill switch is off and nothing was generated (ADR-0009). Same
   * vocabulary as `WatchCycleRun.skipped_reason` on purpose: the switch has to stop EVERY
   * generation path, and reading a source by hand is one of them.
   */
  skippedReason: 'ai_disabled' | null
  /** `failed` means the source could not be read. No findings are produced, none are guessed. */
  fetchStatus: FetchStatus
  claimsProposed: number
  claimsSaved: number
  /** Dropped because `quoteText` was not a verbatim substring (I-2). */
  claimsDroppedNoVerbatimQuote: number
  /** Proposed as `certain` but downgraded by the ADR-0007 gate. */
  claimsDowngradedFromCertain: number
  /**
   * Timeline entries feature group 5 wrote by itself (autonomy zone 4) — non-zero only for a
   * company carrying Đang theo dõi, whoever did the reading (ADR-0028).
   *
   * It travels on THIS result rather than being counted by the watch cycle afterwards because
   * the cycle would then have to ask the database "how many rows appeared just now", and a
   * count bounded by time is the `timestamptz`-versus-`Date` trap feature group 4 already paid
   * for. Here the number never leaves the process that produced it.
   */
  systemEntriesAdded: number
  /**
   * How many sources this read attempted, and how many of them failed.
   *
   * A single `fetchStatus` was enough while a company had exactly one source. It cannot say "two
   * of your three pages answered", and rounding that to `ok` would hide a source that has been
   * down for a week behind a green result. These two numbers are what keep the partial case
   * visible without changing the meaning of any field that already existed.
   */
  sourcesAttempted: number
  sourcesFailed: number
}

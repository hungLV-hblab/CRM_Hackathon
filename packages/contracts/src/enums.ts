/**
 * The SINGLE source of truth for the enums defined in ontology section 3.5.
 *
 * Key = the code used in code/database/API. Value = the Vietnamese label shown in the UI
 * (CLAUDE.md section 3: the UI speaks the Specs' Vietnamese, the code speaks English).
 * Label values stay Vietnamese on purpose — they are product content read by Sales, not code.
 *
 * Frontend takes labels · backend takes keys · Drizzle `pgEnum` takes `enumCodes(...)`.
 * Change something here and forget docs/ontology.md and `ontology-enum-parity.test.ts`
 * goes red — and the other way around too.
 */

/** Codes as a non-empty tuple, which is exactly the shape Drizzle's `pgEnum` requires. */
export function enumCodes<T extends Record<string, string>>(
  enumObj: T,
): [keyof T & string, ...(keyof T & string)[]] {
  return Object.keys(enumObj) as [keyof T & string, ...(keyof T & string)[]]
}

export const COMPANY_TYPE = {
  traditional: 'Traditional',
  it_solution: 'IT Solution',
  it_product: 'IT Product',
  tech_startup: 'Tech-based/Startup',
  other_ito: 'ITO khác',
} as const
export type CompanyType = keyof typeof COMPANY_TYPE

/**
 * Naming trap (ontology 3.5): the "Soạn đề xuất" stage is `drafting`, NOT `proposal` —
 * `Proposal` is already the name of the AI's suggestion entity.
 */
export const STAGE = {
  prospecting: 'Tiếp cận',
  qualified: 'Đủ điều kiện',
  drafting: 'Soạn đề xuất',
  negotiation: 'Thương lượng',
  won: 'Thắng',
  lost: 'Thua',
  on_hold: 'Tạm dừng',
} as const
export type Stage = keyof typeof STAGE

/**
 * ontology 3.5: `on_hold` is OPEN, but the overview screen must keep it out of the running
 * pipeline — paused deals inflate the number people carry into meetings.
 */
export const OPEN_STAGES = ['prospecting', 'qualified', 'drafting', 'negotiation', 'on_hold'] as const
export const CLOSED_STAGES = ['won', 'lost'] as const

export const SIGNAL_TYPE = {
  funding: 'gọi vốn',
  leadership_hire: 'nhân sự cấp cao',
  expansion: 'mở rộng',
  mass_hiring: 'tuyển dụng',
  new_business_line: 'mảng kinh doanh mới',
  other: 'khác',
} as const
export type SignalType = keyof typeof SIGNAL_TYPE

export const CONFIDENCE = {
  certain: 'Chắc',
  likely: 'Có thể',
  speculative: 'Đoán',
} as const
export type Confidence = keyof typeof CONFIDENCE

export const PROPOSAL_TYPE = {
  field_update: 'sửa ô hồ sơ',
  timeline_entry: 'thêm tin',
} as const
export type ProposalType = keyof typeof PROPOSAL_TYPE

/**
 * ADR-0016 — deliberately TWO values, not a mirror of `DECISION`.
 *
 * `status` is only the queue flag ("is this still waiting?"). Every NUMBER — auto-accept
 * rate, error-detection rate, the share of `edit` — is read from `proposal_decisions`, so
 * there is exactly one source of truth and I-12 (`edit` never counted as `accept`) holds
 * without anyone having to remember it.
 *
 * `pending` is also the column DEFAULT, and `status` is absent from the `GRANT INSERT`
 * column list of `crm_system` (ADR-0015): the database itself guarantees every AI-generated
 * proposal starts out waiting for a human. That is T-4 at the second defence layer.
 */
export const PROPOSAL_STATUS = {
  pending: 'Chờ duyệt',
  decided: 'Đã quyết',
} as const
export type ProposalStatus = keyof typeof PROPOSAL_STATUS

export const DECISION = {
  accept: 'Duyệt',
  edit: 'Sửa rồi duyệt',
  reject: 'Bỏ',
} as const
export type Decision = keyof typeof DECISION

export const REJECT_REASON = {
  wrong_info: 'thông tin sai',
  irrelevant: 'đúng nhưng không liên quan',
  outdated: 'đã cũ',
  misread_context: 'hiểu sai ngữ cảnh',
  other: 'khác',
} as const
export type RejectReason = keyof typeof REJECT_REASON

/**
 * `next_step_source` and `created_by` share the same value set but ontology 3.5 declares
 * them as two enums, so keep two objects. Merging them would remove the ability for either
 * to evolve independently. Labels here are ours: the ontology row carries a note, not labels.
 */
export const NEXT_STEP_SOURCE = {
  human: 'Người gõ',
  system: 'Hệ thống tự đặt',
} as const
export type NextStepSource = keyof typeof NEXT_STEP_SOURCE

export const CREATED_BY = {
  human: 'Người tạo',
  system: 'Do hệ thống thêm',
} as const
export type CreatedBy = keyof typeof CREATED_BY

/** I-4: `manual_ingest` must NOT produce a TimelineEntry; only `watch_cycle` may. */
export const TRIGGER_CONTEXT = {
  manual_ingest: 'Nạp tay',
  watch_cycle: 'Vòng quét',
} as const
export type TriggerContext = keyof typeof TRIGGER_CONTEXT

export const ENTRY_TYPE = {
  activity: 'Hoạt động',
  stage_change: 'Đổi giai đoạn',
  note: 'Ghi chú',
  system_entry: 'Do hệ thống thêm',
} as const
export type EntryType = keyof typeof ENTRY_TYPE

/** ontology 3.5: an unreadable source is recorded as `failed`. Never guessed. */
export const FETCH_STATUS = {
  ok: 'Đọc được',
  failed: 'Không đọc được',
} as const
export type FetchStatus = keyof typeof FETCH_STATUS

/**
 * User roles. ontology section 1 defines them in prose ("Sales" and "Admin") and they are
 * NOT part of table 3.5 — hence deliberately absent from `ENUMS` below, otherwise the
 * ontology parity test would report them as drift. This is a real gap in the ontology,
 * written down rather than quietly papered over.
 */
export const USER_ROLE = {
  sales: 'Sales',
  admin: 'Quản trị',
} as const
export type UserRole = keyof typeof USER_ROLE

/**
 * Warning flags on an `Opportunity`. DERIVED from null columns by `opportunity-warnings.ts`,
 * never stored: a `has_warning` column would be a second source of truth that drifts away
 * from the cells it describes the first time someone fills one in through SQL.
 *
 * Deliberately OUTSIDE the `ENUMS` registry below, same as `USER_ROLE`: ontology 3.5 lists
 * the enums that exist as a Postgres type, and this one has no column and no `pgEnum`.
 * Registering it here would make `ontology-enum-parity.test.ts` report drift that is not real.
 *
 * The labels are the SENTENCE shown next to the flag. Rule 4 of design-guidelines section 5
 * forbids a bare `—`: an empty cell has to say why it is empty.
 */
export const OPPORTUNITY_WARNING = {
  missing_qualification_signals: 'Chưa đủ dấu hiệu nhu cầu/ngân sách',
  missing_lost_reason: 'Chưa ghi lý do thua',
  missing_next_step: 'Chưa có Việc tiếp theo',
} as const
export type OpportunityWarning = keyof typeof OPPORTUNITY_WARNING

/**
 * The stages at which the qualification gate is considered PASSED, so a missing signal cell
 * becomes a warning. A fixed set rather than a walk back through the timeline, and the price
 * of that is written down: jumping `prospecting → negotiation` still warns (correct — the two
 * directions were never checked), stepping back to `prospecting` clears the warning (correct —
 * the gate is ahead again), and a deal that was qualified and then paused loses the flag
 * (accepted). In exchange the warning function stays pure and needs no JOIN, so list, detail
 * and the overview screen can all call it.
 */
export const QUALIFICATION_CHECKED_STAGES = [
  'qualified',
  'drafting',
  'negotiation',
  'won',
] as const

/**
 * Registry keyed by the exact enum names used in ontology 3.5. The parity test walks this
 * object, so adding an enum here without adding it to the ontology (or the reverse) fails.
 */
export const ENUMS = {
  company_type: COMPANY_TYPE,
  stage: STAGE,
  signal_type: SIGNAL_TYPE,
  confidence: CONFIDENCE,
  proposal_type: PROPOSAL_TYPE,
  proposal_status: PROPOSAL_STATUS,
  decision: DECISION,
  reject_reason: REJECT_REASON,
  next_step_source: NEXT_STEP_SOURCE,
  created_by: CREATED_BY,
  trigger_context: TRIGGER_CONTEXT,
  entry_type: ENTRY_TYPE,
  fetch_status: FETCH_STATUS,
} as const

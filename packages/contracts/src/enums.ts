/**
 * The SINGLE source of truth for the 11 enums defined in ontology section 3.5.
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
 * Registry keyed by the exact enum names used in ontology 3.5. The parity test walks this
 * object, so adding an enum here without adding it to the ontology (or the reverse) fails.
 */
export const ENUMS = {
  company_type: COMPANY_TYPE,
  stage: STAGE,
  signal_type: SIGNAL_TYPE,
  confidence: CONFIDENCE,
  proposal_type: PROPOSAL_TYPE,
  decision: DECISION,
  reject_reason: REJECT_REASON,
  next_step_source: NEXT_STEP_SOURCE,
  created_by: CREATED_BY,
  trigger_context: TRIGGER_CONTEXT,
  entry_type: ENTRY_TYPE,
  fetch_status: FETCH_STATUS,
} as const

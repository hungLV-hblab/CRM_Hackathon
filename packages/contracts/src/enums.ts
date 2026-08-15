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

/**
 * SUGGESTED values for the company create/edit form dropdown — NOT an enforced enum
 * (schema migration 0012, ADR-0042 amendment). `companies.companyType` is plain `text`: the
 * real BTC `Account.csv` carries free text ("SIer", "Enduser", "drug store", "IT Consulting",
 * several blank rows) that does not fold into these 5 buckets without guessing, and rule 4
 * (CLAUDE.md) forbids guessing a classification. A Sales user typing a new company by hand can
 * still pick one of these five, or type anything else.
 */
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

/**
 * I-9, the urgency table of ontology section 6 — days from decision to the due date, per signal.
 *
 * A PARAMETER, not a magic number, because Specs group 4 asks for a due date that "phản ánh độ
 * gấp của loại tín hiệu": a funding window is measured in days, an expansion in weeks. Shared
 * from contracts because two features read it — group 3 when a human accepts a `next_step`
 * suggestion, group 4 when the system sets one itself — and two copies would drift into two
 * different promises to Sales.
 */
export const SIGNAL_DUE_DAYS: Record<SignalType, number> = {
  funding: 3,
  leadership_hire: 5,
  expansion: 14,
  mass_hiring: 14,
  new_business_line: 14,
  other: 14,
}

/**
 * I-6 — which findings are allowed to reach autonomy zone 3 and set a next step with nobody
 * asked. Two halves, both chosen by the MODEL, which is why they live here rather than beside
 * the service that enforces them.
 *
 * Half one: a funding round and a new decision-maker each open a window that closes on its own,
 * so being a day late costs the deal. `expansion` and `mass_hiring` are real news with no such
 * clock, so they go through the review queue where a person picks the moment.
 *
 * Half two: `speculative` never causes a write into official data — rule 4 of CLAUDE.md.
 *
 * Shared from contracts for the same reason as `SIGNAL_DUE_DAYS` directly above, and one more:
 * `apps/agent-runtime` renders these into the extraction prompt so the model is told what its
 * own label sets in motion. A second copy would be a prompt promising Sales one rule while the
 * domain enforced another — and the prompt is the copy nobody type-checks.
 */
export const AUTO_WRITE_SIGNALS = ['funding', 'leadership_hire'] as const satisfies readonly SignalType[]
export type AutoWriteSignal = (typeof AUTO_WRITE_SIGNALS)[number]

export const AUTO_WRITE_CONFIDENCE = ['certain', 'likely'] as const satisfies readonly Confidence[]

/** The reason shown on screen next to the date, so the number is never unexplained. */
export const SIGNAL_DUE_REASON: Record<SignalType, string> = {
  funding: 'cửa sổ gọi vốn tính bằng ngày',
  leadership_hire: 'sếp mới xem lại lựa chọn của người cũ trong vài tuần đầu',
  expansion: 'cửa sổ tính bằng tuần',
  mass_hiring: 'cửa sổ tính bằng tuần',
  new_business_line: 'cửa sổ tính bằng tuần',
  other: 'cửa sổ tính bằng tuần',
}

/**
 * Three kinds, and the third one exists because of I-7 (ADR-0023).
 *
 * `next_step` is NOT a loosening of I-11: I-11 whitelists which COMPANY PROFILE fields a
 * proposal may target, and `next_step` targets an opportunity instead. `name` and
 * `company_type` stay banned in both layers.
 */
export const PROPOSAL_TYPE = {
  field_update: 'sửa ô hồ sơ',
  timeline_entry: 'thêm tin',
  next_step: 'đặt Việc tiếp theo',
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
 * Which kind of source produced an `Observation` (ADR-0035 · ADR-0036 · ontology 3.6).
 *
 * OUTSIDE the `ENUMS` registry, same as `USER_ROLE` and `OPPORTUNITY_WARNING`, and the reason is
 * the criterion stated above: ontology 3.5 lists the enums that exist as a POSTGRES TYPE.
 * `source_kind` is `text` + CHECK, exactly like `source_tier` on the same table and
 * `snapshot_variant` on `companies` — neither of which is in 3.5 either. Two columns describing
 * the same axis ("where did this row come from") must not be split across the two conventions.
 *
 * ADR-0035 originally promised a 3.5 row here; that promise assumed a `pgEnum`. Keeping the
 * column as `text` + CHECK means adding a third source kind never needs an `ALTER TYPE`, and the
 * closed list is held by the constraint in `0008_live_source.sql`.
 *
 * The labels are what Sales reads, and they carry rule 2 of CLAUDE.md: a finding drawn from an
 * unvetted public page must be distinguishable from one drawn from the acceptance snapshot set
 * BY EYE, not by reading a tooltip.
 */
export const SOURCE_KIND = {
  demo_snapshot: 'Bản chụp',
  live_crawl: 'Nguồn thật',
} as const
export type SourceKind = keyof typeof SOURCE_KIND

/**
 * The tier of a source — "cấp nguồn" of ontology 3.2. Outside `ENUMS` for the same reason as
 * `SOURCE_KIND`: `text` + CHECK, not a Postgres type. `observations.ts` records the ADR that
 * closed the question of why this is not the 1–6 integer tower the ontology first sketched.
 *
 * `company_website` was the only tier that existed while the snapshot set was the only source.
 * The other two arrive with the live path, and `observations.ts:35-38` predicted exactly that:
 * "a second tier (news, LinkedIn) is a new value, not an `ALTER TYPE`".
 */
export const SOURCE_TIER = {
  company_website: 'Trang công ty',
  news: 'Tin tức',
  social: 'Mạng xã hội',
} as const
export type SourceTier = keyof typeof SOURCE_TIER

/**
 * Why a read failed — the closed list held by the CHECK in `0008_live_source.sql`.
 *
 * Outside `ENUMS` for the same Postgres-type reason, plus one of its own: this is diagnostic
 * detail, not business vocabulary. ADR-0036 records that the opposite reading is defensible —
 * these DO have labels a Sales person reads — and that keeping them out is a choice rather than
 * a rule.
 *
 * The labels say what a person can DO about it, and never leak an HTTP status code: a page that
 * blocks robots is information about the source, not a broken product. `js_required` is the
 * valuable one — it is the only value that separates "the site refused our reader" from "the
 * company genuinely published nothing", which is the distinction Specs group 2 cannot express.
 */
export const FETCH_ERROR_REASON = {
  timeout: 'Trang không phản hồi kịp',
  http_4xx: 'Trang từ chối máy đọc tự động',
  http_5xx: 'Máy chủ của trang đang lỗi',
  redirect_loop: 'Trang chuyển hướng vòng quanh',
  js_required: 'Trang cần chạy JavaScript mới hiện nội dung',
  not_html: 'Nguồn không phải trang web đọc được',
  too_large: 'Trang quá lớn để đọc an toàn',
  blocked_url: 'Địa chỉ không được phép đọc',
  invalid_url: 'Địa chỉ nguồn không hợp lệ',
  /**
   * Added by `0009` after the first real read, not by the original list. DNS that does not
   * resolve, a refused connection, a failed TLS handshake — nine reasons had no room for any of
   * them, and the two near misses both state something false: `timeout` claims the page did not
   * answer in time when it was never answered at all, and `invalid_url` sends someone to fix an
   * address that is perfectly correct and merely down today.
   */
  unreachable: 'Không kết nối được tới trang',
} as const
export type FetchErrorReason = keyof typeof FETCH_ERROR_REASON

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

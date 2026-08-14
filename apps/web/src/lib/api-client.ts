import type {
  AiStatusDto,
  AutoNextStepMap,
  CompanyDto,
  MetricsDto,
  SystemParametersDto,
  UpdateSystemSettingsDto,
  ContactDto,
  CreateCompanyDto,
  DecideProposalDto,
  PendingProposalSummary,
  ProposalDto,
  CreateContactDto,
  CreateOpportunityDto,
  CreateTimelineEntryDto,
  IngestResultDto,
  IngestSnapshotDto,
  ListCompaniesQuery,
  ListOpportunitiesQuery,
  NotificationDto,
  ObservationWithClaimsDto,
  OpportunityDto,
  OverviewDto,
  TimelineEntryDto,
  UpdateCompanyDto,
  UpdateContactDto,
  UndoResultDto,
  UpdateOpportunityDto,
  UpdateStageDto,
  WatchCycleRunDto,
} from '@crm/contracts'

/**
 * Every API call goes through here.
 *
 * Paths are RELATIVE (`/api/...`) with no host hard-coded — the frontend and the API sit
 * behind Caddy on the same origin, `:8080`. That is what lets the `httpOnly` cookie work
 * directly: no CORS, no `SameSite=None` (the setting that tends to break on a judge's browser).
 *
 * Writing `http://localhost:3001` in this file destroys exactly that property.
 */
const BASE = '/api'

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

async function call<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    // Without this the browser never sends the session cookie and everything returns 401.
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })

  if (!res.ok) {
    throw new ApiError(await readErrorMessage(res), res.status)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

/** Error text is Vietnamese on purpose: it comes from the API and Sales reads it. */
async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json()
    return typeof body.message === 'string' ? body.message : 'Có lỗi xảy ra'
  } catch {
    return `Có lỗi xảy ra (mã ${res.status})`
  }
}

/**
 * Only the keys the caller actually set. An empty filter must not become `?q=` — the API
 * reads that as "search for the empty string", which is a different request.
 */
function toQueryString(query: object): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === '') continue
    params.set(key, String(value))
  }
  const encoded = params.toString()
  return encoded ? `?${encoded}` : ''
}

export const api = {
  login: (email: string, password: string) =>
    call<{ user: { id: string; email: string; name: string; role: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  logout: () => call<{ ok: boolean }>('/auth/logout', { method: 'POST' }),

  me: () => call<{ userId: string; role: string }>('/auth/me'),

  listCompanies: (query: ListCompaniesQuery = {}) =>
    call<CompanyDto[]>(`/companies${toQueryString(query)}`),

  getCompany: (companyId: string) => call<CompanyDto>(`/companies/${companyId}`),

  createCompany: (dto: CreateCompanyDto) =>
    call<CompanyDto>('/companies', { method: 'POST', body: JSON.stringify(dto) }),

  updateCompany: (companyId: string, dto: UpdateCompanyDto) =>
    call<CompanyDto>(`/companies/${companyId}`, { method: 'PATCH', body: JSON.stringify(dto) }),

  deleteCompany: (companyId: string) =>
    call<void>(`/companies/${companyId}`, { method: 'DELETE' }),

  listContacts: (companyId: string) => call<ContactDto[]>(`/companies/${companyId}/contacts`),

  createContact: (dto: CreateContactDto) =>
    call<ContactDto>('/contacts', { method: 'POST', body: JSON.stringify(dto) }),

  updateContact: (contactId: string, dto: UpdateContactDto) =>
    call<ContactDto>(`/contacts/${contactId}`, { method: 'PATCH', body: JSON.stringify(dto) }),

  deleteContact: (contactId: string) => call<void>(`/contacts/${contactId}`, { method: 'DELETE' }),

  listOpportunities: (query: ListOpportunitiesQuery = {}) =>
    call<OpportunityDto[]>(`/opportunities${toQueryString(query)}`),

  createOpportunity: (dto: CreateOpportunityDto) =>
    call<OpportunityDto>('/opportunities', { method: 'POST', body: JSON.stringify(dto) }),

  updateOpportunity: (opportunityId: string, dto: UpdateOpportunityDto) =>
    call<OpportunityDto>(`/opportunities/${opportunityId}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),

  /**
   * Its own endpoint, and it never fails for missing cells: sending only `{ stage }` is the
   * "Để trống, bổ sung sau" path and the response comes back carrying the warning flags.
   */
  updateOpportunityStage: (opportunityId: string, dto: UpdateStageDto) =>
    call<OpportunityDto>(`/opportunities/${opportunityId}/stage`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),

  listTimeline: (companyId: string) =>
    call<TimelineEntryDto[]>(`/companies/${companyId}/timeline`),

  addTimelineEntry: (companyId: string, dto: CreateTimelineEntryDto) =>
    call<TimelineEntryDto>(`/companies/${companyId}/timeline`, {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  overview: () => call<OverviewDto>('/overview'),

  /** The read zone: snapshots newest first, each carrying the findings drawn from it. */
  readingZone: (companyId: string) =>
    call<ObservationWithClaimsDto[]>(`/companies/${companyId}/reading-zone`),

  /**
   * "Đọc lại nguồn". The response carries the counts, including how many findings were dropped
   * for an unverifiable quote — that number is a metric the team has to be able to defend
   * (ADR-0014), so the UI shows it instead of swallowing it.
   */
  ingestSnapshot: (companyId: string, dto: IngestSnapshotDto) =>
    call<IngestResultDto>(`/companies/${companyId}/observations`, {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  /** The review queue — everything still waiting for a person (autonomy zone 2). */
  listPendingProposals: () => call<ProposalDto[]>('/proposals'),

  /** `companyId → count`, for the "đang có gợi ý chờ duyệt" markers. */
  pendingProposalSummary: () => call<PendingProposalSummary>('/proposals/pending-summary'),

  /**
   * Duyệt / Sửa rồi duyệt / Bỏ. There is deliberately NO endpoint to create a proposal and none
   * to undo a decision: suggestions are raised by the AI while reading a source, and a decision
   * is the measurement feature group 6 reads (ADR-0016).
   */
  decideProposal: (proposalId: string, dto: DecideProposalDto) =>
    call<void>(`/proposals/${proposalId}/decide`, { method: 'POST', body: JSON.stringify(dto) }),

  /**
   * Autonomy zone 3 — what the system wrote into a deal's next step by itself, keyed by
   * opportunity. Its OWN endpoint rather than fields on `OpportunityDto` (ADR-0027): the deal
   * board merges the two in the client, and the five screens that never show a machine-written
   * cell keep the query they already had.
   */
  autoNextSteps: () => call<AutoNextStepMap>('/opportunities/auto-next-steps'),

  /** One click, valid for 7 days. Returns what the cell was put back to. */
  undoAutoNextStep: (eventId: string) =>
    call<UndoResultDto>(`/auto-next-step-events/${eventId}/undo`, { method: 'POST' }),

  /** In-product notices. Read AND unread — ontology 3.3 forbids one vanishing before it is seen. */
  listNotifications: () => call<NotificationDto[]>('/notifications'),

  /** "Đã xem", and only pressing it ever writes `read_at`. */
  markNotificationRead: (notificationId: string) =>
    call<void>(`/notifications/${notificationId}/read`, { method: 'POST' }),

  /**
   * "Nhật ký vòng quét" — one line per cycle, newest first, rolled-up lines marked in place.
   * Autonomy zone 4 writes without asking, so this log is where the loop is audited afterwards.
   */
  listWatchCycleRuns: () => call<WatchCycleRunDto[]>('/watch-cycle-runs'),

  /**
   * I-13 — remove an entry the watch cycle added, with a short reason.
   *
   * The reason travels in the BODY of a DELETE, which is unusual on purpose: in the query string
   * it would land in every access log and in the browser history, and what a person writes about
   * the machine's mistake is not URL material. It is required — this is the error-detection
   * signal feature group 5 produces, and an unexplained deletion counts for nothing.
   */
  deleteSystemTimelineEntry: (companyId: string, entryId: string, reason: string) =>
    call<void>(`/companies/${companyId}/timeline/${entryId}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason }),
    }),

  /**
   * Turning Đang theo dõi on or off. Reuses `PATCH /companies/:id` rather than adding an endpoint:
   * `isWatched` is an ordinary column a person owns, and a dedicated route would suggest the flag
   * is something else.
   */
  setWatched: (companyId: string, isWatched: boolean) =>
    call<CompanyDto>(`/companies/${companyId}`, {
      method: 'PATCH',
      body: JSON.stringify({ isWatched }),
    }),

  /**
   * ADMIN ONLY — `GET /settings` is guarded by `@Roles('admin')`, so a Sales session gets a
   * 403 here, not a payload. Callers must check the role first (`api.me()`) rather than
   * firing this on every page load and swallowing the failure.
   */
  systemSettings: () => call<SystemParametersDto>('/settings'),

  /**
   * EVERY logged-in account, Sales included (ADR-0032). This is what the "AI đang tắt" banner
   * reads, and the reason it is a second endpoint rather than a looser guard on the one above:
   * T-9 requires SALES to see the notice, and Sales must keep getting a 403 on the admin payload.
   */
  aiStatus: () => call<AiStatusDto>('/settings/ai-status'),

  /** ADMIN ONLY. Effective on the next read — no restart, nothing cached (ADR-0011). */
  updateSystemSettings: (dto: UpdateSystemSettingsDto) =>
    call<SystemParametersDto>('/settings', { method: 'PATCH', body: JSON.stringify(dto) }),

  /** ADMIN ONLY — every number of ontology section 7, each rate carrying its denominator. */
  metrics: () => call<MetricsDto>('/metrics'),

  /**
   * The demo control: which stored snapshot counts as a company's source right now. On the admin
   * screen so a live demo never has to leave the browser for a terminal.
   *
   * The response is the ONLY place the variant is readable from the client: `CompanyDto`
   * deliberately does not carry the column, because it is demo scaffolding rather than part of
   * Sales' data model, and no Sales screen has any business reading it.
   */
  setSnapshotVariant: (companyId: string, variant: 'before' | 'after') =>
    call<{ id: string; name: string; snapshotVariant: 'before' | 'after' }>(
      `/demo/companies/${companyId}/snapshot-variant`,
      { method: 'POST', body: JSON.stringify({ variant }) },
    ),
}

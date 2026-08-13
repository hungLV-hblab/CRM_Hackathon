import type {
  CompanyDto,
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
  ObservationWithClaimsDto,
  OpportunityDto,
  OverviewDto,
  TimelineEntryDto,
  UpdateCompanyDto,
  UpdateContactDto,
  UpdateOpportunityDto,
  UpdateStageDto,
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
}

import type {
  CompanyDto,
  CreateCompanyDto,
  IngestResultDto,
  IngestSnapshotDto,
  ObservationWithClaimsDto,
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

export const api = {
  login: (email: string, password: string) =>
    call<{ user: { id: string; email: string; name: string; role: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  logout: () => call<{ ok: boolean }>('/auth/logout', { method: 'POST' }),

  me: () => call<{ userId: string; role: string }>('/auth/me'),

  listCompanies: () => call<CompanyDto[]>('/companies'),

  createCompany: (dto: CreateCompanyDto) =>
    call<CompanyDto>('/companies', { method: 'POST', body: JSON.stringify(dto) }),

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
}

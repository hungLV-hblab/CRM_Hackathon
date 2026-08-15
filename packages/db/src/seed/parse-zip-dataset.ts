import AdmZip from 'adm-zip'
import { parse } from 'csv-parse/sync'

import { STAGE, type Stage } from '@crm/contracts'

import { SALES_ID } from './default-users'
import { deterministicUuid } from './deterministic-uuid'
import type {
  SeedCompany,
  SeedContact,
  SeedDataset,
  SeedOpportunity,
  SeedSnapshotPage,
} from './seed-dataset'

/**
 * The single source of truth for every company/contact/opportunity/snapshot the product shows —
 * parsed straight from the BTC zip, never hand-typed (validate session's decision: no more
 * `seed-data.ts`). Used by both the CLI (`pnpm seed`, reads the zip checked into the repo) and
 * the admin upload endpoint (reads whatever file was POSTed).
 *
 * A PURE, fully synchronous function on purpose — see
 * `apps/api/src/ai/resolve-observation-source.ts`, which computes I-16's `SEED_COMPANY_IDS`
 * at module-load time from this function's output. Making this async would cascade into three
 * production call sites that are synchronous by design (found during `/ck:plan validate`).
 * `adm-zip` and `csv-parse/sync` are chosen specifically because both have synchronous APIs.
 */

const STAGE_BY_LABEL = new Map<string, Stage>(
  Object.entries(STAGE).map(([code, label]) => [label, code as Stage]),
)

const OPEN_STAGE_LABELS = new Set(['Tiếp cận', 'Đủ điều kiện', 'Soạn đề xuất', 'Thương lượng', 'Tạm dừng'])

function yesNo(value: string | undefined): boolean {
  return (value ?? '').trim() === 'Có'
}

function nullableText(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

const FULL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * `next_step_due_date` is a `date` column — a full `YYYY-MM-DD` or nothing. The real
 * `Opps.csv` has 5 rows with `due_date="2026-08"` (month-only, no day) — a genuine data-quality
 * gap, found when `seed()` threw a Postgres date-parse error on the real zip. Rule 4: guessing
 * a day would invent precision the source never had, so an incomplete date becomes NULL with a
 * warning instead.
 */
function nullableFullDate(value: string | undefined, code: string, warnings: string[]): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  if (!FULL_DATE_RE.test(trimmed)) {
    warnings.push(`${code}: due_date "${trimmed}" không phải ngày đầy đủ (YYYY-MM-DD) — để trống thay vì đoán`)
    return null
  }
  return trimmed
}

/** `"45,000"` → `"45000.00"` — thousands separators the CSV uses, `numeric` column wants a plain string. */
function nullableMoney(value: string | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  const digits = trimmed.replace(/,/g, '')
  return Number.isFinite(Number(digits)) ? Number(digits).toFixed(2) : null
}

/**
 * Unzips into a flat `path → bytes` map, stripping the top-level `hackathon-1-data/` directory
 * so callers look up `Account.csv`, `snapshot/C15-homepage-before.html` regardless of what the
 * zip's root folder happens to be named.
 */
export function unzipDataset(buffer: Buffer): Map<string, Buffer> {
  const zip = new AdmZip(buffer)
  const files = new Map<string, Buffer>()
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue
    const name = entry.entryName.replace(/^[^/]+\//, '')
    if (!name) continue
    files.set(name, entry.getData())
  }
  return files
}

function readCsv(files: Map<string, Buffer>, filename: string): Record<string, string>[] {
  const buffer = files.get(filename)
  if (!buffer) throw new Error(`Thiếu file ${filename} trong zip`)
  return parse(buffer, { columns: true, skip_empty_lines: true, trim: false, bom: true })
}

interface AccountsResult {
  companies: SeedCompany[]
  /** company_code → the parsed row, kept for callers that still need the raw code (contacts, opportunities, snapshot grouping — none of which are stored on `SeedCompany` itself). */
  byCode: Map<string, SeedCompany>
}

function parseAccounts(files: Map<string, Buffer>): { result: AccountsResult; warnings: string[] } {
  const rows = readCsv(files, 'Account.csv')
  const companies: SeedCompany[] = []
  const byCode = new Map<string, SeedCompany>()
  const warnings: string[] = []

  for (const row of rows) {
    const code = row.company_code?.trim()
    if (!code) continue

    /**
     * `company_type` is free text (schema migration 0012) — the real `Account.csv` does not
     * fold into a closed 5-value set (e.g. "SIer", "Enduser", "drug store", "IT Consulting", 6
     * blank rows). Use the raw value as-is; fall back to `industry` only when the cell itself is
     * empty, and flag that row so a human can fill in something more specific later.
     */
    const rawType = nullableText(row.company_type)
    const industry = nullableText(row.industry)
    let companyType = rawType ?? industry
    if (!rawType) {
      warnings.push(`${code}: company_type trống trong CSV, tạm dùng ngành nghề ("${industry ?? '?'}") — cần Sales xác nhận lại`)
    }
    if (!companyType) companyType = 'Không rõ'

    const company: SeedCompany = {
      id: deterministicUuid('company', code),
      name: row.company_name?.trim() ?? code,
      industry: industry ?? 'Không rõ',
      companyType,
      country: nullableText(row.country),
      size: nullableText(row.company_size),
      website: nullableText(row.website_url),
      isWatched: yesNo(row.is_tracked),
      ownerId: SALES_ID,
    }
    companies.push(company)
    byCode.set(code, company)
  }

  return { result: { companies, byCode }, warnings }
}

function parseContacts(files: Map<string, Buffer>, validCompanyCodes: Set<string>): SeedContact[] {
  const rows = readCsv(files, 'Contacts.csv')
  const contacts: SeedContact[] = []

  for (const row of rows) {
    const code = row.contact_code?.trim()
    const companyCode = row.company_code?.trim()
    if (!code || !companyCode || !validCompanyCodes.has(companyCode)) continue

    contacts.push({
      id: deterministicUuid('contact', code),
      companyId: deterministicUuid('company', companyCode),
      name: row.full_name?.trim() ?? code,
      title: nullableText(row.job_title),
      email: nullableText(row.email),
      isPrimary: yesNo(row.is_primary_contact),
    })
  }

  return contacts
}

interface OpportunitiesResult {
  opportunities: SeedOpportunity[]
  droppedOrphanCodes: string[]
  warnings: string[]
}

function parseOpportunities(
  files: Map<string, Buffer>,
  validCompanyCodes: Set<string>,
): OpportunitiesResult {
  const rows = readCsv(files, 'Opps.csv')
  const opportunities: SeedOpportunity[] = []
  const droppedOrphanCodes: string[] = []
  const warnings: string[] = []

  for (const row of rows) {
    const code = row.opportunity_code?.trim()
    const companyCode = row.company_code?.trim()
    if (!code) continue

    if (!companyCode || !validCompanyCodes.has(companyCode)) {
      droppedOrphanCodes.push(code)
      continue
    }

    const stageLabel = row.stage?.trim()
    const stage = stageLabel ? STAGE_BY_LABEL.get(stageLabel) : undefined
    if (!stage) {
      droppedOrphanCodes.push(code) // unmapped stage — same "don't guess" rule as company_type
      continue
    }

    const isOpen = stageLabel ? OPEN_STAGE_LABELS.has(stageLabel) : false
    const nextStepDueDate = nullableFullDate(row.due_date, code, warnings)

    opportunities.push({
      id: deterministicUuid('opportunity', code),
      companyId: deterministicUuid('company', companyCode),
      name: row.opportunity_name?.trim() ?? code,
      expectedValue: nullableMoney(row.expected_value),
      expectedCloseMonth: nullableText(row.expected_close_month),
      stage,
      nextStepText: nullableText(row.next_action),
      nextStepDueDate,
      nextStepSource: isOpen && nullableText(row.next_action) && nextStepDueDate ? 'human' : null,
      needSignal: nullableText(row.need_signal),
      needSignalSource: null,
      budgetSignal: nullableText(row.budget_signal),
      budgetSignalSource: null,
      lostReason: nullableText(row.lost_reason),
    })
  }

  return { opportunities, droppedOrphanCodes, warnings }
}

const SNAPSHOT_FILENAME_RE = /^snapshot\/(C\d+)-(.+)-(before|after)\.html$/

function groupSnapshots(
  files: Map<string, Buffer>,
  accountsByCode: Map<string, SeedCompany>,
): SeedSnapshotPage[] {
  const groups = new Map<string, { companyCode: string; pageSlug: string; before: string | null; after: string | null }>()

  for (const [path, bytes] of files) {
    const match = SNAPSHOT_FILENAME_RE.exec(path)
    if (!match) continue
    const [, companyCode, pageSlug, variant] = match
    if (!accountsByCode.has(companyCode)) continue

    const key = `${companyCode}:${pageSlug}`
    const group = groups.get(key) ?? { companyCode, pageSlug, before: null, after: null }
    const html = bytes.toString('utf8')
    if (variant === 'before') group.before = html
    else group.after = html
    groups.set(key, group)
  }

  const pages: SeedSnapshotPage[] = []
  for (const { companyCode, pageSlug, before, after } of groups.values()) {
    const website = accountsByCode.get(companyCode)?.website ?? null
    pages.push({
      companyId: deterministicUuid('company', companyCode),
      pageSlug,
      sourceUrl: website ? `${website}#${pageSlug}` : null,
      beforeHtml: before,
      afterHtml: after,
    })
  }

  return pages
}

export function parseZipDataset(buffer: Buffer): SeedDataset {
  const files = unzipDataset(buffer)
  const warnings: string[] = []

  const { result, warnings: accountWarnings } = parseAccounts(files)
  const { companies, byCode } = result
  warnings.push(...accountWarnings)

  const validCodes = new Set(byCode.keys())
  const contacts = parseContacts(files, validCodes)
  const {
    opportunities,
    droppedOrphanCodes,
    warnings: opportunityWarnings,
  } = parseOpportunities(files, validCodes)
  warnings.push(...opportunityWarnings)

  if (droppedOrphanCodes.length > 0) {
    warnings.push(
      `Bỏ qua ${droppedOrphanCodes.length} cơ hội có company_code không tồn tại trong Account.csv hoặc stage không hợp lệ: ${droppedOrphanCodes.join(', ')}`,
    )
  }

  const snapshotPages = groupSnapshots(files, byCode)

  return { companies, contacts, opportunities, snapshotPages, warnings }
}

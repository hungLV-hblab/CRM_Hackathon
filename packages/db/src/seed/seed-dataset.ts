import type { Stage } from '@crm/contracts'

/**
 * The dataset `seed()` writes to the database. Replaces the hand-typed arrays that used to
 * live in `seed-data.ts` — companies/contacts/opportunities/snapshot content now always come
 * from parsing a zip (`parseZipDataset`), never from a TypeScript literal. The one exception is
 * `users`: the two login accounts have no source in the BTC data at all (see `default-users.ts`),
 * so `seed()` still takes them as a hard fixed constant.
 */

export interface SeedCompany {
  id: string
  name: string
  industry: string
  /** Free text (schema migration 0012) — the real data does not fold into a closed 5-value set. */
  companyType: string
  country: string | null
  size: string | null
  website: string | null
  isWatched: boolean
  /**
   * Imported from `sales_owner` (ADR-0046). `null` when the cell names nobody the system knows
   * — such a company is administrator-only until someone assigns it, which is the honest state
   * rather than a guessed owner.
   */
  ownerId: string | null
}

export interface SeedContact {
  id: string
  companyId: string
  name: string
  title: string | null
  email: string | null
  isPrimary: boolean
}

export interface SeedOpportunity {
  id: string
  companyId: string
  name: string
  expectedValue: string | null
  expectedCloseMonth: string | null
  stage: Stage
  nextStepText: string | null
  nextStepDueDate: string | null
  nextStepSource: 'human' | 'system' | null
  needSignal: string | null
  needSignalSource: string | null
  budgetSignal: string | null
  budgetSignalSource: string | null
  lostReason: string | null
}

export interface SeedSnapshotPage {
  companyId: string
  pageSlug: string
  sourceUrl: string | null
  beforeHtml: string | null
  afterHtml: string | null
}

export interface SeedDataset {
  companies: SeedCompany[]
  contacts: SeedContact[]
  opportunities: SeedOpportunity[]
  snapshotPages: SeedSnapshotPage[]
  /** Rows dropped or coerced during parsing, surfaced to whoever triggered the import. */
  warnings: string[]
}

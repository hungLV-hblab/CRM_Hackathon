/** Response of `POST /admin/import-data` — spec 7 condition 5's UI replacement for "một lệnh". */
export interface ImportSummaryDto {
  companies: number
  contacts: number
  opportunities: number
  snapshotPages: number
  /** Rows dropped or coerced while parsing (orphan company_code, unparseable date, ...). */
  warnings: string[]
}

import type { UserRole } from './enums'

/**
 * The accounts handed out for judging, shared by three consumers that must never disagree:
 * the seed (creates them), the login screen's demo tab (lists them), and the admin dashboard
 * filter (names them). One list here, or three lists drifting apart.
 *
 * The password is published by the organizers for every handed-out account, so shipping it in
 * a client bundle discloses nothing. Swapping in the real handed-out list means editing THIS
 * file only — ids and hashes live with the seed.
 */
export const DEMO_PASSWORD = 'hackathon#1'

export interface DemoAccount {
  email: string
  /**
   * Display name, and — for a sales account — ALSO THE JOIN KEY into the imported data: it is
   * matched, character for character, against the `sales_owner` cell of `Account.csv`. That is
   * why these are bare first names rather than something friendlier; the alternative was to
   * hand-type an ownership split over real companies, which invents data the source already
   * carries (rule 4). Rename one of these and the companies that named it lose their owner —
   * `parseZipDataset` says so in a warning rather than guessing a replacement.
   */
  name: string
  role: UserRole
}

/**
 * FIVE sales, not one: the BTC `Account.csv` names five people and gives each of them exactly
 * five companies, so the per-owner boundary (ADR-0046) has five genuinely different views to
 * show instead of a filter that never filters anything.
 *
 * `sales@hblab.vn` stays first and keeps its historical role as "the" sales login — every spec
 * that signs in without caring who it is lands on Thảo, who owns the companies those specs
 * already drive (Genky · Keyware Solution · Toyoshingo).
 */
export const DEMO_ACCOUNTS: DemoAccount[] = [
  { email: 'sales@hblab.vn', name: 'Thảo', role: 'sales' },
  { email: 'sales2@hblab.vn', name: 'Vân', role: 'sales' },
  { email: 'sales3@hblab.vn', name: 'Phúc', role: 'sales' },
  { email: 'sales4@hblab.vn', name: 'Linh', role: 'sales' },
  { email: 'sales5@hblab.vn', name: 'Huệ', role: 'sales' },
  { email: 'admin@hblab.vn', name: 'Quản trị', role: 'admin' },
]

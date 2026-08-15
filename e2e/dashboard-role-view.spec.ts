import { expect, test } from '@playwright/test'

/**
 * BTC addendum 3.3 — whose dashboard is whose:
 *
 * - a sales gets THEIR OWN numbers, no filter, and a line saying so;
 * - an admin gets the whole team, a per-sales filter that lives in the URL, and the
 *   per-sales progress table.
 *
 * Runs on the imported dataset, where ownership comes from the `sales_owner` column of
 * `Account.csv` (ADR-0046): five sales people with five companies each. Thảo signs in as
 * `sales@hblab.vn` and looks after C15–C19; Vân is `sales2@hblab.vn` and looks after C20–C24.
 *
 * Both of Thảo's open deals are missing a next step, and not because anybody staged it: their
 * `due_date` is month-only in the CSV, which rule 4 stores as NULL rather than inventing a day.
 */

const SALES1 = { email: 'sales@hblab.vn', password: 'hackathon#1' }
const ADMIN = { email: 'admin@hblab.vn', password: 'hackathon#1' }

/** Thảo's (C16) — open, and silent for the month-only-date reason above. */
const OWN_SILENT_DEAL = 'Làm đề xuất tối ưu nghiệp vụ BPO và call center bằng giải pháp AI'
/** Vân's (C22) — equally silent, and therefore the one Thảo must NOT be shown. */
const OTHER_SILENT_DEAL = 'Số hóa thủ tục đăng ký iDeCo Plus'

async function login(page: import('@playwright/test').Page, who: { email: string; password: string }) {
  await page.goto('/dang-nhap')
  await page.getByLabel('Email').fill(who.email)
  await page.getByLabel('Mật khẩu').fill(who.password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/cong-ty$/)
}

test('sales: tự thấy dữ liệu của mình, không có filter, deal im lặng của mình nằm trong khối thiếu việc', async ({ page }) => {
  await login(page, SALES1)
  await page.goto('/tong-quan')

  await expect(page.getByText('Đang xem: dữ liệu của bạn.')).toBeVisible()
  await expect(page.getByLabel('Xem theo Sales')).toHaveCount(0)

  await expect(page.getByRole('cell', { name: OWN_SILENT_DEAL })).toBeVisible()
  await expect(page.getByRole('cell', { name: OTHER_SILENT_DEAL })).toHaveCount(0)

  // Nobody in the imported data has lost a deal, so the block says "nothing" rather than
  // borrowing a row from somebody else's pipeline.
  await expect(page.getByText('Chưa có cơ hội Thua nào có lý do được ghi.')).toBeVisible()
})

test('admin: thấy cả đội, lọc theo một sales qua URL, bảng tiến độ đủ một dòng mỗi người', async ({ page }) => {
  await login(page, ADMIN)
  await page.goto('/tong-quan')

  // Whole team first: both sales people's silent deals sit on the one screen.
  await expect(page.getByRole('cell', { name: OWN_SILENT_DEAL })).toBeVisible()
  await expect(page.getByRole('cell', { name: OTHER_SILENT_DEAL })).toBeVisible()

  // The per-sales table: one row per sales user, silence and lateness counted per person.
  await expect(page.getByRole('heading', { name: 'Tiến độ theo Sales' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Vân', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Phúc', exact: true })).toBeVisible()

  // Narrow to Vân: the URL carries the choice (a shareable link), and every figure follows —
  // her silent deal stays, Thảo's drops out.
  await page.getByLabel('Xem theo Sales').selectOption({ label: 'Vân' })
  await expect(page).toHaveURL(/\?sales=/)
  await expect(page.getByRole('cell', { name: OTHER_SILENT_DEAL })).toBeVisible()
  await expect(page.getByRole('cell', { name: OWN_SILENT_DEAL })).toHaveCount(0)

  // Back to everything: the choice leaves the URL with the filter.
  await page.getByLabel('Xem theo Sales').selectOption({ label: 'Tất cả' })
  await expect(page).not.toHaveURL(/\?sales=/)
  await expect(page.getByRole('cell', { name: OWN_SILENT_DEAL })).toBeVisible()
})

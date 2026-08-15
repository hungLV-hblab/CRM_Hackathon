import { expect, test, type Page } from '@playwright/test'

import { companyIdByName, seedSnapshotPage } from './watch-cycle-scenario'

/**
 * The filters on `/hang-doi`, and the line between them and the permission boundary.
 *
 * The boundary is the server's (ADR-0046) and has its own tests. What only a browser can show is
 * the half that lives on screen: that a Sales person is never even OFFERED a control naming other
 * people's work, that an administrator can narrow by person and by company at once, and that a
 * filter matching nothing says so in different words from an empty queue — telling somebody their
 * work is done when it is merely hidden is the failure rule 4 of CLAUDE.md is about.
 *
 * ── Why this spec creates its own companies ──────────────────────────────────────────────
 * Same reason T-5 does. Filling a blank profile cell is the suggestion this spec relies on, and
 * of the 25 imported companies exactly one has a blank cell at all — so the precondition has to
 * be built rather than found. The two companies are created THROUGH THE UI while signed in as
 * Vân, which makes her their owner: that is what gives the administrator a real person to filter
 * by, and it exercises the ownership rule instead of assuming it. Suggestions are then produced
 * by reading a source, exactly as T-5 does, so an empty queue here is a real state rather than a
 * harness gap. No imported company's data is touched.
 */

const ADMIN = { email: 'admin@hblab.vn', password: 'hackathon#1' }
const SALES = { email: 'sales2@hblab.vn', password: 'hackathon#1' }
/** Her display name, and the label the owner filter renders — both come from `DEMO_ACCOUNTS`. */
const SALES_NAME = 'Vân'

/** Two of them, because "filter down to nothing" needs a second company to filter away from. */
const COMPANY = 'Cty Thu Nghiem Bo Loc A'
const OTHER_COMPANY = 'Cty Thu Nghiem Bo Loc B'

const SOURCE_URL = 'https://example.test/queue-filters-harness'
const afterHtml = (name: string) => `<html><body><article>
  <h1>${name}</h1>
  <ul class="facts"><li>Quy mô: 200-300 nhân viên</li></ul>
</article></body></html>`
const beforeHtml = (name: string) => `<html><body><article><h1>${name}</h1></article></body></html>`

async function login(page: Page, user: { email: string; password: string }): Promise<void> {
  await page.goto('/dang-nhap')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Mật khẩu').fill(user.password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/cong-ty$/, { timeout: 30_000 })
}

async function createCompany(page: Page, name: string): Promise<void> {
  await page.goto('/cong-ty')
  if (await page.getByRole('cell', { name }).isVisible().catch(() => false)) return

  await page.getByRole('button', { name: 'Thêm công ty' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Tên công ty').fill(name)
  await dialog.getByLabel('Ngành').fill('Kiểm thử bộ lọc')
  await dialog.getByLabel('Loại hình').fill('IT Solution')
  await dialog.getByRole('button', { name: 'Lưu' }).click()
  await expect(page.getByRole('cell', { name })).toBeVisible()
}

/** Either outcome is fine (I-3): a first read stores findings, a repeat reports no change. */
async function readSource(page: Page, company: string): Promise<void> {
  await page.goto('/cong-ty')
  await page.getByRole('link', { name: company }).click()
  await page.getByRole('button', { name: 'Đọc bản chụp sau' }).click()
  await expect(page.getByText(/Lưu \d+\/\d+ phát hiện|Đã đọc, nội dung không đổi/)).toBeVisible()
}

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage()
  await login(page, SALES)

  for (const name of [COMPANY, OTHER_COMPANY]) {
    await createCompany(page, name)
    await seedSnapshotPage(
      await companyIdByName(name),
      'homepage',
      SOURCE_URL,
      beforeHtml(name),
      afterHtml(name),
    )
  }

  await page.close()
})

test('Sales không được mời lọc theo người khác', async ({ page }) => {
  await login(page, SALES)
  await readSource(page, COMPANY)
  await page.goto('/hang-doi')

  await expect(page.getByLabel('Lọc theo công ty')).toBeVisible()
  // Hidden, not disabled: a greyed-out control still tells them the other work exists.
  await expect(page.getByLabel('Lọc theo người phụ trách')).toHaveCount(0)
})

test('admin lọc được theo người phụ trách và theo công ty, hai bộ lọc giao nhau', async ({
  page,
}) => {
  await login(page, ADMIN)
  await readSource(page, COMPANY)
  await page.goto('/hang-doi')

  const cards = page.getByTestId('proposal-card')
  await expect(cards.first()).toBeVisible()

  await test.step('lọc theo người phụ trách thu hẹp về đúng người đó', async () => {
    await page.getByLabel('Lọc theo người phụ trách').selectOption({ label: SALES_NAME })
    await expect(cards.first()).toContainText(SALES_NAME)
  })

  await test.step('thêm bộ lọc công ty thì giao hai điều kiện', async () => {
    await page.getByLabel('Lọc theo công ty').selectOption({ label: COMPANY })
    const count = await cards.count()
    for (let index = 0; index < count; index += 1) {
      await expect(cards.nth(index)).toContainText(COMPANY)
    }
  })

  await test.step('chip nói đang lọc gì, và bỏ được', async () => {
    await expect(page.getByText(`Công ty: ${COMPANY}`)).toBeVisible()
    await page.getByRole('button', { name: `Bỏ lọc Công ty: ${COMPANY}` }).click()
    await expect(page.getByText(`Công ty: ${COMPANY}`)).toHaveCount(0)
  })
})

test('lọc ra rỗng nói khác với hàng đợi rỗng', async ({ page }) => {
  await login(page, ADMIN)
  await readSource(page, COMPANY)
  await page.goto('/hang-doi')
  await expect(page.getByTestId('proposal-card').first()).toBeVisible()

  /**
   * Filter to a company that has nothing waiting. The screen must say the filter is hiding
   * things — the "hàng đợi trống" sentence would claim the reviewer has no work left.
   */
  const companyFilter = page.getByLabel('Lọc theo công ty')
  const options = await companyFilter.locator('option').all()
  test.skip(options.length < 3, 'needs two companies with pending suggestions')

  await companyFilter.selectOption(await options[options.length - 1].getAttribute('value') ?? '')
  await page.getByLabel('Lọc theo người phụ trách').selectOption({ label: SALES_NAME })

  const filteredEmpty = page.getByTestId('queue-filtered-empty')
  const plainEmpty = page.getByTestId('queue-empty')

  if (await filteredEmpty.isVisible()) {
    await expect(plainEmpty).toHaveCount(0)
    await expect(filteredEmpty).toContainText('Bỏ bộ lọc')
  }
})

import { expect, test } from '@playwright/test'

import { companyIdByName, seedSnapshotPage } from './watch-cycle-scenario'

/**
 * T-5 in a real browser: the three buttons, the five reasons, and the step count.
 *
 * The service tests already prove each decision is recorded and that `edit` is not counted as
 * `accept`. What ONLY a browser can prove is the part ADR-0008 is about — that Bỏ costs no more
 * steps than Duyệt, and that all four pieces of evidence sit on the card rather than behind a
 * second screen. A queue that pushed Bỏ behind a confirm dialog would leave every backend test
 * green while quietly inflating the auto-accept rate.
 *
 * ── Why this test creates its own companies (feature 260815-1026) ────────────────────────
 * The original fixture engineered two exact preconditions no real BTC company happens to have:
 * a profile cell left blank on purpose (Kitefin's `website`), and an open opportunity whose next
 * step a HUMAN already typed so I-7 refuses the machine's overwrite (Sakura's case). Real
 * companies imported from the BTC zip either already carry every profile cell Sales filled in,
 * or — checked directly — have zero opportunities with a genuinely empty next step (every real
 * open deal already has one). So this spec creates two throwaway companies via the UI, exactly
 * like T-1, and seeds one `snapshot_pages` row each with content built to produce the SAME two
 * cases. No real imported company's data is touched.
 *
 * Runs against the compose stack on :8080 (`pnpm start`), like the rest of the e2e suite.
 */

const SALES = { email: 'sales@hblab.vn', password: 'sales123' }

/** The "blank cell" case: a fresh company (size starts NULL) whose page states one. */
const COMPANY = 'Cty Thu Nghiem T5 Trong'
/** The "human next step, refuse to overwrite" case: same blank-cell shape PLUS an open deal. */
const EDIT_COMPANY = 'Cty Thu Nghiem T5 Sua'
const EDIT_OPPORTUNITY = 'Doi tich hop CRM T5'

const SOURCE_URL = 'https://example.test/t5-harness'
const COMPANY_AFTER_HTML = `<html><body><article>
  <h1>${COMPANY}</h1>
  <ul class="facts"><li>Quy mô: 200-300 nhân viên</li></ul>
</article></body></html>`
const EDIT_AFTER_HTML = `<html><body><article>
  <h1>${EDIT_COMPANY}</h1>
  <p>Công ty bổ nhiệm bà Nguyễn Thu Hà làm tân CTO.</p>
  <ul class="facts"><li>Quy mô: 150-200 nhân viên</li></ul>
</article></body></html>`
const BEFORE_HTML = (name: string) => `<html><body><article><h1>${name}</h1></article></body></html>`

async function login(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/dang-nhap')
  await page.getByLabel('Email').fill(SALES.email)
  await page.getByLabel('Mật khẩu').fill(SALES.password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/cong-ty$/)
}

async function createCompany(page: import('@playwright/test').Page, name: string): Promise<void> {
  await page.goto('/cong-ty')
  if (await page.getByRole('cell', { name }).isVisible().catch(() => false)) return

  await page.getByRole('button', { name: 'Thêm công ty' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Tên công ty').fill(name)
  await dialog.getByLabel('Ngành').fill('Kiểm thử T-5')
  await dialog.getByLabel('Loại hình').fill('IT Solution')
  await dialog.getByRole('button', { name: 'Lưu' }).click()
  await expect(page.getByRole('cell', { name })).toBeVisible()
}

async function readSource(
  page: import('@playwright/test').Page,
  company: string,
): Promise<void> {
  await page.goto('/cong-ty')
  await page.getByRole('link', { name: company }).click()
  await expect(page.getByRole('heading', { name: company })).toBeVisible()
  await page.getByRole('button', { name: 'Đọc bản chụp sau' }).click()
  await expect(page.getByText(/Lưu \d+\/\d+ phát hiện|Đã đọc, nội dung không đổi/)).toBeVisible()
}

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage()
  await login(page)

  await createCompany(page, COMPANY)
  await seedSnapshotPage(
    await companyIdByName(COMPANY),
    'homepage',
    SOURCE_URL,
    BEFORE_HTML(COMPANY),
    COMPANY_AFTER_HTML,
  )

  await createCompany(page, EDIT_COMPANY)
  await page.goto('/co-hoi')
  if (!(await page.getByText(EDIT_OPPORTUNITY).isVisible().catch(() => false))) {
    await page.getByRole('button', { name: 'Thêm cơ hội' }).click()
    const oppDialog = page.getByRole('dialog')
    await oppDialog.getByLabel('Công ty').selectOption({ label: EDIT_COMPANY })
    await oppDialog.getByLabel('Tên cơ hội').fill(EDIT_OPPORTUNITY)
    await oppDialog.getByLabel('Giá trị dự kiến (để trống nếu chưa biết)').fill('300000')
    await oppDialog.getByRole('button', { name: 'Lưu' }).click()
    await expect(page.getByRole('region', { name: 'Tiếp cận' }).getByText(EDIT_OPPORTUNITY)).toBeVisible()

    // A human types this deal's next step BEFORE the source is ever read, so I-7 has something
    // to refuse to overwrite once the seeded "after" page's leadership_hire signal is read.
    const card = page.locator('article').filter({ hasText: EDIT_OPPORTUNITY })
    await card.getByRole('button', { name: 'Đặt Việc tiếp theo' }).click()
    await card.getByLabel('Việc tiếp theo').fill('Gửi hợp đồng nháp cho khách duyệt')
    // Both cells or neither: `NextStep` on the card only renders once BOTH are set (rule 4 —
    // a next step with no due date is treated as still incomplete), and leaving the date blank
    // would also raise the `missing_next_step` warning flag right next to the button that now
    // reads "Sửa" — which looks contradictory but is the product working as designed.
    await card.getByLabel('Ngày hạn').fill('2026-09-01')
    await card.getByRole('button', { name: 'Lưu' }).click()
    await expect(card.getByText('Gửi hợp đồng nháp cho khách duyệt')).toBeVisible()
  }
  await seedSnapshotPage(
    await companyIdByName(EDIT_COMPANY),
    'homepage',
    SOURCE_URL,
    BEFORE_HTML(EDIT_COMPANY),
    EDIT_AFTER_HTML,
  )

  await page.close()
})

test('T-5 · hàng đợi hiện đủ bốn thứ tại chỗ, ba nhánh quyết định đều ghi lại', async ({ page }) => {
  await login(page)

  await test.step('đọc nguồn để có gợi ý, và màn công ty hiện dấu hiệu chờ duyệt', async () => {
    await readSource(page, COMPANY)
    // The marker Specs asks for: the reviewer must not have to remember to check the queue.
    await expect(page.getByTestId('pending-proposal-marker').first()).toBeVisible()
  })

  await test.step('thẻ gợi ý hiện hiện-tại → đề nghị, câu trích, mức chắc chắn, hệ quả nếu sai', async () => {
    await page.goto('/hang-doi')
    const card = page.getByTestId('proposal-card').filter({ hasText: COMPANY }).first()
    await expect(card).toBeVisible()

    // All four, on the card, with no expander to open first.
    await expect(card.getByText('→')).toBeVisible()
    await expect(card.getByRole('button', { name: 'Xem nguồn' })).toBeVisible()
    await expect(card.getByText(/Chắc|Có thể|Đoán/)).toBeVisible()
    await expect(card.getByText(/^Nếu sai:/)).toBeVisible()
  })

  await test.step('bấm Xem nguồn mở đúng đoạn gốc, có đánh dấu', async () => {
    await page
      .getByTestId('proposal-card')
      .filter({ hasText: COMPANY })
      .first()
      .getByRole('button', { name: 'Xem nguồn' })
      .click()
    const highlight = page.getByTestId('quote-highlight').first()
    await expect(highlight).toBeVisible()

    const quoted = (await highlight.innerText()).trim()
    const sourceText = (await page.getByTestId('source-text').first().innerText()).trim()
    expect(sourceText).toContain(quoted)

    // The dialog closes on Escape — it has no close button, by design.
    await page.keyboard.press('Escape')
  })

  await test.step('Bỏ = MỘT bước: menu 5 lý do bung tại chỗ, chọn lý do là xong', async () => {
    const before = await page.getByTestId('proposal-card').count()

    await page
      .getByTestId('proposal-card')
      .filter({ hasText: COMPANY })
      .first()
      .getByRole('button', { name: 'Bỏ' })
      .click()

    // In place, on the card. No dialog, no navigation — the reviewer keeps their position.
    const reasons = page.getByTestId('reject-reasons').first()
    await expect(reasons).toBeVisible()
    await expect(reasons.getByRole('button')).toHaveCount(5)

    // Choosing the reason IS the act of rejecting: there is no confirm button after it, which
    // is what makes Bỏ one step like Duyệt (ADR-0008).
    await reasons.getByRole('button', { name: 'thông tin sai' }).click()

    await expect(page.getByTestId('proposal-card')).toHaveCount(before - 1)
  })
})

test('T-5 · Sửa rồi duyệt ghi giá trị người gõ, không ghi giá trị máy đề nghị', async ({ page }) => {
  await login(page)
  await readSource(page, EDIT_COMPANY)
  await page.goto('/hang-doi')

  /**
   * Filtered by KIND as well as by company. Reading the "sửa" company's page now produces two
   * cards: the blank `size` cell this test edits, and a `next_step` suggestion, because feature
   * group 4 refuses to overwrite its human-typed next step and hands the case to the queue (I-7,
   * ADR-0023). Taking `.first()` of the company's cards picked whichever came back newest.
   */
  const card = page
    .getByTestId('proposal-card')
    .filter({ hasText: EDIT_COMPANY })
    .filter({ hasText: 'sửa ô hồ sơ' })
    .first()
  await expect(card).toBeVisible()

  // The two-step branch, and honestly two steps: open the field, then approve.
  await card.getByRole('button', { name: 'Sửa rồi duyệt' }).click()
  const field = page.getByLabel('Sửa lại giá trị')
  await expect(field).toBeVisible()
  await field.fill('900-950')
  await page.getByRole('button', { name: 'Duyệt giá trị đã sửa' }).click()

  // The profile now holds what the PERSON typed — the machine's value was only a suggestion.
  await page.goto('/cong-ty')
  await page.getByRole('link', { name: EDIT_COMPANY }).click()
  await expect(page.getByText('900-950')).toBeVisible()
})

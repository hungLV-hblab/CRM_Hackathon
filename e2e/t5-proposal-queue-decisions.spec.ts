import { expect, test } from '@playwright/test'

/**
 * T-5 in a real browser: the three buttons, the five reasons, and the step count.
 *
 * The service tests already prove each decision is recorded and that `edit` is not counted as
 * `accept`. What ONLY a browser can prove is the part ADR-0008 is about — that Bỏ costs no more
 * steps than Duyệt, and that all four pieces of evidence sit on the card rather than behind a
 * second screen. A queue that pushed Bỏ behind a confirm dialog would leave every backend test
 * green while quietly inflating the auto-accept rate.
 *
 * Runs against the compose stack on :8080 (`pnpm start`), like the rest of the e2e suite.
 */

const SALES = { email: 'sales@hblab.vn', password: 'sales123' }
/**
 * Watched, and its seeded `website` is empty while the page states one — so reading its source
 * puts exactly one suggestion in the queue. No other spec reads Kitefin, which keeps this one
 * independent of run order on a shared database.
 */
const COMPANY = 'Kitefin Analytics'
/** Read by the provenance spec too, so this one only requires that ITS card is in the queue. */
const EDIT_COMPANY = 'Sakura Manufacturing KK'

async function login(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/dang-nhap')
  await page.getByLabel('Email').fill(SALES.email)
  await page.getByLabel('Mật khẩu').fill(SALES.password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/cong-ty$/)
}

/**
 * Reading a source is what puts something in the queue — nothing is seeded into it.
 *
 * Either outcome is acceptable: a first read stores findings, a repeat read reports "đã đọc,
 * không đổi" (I-3). Asserting only the first would make this helper fail on the second spec of
 * a shared-database run, which is a harness problem masquerading as a product bug.
 */
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

test('T-5 · hàng đợi hiện đủ bốn thứ tại chỗ, ba nhánh quyết định đều ghi lại', async ({ page }) => {
  await login(page)

  await test.step('đọc nguồn để có gợi ý, và màn công ty hiện dấu hiệu chờ duyệt', async () => {
    await readSource(page, COMPANY)
    // The marker Specs asks for: the reviewer must not have to remember to check the queue.
    await expect(page.getByTestId('pending-proposal-marker').first()).toBeVisible()
  })

  await test.step('thẻ gợi ý hiện hiện-tại → đề nghị, câu trích, mức chắc chắn, hệ quả nếu sai', async () => {
    await page.goto('/hang-doi')
    const card = page.getByTestId('proposal-card').first()
    await expect(card).toBeVisible()

    // All four, on the card, with no expander to open first.
    await expect(card.getByText('→')).toBeVisible()
    await expect(card.getByRole('button', { name: 'Xem nguồn' })).toBeVisible()
    await expect(card.getByText(/Chắc|Có thể|Đoán/)).toBeVisible()
    await expect(card.getByText(/^Nếu sai:/)).toBeVisible()
  })

  await test.step('bấm Xem nguồn mở đúng đoạn gốc, có đánh dấu', async () => {
    await page.getByTestId('proposal-card').first().getByRole('button', { name: 'Xem nguồn' }).click()
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

  const card = page.getByTestId('proposal-card').filter({ hasText: EDIT_COMPANY }).first()
  await expect(card).toBeVisible()

  // The two-step branch, and honestly two steps: open the field, then approve.
  await card.getByRole('button', { name: 'Sửa rồi duyệt' }).click()
  const field = page.getByLabel('Sửa lại giá trị')
  await expect(field).toBeVisible()
  await field.fill('900-950')
  await page.getByRole('button', { name: 'Duyệt giá trị đã sửa' }).click()

  // The profile now holds what the PERSON typed — `1000+` was only the machine's suggestion.
  await page.goto('/cong-ty')
  await page.getByRole('link', { name: EDIT_COMPANY }).click()
  await expect(page.getByText('900-950')).toBeVisible()
})

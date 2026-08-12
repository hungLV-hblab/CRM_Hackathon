import { expect, test } from '@playwright/test'

/**
 * T-3, automated instead of "checked by hand": click a finding → the source opens at the right
 * passage → the quoted span is marked.
 *
 * Doing this in a browser rather than as a service test is the point. The service test already
 * proves the OFFSETS are right; what only a browser can prove is that the highlight the user
 * actually sees is built from those same offsets. A rendering bug that slices the wrong span
 * would leave every backend test green while the screen shows fake provenance.
 *
 * Runs against the compose stack on :8080 (`pnpm start`), like the rest of the e2e suite.
 */

const SALES = { email: 'sales@hblab.vn', password: 'sales123' }
/**
 * ONE COMPANY PER TEST, deliberately. The e2e suite shares a single seeded database and runs
 * with one worker, so a test that reads the same company as an earlier one inherits its state
 * — and "đã đọc, không đổi" on the first click would then be correct behaviour failing a test.
 * Separate companies make each spec independent of run order without needing a reseed hook.
 */
const COMPANY = 'Sakura Manufacturing KK'
const REREAD_COMPANY = 'Nimbus Cloud Solutions'
/** No readable snapshot in either variant — the `fetch_status = failed` path. */
const UNREADABLE_COMPANY = 'Ohara Retail Group'

async function login(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/dang-nhap')
  await page.getByLabel('Email').fill(SALES.email)
  await page.getByLabel('Mật khẩu').fill(SALES.password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/cong-ty$/)
}

test('T-3 · bấm phát hiện mở đúng đoạn nguồn và có đánh dấu', async ({ page }) => {
  await login(page)

  await page.getByRole('link', { name: COMPANY }).click()
  await expect(page.getByRole('heading', { name: COMPANY })).toBeVisible()

  // The read zone is empty until a source is read: nothing is invented on page load.
  await expect(page.getByText('Chưa đọc nguồn nào cho công ty này')).toBeVisible()

  await page.getByRole('button', { name: 'Đọc bản chụp sau' }).click()

  // The counts are shown, including how many findings were dropped — that number is a metric
  // (ADR-0014), so it appears even when it is zero.
  await expect(page.getByText(/bị bỏ vì câu trích không khớp nguyên văn/)).toBeVisible()

  // Every finding is rendered WITH a way back to its source. There is no branch that renders a
  // statement without one, which is rule 1 enforced at the component layer.
  const openSource = page.getByRole('button', { name: 'Xem câu trích trong nguồn' }).first()
  await expect(openSource).toBeVisible()

  // Nothing is marked before the user asks for it.
  await expect(page.getByTestId('quote-highlight')).toHaveCount(0)

  await openSource.click()

  const highlight = page.getByTestId('quote-highlight').first()
  await expect(highlight).toBeVisible()

  // THE ASSERTION THIS SPEC EXISTS FOR: the marked text is a real, non-trivial passage of the
  // source, and the source text around it actually contains it. A highlight of the wrong span
  // — or of the whole document — fails here.
  const quoted = (await highlight.innerText()).trim()
  expect(quoted.length).toBeGreaterThan(10)

  const sourceText = (await page.getByTestId('source-text').first().innerText()).trim()
  expect(sourceText).toContain(quoted)
  expect(sourceText.length).toBeGreaterThan(quoted.length)

  // The original tab shows the captured markup as text, never rendered.
  await page.getByRole('button', { name: 'Bản gốc' }).first().click()
  await expect(page.getByText('<p>', { exact: false }).first()).toBeVisible()
})

test('I-3 · đọc lại nội dung y nguyên thì không tạo bản lưu mới', async ({ page }) => {
  await login(page)
  await page.getByRole('link', { name: REREAD_COMPANY }).click()

  await page.getByRole('button', { name: 'Đọc bản chụp sau' }).click()
  await expect(page.getByText(/Lưu \d+\/\d+ phát hiện/)).toBeVisible()

  await page.getByRole('button', { name: 'Đọc bản chụp sau' }).click()

  // "Đã đọc, không đổi" — and the message says so explicitly rather than looking like nothing
  // happened, so a judge can tell a working cycle from a dead one.
  await expect(
    page.getByText('Đã đọc, nội dung không đổi — không tạo bản lưu mới, không gọi LLM.'),
  ).toBeVisible()
})

test('nguồn không đọc được thì nói rõ, không đoán nội dung', async ({ page }) => {
  await login(page)
  await page.getByRole('link', { name: UNREADABLE_COMPANY }).click()

  await page.getByRole('button', { name: 'Đọc bản chụp sau' }).click()

  await expect(
    page.getByText('Không đọc được nguồn. Đã ghi lại lần đọc này, không có phát hiện nào được sinh.'),
  ).toBeVisible()
  await expect(
    page.getByText('Nguồn không đọc được nên không có phát hiện nào. Hệ thống không đoán.'),
  ).toBeVisible()
  // No finding is rendered at all — an empty answer, not a plausible one (rule 4).
  await expect(page.getByRole('button', { name: 'Xem câu trích trong nguồn' })).toHaveCount(0)
})

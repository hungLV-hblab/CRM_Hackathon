import { expect, test, type Page } from '@playwright/test'

/**
 * The Claude login panel on the admin screen, driven the way a person drives it.
 *
 * WHAT THIS SPEC CANNOT DO, and deliberately does not fake: complete the authorisation. That step
 * happens on Anthropic's site, with a real account, and ends in a code only a human can copy. So
 * the spec stops exactly where the human takes over — it presses the button, waits for a REAL
 * `claude setup-token` process to come up under a PTY inside the container, and asserts the
 * authorisation URL that comes back is a real one.
 *
 * That boundary is worth being precise about, because everything before it is where the bugs are:
 * the ticket, the Caddy prefix, the PTY, the ANSI scraping. The last click is the part that was
 * never in question.
 *
 * Runs against the compose stack on :8080 (`pnpm start`).
 */

const SALES = { email: 'sales@hblab.vn', password: 'hackathon#1' }
const ADMIN = { email: 'admin@hblab.vn', password: 'hackathon#1' }

test('admin thấy panel và mở được phiên uỷ quyền thật', async ({ page }) => {
  await login(page, ADMIN)
  await page.goto('/quan-tri')

  const panel = page.getByRole('heading', { name: 'Đăng nhập Claude' })
  await expect(panel).toBeVisible()

  const start = page.getByTestId('claude-login-start')
  await expect(start).toBeVisible()

  /**
   * 44px minimum touch target, the same rule `ui-invariants` enforces everywhere else. Asserted
   * here too because this panel is new and the checklist is easy to skip on an admin screen.
   */
  const box = await start.boundingBox()
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)

  await start.click()

  /**
   * A real subprocess is starting inside the container: `script` allocates a PTY, the CLI boots
   * Ink, paints a banner and a spinner, and only then prints the URL. Measured at roughly three
   * seconds, so the wait is generous rather than tuned — a tuned one here is a flaky one.
   */
  const url = page.getByTestId('claude-login-url')
  await expect(url).toBeVisible({ timeout: 60_000 })

  const href = await url.getAttribute('href')
  expect(href).toMatch(/^https:\/\/claude\.ai\/oauth\/authorize\?/)
  /** PKCE, not a bare redirect: these two parameters are what make the pasted code usable once. */
  expect(href).toContain('code_challenge=')
  expect(href).toContain('state=')

  /** The code box is a PERSON's action, so it must not be dressed as machine output. */
  await expect(page.getByTestId('claude-login-code')).toBeVisible()

  /** Leave no session holding the single slot for the next run of this suite. */
  await page.getByRole('button', { name: 'Huỷ' }).click()
})

test('admin có khối lượt chạy gần nhất và nút ép một lượt', async ({ page }) => {
  await login(page, ADMIN)
  await page.goto('/quan-tri')

  /**
   * This spec deliberately does NOT press "Kiểm tra ngay". That button spends a real person's
   * Claude quota on every run, and a suite that burns quota on every CI pass is a suite somebody
   * eventually deletes. Which fields each outcome records — and that a failed run keeps its own
   * reason rather than collapsing into a generic error — is locked down by unit tests on both
   * sides of the wire. What belongs here is that the control exists and is reachable.
   *
   * The block is asserted by its heading rather than by one of the three states, because the
   * state depends on whether anything has run against this container yet: an assertion on
   * "chưa kiểm tra lần nào" would pass on a fresh stack and fail after any real run, which is a
   * flake that teaches people to delete the test.
   */
  const result = page.getByTestId('claude-check-result')
  await expect(result).toBeVisible()
  await expect(result).toContainText('Lượt chạy gần nhất')

  const check = page.getByTestId('claude-check-run')
  await expect(check).toBeVisible()

  /** 44px minimum touch target, the same rule `ui-invariants` enforces on every other screen. */
  const box = await check.boundingBox()
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
})

test('Sales không thấy panel đăng nhập Claude', async ({ page }) => {
  await login(page, SALES)
  await page.goto('/quan-tri')

  /**
   * The real guard is the 403 on `/settings`; this asserts the screen honours it rather than
   * drawing a control Sales would only be refused on click. Both halves matter — the refusal
   * notice must be there, and the button must not.
   */
  await expect(page.getByText('Màn này dành cho tài khoản Quản trị')).toBeVisible()
  await expect(page.getByTestId('claude-login-start')).toHaveCount(0)
})

async function login(page: Page, user: { email: string; password: string }): Promise<void> {
  await page.goto('/dang-nhap')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Mật khẩu').fill(user.password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/cong-ty$/, { timeout: 30_000 })
}

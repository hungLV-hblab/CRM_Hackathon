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

/**
 * Reading a source calls the model, and since feature group 5 the WORKER is calling it too, on
 * every watched company, every cycle. Playwright's default 5s was set when the watch cycle did
 * nothing; under real background load it cuts a legitimate read off mid-flight, and the failure
 * reads as "the read produced nothing" — a product bug's clothes on a harness problem.
 * The assertion is unchanged; only the patience is.
 */
const INGEST_TIMEOUT = 30_000

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

  /**
   * ── This assertion was CHANGED by phase 7, on purpose ──────────────────────────────────
   * It used to read "the read zone is empty until a source is read", and that stopped being true
   * for this company: Sakura carries Đang theo dõi, and since feature group 5 the watch cycle
   * really does read watched sources on its own — before phase 7 `scan()` only counted companies
   * and created nothing. The old line encoded "the watch cycle does nothing", which is now a
   * statement the product is supposed to contradict.
   *
   * What it is replaced with is the invariant the old line was reaching for, and it is stronger:
   * every finding on screen has a way back to its source. Rule 1 of CLAUDE.md, counted rather
   * than trusted — one statement rendered without a provenance control fails here, whoever put it
   * there. That holds whether the zone is empty, freshly read, or filled by the machine overnight.
   */
  const statements = page.locator('.text-suy-luan')
  const provenanceControls = page.getByRole('button', { name: 'Xem câu trích trong nguồn' })
  expect(await provenanceControls.count()).toBe(await statements.count())

  await page.getByRole('button', { name: 'Đọc bản chụp sau' }).click()

  // The counts are shown, including how many findings were dropped — that number is a metric
  // (ADR-0014), so it appears even when it is zero.
  await expect(page.getByText(/bị bỏ vì câu trích không khớp nguyên văn/)).toBeVisible({
    timeout: INGEST_TIMEOUT,
  })

  // Every finding is rendered WITH a way back to its source. There is no branch that renders a
  // statement without one, which is rule 1 enforced at the component layer.
  const openSource = page.getByRole('button', { name: 'Xem câu trích trong nguồn' }).first()
  await expect(openSource).toBeVisible()

  // Nothing is marked before the user asks for it.
  await expect(page.getByTestId('quote-highlight')).toHaveCount(0)

  await openSource.click()

  /**
   * Both locators are scoped to the ONE snapshot card that is open, and that is a correctness
   * fix rather than tidying. The read zone mounts a `SourceViewer` for every snapshot it lists,
   * so `getByTestId('source-text').first()` is whichever snapshot happens to be listed first —
   * while the highlight belongs to the card whose finding was just clicked. For a watched
   * company those are the same card only until the watch cycle adds another snapshot, which
   * means how many cycles fired during the earlier specs decided whether this line passed.
   * It failed exactly once that way before being pinned down.
   */
  const openedCard = page.locator('article', { has: page.getByTestId('quote-highlight') }).first()
  const highlight = openedCard.getByTestId('quote-highlight').first()
  await expect(highlight).toBeVisible()

  // THE ASSERTION THIS SPEC EXISTS FOR: the marked text is a real, non-trivial passage of the
  // source, and the source text around it actually contains it. A highlight of the wrong span
  // — or of the whole document — fails here.
  const quoted = (await highlight.innerText()).trim()
  expect(quoted.length).toBeGreaterThan(10)

  const sourceText = (await openedCard.getByTestId('source-text').first().innerText()).trim()
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
  await expect(page.getByText(/Lưu \d+\/\d+ phát hiện/)).toBeVisible({ timeout: INGEST_TIMEOUT })

  await page.getByRole('button', { name: 'Đọc bản chụp sau' }).click()

  // "Đã đọc, không đổi" — and the message says so explicitly rather than looking like nothing
  // happened, so a judge can tell a working cycle from a dead one.
  await expect(
    page.getByText('Đã đọc, nội dung không đổi — không tạo bản lưu mới, không gọi LLM.'),
  ).toBeVisible({ timeout: INGEST_TIMEOUT })
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

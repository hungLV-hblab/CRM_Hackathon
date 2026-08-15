import { expect, test } from '@playwright/test'

import { companyIdByName, seedSnapshotPage } from './watch-cycle-scenario'

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
 *
 * ── Why COMPANY is self-contained (feature 260815-1026) ──────────────────────────────────
 * T-3 needs a real "Xem câu trích trong nguồn" button, which only renders once a read produces
 * at least one finding. Checked directly: real BTC pages are raw Wayback/live HTML with no
 * `Ngành:`/`Quy mô:` facts block (so the profile-fact half of `FixtureClaimExtractor` never
 * fires), and the only real pages whose noise happens to contain a signal keyword belong to
 * companies T-8 already reads (`audax`, `GFF AI`, `Seiko Solutions Inc.`) — reusing one here
 * would make this spec's pass/fail depend on T-8 having run first. So this spec creates its own
 * company via the UI (same pattern as T-5/T-6/T-7) and seeds one page with a genuine, deterministic
 * claim-triggering sentence. REREAD_COMPANY and UNREADABLE_COMPANY don't need a claim — any real
 * company works for the former, and `CY&SONS` genuinely ships zero snapshot pages for the latter.
 */
const COMPANY = 'Cty Thu Nghiem T3 Doc Nguon'
const REREAD_COMPANY = 'Hiblead'
/** No snapshot pages at all for this real company — the `fetch_status = failed` path. */
const UNREADABLE_COMPANY = 'CY&SONS'

const SOURCE_URL = 'https://example.test/t3-harness'
const BEFORE_HTML = `<html><body><article>
  <h1>${COMPANY}</h1>
  <p>Công ty cung cấp dịch vụ tư vấn công nghệ cho khách hàng doanh nghiệp.</p>
</article></body></html>`
const AFTER_HTML = `<html><body><article>
  <h1>${COMPANY}</h1>
  <p>Công ty bổ nhiệm bà Lê Thị Mai làm tân CTO phụ trách mảng sản phẩm.</p>
</article></body></html>`

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

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage()
  await login(page)

  await page.goto('/cong-ty')
  if (!(await page.getByRole('cell', { name: COMPANY }).isVisible().catch(() => false))) {
    await page.getByRole('button', { name: 'Thêm công ty' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Tên công ty').fill(COMPANY)
    await dialog.getByLabel('Ngành').fill('Kiểm thử T-3')
    await dialog.getByLabel('Loại hình').fill('IT Solution')
    await dialog.getByRole('button', { name: 'Lưu' }).click()
    await expect(page.getByRole('cell', { name: COMPANY })).toBeVisible()

    await seedSnapshotPage(
      await companyIdByName(COMPANY),
      'homepage',
      SOURCE_URL,
      BEFORE_HTML,
      AFTER_HTML,
    )
  }

  await page.close()
})

test('T-3 · bấm phát hiện mở đúng đoạn nguồn và có đánh dấu', async ({ page }) => {
  await login(page)

  await page.getByRole('link', { name: COMPANY }).click()
  await expect(page.getByRole('heading', { name: COMPANY })).toBeVisible()

  /**
   * The invariant rule 1 of CLAUDE.md asks for, counted rather than trusted: every finding
   * rendered on screen has a way back to its source. One statement rendered without a
   * provenance control fails here, whoever put it there — before this company has been read at
   * all, both counts are zero, which trivially satisfies the same invariant.
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

  /**
   * ── Added by phase 2 of the live-source work. Nothing above was changed ────────────────────
   * Rule 2 applies to the SOURCE, not only to fact-versus-inference: a snapshot the team vetted
   * and a public page nobody has read carry different weight, and the difference has to be
   * visible without opening anything. This company reads a stored snapshot, so both labels are
   * the snapshot ones — the assertion that matters is that the labels EXIST and say which.
   *
   * Scoped to one card: the read zone lists a card per snapshot, and a page-wide `getByText`
   * would pass on any of them.
   */
  const labelledCard = page.locator('article', { hasText: 'Vùng đọc — do AI sinh' }).first()
  await expect(labelledCard.getByText('Bản chụp', { exact: true })).toBeVisible()
  await expect(labelledCard.getByText('Trang công ty', { exact: true })).toBeVisible()
  // The live label must NOT appear on a snapshot read — the two are a distinction or they are
  // decoration.
  await expect(labelledCard.getByText('Nguồn thật', { exact: true })).toHaveCount(0)

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

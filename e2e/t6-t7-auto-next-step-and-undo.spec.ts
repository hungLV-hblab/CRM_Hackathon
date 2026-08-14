import { expect, test } from '@playwright/test'

/**
 * T-6 and T-7 in a real browser — autonomy zone 3 as a judge will actually meet it.
 *
 * The integration suite already proves the write lands in three columns, that the trail records
 * both directions, and that I-8 restores the human baseline rather than the machine's previous
 * guess. What ONLY a browser can prove is the half Specs is actually buying with that privilege:
 *
 *   - Sales is TOLD, without going looking;
 *   - the cell is visibly not theirs, without reading any explanation;
 *   - undoing costs ONE press, from the screen they were already on.
 *
 * A build that quietly wrote the cell with no mark and no button would leave every backend test
 * green — which is the whole reason this file exists rather than one more service test.
 *
 * Runs against the compose stack on :8080 (`pnpm start`), like the rest of the e2e suite.
 */

const SALES = { email: 'sales@hblab.vn', password: 'sales123' }

/**
 * Nimbus is the zone 3 case in the seed: an open deal at `negotiation` with an EMPTY next step,
 * and an `after` page announcing a new CTO. Empty cell + `leadership_hire` is exactly the pair
 * I-6 lets the system write on, and no other spec reads Nimbus, so this one does not depend on
 * run order against the shared demo database.
 */
const COMPANY = 'Nimbus Cloud Solutions'
const OPPORTUNITY = 'Đội phát triển nền tảng tích hợp'

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

/**
 * Flipping the company to its "after" snapshot is what causes the write — nothing is seeded.
 *
 * Either outcome is fine: a first read stores findings, a repeat read reports "đã đọc, không
 * đổi" (I-3). Requiring the first would make this fail on a second run against the same
 * database, which is a harness problem wearing a product bug's clothes.
 */
async function readAfterSnapshot(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/cong-ty')
  await page.getByRole('link', { name: COMPANY }).click()
  await expect(page.getByRole('heading', { name: COMPANY })).toBeVisible()
  await page.getByRole('button', { name: 'Đọc bản chụp sau' }).click()
  await expect(
    page.getByText(/Lưu \d+\/\d+ phát hiện|Đã đọc, nội dung không đổi/),
  ).toBeVisible({ timeout: INGEST_TIMEOUT })
}

/** The deal's card on the board, whichever stage column it currently sits in. */
function card(page: import('@playwright/test').Page) {
  return page.locator('article').filter({ hasText: OPPORTUNITY }).first()
}

test('T-6 · đổi sang bản chụp sau thì Việc tiếp theo tự đổi, có thông báo, ô mang dấu hiệu hệ thống', async ({
  page,
}) => {
  await login(page)

  await test.step('đọc bản chụp "sau" của công ty có cơ hội đang mở, ô Việc tiếp theo trống', async () => {
    await readAfterSnapshot(page)
  })

  await test.step('bảng cơ hội báo ngay, không phải đi tìm', async () => {
    await page.goto('/co-hoi')
    const strip = page.getByTestId('notification-strip')
    await expect(strip).toBeVisible()
    // The notice names the deal, so Sales knows what changed before opening anything.
    await expect(strip).toContainText(OPPORTUNITY)
  })

  await test.step('ô Việc tiếp theo mang dấu hiệu do máy điền, kèm lý do ngày hạn', async () => {
    const cell = card(page).getByTestId('auto-next-step-cell')
    await expect(cell).toBeVisible()

    // Rule 2, and NOT by colour alone: the words are there to be read on a greyscale printout.
    await expect(cell).toContainText('Do hệ thống điền')
    // I-9 on screen: the date carries the reason the urgency table gives for it.
    await expect(cell).toContainText('sếp mới xem lại lựa chọn của người cũ')
    // Rule 1 does not soften in zone 3.
    await expect(cell.getByRole('button', { name: 'Xem câu trích trong nguồn' })).toBeVisible()
  })

  await test.step('bấm câu trích mở đúng đoạn trong nguồn, có đánh dấu', async () => {
    await card(page).getByRole('button', { name: 'Xem câu trích trong nguồn' }).click()

    const highlight = page.getByTestId('quote-highlight').first()
    await expect(highlight).toBeVisible()

    const quoted = (await highlight.innerText()).trim()
    const sourceText = (await page.getByTestId('source-text').first().innerText()).trim()
    expect(sourceText).toContain(quoted)

    await page.keyboard.press('Escape')
  })
})

test('T-7 · Hoàn tác một cú bấm, giá trị cũ trở lại, thông báo không tự biến mất', async ({
  page,
}) => {
  await login(page)
  await readAfterSnapshot(page)
  await page.goto('/co-hoi')

  const cell = card(page).getByTestId('auto-next-step-cell')
  await expect(cell).toBeVisible()

  await test.step('cửa sổ 7 ngày được đếm rõ, không bắt người dùng tự tính', async () => {
    await expect(cell).toContainText(/Còn \d+ ngày để hoàn tác|ngày cuối để hoàn tác/)
  })

  await test.step('Hoàn tác = MỘT bước, ngay trên thẻ đang nhìn', async () => {
    /**
     * The button is a first-class control on the card, not an item in a ⋯ menu and not a link
     * to another screen. CLAUDE.md section 4: undoing must be easier than the write was, and
     * the write cost nobody a single press.
     */
    await cell.getByTestId('undo-auto-next-step').click()

    // One press, and the machine cell is gone — no confirm dialog in between.
    await expect(card(page).getByTestId('auto-next-step-cell')).toHaveCount(0)
  })

  await test.step('ô trở về đúng nguyên trạng: trống, và cơ hội lại mang cờ thiếu Việc tiếp theo', async () => {
    // Nimbus' cell was empty before the machine wrote, so "back" means empty — not the
    // machine's sentence with a different label on it (I-8).
    await expect(card(page)).toContainText('Chưa có Việc tiếp theo')
  })

  await test.step('thông báo vẫn còn cho tới khi bấm Đã xem', async () => {
    await page.goto('/thong-bao')
    const strip = page.getByTestId('notification-strip')
    // Undoing does not erase the record that Sales was told — that record is a third of what
    // buys zone 3 its privilege.
    await expect(strip).toContainText(OPPORTUNITY)

    const row = page.getByTestId('notification-row').filter({ hasText: OPPORTUNITY }).first()
    await row.getByRole('button', { name: 'Đã xem' }).click()

    // Marked, not deleted: it stays on the history screen wearing its new state.
    await expect(row).toContainText('Đã xem')
  })

  await test.step('sau khi Đã xem, dải ở bảng cơ hội không còn hối nữa', async () => {
    await page.goto('/co-hoi')
    await expect(page.getByTestId('notification-strip')).toHaveCount(0)
  })
})

import { expect, test, type Page } from '@playwright/test'

import { setAiEnabled } from './turn-ai-off'

/**
 * T-1 — the whole of feature group 1, driven end to end with the AI switched OFF.
 *
 * ONE spec rather than eight, because the point of this check is that the path HOLDS TOGETHER:
 * a company you cannot then hang a contact on, or a deal you cannot move, passes eight small
 * specs and fails the only question T-1 asks. Every leg is wrapped in `test.step()` so the
 * reporter names the leg that broke, and `trace: 'retain-on-failure'` keeps the rest.
 *
 * Stages are changed BY KEYBOARD, through the same dnd-kit path a person uses — there is no
 * second way to change a stage, by design (ADR-0020). The keys have to be SPACED: measured at
 * 0ms the card does not move, at ≥50ms it moves exactly one column. Pressing them back to back
 * fails the product for a fault in the harness.
 */

const SALES = { email: 'sales@hblab.vn', password: 'sales123' }

const COMPANY = 'Cty Thu Nghiem T1'
const INDUSTRY = 'Kiem thu T-1'
const PRIMARY_CONTACT = 'Pham Quoc Anh'
const SECOND_CONTACT = 'Le Minh Chau'
const OPPORTUNITY = 'Thue ngoai doi kiem thu T-1'
const ACTIVITY = 'Goi dien gioi thieu nang luc ITO, khach hen hop lai tuan sau.'

/** ≥50ms between key presses, from the measurement recorded in ADR-0020. */
const KEY_SPACING_MS = 80

test.beforeAll(async () => {
  await setAiEnabled(false)
})

test.afterAll(async () => {
  // Leaving the switch off would make every later run of the suite fail somewhere else.
  await setAiEnabled(true)
})

test('T-1 · nhóm 1 chạy đủ khi AI đang tắt', async ({ page }) => {
  /**
   * Nine legs, each a full page load against the production build, plus three keyboard drags
   * that are spaced on purpose. Playwright's 30s default is a budget for ONE interaction and
   * this spec is deliberately one journey — raised here rather than in the config so the other
   * specs keep the tight default that catches a slow screen.
   */
  test.setTimeout(180_000)

  await test.step('AI đang tắt, và nhìn thấy được trên màn hình', async () => {
    await login(page)

    // Kitefin, not a company another spec reads: the read zone accumulates snapshots.
    await page.getByRole('link', { name: 'Kitefin Analytics' }).click()
    await page.getByRole('button', { name: 'Đọc bản chụp sau' }).click()

    // The precondition is READ OFF THE SCREEN instead of assumed. If this line ever passes
    // while the AI is on, everything below proves nothing.
    await expect(page.getByText('AI đang tắt nên không đọc nguồn. Dữ liệu đã có vẫn còn nguyên.')).toBeVisible()
  })

  await test.step('Tạo công ty', async () => {
    await page.goto('/cong-ty')
    await page.getByRole('button', { name: 'Thêm công ty' }).click()

    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Tên công ty').fill(COMPANY)
    await dialog.getByLabel('Ngành').fill(INDUSTRY)
    await dialog.getByLabel('Loại hình').selectOption('it_solution')
    await dialog.getByRole('button', { name: 'Lưu' }).click()

    await expect(page.getByRole('cell', { name: COMPANY })).toBeVisible()
  })

  await test.step('Tạo người liên hệ và đặt đầu mối chính', async () => {
    await page.getByRole('link', { name: COMPANY }).click()
    await expect(page.getByRole('heading', { name: COMPANY })).toBeVisible()

    await addContact(page, PRIMARY_CONTACT, 'Giám đốc CNTT')
    await addContact(page, SECOND_CONTACT, 'Quản lý dự án')

    const primaryRow = page.getByRole('listitem').filter({ hasText: PRIMARY_CONTACT })
    await primaryRow.getByRole('button', { name: 'Đặt làm đầu mối chính' }).click()

    // Exactly one đầu mối chính per company, and the promotion is what proves it is enforced
    // rather than merely stated. `exact` matters here: without it the badge and the OTHER
    // row's "Đặt làm đầu mối chính" button both match and the count means nothing.
    await expect(page.getByText('Đầu mối chính', { exact: true })).toHaveCount(1)
    await expect(primaryRow.getByText('Đầu mối chính', { exact: true })).toBeVisible()
  })

  await test.step('Ghi hoạt động vào dòng thời gian', async () => {
    await page.getByLabel('Loại').selectOption('activity')
    await page.getByLabel('Nội dung').fill(ACTIVITY)
    await page.getByRole('button', { name: 'Ghi lại' }).click()

    await expect(page.getByText(ACTIVITY)).toBeVisible()
  })

  await test.step('Tạo cơ hội', async () => {
    await page.goto('/co-hoi')
    await page.getByRole('button', { name: 'Thêm cơ hội' }).click()

    const dialog = page.getByRole('dialog')
    // Selected by NAME: the dialog falls back to the first company when nothing is picked, so
    // an unselected dropdown would silently attach the deal to somebody else's company.
    await dialog.getByLabel('Công ty').selectOption({ label: COMPANY })
    await dialog.getByLabel('Tên cơ hội').fill(OPPORTUNITY)
    await dialog.getByLabel('Giá trị dự kiến (để trống nếu chưa biết)').fill('150000')
    await dialog.getByRole('button', { name: 'Lưu' }).click()

    await expect(columnFor(page, 'Tiếp cận').getByText(OPPORTUNITY)).toBeVisible()
  })

  await test.step('Kéo qua ba giai đoạn tới Thương lượng, bỏ trống hai ô dấu hiệu', async () => {
    // Tiếp cận → Đủ điều kiện. Dropping here ASKS for the four signal cells.
    await dragOneColumnRight(page, OPPORTUNITY)

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    // Two of four filled. The other two stay empty on purpose: the deal must still move, and
    // it must come back wearing a flag rather than being refused.
    // `exact`, or the cell and its own "Nguồn của dấu hiệu nhu cầu" both match.
    await dialog.getByLabel('Dấu hiệu nhu cầu', { exact: true }).fill('Đội kiểm thử nội bộ đang quá tải')
    await dialog.getByLabel('Nguồn của dấu hiệu nhu cầu').fill('Cuộc gọi ngày 13/08/2026')
    await dialog.getByRole('button', { name: 'Lưu và chuyển' }).click()

    await expect(columnFor(page, 'Đủ điều kiện').getByText(OPPORTUNITY)).toBeVisible()
    await expect(cardFor(page, OPPORTUNITY).getByText('Chưa đủ dấu hiệu nhu cầu/ngân sách')).toBeVisible()

    // Đủ điều kiện → Soạn đề xuất → Thương lượng. Neither stage asks anything.
    await dragOneColumnRight(page, OPPORTUNITY)
    await expect(columnFor(page, 'Soạn đề xuất').getByText(OPPORTUNITY)).toBeVisible()

    await dragOneColumnRight(page, OPPORTUNITY)
    await expect(columnFor(page, 'Thương lượng').getByText(OPPORTUNITY)).toBeVisible()

    // Still flagged three stages later: the gap was recorded, not waved through.
    await expect(cardFor(page, OPPORTUNITY).getByText('Chưa đủ dấu hiệu nhu cầu/ngân sách')).toBeVisible()
  })

  await test.step('Tìm và lọc công ty', async () => {
    await page.goto('/cong-ty')

    await page.getByLabel('Tìm theo tên').fill('Thu Nghiem')
    await expect(page.getByRole('cell', { name: COMPANY })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Sakura Manufacturing KK' })).toHaveCount(0)

    // A filter that matches nothing says so and offers the way back, rather than showing an
    // empty table that reads like a broken screen.
    await page.getByLabel('Lọc theo loại hình').selectOption('traditional')
    await expect(page.getByText('Không có công ty nào khớp bộ lọc đang chọn.')).toBeVisible()
    await page.getByRole('button', { name: 'Xoá bộ lọc' }).click()
    await expect(page.getByRole('cell', { name: 'Sakura Manufacturing KK' })).toBeVisible()
  })

  await test.step('Màn tổng quan', async () => {
    await page.goto('/tong-quan')
    await expect(page.getByRole('heading', { name: 'Tổng quan' })).toBeVisible()

    await expect(page.getByRole('cell', { name: 'Thương lượng' })).toBeVisible()
    await expect(page.getByText('Pipeline đang chạy:')).toBeVisible()
    await expect(page.getByRole('cell', { name: INDUSTRY })).toBeVisible()

    // Both halves of the lost-reason block: the table of reasons, and the deals with no reason
    // standing outside it so the reasons still add up.
    await expect(page.getByRole('cell', { name: 'Khách chọn đối tác đã có đội tại chỗ' })).toBeVisible()
    await expect(page.getByText('cơ hội Thua chưa ghi lý do')).toBeVisible()
  })
})

async function login(page: Page): Promise<void> {
  await page.goto('/dang-nhap')
  await page.getByLabel('Email').fill(SALES.email)
  await page.getByLabel('Mật khẩu').fill(SALES.password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/cong-ty$/)
}

async function addContact(page: Page, name: string, title: string): Promise<void> {
  await page.getByRole('button', { name: 'Thêm người liên hệ' }).click()

  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Tên').fill(name)
  await dialog.getByLabel('Chức danh').fill(title)
  await dialog.getByRole('button', { name: 'Lưu' }).click()

  await expect(page.getByText(name)).toBeVisible()
}

/** The board column, addressed by the label a screen reader would read out. */
function columnFor(page: Page, stageLabel: string) {
  return page.getByRole('region', { name: stageLabel })
}

function cardFor(page: Page, opportunityName: string) {
  return page.getByRole('article').filter({ hasText: opportunityName })
}

/**
 * Moves one card one column to the right, over the keyboard: focus the handle, `Space` to lift,
 * `ArrowRight` to move, `Space` to drop.
 *
 * Two things make it reliable, and both come from the measurement in ADR-0020:
 *
 *  - the keys are SPACED. `KeyboardSensor` initialises the drag coordinates after `Space`
 *    lifts the card, and an arrow key fired in the same tick is swallowed. At 0ms the card
 *    does not move at all; the product is fine, the harness is not.
 *  - each step waits on dnd-kit's own `aria-live` announcements instead of a fixed sleep. That
 *    region is also how a keyboard user knows where they are, so waiting on it exercises the
 *    thing rather than working around it.
 *
 * Lifting a card announces "moved over" its OWN slot straight away, so the arrow key is waited
 * out by watching that line CHANGE rather than by matching a particular droppable: an arrow
 * key can land on the target column or on a card already sitting in it, and both are correct
 * (`stageOf` in `stage-board.tsx` resolves the two to the same stage).
 */
async function dragOneColumnRight(page: Page, opportunityName: string): Promise<void> {
  /**
   * dnd-kit's OWN live region, not "the status role on the page". This spec runs with the AI
   * switched off, which is exactly when the "AI đang tắt" banner renders — and that banner is a
   * status too, so a bare `getByRole('status')` matches two elements and the drag assertions fail
   * on a board that is working perfectly.
   */
  const announcements = page.locator('[id^="DndLiveRegion"]')
  const handle = page.getByRole('button', {
    name: new RegExp(`^Kéo cơ hội ${escapeForRegExp(opportunityName)},`),
  })

  await handle.focus()

  await page.keyboard.press('Space', { delay: KEY_SPACING_MS })
  await expect(announcements).toContainText(/moved over droppable area/i)
  const afterLift = await announcements.innerText()

  await page.keyboard.press('ArrowRight', { delay: KEY_SPACING_MS })
  await expect(announcements).not.toHaveText(afterLift)

  await page.keyboard.press('Space', { delay: KEY_SPACING_MS })
  await expect(announcements).toContainText(/dropped over droppable area/i)
}

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

import { expect, test, type Page } from '@playwright/test'

/**
 * The tour must never start on its own.
 *
 * This spec exists because of a design that was considered and rejected: running the tour
 * automatically on a user's first visit, suppressed in tests by a `localStorage` flag. That
 * flag had nowhere to live — `playwright.config.ts` sets no `storageState` and
 * `e2e/global-setup.ts` only reseeds, so `localStorage` is empty in EVERY spec and the tour
 * would have opened an overlay over all of them, blocking the first click of each.
 *
 * So there are exactly two ways in, both requiring a person: the header button and `?tour=1`.
 * The first assertion below is a NEGATIVE one, and it is the point of the file — it is what
 * stops someone adding auto-run later "to be friendly" without anyone noticing.
 */

const SALES = { email: 'sales@hblab.vn', password: 'sales123' }

async function login(page: Page) {
  await page.goto('/dang-nhap')
  await page.getByLabel('Email').fill(SALES.email)
  await page.getByLabel('Mật khẩu').fill(SALES.password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/cong-ty$/)
}

/** driver.js marks the page while it is running; nothing else in the app uses this class. */
function overlay(page: Page) {
  return page.locator('.driver-active-element, .driver-popover')
}

test('mở màn bình thường thì không có tour nào tự chạy', async ({ page }) => {
  await login(page)
  await page.goto('/cong-ty')

  await expect(overlay(page)).toHaveCount(0)

  // Not merely "no overlay in the DOM" — the screen has to be usable. An overlay that exists
  // but is invisible would still eat this click.
  await page.getByRole('button', { name: 'Thêm công ty' }).click()
  await expect(page.getByRole('dialog', { name: 'Thêm công ty' })).toBeVisible()
})

test('tham số ?tour=1 mở tour, Escape đóng và trả lại quyền bấm', async ({ page }) => {
  await login(page)
  await page.goto('/cong-ty?tour=1')

  await expect(page.locator('.driver-popover')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.locator('.driver-popover')).toHaveCount(0)

  // The page works again afterwards — a tour that leaves the screen inert is worse than none.
  await page.getByRole('button', { name: 'Thêm công ty' }).click()
  await expect(page.getByRole('dialog', { name: 'Thêm công ty' })).toBeVisible()
})

test('nút Xem hướng dẫn trên header mở lại tour bất cứ lúc nào', async ({ page }) => {
  await login(page)
  await page.goto('/cong-ty')

  await page.getByRole('button', { name: 'Xem hướng dẫn' }).click()
  await expect(page.locator('.driver-popover')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.locator('.driver-popover')).toHaveCount(0)
})

import { expect, test } from '@playwright/test'

/**
 * The demo tab is a convenience wrapper around the REAL login flow — same endpoint, same
 * cookie, same middleware. So the assertions here are about identity, not plumbing: pressing
 * a sales button must land in the app as that sales, pressing the admin button must land as
 * someone who can see the admin nav, and the password tab must remain fully usable.
 */

test('tab demo: bấm một tài khoản sales là vào thẳng ứng dụng', async ({ page, context }) => {
  await page.goto('/dang-nhap')

  await page.getByRole('tab', { name: 'Tài khoản demo' }).click()
  // Vân — one of the five sales people `Account.csv` names in its `sales_owner` column.
  await page.getByRole('button', { name: /Vân/ }).click()

  await expect(page).toHaveURL(/\/cong-ty$/)
  await expect(page.getByRole('heading', { name: 'Công ty' })).toBeVisible()

  // The shortcut must produce the same real session a typed login does.
  const session = (await context.cookies()).find((cookie) => cookie.name === 'crm_session')
  expect(session?.httpOnly).toBe(true)
})

test('tab demo: tài khoản quản trị vào được khu quản trị', async ({ page }) => {
  await page.goto('/dang-nhap')

  await page.getByRole('tab', { name: 'Tài khoản demo' }).click()
  await page.getByRole('button', { name: /Quản trị/ }).click()

  await expect(page).toHaveURL(/\/cong-ty$/)
  // Admin-only nav entry: proof the session carries the admin role, not just any session.
  await expect(page.getByRole('link', { name: 'Quản trị' }).first()).toBeVisible()
})

test('tab mật khẩu vẫn nguyên vẹn sau khi tab demo xuất hiện', async ({ page }) => {
  await page.goto('/dang-nhap')

  // Flip to demo and back: the password form must come back intact, not reset into a stub.
  await page.getByRole('tab', { name: 'Tài khoản demo' }).click()
  await page.getByRole('tab', { name: 'Mật khẩu' }).click()

  await page.getByLabel('Email').fill('sales@hblab.vn')
  await page.getByLabel('Mật khẩu').fill('hackathon#1')
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/cong-ty$/)
})

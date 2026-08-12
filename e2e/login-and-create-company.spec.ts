import { expect, test } from '@playwright/test'

/**
 * The walking skeleton's end-to-end proof: browser → Caddy → Next → API → Postgres.
 *
 * It runs against the SIMULATED PRODUCTION STACK on :8080 (`pnpm start`), never against
 * `next dev`. Spec 7.3 asks for a production build, and a dev server hides exactly the two
 * failures this suite exists to catch: a missing `.next/static` in the standalone output,
 * and a cookie that never survives the proxy hop.
 *
 * Step 4 (reload and still be logged in) is the one that is easy to leave out and the one
 * that actually proves the session is a real httpOnly cookie rather than React state.
 */

const SALES = { email: 'sales@hblab.vn', password: 'sales123' }
const NEW_COMPANY = 'Cty Kiem Thu'

test('đăng nhập, giữ phiên qua reload, tạo công ty, đăng xuất', async ({ page }) => {
  // 1 — an anonymous visitor never sees the application shell.
  await page.goto('/')
  await expect(page).toHaveURL(/\/dang-nhap$/)

  // 2 — a wrong password fails IN PLACE: the error is visible and the URL does not move.
  await page.getByLabel('Email').fill(SALES.email)
  await page.getByLabel('Mật khẩu').fill('sai-mat-khau')
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page).toHaveURL(/\/dang-nhap$/)

  // 3 — the real credentials land on the company list.
  await page.getByLabel('Mật khẩu').fill(SALES.password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/cong-ty$/)
  await expect(page.getByRole('heading', { name: 'Công ty' })).toBeVisible()

  // 4 — reload. React state is gone; only a real cookie can keep the user in.
  await page.reload()
  await expect(page).toHaveURL(/\/cong-ty$/)
  await expect(page.getByRole('heading', { name: 'Công ty' })).toBeVisible()

  // 5 — a new company written through the UI shows up in the table it was written into.
  await page.getByRole('button', { name: 'Thêm công ty' }).click()
  await page.getByLabel('Tên công ty').fill(NEW_COMPANY)
  await page.getByLabel('Ngành').fill('Kiểm thử')
  await page.getByLabel('Loại hình').selectOption('it_solution')
  await page.getByRole('button', { name: 'Lưu' }).click()
  await expect(page.getByRole('cell', { name: NEW_COMPANY })).toBeVisible()

  // 6 — logging out returns to the login screen.
  await page.getByRole('button', { name: 'Đăng xuất' }).click()
  await expect(page).toHaveURL(/\/dang-nhap$/)
})

test('xoá cookie phiên rồi tải lại thì bị đá về trang đăng nhập', async ({ page, context }) => {
  await page.goto('/dang-nhap')
  await page.getByLabel('Email').fill(SALES.email)
  await page.getByLabel('Mật khẩu').fill(SALES.password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/cong-ty$/)

  // Same thing a judge does by hand in DevTools → Application → Cookies → delete.
  await context.clearCookies()
  await page.reload()
  await expect(page).toHaveURL(/\/dang-nhap$/)
})

test('cookie phiên có cờ HttpOnly', async ({ page, context }) => {
  await page.goto('/dang-nhap')
  await page.getByLabel('Email').fill(SALES.email)
  await page.getByLabel('Mật khẩu').fill(SALES.password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/cong-ty$/)

  const session = (await context.cookies()).find((cookie) => cookie.name === 'crm_session')
  expect(session, 'không tìm thấy cookie phiên crm_session').toBeDefined()
  // Without HttpOnly any script on the page could read the session — acceptance point 2.
  expect(session?.httpOnly).toBe(true)
})

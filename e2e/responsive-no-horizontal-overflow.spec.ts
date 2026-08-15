import { expect, test } from '@playwright/test'

const SALES = { email: 'sales@hblab.vn', password: 'sales123' }
const ROUTES = ['/cong-ty', '/co-hoi', '/tong-quan', '/hang-doi', '/dang-theo-doi', '/huong-dan', '/thong-bao']

for (const width of [375, 1440]) {
  test(`không tràn ngang ở ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/dang-nhap')
    await page.getByLabel('Email').fill(SALES.email)
    await page.getByLabel('Mật khẩu').fill(SALES.password)
    await page.getByRole('button', { name: 'Đăng nhập' }).click()
    await expect(page).toHaveURL(/\/cong-ty$/)

    for (const route of ROUTES) {
      await page.goto(route)
      await page.waitForTimeout(400)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow, `${route} tràn ngang ${overflow}px`).toBeLessThanOrEqual(0)
    }
  })
}

test('công ty chi tiết: một cột ở 375, hai cột ở 1440', async ({ page }) => {
  await page.goto('/dang-nhap')
  await page.getByLabel('Email').fill(SALES.email)
  await page.getByLabel('Mật khẩu').fill(SALES.password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await page.getByRole('link', { name: 'SAS' }).click()
  await expect(page.getByRole('heading', { name: 'Dòng thời gian' })).toBeVisible()

  for (const [width, expected] of [[375, 1], [1440, 2]] as const) {
    await page.setViewportSize({ width, height: 900 })
    await page.waitForTimeout(300)
    const columns = await page
      .locator('div.grid.gap-6')
      .first()
      .evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(' ').length)
    expect(columns, `ở ${width}px`).toBe(expected)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, `chi tiết công ty tràn ngang ${overflow}px ở ${width}px`).toBeLessThanOrEqual(0)
  }
})

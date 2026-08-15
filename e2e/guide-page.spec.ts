import { expect, test, type Page } from '@playwright/test'

/**
 * `/huong-dan` — the page that answers "what is this system allowed to do on its own".
 *
 * It exists for rule 7 of CLAUDE.md: anyone on the team has to be able to defend every AI
 * output the product ships, and round two asks about exactly that. A page whose content has
 * drifted away from `docs/ontology.md` is worse than no page, because it teaches the wrong
 * answer confidently — so this spec checks the four zones are all present and that every link
 * out of it actually resolves.
 */

const SALES = { email: 'sales@hblab.vn', password: 'hackathon#1' }

const ZONES = [
  'Vùng 1 · Tự do',
  'Vùng 2 · Chờ duyệt',
  'Vùng 3 · Tự ghi, hoàn tác được',
  'Vùng 4 · Tự ghi, không hỏi ai',
]

async function login(page: Page) {
  await page.goto('/dang-nhap')
  await page.getByLabel('Email').fill(SALES.email)
  await page.getByLabel('Mật khẩu').fill(SALES.password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/cong-ty$/)
}

test('trang hướng dẫn có đủ bốn vùng tự chủ, vùng cấm và nút tắt AI', async ({ page }) => {
  await login(page)
  await page.goto('/huong-dan')

  for (const zone of ZONES) {
    await expect(page.getByRole('heading', { name: zone })).toBeVisible()
  }

  // The forbidden list is the half people skip when they explain the product, and it is the
  // half that proves the boundary is real rather than aspirational.
  await expect(page.getByRole('heading', { name: /Cấm tuyệt đối/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Tắt sạch AI/ })).toBeVisible()
})

test('mọi link trên trang hướng dẫn đều tới nơi có thật', async ({ page }) => {
  await login(page)
  await page.goto('/huong-dan')

  const links = page.locator('main a[href^="/"]')
  const count = await links.count()
  expect(count).toBeGreaterThan(0)

  const seen = new Set<string>()
  for (let index = 0; index < count; index += 1) {
    const href = await links.nth(index).getAttribute('href')
    if (!href || seen.has(href)) continue
    seen.add(href)

    /**
     * The guard against writing links to screens that do not exist yet — `/quan-tri` is the
     * live example: it ships with the admin dashboard, and until then a link to it would send
     * a judge to a 404 from the one page whose whole job is to explain the system.
     */
    const response = await page.goto(href)
    expect(response?.status(), `link ${href}`).toBeLessThan(400)
    await expect(page.getByText('This page could not be found')).toHaveCount(0)
    await page.goBack()
  }
})

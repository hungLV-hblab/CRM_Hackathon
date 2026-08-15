import { expect, test, type Page } from '@playwright/test'

/**
 * The application shell: one navigation surface every screen shares.
 *
 * Before it existed, each of the seven routes drew its own header and hand-rolled its own
 * "← Công ty" link, so moving between screens meant typing a URL. The assertions below are
 * about REACHABILITY, not decoration — a judge with a keyboard and no URL bar must be able to
 * get to every screen.
 *
 * The nav item list is read FROM THE DOM rather than hard-coded here. Two more items are
 * known to be coming (Hướng dẫn with the guide page, Quản trị with the admin dashboard), and
 * a spec that counts to five would go red the day either lands — failing for growth rather
 * than for breakage, which teaches the team to stop trusting it.
 */

const SALES = { email: 'sales@hblab.vn', password: 'hackathon#1' }

async function login(page: Page) {
  await page.goto('/dang-nhap')
  await page.getByLabel('Email').fill(SALES.email)
  await page.getByLabel('Mật khẩu').fill(SALES.password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/cong-ty$/)
}

/** The sidebar on desktop; the same list is what the mobile drawer renders. */
function sidebarNav(page: Page) {
  return page.getByRole('navigation', { name: 'Điều hướng chính' })
}

test('mỗi màn tới được bằng đúng một cú bấm từ thanh bên', async ({ page }) => {
  await login(page)

  const links = sidebarNav(page).getByRole('link')
  const count = await links.count()
  // A shell with one or two items is a shell that silently lost its list.
  expect(count).toBeGreaterThanOrEqual(5)

  const targets: { href: string; label: string }[] = []
  for (let index = 0; index < count; index += 1) {
    const link = links.nth(index)
    targets.push({
      href: (await link.getAttribute('href')) ?? '',
      label: (await link.innerText()).trim(),
    })
  }

  for (const target of targets) {
    // Always start from the same screen, so "one click away" means one click from anywhere,
    // not one click from wherever the previous iteration happened to leave us.
    await page.goto('/cong-ty')
    await sidebarNav(page).getByRole('link', { name: target.label }).click()
    await expect(page).toHaveURL(new RegExp(`${target.href}$`))

    /**
     * A nav item pointing at a route nobody built yet renders Next's 404 INSIDE the shell,
     * which reads as a broken shell rather than as a missing feature. This is the assertion
     * that catches it — it is why the admin item stays out of the list until its screen ships.
     */
    await expect(page.getByText('This page could not be found')).toHaveCount(0)

    // The current item marks itself for a screen reader, not only for the eye.
    await expect(
      sidebarNav(page).getByRole('link', { name: target.label }),
    ).toHaveAttribute('aria-current', 'page')
  }
})

test('trang đăng nhập không có thanh bên', async ({ page }) => {
  // The negative assertion, and the one easiest to forget: a login screen wrapped in the
  // application shell offers navigation to someone who has not authenticated yet.
  await page.goto('/dang-nhap')
  await expect(sidebarNav(page)).toHaveCount(0)
})

test('ở 375px thanh bên ẩn đi và mở lại được bằng nút hamburger', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await login(page)

  await expect(sidebarNav(page)).toBeHidden()

  await page.getByRole('button', { name: 'Mở điều hướng' }).click()
  const drawerNav = page.getByRole('dialog').getByRole('navigation', { name: 'Điều hướng chính' })
  await expect(drawerNav).toBeVisible()

  await drawerNav.getByRole('link', { name: 'Tổng quan' }).click()
  await expect(page).toHaveURL(/\/tong-quan$/)
})

test('mọi mục điều hướng có vùng chạm ít nhất 44px', async ({ page }) => {
  await login(page)

  const links = sidebarNav(page).getByRole('link')
  for (let index = 0; index < (await links.count()); index += 1) {
    const box = await links.nth(index).boundingBox()
    // Sales opens this on a phone between meetings; 44px is the smallest target a thumb hits
    // reliably. shadcn's own default is h-9 (36px), so this has to be asserted, not assumed.
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
  }
})

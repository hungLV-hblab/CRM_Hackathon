import { resolve } from 'node:path'

import { expect, test, type Page } from '@playwright/test'

/**
 * Spec 7 condition 5 — nạp dữ liệu BTC qua giao diện, không gõ tay, không sửa mã. Nạp lại đúng
 * file thì hệ thống về đúng trạng thái ban đầu.
 *
 * Uploads the SAME zip `pnpm seed` already loaded (deterministic company IDs from
 * `deterministicUuid`), so this spec's action is state-neutral for every spec that runs after it
 * in the same `workers: 1` run — re-uploading restores the identical dataset, it does not swap
 * in a different one.
 *
 * Runs against the compose stack on :8080 (`pnpm start`), same as every other e2e spec.
 */

const ADMIN = { email: 'admin@hblab.vn', password: 'admin123' }
const ZIP_PATH = resolve(__dirname, '../packages/db/seed-assets/hackathon-1-data.zip')

async function login(page: Page): Promise<void> {
  await page.goto('/dang-nhap')
  await page.getByLabel('Email').fill(ADMIN.email)
  await page.getByLabel('Mật khẩu').fill(ADMIN.password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/tong-quan$|\/cong-ty$/)
}

test('admin nạp lại dữ liệu qua giao diện — xác nhận, tóm tắt đúng, và idempotent', async ({
  page,
}) => {
  await login(page)
  await page.goto('/quan-tri')
  await expect(page.getByRole('heading', { name: 'Quản trị' })).toBeVisible()

  // 1 — chọn file, modal xác nhận bật lên, chưa gọi API cho tới khi bấm xác nhận.
  await page.getByRole('button', { name: 'Chọn file zip…' }).click()
  await page.setInputFiles('input[type="file"]', ZIP_PATH)
  await expect(page.getByRole('heading', { name: 'Nạp lại toàn bộ dữ liệu?' })).toBeVisible()
  await expect(page.getByText('hackathon-1-data.zip')).toBeVisible()

  // 2 — xác nhận, tóm tắt đúng số liệu thật.
  await page.getByRole('button', { name: 'Xoá và nạp lại' }).click()
  await expect(page.getByText('Đã nạp xong:')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('25 công ty')).toBeVisible()
  await expect(page.getByText('38 liên hệ')).toBeVisible()
  await expect(page.getByText('15 cơ hội')).toBeVisible()

  // 3 — dữ liệu thật hiện trên giao diện, không chỉ trong tóm tắt.
  await page.goto('/cong-ty')
  await expect(page.getByText('Genky')).toBeVisible()

  // 4 — nạp lại đúng file lần nữa: cùng kết quả, không cộng dồn (I-14).
  await page.goto('/quan-tri')
  await page.getByRole('button', { name: 'Chọn file zip…' }).click()
  await page.setInputFiles('input[type="file"]', ZIP_PATH)
  await page.getByRole('button', { name: 'Xoá và nạp lại' }).click()
  await expect(page.getByText('Đã nạp xong:')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('25 công ty')).toBeVisible()
})

test('sales không thấy được panel nạp dữ liệu', async ({ page }) => {
  await page.goto('/dang-nhap')
  await page.getByLabel('Email').fill('sales@hblab.vn')
  await page.getByLabel('Mật khẩu').fill('sales123')
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await page.goto('/quan-tri')

  await expect(page.getByRole('button', { name: 'Chọn file zip…' })).not.toBeVisible()
})

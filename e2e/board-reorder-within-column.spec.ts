import { expect, test, type Locator, type Page } from '@playwright/test'

/**
 * Same-column reorder on the board, over the keyboard — the same dnd-kit path the pointer
 * uses, driven the way T-1 drives stage moves (spaced keys, waits on dnd-kit's own
 * `aria-live` region; the reasoning for both lives on `dragOneColumnRight` in the T-1 spec).
 *
 * The imported data puts three deals in the "Tạm dừng" column, so this spec reads their order,
 * moves one with an arrow key, and — the actual point — RELOADS before asserting again: an
 * optimistic cache can fake the first assertion, only the database can pass the second.
 */

/**
 * Signed in as Linh, and that is not incidental (ADR-0046): `Account.csv` gives her C32 and C33,
 * which is every company holding a paused deal. One Sales session therefore has the whole column,
 * so the spec measures the reorder it is named after rather than the ownership boundary.
 */
const SALES = { email: 'sales4@hblab.vn', password: 'hackathon#1' }

/** ≥50ms between key presses, from the measurement recorded in ADR-0020. */
const KEY_SPACING_MS = 80

/**
 * The column as the seed deals it: `board_order` follows the order `Opps.csv` lists the deals,
 * which is why the starting arrangement below is an assertion rather than a guess.
 */
const FIRST = 'Bulox - Electrical Monitoring'
const SECOND = 'Jardine Restaurant Group'
const THIRD = 'Phúc Long Mobile App'

test('kéo thẻ lên đầu cột bằng bàn phím, thứ tự sống qua reload', async ({ page }) => {
  await login(page)
  await page.goto('/co-hoi')

  const column = page.getByRole('region', { name: 'Tạm dừng' })
  await expectColumnOrder(column, [FIRST, SECOND, THIRD])

  await liftAndPress(page, SECOND, 'ArrowUp')
  await expectColumnOrder(column, [SECOND, FIRST, THIRD])

  // The reload is the assertion that matters: it throws away the optimistic cache and asks
  // the database. Before `board_order` existed this line was unpassable — there was nothing
  // on the server for the new order to live in.
  await page.reload()
  await expectColumnOrder(column, [SECOND, FIRST, THIRD])
})

test('kéo thẻ xuống cũng giữ được sau reload — hai chiều, không chỉ một', async ({
  page,
}) => {
  await login(page)
  await page.goto('/co-hoi')

  const column = page.getByRole('region', { name: 'Tạm dừng' })
  // Whatever the previous test left on top moves down one, so this spec stays independent of
  // run order within the file.
  const first = (await column.getByRole('article').first().locator('p').first().innerText()).trim()

  await liftAndPress(page, first, 'ArrowDown')
  await page.reload()

  // One press moves one position, so the assertion names that position rather than "the end" —
  // the column holds three cards, and "it went somewhere lower" would pass on a no-op too.
  await expect(column.getByRole('article').nth(1)).toContainText(first)
})

async function login(page: Page): Promise<void> {
  await page.goto('/dang-nhap')
  await page.getByLabel('Email').fill(SALES.email)
  await page.getByLabel('Mật khẩu').fill(SALES.password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/cong-ty$/)
}

/** Top-to-bottom card order of one column — the reading order Sales arranged. */
async function expectColumnOrder(column: Locator, names: string[]): Promise<void> {
  const cards = column.getByRole('article')
  await expect(cards).toHaveCount(names.length)
  for (const [index, name] of names.entries()) {
    await expect(cards.nth(index)).toContainText(name)
  }
}

/** Focus a card's handle, Space to lift, one arrow, Space to drop — waits on aria-live. */
async function liftAndPress(page: Page, opportunityName: string, key: string): Promise<void> {
  const announcements = page.locator('[id^="DndLiveRegion"]')
  const handle = page.getByRole('button', {
    name: new RegExp(`^Kéo cơ hội ${escapeForRegExp(opportunityName)},`),
  })

  await handle.focus()

  await page.keyboard.press('Space', { delay: KEY_SPACING_MS })
  await expect(announcements).toContainText(/moved over droppable area/i)
  const afterLift = await announcements.innerText()

  await page.keyboard.press(key, { delay: KEY_SPACING_MS })
  await expect(announcements).not.toHaveText(afterLift)

  await page.keyboard.press('Space', { delay: KEY_SPACING_MS })
  await expect(announcements).toContainText(/dropped over droppable area/i)
}

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

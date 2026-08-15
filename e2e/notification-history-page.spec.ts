import { expect, test, type Page } from '@playwright/test'
import { config } from 'dotenv'
import { resolve } from 'node:path'
import { Pool } from 'pg'

/**
 * `/thong-bao` as its own screen: what a person can tell apart, and what they can still reach.
 *
 * Three things worth proving in a browser, none of which a service test can see:
 *   - a notice marked seen STAYS on the page, wearing its state in words rather than only in
 *     colour (ontology 3.3, and rule 2 of the design guidelines);
 *   - the undo is still reachable AFTER the notice is marked seen — the exact reason this route
 *     exists at all (ADR-0027), since marking it seen removes it from the strip on the deal board;
 *   - "Đánh dấu tất cả đã xem" clears the page and then stops offering itself.
 *
 * ITS OWN COMPANY, ITS OWN DEAL, ITS OWN EVENT. The first draft drove the watch cycle over a
 * company another spec had already claimed and broke it: on a database this suite shares, a spec
 * saying "no other file reads this company" is a contract, not a note. Everything below is written by
 * the harness, the way T-9 seeds its pending suggestion: what this file measures is the history
 * screen, not how a notice comes to exist.
 */

const SALES = { email: 'sales@hblab.vn', password: 'hackathon#1' }
/** Seed user `sales@hblab.vn`, so the fixtures below belong to the account that signs in. */
const SALES_ID = '11111111-1111-4111-8111-111111111111'

const COMPANY_ID = 'bbbbbbbb-0007-4000-8000-000000000001'
const OPPORTUNITY_ID = 'bbbbbbbb-0007-4000-8000-000000000002'
const OBSERVATION_ID = 'bbbbbbbb-0007-4000-8000-000000000003'
const CLAIM_ID = 'bbbbbbbb-0007-4000-8000-000000000004'
const EVENT_ID = 'bbbbbbbb-0007-4000-8000-000000000005'

const COMPANY_NAME = 'Cty Lich Su Thong Bao'
const UNDOABLE_MESSAGE = 'He thong da dat Viec tiep theo cho deal Lich Su Thong Bao'
const PLAIN_MESSAGE = 'He thong da them mot muc dong thoi gian cho Lich Su Thong Bao'

test.describe.configure({ mode: 'serial' })

function ownerPool(): Pool {
  config({ path: resolve(__dirname, '../.env') })
  const connectionString = process.env.DATABASE_URL_OWNER
  if (!connectionString) {
    throw new Error('Missing DATABASE_URL_OWNER. Copy .env.example to .env and fill it in.')
  }
  return new Pool({ connectionString })
}

/**
 * Two notices for this account: one carrying a live undo window, one plain. Fixed ids, cleared
 * first, so running the suite twice does not accumulate copies.
 */
async function seedHistory(): Promise<void> {
  const pool = ownerPool()
  const quote = 'Doi ngu mo rong sang thi truong moi trong quy toi.'
  try {
    /**
     * Only THIS file's two messages. An earlier draft cleared every notice belonging to the
     * account, which is other specs' data on a shared database.
     */
    await pool.query('DELETE FROM notifications WHERE message = ANY($1)', [
      [UNDOABLE_MESSAGE, PLAIN_MESSAGE],
    ])
    await pool.query('DELETE FROM auto_next_step_events WHERE id = $1', [EVENT_ID])
    await pool.query('DELETE FROM claims WHERE id = $1', [CLAIM_ID])
    await pool.query('DELETE FROM observations WHERE id = $1', [OBSERVATION_ID])
    await pool.query('DELETE FROM opportunities WHERE id = $1', [OPPORTUNITY_ID])
    await pool.query('DELETE FROM companies WHERE id = $1', [COMPANY_ID])

    await pool.query(
      `INSERT INTO companies (id, name, industry, company_type, owner_id)
       VALUES ($1, $2, 'Kiem thu lich su', 'it_solution', $3)`,
      [COMPANY_ID, COMPANY_NAME, SALES_ID],
    )
    await pool.query(
      `INSERT INTO opportunities (id, company_id, name, stage, next_step_text, next_step_source)
       VALUES ($1, $2, 'Deal Lich Su Thong Bao', 'negotiation', 'Goi lai khach', 'system')`,
      [OPPORTUNITY_ID, COMPANY_ID],
    )
    await pool.query(
      `INSERT INTO observations (id, company_id, source_url, raw_content, extractor_version,
                                 content_hash, fetch_status)
       VALUES ($1, $2, 'https://lichsu.example.com', $3, 'p7-harness', 'p7-harness-hash', 'ok')`,
      [OBSERVATION_ID, COMPANY_ID, quote],
    )
    await pool.query(
      `INSERT INTO claims (id, company_id, observation_id, statement, signal_type, confidence,
                           quote_text, quote_start, quote_end, trigger_context)
       VALUES ($1, $2, $3, 'Doi ngu mo rong', 'expansion', 'likely', $4, 0, $5, 'watch_cycle')`,
      [CLAIM_ID, COMPANY_ID, OBSERVATION_ID, quote, quote.length],
    )
    await pool.query(
      `INSERT INTO auto_next_step_events (id, opportunity_id, claim_id, new_text, new_due_date,
                                          previous_text, previous_source, undo_deadline)
       VALUES ($1, $2, $3, 'Goi lai khach', CURRENT_DATE + 3, NULL, NULL,
               now() + interval '7 days')`,
      [EVENT_ID, OPPORTUNITY_ID, CLAIM_ID],
    )
    await pool.query(
      `INSERT INTO notifications (user_id, message, auto_event_id, created_at)
       VALUES ($1, $2, $3, now())`,
      [SALES_ID, UNDOABLE_MESSAGE, EVENT_ID],
    )
    await pool.query(
      `INSERT INTO notifications (user_id, message, created_at)
       VALUES ($1, $2, now() - interval '1 minute')`,
      [SALES_ID, PLAIN_MESSAGE],
    )
  } finally {
    await pool.end()
  }
}

/**
 * Everything this file created, removed again — in reverse dependency order.
 *
 * Not optional housekeeping. The suite runs against ONE seeded database with a single worker, so
 * a company left behind is an extra card on the deal board for every spec that follows; T-1 drags
 * a card across three columns and went red on exactly that.
 */
async function clearHistoryFixtures(): Promise<void> {
  const pool = ownerPool()
  try {
    await pool.query('DELETE FROM notifications WHERE message = ANY($1)', [
      [UNDOABLE_MESSAGE, PLAIN_MESSAGE],
    ])
    await pool.query('DELETE FROM auto_next_step_events WHERE id = $1', [EVENT_ID])
    await pool.query('DELETE FROM claims WHERE id = $1', [CLAIM_ID])
    await pool.query('DELETE FROM observations WHERE id = $1', [OBSERVATION_ID])
    await pool.query('DELETE FROM opportunities WHERE id = $1', [OPPORTUNITY_ID])
    await pool.query('DELETE FROM companies WHERE id = $1', [COMPANY_ID])
  } finally {
    await pool.end()
  }
}

test.beforeAll(async () => {
  await seedHistory()
})

test.afterAll(async () => {
  await clearHistoryFixtures()
})

async function login(page: Page): Promise<void> {
  await page.goto('/dang-nhap')
  await page.getByLabel('Email').fill(SALES.email)
  await page.getByLabel('Mật khẩu').fill(SALES.password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/cong-ty$/, { timeout: 30_000 })
}

test('thông báo đã xem vẫn ở lại trang, mang trạng thái bằng CHỮ', async ({ page }) => {
  await login(page)
  await page.goto('/thong-bao')

  const row = page.getByTestId('notification-row').filter({ hasText: PLAIN_MESSAGE }).first()
  await expect(row).toHaveAttribute('data-read', 'false')

  const before = await page.getByTestId('notification-row').count()
  await row.getByRole('button', { name: 'Đã xem' }).click()

  // Still there — marked, not deleted. The count is asserted too: a row that vanished would
  // also satisfy "no longer unread", and that is the failure this screen exists to prevent.
  await expect(page.getByTestId('notification-row')).toHaveCount(before)
  await expect(row).toHaveAttribute('data-read', 'true')
  // In words, so a greyscale printout and a screen reader both get it.
  await expect(row).toContainText('Đã xem')
})

test('cửa sổ hoàn tác vẫn bấm được sau khi thông báo đã được đánh dấu đã xem', async ({ page }) => {
  await login(page)
  await page.goto('/thong-bao')

  const row = page.getByTestId('notification-row').filter({ hasText: UNDOABLE_MESSAGE }).first()
  await row.getByRole('button', { name: 'Đã xem' }).click()
  await expect(row).toHaveAttribute('data-read', 'true')

  /**
   * The point of the route in one assertion: the notice is now hidden from the strip on the deal
   * board, and the undo has to stay reachable here for the rest of the seven days.
   */
  await expect(row.getByRole('button', { name: 'Hoàn tác' })).toBeVisible()
})

test('Đánh dấu tất cả đã xem dọn hết trang rồi tự tắt', async ({ page }) => {
  await seedHistory()
  await login(page)
  await page.goto('/thong-bao')

  const markAll = page.getByRole('button', { name: 'Đánh dấu tất cả đã xem' })
  await expect(markAll).toBeEnabled()
  await markAll.click()

  // Every row reads as seen, and the button stops offering work it will not do.
  const rows = page.getByTestId('notification-row')
  await expect(rows.filter({ hasText: 'Đã xem' })).toHaveCount(await rows.count())
  await expect(markAll).toBeDisabled()
})

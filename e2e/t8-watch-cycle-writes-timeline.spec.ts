import { expect, test } from '@playwright/test'

import {
  resetReadHistory,
  setSnapshotVariant,
  setWatchCycleSeconds,
  systemEntriesFor,
  waitFor,
  watchCycleRuns,
} from './watch-cycle-scenario'

/**
 * T-8 — autonomy zone 4 on the real stack: the watch cycle adding timeline entries with NOBODY
 * pressing anything.
 *
 * This is the only acceptance check whose subject is a background process, so it is also the only
 * one where the integration suite cannot stand in. Those tests drive `scan()` by hand against a
 * fake clock; what they cannot show is that the WORKER CONTAINER is alive, reads its cadence out
 * of the database, and writes to Sales' timeline on its own. A missing provider in `WatchModule`
 * leaves every unit test green and produces a container that restarts forever — a failure shaped
 * almost exactly like the `unref()` restart loop of ADR-0011.
 *
 * Runs against the compose stack on :8080 (`pnpm start`), like the rest of the suite. Bring it up
 * with `docker compose up --build` first: phase 4 lost two runs to a web container that was
 * seventeen hours stale, and the results looked like product bugs.
 *
 * ── The scenario, and why each piece of it is set explicitly ─────────────────────────────
 * Three watched companies (Sakura · Nimbus · Kitefin, from the seed). The read history of all
 * three is wiped and all three are pointed at `before`, which carries no news; one cycle later
 * that is the BASELINE — every source has been read and nothing was newsworthy. Then two of them
 * are flipped to `after`, whose pages announce a funding round and an expansion.
 *
 * So the expected outcome is sharper than "some entries appeared": read 3, of which 2 changed,
 * of which 2 produced an entry, and the third stays silent because I-3 sees the same hash. That
 * third company is what makes this a test rather than a demonstration — a build that wrote an
 * entry per cycle regardless would pass a check that only counted new rows.
 */

const SALES = { email: 'sales@hblab.vn', password: 'sales123' }

const WATCHED = ['Sakura Manufacturing KK', 'Nimbus Cloud Solutions', 'Kitefin Analytics']
/** The two whose source changes. Their `after` pages carry a funding item and an expansion. */
const CHANGED = ['Sakura Manufacturing KK', 'Kitefin Analytics']
/** Stays on `before` — read, unchanged, and therefore silent. */
const UNCHANGED = 'Nimbus Cloud Solutions'

const CYCLE_SECONDS = 10
/**
 * Generous about WHEN inside the window, strict about the window. At a 10s cadence with several
 * model calls per cycle, a cycle overrunning its own period is the normal state — I-10 logs a
 * skipped tick and carries on — so "two cycles" is a bound on rounds, not on seconds.
 */
const TWO_CYCLES_MS = 120_000

/**
 * Serial, and with a timeout measured in cycles rather than in Playwright's default 30s. Every
 * wait in this file is a wait on a BACKGROUND PROCESS that calls a model several times per round,
 * which is a different order of magnitude from a click waiting for a re-render.
 */
test.describe.configure({ mode: 'serial', timeout: TWO_CYCLES_MS + 60_000 })

test.beforeAll(async () => {
  // Hook timeouts are separate from test timeouts, and the default would cut the baseline wait off
  // mid-cycle — which reads as "the worker is dead" when it is merely mid-round.
  test.setTimeout(TWO_CYCLES_MS + 60_000)
  await setWatchCycleSeconds(CYCLE_SECONDS)
  await resetReadHistory(WATCHED, 'before')

  // Baseline: wait until the worker has read all three at `before`. Flipping the two sources
  // before this point would leave "was it new content or the first read ever?" unanswerable.
  await waitFor(
    'the worker to read all three watched companies once',
    () => watchCycleRuns(),
    (runs) => runs.some((run) => run.skippedReason === null && run.companiesScanned >= 3),
    TWO_CYCLES_MS,
  )
})

test.afterAll(async () => {
  test.setTimeout(30_000)
  /**
   * Back to 60s, without fail. Left at 10 it would leave a worker re-reading five sources every
   * ten seconds behind every later run of the suite, calling the model each time.
   */
  await setWatchCycleSeconds(60)
})

test('T-8 · đổi nguồn 2 công ty Đang theo dõi → trong 2 chu kỳ có 2 mục mới, không ai bấm gì', async () => {
  const before = await systemEntriesFor(WATCHED)

  // The only action in this test, and it is not a click: it is the SOURCE changing.
  await setSnapshotVariant(CHANGED, 'after')

  const after = await waitFor(
    'the watch cycle to add one timeline entry for each changed company',
    () => systemEntriesFor(WATCHED),
    (entries) =>
      CHANGED.every((name) => entries.some((entry) => entry.companyName === name)) &&
      entries.length >= before.length + CHANGED.length,
    TWO_CYCLES_MS,
  )

  // Each changed company gained at least one entry, written by the machine on its own.
  for (const name of CHANGED) {
    expect(after.filter((entry) => entry.companyName === name).length).toBeGreaterThan(0)
  }

  /**
   * And the third stayed silent. I-3 compared the hash, found the same page, and produced no
   * findings — so zone 4 had nothing to write. Without this assertion a build that added an entry
   * every cycle would look correct.
   */
  expect(after.filter((entry) => entry.companyName === UNCHANGED)).toHaveLength(0)

  /**
   * Every entry traces back to a quote that is verbatim in the source it came from. Rule 1 of
   * CLAUDE.md, checked on the machine's own writes rather than only on the read zone — this is
   * the path where no human ever reviewed the text before it landed in official data.
   */
  for (const entry of after) {
    expect(entry.quoteText, `entry "${entry.description}" has no claim behind it`).not.toBeNull()
    expect(entry.rawContent).toContain(entry.quoteText as string)
  }
})

test('T-8 · Nhật ký vòng quét có dòng từng vòng với đủ bốn con số', async () => {
  const runs = await watchCycleRuns()
  const scanned = runs.filter((run) => run.skippedReason === null && !run.isRollup)

  expect(scanned.length).toBeGreaterThan(0)

  // Every real cycle scanned the three watched companies and none of them failed.
  for (const run of scanned) {
    expect(run.companiesScanned).toBeGreaterThanOrEqual(3)
    expect(run.errorCount).toBe(0)
  }

  /**
   * At least one cycle both saw new content AND wrote something. This is the pair the log exists
   * to expose: content read with nothing written is the signature of a wrong filter or a wrong
   * prompt, and phase 5 measured that failure looking identical to "the model found nothing".
   */
  expect(scanned.some((run) => run.newContentCount > 0 && run.entriesAdded > 0)).toBe(true)
})

test('T-8 · mục hệ thống trên giao diện: có nhãn, bấm ra được câu trích, và Sales xoá được', async ({
  page,
}) => {
  await login(page)

  const company = CHANGED[0]
  await page.goto('/cong-ty')
  await page.getByRole('link', { name: company }).click()
  await expect(page.getByRole('heading', { name: company })).toBeVisible()

  /**
   * Rule 2: a reader tells the machine's row from their own WITHOUT reading an explanation. The
   * label is asserted rather than the colour — a judge on a greyscale printout has to see it too.
   */
  const systemRow = page.locator('li').filter({ hasText: 'Do hệ thống thêm' }).first()
  await expect(systemRow).toBeVisible()

  // Rule 1: the assertion is clickable back to the exact characters it was drawn from.
  await systemRow.getByRole('button', { name: 'Xem câu trích' }).click()
  await expect(systemRow.getByTestId('quote-highlight')).toBeVisible()
  const highlighted = await systemRow.getByTestId('quote-highlight').innerText()
  expect(highlighted.trim().length).toBeGreaterThan(0)

  /**
   * I-13, which is what makes zone 4 acceptable at all: removing the machine's write costs less
   * than the machine's write did, and the reason is recorded so "how often was it wrong" is a
   * number rather than an impression.
   */
  const entriesBefore = await systemEntriesFor([company])
  await systemRow.getByRole('button', { name: 'Xoá mục này' }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  // The reason is mandatory: no reason, no deletion, because the metric would be meaningless.
  await expect(dialog.getByRole('button', { name: 'Xoá mục này' })).toBeDisabled()

  await dialog.getByLabel('Lý do ngắn').fill('Tin này không phải của công ty này')
  await dialog.getByRole('button', { name: 'Xoá mục này' }).click()

  await expect
    .poll(async () => (await systemEntriesFor([company])).length, { timeout: 15_000 })
    .toBe(entriesBefore.length - 1)
})

test('Đang theo dõi · công tắc một thao tác, kèm dòng nói rõ đang uỷ quyền cái gì', async ({
  page,
}) => {
  await login(page)
  await page.goto('/dang-theo-doi')

  /**
   * The sentence ADR-0006 requires, and the reason it is asserted rather than left to review:
   * turning this flag on moves a company from "the AI proposes, a person decides" to "the AI
   * writes to the timeline without asking". Without the warning next to the switch, the label
   * reads like a bookmark and a person delegates write access believing they subscribed to
   * something. The trap the ADR names is a MISSING sentence, which no other test would notice.
   */
  await expect(page.getByText(/tự ghi tin mới vào dòng thời gian/)).toBeVisible()
  await expect(page.getByText(/không hỏi duyệt/)).toBeVisible()

  // Marlin is not watched, and no other spec in this file touches it — so it can be switched on
  // and back off without leaving anything behind.
  const row = page.locator('li').filter({ hasText: 'Marlin Product Labs' })
  await expect(row.getByRole('button', { name: 'Bật theo dõi' })).toBeVisible()

  // ONE action on, ONE action off. Zone 4 is bought with "undoing is easier than the machine's
  // own act", so a confirm step on the way OUT would put the friction on the wrong side.
  await row.getByRole('button', { name: 'Bật theo dõi' }).click()
  await expect(row.getByRole('button', { name: 'Tắt theo dõi' })).toBeVisible()

  await row.getByRole('button', { name: 'Tắt theo dõi' }).click()
  await expect(row.getByRole('button', { name: 'Bật theo dõi' })).toBeVisible()
})

test('Nhật ký vòng quét · mỗi vòng một dòng, đọc được trên màn hình', async ({ page }) => {
  await login(page)
  await page.goto('/quan-tri/nhat-ky-vong-quet')

  await expect(page.getByRole('heading', { name: 'Nhật ký vòng quét' })).toBeVisible()

  // The four numbers per cycle, on screen — the log is where round 2 asks its questions from, so
  // "the endpoint returns them" is not the same as "a reader can see them".
  await expect(page.getByText('Công ty đã quét').first()).toBeVisible()
  await expect(page.getByText('Có nội dung mới').first()).toBeVisible()
  await expect(page.getByText('Mục tự thêm').first()).toBeVisible()
})

async function login(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/dang-nhap')
  await page.getByLabel('Email').fill(SALES.email)
  await page.getByLabel('Mật khẩu').fill(SALES.password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  /**
   * A longer wait than the other specs use, for a reason specific to this one: it runs with the
   * cycle at 10 seconds, so the worker is reading three sources and calling the model continuously
   * in the background. The API answers under that load, just not within the default 5s.
   */
  await expect(page).toHaveURL(/\/cong-ty$/, { timeout: 30_000 })
}

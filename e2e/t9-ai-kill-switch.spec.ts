import { expect, test, type Page } from '@playwright/test'

import { setAiEnabled } from './turn-ai-off'
import {
  SEEDED_PROPOSAL_VALUE,
  aiOutputCounts,
  seedPendingProposal,
  seededProposalDecision,
  setWatchCycleSeconds,
  toggleAiAuditEvents,
  waitFor,
  watchCycleRuns,
} from './watch-cycle-scenario'

/**
 * T-9 — the brake, pulled on the real stack while the watch cycle is mid-flight.
 *
 * "Tắt AI giữa lúc vòng quét chạy: 2 chu kỳ sau không thêm gì, dữ liệu còn nguyên, Sales thấy
 * banner; bật lại chạy tiếp, cả hai lần có ghi vết."
 *
 * Every clause of that sentence is a separate assertion below, and two of them are the ones that
 * would rot silently:
 *
 *   - **Sales, not the admin, sees the notice.** A second browser CONTEXT is used rather than a
 *     second tab, because the point is a different SESSION with a different role. Checking the
 *     banner in the admin's own window would prove nothing: the admin has just pressed the button
 *     and can read `/settings` anyway. This is the hole ADR-0032 was written to close.
 *   - **"Dừng sinh mới" is not "xoá cái đã sinh".** The counts are compared for EQUALITY, not for
 *     "no growth" — a kill switch that quietly removed the machine's past output would satisfy a
 *     one-sided check while destroying data the product promises to keep.
 *
 * The switch is pressed ON THE ADMIN SCREEN, not in SQL. `turn-ai-off.ts` exists for specs that
 * need a starting state; here the button IS the subject.
 *
 * Runs against the compose stack on :8080 (`pnpm start`). `docker compose up --build` first —
 * phase 4 lost two runs to a stale web container and the results looked like product bugs.
 */

const SALES = { email: 'sales@hblab.vn', password: 'hackathon#1' }
const ADMIN = { email: 'admin@hblab.vn', password: 'hackathon#1' }
/**
 * The queue is scoped by `companies.owner_id` (ADR-0046), and the harness hangs its guaranteed
 * pending suggestion off San-e — which `Account.csv` gives to Phúc, not to the Sales account
 * above. So the "the queue is still decidable" step runs in HIS session.
 *
 * A third context rather than reusing `admin`: the claim being tested is that a SALES person can
 * still decide while the machine is off, and deciding it as the administrator would quietly
 * weaken that to "somebody with full rights can".
 */
const SALES_QUEUE_OWNER = { email: 'sales3@hblab.vn', password: 'hackathon#1' }

const CYCLE_SECONDS = 10
/** Generous about WHEN inside the window, strict about the window. Same reasoning as T-8. */
const TWO_CYCLES_MS = 120_000

test.describe.configure({ mode: 'serial', timeout: TWO_CYCLES_MS + 120_000 })

test.beforeAll(async () => {
  test.setTimeout(TWO_CYCLES_MS + 60_000)
  await setWatchCycleSeconds(CYCLE_SECONDS)
  /** So "the queue is still decidable" cannot pass vacuously against an empty queue. */
  await seedPendingProposal()

  // The cycle must be demonstrably RUNNING before it is switched off, or "it stopped" proves
  // nothing about the switch.
  await waitFor(
    'the worker to complete a cycle with the AI still on',
    () => watchCycleRuns(),
    (runs) => runs.some((run) => run.skippedReason === null && !run.isRollup),
    TWO_CYCLES_MS,
  )
})

test.afterAll(async () => {
  test.setTimeout(30_000)
  /**
   * Both, without fail, and the AI one first because it is the dangerous one to leave: every later
   * spec that reads a source would see zero findings and fail for a reason that has nothing to do
   * with it. `playwright.config.ts` runs `workers: 1` with `fullyParallel: false`, so switching a
   * global off mid-suite is safe only under exactly this discipline.
   */
  await setAiEnabled(true)
  await setWatchCycleSeconds(60)
})

test('T-9 · tắt AI trên màn Quản trị → 2 chu kỳ không sinh gì, Sales thấy banner, bật lại chạy tiếp', async ({
  browser,
}) => {
  const adminContext = await browser.newContext()
  const salesContext = await browser.newContext()
  const queueOwnerContext = await browser.newContext()
  const admin = await adminContext.newPage()
  const sales = await salesContext.newPage()
  const queueOwner = await queueOwnerContext.newPage()

  try {
    await login(admin, ADMIN)
    await login(sales, SALES)
    await login(queueOwner, SALES_QUEUE_OWNER)

    await test.step('trước khi tắt: màn Quản trị nói AI đang bật, Sales không thấy banner', async () => {
      await admin.goto('/quan-tri')
      await expect(admin.getByRole('heading', { name: 'Quản trị' })).toBeVisible()
      await expect(admin.getByText('AI đang bật').first()).toBeVisible()

      await sales.goto('/cong-ty')
      await expect(sales.getByTestId('ai-disabled-banner')).toHaveCount(0)
    })

    let skipsBefore = 0
    let generatedBefore = await aiOutputCounts()

    await test.step('admin bấm Tắt toàn bộ AI — hiệu lực ngay, không chạy lại gì', async () => {
      await admin.getByTestId('toggle-ai').click()
      await expect(admin.getByText('AI đang tắt').first()).toBeVisible()

      /**
       * Wait for the FIRST skipped tick before taking the baseline. A cycle already in flight when
       * the button was pressed may still finish and write — that is correct behaviour (ADR-0011
       * checks the flag at the TOP of each round), and measuring from before it would blame the
       * switch for a round it never governed.
       */
      const runs = await waitFor(
        'the worker to skip a tick because the AI is off',
        () => watchCycleRuns(),
        (rows) => rows.some((run) => run.skippedReason === 'ai_disabled'),
        TWO_CYCLES_MS,
      )
      skipsBefore = runs.filter((run) => run.skippedReason === 'ai_disabled').length
      generatedBefore = await aiOutputCounts()
    })

    await test.step('Sales — tài khoản KHÁC, phiên KHÁC — thấy banner nói rõ máy đang dừng', async () => {
      await sales.reload()
      const banner = sales.getByTestId('ai-disabled-banner')
      await expect(banner).toBeVisible()
      // The words, not the colour: a judge reading a greyscale printout has to see it too.
      await expect(banner).toContainText('AI đang tắt')
      await expect(banner).toContainText('vẫn còn nguyên')
    })

    await test.step('hai chu kỳ sau: không mục nào, không gợi ý nào, không lần tự đặt nào', async () => {
      await waitFor(
        'two more ticks to pass with the AI off',
        () => watchCycleRuns(),
        (rows) =>
          rows.filter((run) => run.skippedReason === 'ai_disabled').length >= skipsBefore + 2,
        TWO_CYCLES_MS,
      )

      /**
       * EQUALITY on all four. Not "did not grow": a switch that also deleted what the machine had
       * produced would pass a one-sided check while breaking the promise that turning the AI off
       * keeps its past work.
       */
      expect(await aiOutputCounts()).toEqual(generatedBefore)
      expect(generatedBefore.claims).toBeGreaterThan(0)
    })

    await test.step('hàng đợi tồn vẫn duyệt được — nút tắt chỉ dừng SINH MỚI (ADR-0009)', async () => {
      await queueOwner.goto('/hang-doi')
      const card = queueOwner
        .getByTestId('proposal-card')
        .filter({ hasText: SEEDED_PROPOSAL_VALUE })
        .first()
      await expect(card).toBeVisible()

      // `exact` because "Duyệt" is a prefix of "Sửa rồi duyệt" — the accessible-name trap phase 4
      // wrote down, and the two buttons mean opposite things for I-12.
      await card.getByRole('button', { name: 'Duyệt', exact: true }).click()

      // Decided while the machine is off, and recorded — the metric feature group 6 reads.
      await expect
        .poll(() => seededProposalDecision(), { timeout: 15_000 })
        .toBe('accept')
    })

    await test.step('bật lại → vòng quét chạy tiếp, banner của Sales biến mất', async () => {
      const runsAtReenable = (await watchCycleRuns()).length

      await admin.getByTestId('toggle-ai').click()
      await expect(admin.getByText('AI đang bật').first()).toBeVisible()

      await waitFor(
        'the worker to run a real cycle again',
        () => watchCycleRuns(),
        (rows) =>
          rows
            .slice(runsAtReenable)
            .some((run) => run.skippedReason === null && !run.isRollup),
        TWO_CYCLES_MS,
      )

      await sales.reload()
      await expect(sales.getByTestId('ai-disabled-banner')).toHaveCount(0)
    })

    await test.step('cả hai lần bật/tắt đều có ghi vết, đúng chiều', async () => {
      const events = await toggleAiAuditEvents()
      /**
       * The LAST two, because earlier runs of the suite leave their own pair behind. Both
       * directions are asserted: a trail that only recorded switching off would leave "when did
       * the machine come back" unanswerable, which is half of what round 2 asks from this table.
       */
      expect(events.slice(-2)).toEqual([
        { from: true, to: false },
        { from: false, to: true },
      ])
    })
  } finally {
    await adminContext.close()
    await salesContext.close()
    await queueOwnerContext.close()
  }
})

async function login(page: Page, user: { email: string; password: string }): Promise<void> {
  await page.goto('/dang-nhap')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Mật khẩu').fill(user.password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  /**
   * A longer wait than the default, for the reason T-8 gives: this spec runs with the cycle at ten
   * seconds, so the worker is reading three sources and calling the model continuously behind it.
   * The API answers under that load, just not within 5s.
   */
  await expect(page).toHaveURL(/\/cong-ty$/, { timeout: 30_000 })
}

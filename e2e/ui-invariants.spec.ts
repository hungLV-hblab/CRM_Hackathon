import fs from 'node:fs'
import path from 'node:path'

import { expect, test, type Locator, type Page } from '@playwright/test'

/**
 * The invariants the primitives in `components/ui/` carry, measured on the running stack.
 *
 * These exist because those files are being rebuilt on shadcn, and shadcn's defaults quietly
 * contradict two project rules: its `Button` is `h-9` (36px, under the 44px touch target) and
 * its `Badge` variants are `default | secondary | destructive | outline`, which have no way to
 * say "a machine produced this". Accepting either default would delete a rule while every
 * existing test stayed green.
 *
 * They read COMPUTED STYLE, not class strings: what matters is the pixel a judge sees, and a
 * class-name assertion would go red on any legitimate restyle while missing a broken one.
 * Thresholds and colour sets, never exact pixel counts.
 *
 * Unlike normal tests-first, this file is written to be GREEN BEFORE the migration — it locks
 * behaviour that is already correct. A red assertion the day it is written means the assertion
 * is wrong, not that a bug was found.
 *
 * ONE EXCEPTION, and it is worth knowing about: T-E's accessible-name assertion was red when
 * this file was first run. The native `<dialog>` renders its title as a plain `<h2>` and never
 * points at it with `aria-labelledby`, so a screen reader announces "dialog" and stops. That
 * is a real defect the file caught rather than a mis-written assertion, and the move to Radix
 * — which requires a `DialogTitle` and wires the name itself — is what turns it green.
 */

/**
 * Signed in as the administrator (ADR-0046): this file checks design invariants across screens
 * and reaches for companies that `Account.csv` gives to different Sales people. The invariants
 * are about tokens and colour meaning, not about whose data is on screen, so the widest account
 * is the one that keeps the file measuring what it is named after.
 */
const SALES = { email: 'admin@hblab.vn', password: 'hackathon#1' }

/** brand-400 — the one colour that means "a human is meant to press this". */
const BRAND_400 = 'rgb(255, 194, 15)'
/** The violet family: machine-100 surface, machine-600/700 text. */
const MACHINE_COLOURS = ['rgb(237, 233, 254)', 'rgb(109, 40, 217)', 'rgb(91, 33, 182)']

async function login(page: Page) {
  await page.goto('/dang-nhap')
  await page.getByLabel('Email').fill(SALES.email)
  await page.getByLabel('Mật khẩu').fill(SALES.password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/cong-ty$/)
}

function styleOf(locator: Locator, property: string) {
  return locator.evaluate(
    (node, prop) => getComputedStyle(node as Element).getPropertyValue(prop),
    property,
  )
}

test('T-A · mọi nút nhìn thấy được đều cao ít nhất 44px', async ({ page }) => {
  await login(page)

  for (const route of ['/cong-ty', '/hang-doi']) {
    await page.goto(route)
    const buttons = page.getByRole('button')
    const count = await buttons.count()
    expect(count).toBeGreaterThan(0)

    for (let index = 0; index < count; index += 1) {
      const button = buttons.nth(index)
      if (!(await button.isVisible())) continue
      const box = await button.boundingBox()
      const label = (await button.innerText()).trim() || (await button.getAttribute('aria-label'))
      // 44px is the smallest target a thumb hits reliably, and shadcn's default is 36px.
      expect(box?.height ?? 0, `nút "${label}" ở ${route}`).toBeGreaterThanOrEqual(44)
    }
  }
})

test('T-B · nút chính mang nền thương hiệu, nút phá huỷ thì không', async ({ page }) => {
  await login(page)

  const primary = page.getByRole('button', { name: 'Thêm công ty' })
  expect(await styleOf(primary, 'background-color')).toBe(BRAND_400)

  // Ink on amber is 11.36:1; white on amber is 1.7:1. The pairing is the point, so the text
  // colour is asserted as dark rather than merely "not the background".
  const primaryText = await styleOf(primary, 'color')
  const [r, g, b] = primaryText.match(/\d+/g)!.map(Number)
  expect(r + g + b).toBeLessThan(200)

  // A destructive action never wears the brand colour — CLAUDE.md's forbidden list.
  await page.goto('/cong-ty')
  await page.getByRole('link', { name: 'Keyware Solution' }).click()
  const danger = page.getByRole('button', { name: 'Xoá' }).first()
  await expect(danger).toBeVisible()
  expect(await styleOf(danger, 'background-color')).not.toBe(BRAND_400)
})

test('T-C · nhãn của máy mang màu tím, nhãn dữ liệu người nhập thì không', async ({ page }) => {
  await login(page)

  /**
   * Rule 2 of CLAUDE.md, measured: a reader must tell a fact from something the AI concluded
   * without reading an explanation. If both badges came out the same colour the rule would be
   * gone while every other test stayed green.
   *
   * The read zone's header badge is the anchor. It only exists once a snapshot has been read,
   * so this test reads one itself rather than assuming earlier specs left something behind: a
   * fresh seed creates NO observations and NO proposals, and an assertion that depends on which
   * specs ran first is an assertion that reports run order, not colour.
   *
   * Toyoshingo is a real BTC company no other spec touches, so reading it disturbs nobody.
   */
  await page.getByRole('link', { name: 'Toyoshingo' }).click()
  await page.getByRole('button', { name: 'Đọc bản chụp sau' }).click()

  const machineBadge = page.getByText('Vùng đọc — do AI sinh').first()
  await expect(machineBadge).toBeVisible()
  const machineColours = [
    await styleOf(machineBadge, 'background-color'),
    await styleOf(machineBadge, 'color'),
  ]
  expect(machineColours.some((colour) => MACHINE_COLOURS.includes(colour))).toBe(true)

  // Scoped to the table: the filter dropdown has an <option> with the same words, and an
  // unscoped lookup matches that invisible option instead of the badge.
  await page.goto('/cong-ty')
  const humanBadge = page.locator('table').getByText('Đang theo dõi').first()
  await expect(humanBadge).toBeVisible()
  const humanColours = [
    await styleOf(humanBadge, 'background-color'),
    await styleOf(humanBadge, 'color'),
  ]
  expect(humanColours.some((colour) => MACHINE_COLOURS.includes(colour))).toBe(false)
})

test('T-D · nhãn ô nhập vẫn bind bằng id nên tra được bằng tên', async ({ page }) => {
  await login(page)
  await page.getByRole('button', { name: 'Thêm công ty' }).click()

  /**
   * `getByLabel` is how five specs find their fields; it works only because `Input` generates
   * an `id` and points `htmlFor` at it. Losing that wiring breaks the suite AND every screen
   * reader at the same time, so it is asserted directly rather than left implied.
   *
   * The error colour is NOT asserted here: `Input`'s `error` prop is currently passed by no
   * screen in the app, so no end-to-end path can render it. `text-red-600` → `text-danger` is
   * verified by the grep in the phase 6 checklist instead — an honest static check beats an
   * end-to-end assertion that cannot reach the code.
   */
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Tên công ty')).toBeVisible()
  await expect(dialog.getByLabel('Ngành')).toBeVisible()
})

test('T-E · hộp thoại có tên đọc được và đóng bằng Escape', async ({ page }) => {
  await login(page)
  await page.getByRole('button', { name: 'Thêm công ty' }).click()

  // The accessible name is the contract a native <dialog> gave for free and a portal-based
  // one must be told to provide. Without it a screen reader announces "dialog" and nothing else.
  await expect(page.getByRole('dialog', { name: 'Thêm công ty' })).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('T-F · cờ cảnh báo mang chữ đọc được, không chỉ có màu', async ({ page }) => {
  await login(page)
  await page.goto('/co-hoi')

  /**
   * The greyscale-printout test, automated: a judge printing this screen in black and white
   * must still read what is wrong. A coloured chip with no words fails that, and colour is
   * never allowed to be the only channel.
   */
  const flag = page.getByText('Chưa có Việc tiếp theo').first()
  await expect(flag).toBeVisible()
  expect((await flag.innerText()).trim().length).toBeGreaterThan(3)
})

/**
 * THE GATE ITSELF, because the old one was broken in both directions at once.
 *
 * The interface checklist has always ended with a grep for raw colours:
 *
 *     grep -rE "slate-|amber-|indigo-|bg-\[#" apps/web/src
 *
 * It missed `bg-red-50` in the watched-companies screen, because the pattern never covered
 * `red-*`. And it matched twice on `-tran`+`slate-`+`y-1/2`, so whoever ran it saw two junk
 * hits, concluded "translate again", and stopped reading — including past the real violation
 * sitting in the same list.
 *
 * A gate that both misses violations and cries wolf is worse than no gate: it manufactures
 * the feeling of having checked. So the patterns are anchored to a utility prefix and a
 * trailing digit, and they live in a test rather than in a doc somebody remembers to run.
 */
const SOURCE_DIR = path.join(process.cwd(), 'apps', 'web', 'src')

/** Vendored Radix menu, ~257 lines written against shadcn's own radius and shadow scale.
 *  Rewriting it buys nothing a reader can see; the exemption is declared in ADR-0034. */
const VENDORED = ['dropdown-menu.tsx']

const TAILWIND_PALETTES =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'
const UTILITY_PREFIXES = 'bg|text|border|ring|fill|stroke|from|to|via|divide|accent|outline|caret'

const SCALE_RULES = [
  {
    ten: 'màu thô của Tailwind',
    // The trailing `-[0-9]` is the second anchor: `bg-brand-400` survives because `brand` is
    // not a Tailwind palette, and `text-danger` survives because it carries no scale number.
    pattern: new RegExp(
      String.raw`\b(${UTILITY_PREFIXES})-(${TAILWIND_PALETTES})-[0-9]|bg-\[#`,
    ),
    cach_sua: 'dùng token ink-* / brand-* / machine-* hoặc bốn màu trạng thái',
    scope: 'src',
    exempt: [] as string[],
  },
  {
    ten: 'bo góc ngoài thang ba giá trị',
    pattern: /\brounded-(sm|md|lg|xl|2xl|3xl|full)\b/,
    cach_sua: 'dùng rounded-control (nút, ô nhập) · rounded-card (thẻ) · rounded-pill (chip)',
    scope: 'src',
    exempt: VENDORED,
  },
  {
    ten: 'đổ bóng ngoài thang hai mức',
    pattern: /\bshadow-(sm|md|lg|xl|2xl)\b/,
    cach_sua: 'dùng shadow-card (nằm trên trang) · shadow-float (nổi lên trên)',
    scope: 'src',
    exempt: VENDORED,
  },
  {
    ten: 'từ vựng alias của shadcn rò ra ngoài components/ui/',
    pattern: /\b(bg-card|bg-background|text-primary|text-muted-foreground|border-border)\b/,
    cach_sua: 'code màn hình viết bg-surface / ink-* / brand-* / machine-*',
    scope: 'app',
    exempt: [],
  },
]

test('thang token không bị phá — màu, bo góc, đổ bóng, từ vựng alias', () => {
  for (const rule of SCALE_RULES) {
    const root = rule.scope === 'app' ? path.join(SOURCE_DIR, 'app') : SOURCE_DIR
    const viPham: string[] = []

    for (const file of walkTsx(root)) {
      if (rule.exempt.some((name) => file.endsWith(name))) continue

      fs.readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, index) => {
          // Comments are prose, and prose about a banned class is not a use of it — several
          // of these files explain WHY `rounded-md` is wrong, and a gate that goes red on its
          // own documentation is a gate that gets widened. A class always reaches the DOM
          // through an attribute, so no real usage begins a line with a comment marker.
          if (isComment(line)) return

          if (rule.pattern.test(line)) {
            viPham.push(`${path.relative(process.cwd(), file)}:${index + 1}  ${line.trim()}`)
          }
        })
    }

    // The message carries the fix, not just the failure: a gate that only says "no" gets
    // widened by the next person in a hurry, and widening the gate is how the rule dies.
    expect(viPham, `${rule.ten} — ${rule.cach_sua}\n${viPham.join('\n')}`).toEqual([])
  }
})

function isComment(line: string): boolean {
  const trimmed = line.trim()
  return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')
}

function walkTsx(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return walkTsx(full)
    return entry.name.endsWith('.tsx') ? [full] : []
  })
}

test('ô nhập, ô chọn và checkbox đều đạt vùng chạm 44px', async ({ page }) => {
  /**
   * 38px and 44px look identical in a screenshot and feel completely different under a thumb,
   * so this is measured rather than reviewed. The fields used to be 38px while the button
   * beside them was 44 — the mismatch was visible on every filter row and named by nobody.
   */
  await login(page)

  for (const nhan of ['Tìm theo tên', 'Lọc theo ngành', 'Lọc theo loại hình']) {
    const box = await page.getByLabel(nhan).boundingBox()
    expect(box, `không tìm thấy ô "${nhan}"`).not.toBeNull()
    expect(box!.height, `ô "${nhan}" cao ${box!.height}px, dưới vùng chạm 44px`).toBeGreaterThanOrEqual(44)
  }

  // The checkbox counts the LABEL as the target, which is what a finger actually aims at.
  await page.goto('/co-hoi')
  const checkbox = page.getByText('Chỉ hiện quá hạn')
  const box = await checkbox.boundingBox()
  expect(box!.height).toBeGreaterThanOrEqual(44)
})

test('header của bảng dính được thật — hộp bọc có trần chiều cao và tự cuộn', async ({ page }) => {
  /**
   * The comment in `table.tsx` promised a sticky header for months while the behaviour did not
   * exist: the wrapper declared only `overflow-x-auto` and no height limit, so its height always
   * equalled the table's, nothing ever scrolled inside it, and `sticky top-0` had no scroll to
   * stick against. The page scrolled instead and the column titles left the screen.
   *
   * Asserted as the MECHANISM rather than by scrolling, deliberately: the seed has five
   * companies, so a scroll assertion would pass on an empty gesture and prove nothing about a
   * long list. What broke was the container, so the container is what gets measured.
   */
  await login(page)

  const wrapper = page.locator('table').first().locator('..')
  expect(await styleOf(wrapper, 'overflow-y')).toBe('auto')
  expect(await styleOf(wrapper, 'max-height')).not.toBe('none')

  const thead = page.locator('table thead').first()
  expect(await styleOf(thead, 'position')).toBe('sticky')
  // An opaque background is part of it: without one, rows scroll THROUGH the header.
  expect(await styleOf(thead, 'background-color')).not.toBe('rgba(0, 0, 0, 0)')
})

test('cột số có header căn phải khớp với ô, và sắp xếp báo được aria-sort', async ({ page }) => {
  await login(page)
  await page.goto('/tong-quan')

  // The cells were right-aligned and the headers were not, so the column had nothing to line up
  // against — the one place in a table where alignment is information rather than taste.
  const numericHeader = page.getByRole('columnheader', { name: 'Số cơ hội' }).first()
  expect(await styleOf(numericHeader, 'text-align')).toBe('right')

  await page.goto('/cong-ty')
  // Only the SORTED state has to be announced — an unsorted column legitimately carries no
  // `aria-sort` at all, so there is nothing to assert before the first click.
  const sortable = page.getByRole('columnheader', { name: 'Tên' })
  await sortable.getByRole('button').click()
  await expect(sortable).toHaveAttribute('aria-sort', 'ascending')
  await sortable.getByRole('button').click()
  await expect(sortable).toHaveAttribute('aria-sort', 'descending')
})

---
title: "Nâng cấp UI toàn diện — shadcn, app shell, tour"
description: "Migrate 6 primitive sang shadcn giữ nguyên bề mặt API, thêm app shell (header/sidebar/footer/drawer), mở thang bo góc, tour driver.js, trang hướng dẫn, ⌘K"
status: pending
priority: P2
effort: large
branch: "feat/phase-6"
tags: [ui, shadcn, app-shell, tour, design-tokens]
blockedBy: [260813-0107-feature-groups-1-6-and-acceptance-suite]
blocks: []
created: "2026-08-13T18:11:40.849Z"
createdBy: "ck:plan"
mode: tdd
scope: project
source: plans/reports/from-brainstorm-to-planner-260814-0056-nang-cap-ui-toan-dien-shadcn-shell-tour-report.md
---

# Nâng cấp UI toàn diện — shadcn, app shell, tour

> Thiết kế chốt ở [báo cáo brainstorm 14/08 01:00](../reports/from-brainstorm-to-planner-260814-0056-nang-cap-ui-toan-dien-shadcn-shell-tour-report.md).
> **Bị chặn bởi [plan 260813-0107](../260813-0107-feature-groups-1-6-and-acceptance-suite/plan.md).** P7 (vòng quét) và P8 (bảng điều khiển + T-9 + T-10) phải xong trước — đây là quyết định của người dùng, không phải gợi ý. UI không được lấy giờ của điểm nghiệm thu.
> **Plan này không thêm nhóm tính năng nào.** Không API mới, không bảng mới, không endpoint mới. Chỉ tầng trình bày.

## Mục tiêu

Bịt lỗ **không có đường đi giữa các màn** (hiện `layout.tsx` chỉ có font + `QueryProvider`; 7 route mỗi trang tự dựng `<main>` + link `← Công ty` tự phát), và đưa 6 primitive viết tay sang shadcn **mà không làm đỏ một spec nào**.

## Nguyên tắc chi phối cả plan

**Đổi ruột, khoá vỏ.** Prop và accessible name của mọi component đóng băng; chỉ nội thất và class được đổi. Lý do: e2e chọn phần tử gần như hoàn toàn bằng accessible name (`getByRole('button',{name})`, `getByLabel(...)`, `getByRole('cell',{name})`, `getByRole('region',{name})`), nên bề mặt API **chính là** hợp đồng test. Đổi tên prop là quyết định riêng, ngoài phạm vi plan này.

Ba hệ quả không thương lượng:

- **Không dùng `shadcn init`** — nó ghi theme riêng (`--background`, `--primary`, palette oklch) + block `.dark` + `tw-animate-css` vào `globals.css`, đụng trực diện `@theme` hiện có và danh sách cấm của [design-guidelines](../../docs/design-guidelines.md). Tự viết `components.json`, cài deps tay, `shadcn add` từng component.
- **Không có nền tối.** design-guidelines đã chốt loại ở mục "Phạm vi đã chốt". CLI sinh block `.dark` thì xoá ngay.
- **Tên semantic của shadcn là lớp dịch cho component vendored, không phải từ vựng của app.** Code màn hình vẫn viết `ink-*`/`brand-*`/`machine-*`.

## Phases

| # | Phase | Trạng thái | Ước lượng | Phụ thuộc | Cắt được? |
| --- | --- | --- | --- | --- | --- |
| 1 | [Tầng token + giàn shadcn](./phase-01-tang-token-va-gian-shadcn.md) | pending | 30' | — | ❌ **phải có** |
| 2 | [App shell — header, sidebar, footer, drawer](./phase-02-app-shell-header-sidebar-footer.md) | pending | 1h20' | 1 | ❌ **phải có** |
| 3 | [Migrate primitive sang shadcn](./phase-03-migrate-primitive-sang-shadcn.md) | pending | 1h30' | 1 | ❌ **phải có** |
| 4 | [Restyle màn hình — Card, Skeleton, Sonner](./phase-04-restyle-man-hinh-card-skeleton-sonner.md) | pending | 1h30' | 2, 3 | ✅ cắt được |
| 5 | [Tour driver.js + `/huong-dan` + ⌘K](./phase-05-tour-driverjs-huong-dan-command-palette.md) | pending | 2h | 2 | ✅ cắt được |
| 6 | [Cửa chốt — checklist giao diện](./phase-06-cua-chot-checklist-giao-dien.md) | pending | 30' | 4, 5 | ❌ **phải có** (chạy trên phần đã làm được) |

```
P1 token ──┬── P2 shell ──┬── P4 restyle ──┐
           │              └── P5 tour/⌘K ──┼── P6 cửa chốt
           └── P3 primitive ───────────────┘
```

P2 và P3 **độc lập nhau** — cả hai chỉ cần token của P1. Hai người làm song song được, nhưng P3 chạm `components/ui/` và P2 chạm `layout.tsx` + `components/shell/`, không đụng file.

## Ngân sách — nói thẳng chỗ không vừa

Cộng thật: **7h20'**. Người dùng đã chốt làm **sau P7 + P8**, nghĩa là rơi vào **sáng 15/08** — đúng cửa sổ mà [CLAUDE.md](../../CLAUDE.md) nói *"15/08 chỉ hardening + test + demo"*, với vòng 1 chốt **15:00**.

Bảo vệ được: đây không phải nhóm tính năng mới. Nhưng 7h20' + demo + nộp bài trong một buổi sáng là **không vừa**, và phải cắt.

Thứ tự cắt, cắt từ dưới lên:

1. **P5 ⌘K Command palette** (45') — hữu ích cho BGK di chuyển, nhưng rubric không chấm.
2. **P4 restyle màn hình** (1h30') — P1+P2+P3 đã đổi diện mạo đủ nhiều; Card/Skeleton là lớp sơn thứ hai.
3. **P5 tour driver.js** (45') — cắt tour thì giữ `/huong-dan` (30'), vì trang đó đánh vào luật 7 "giải thích được" mà vòng 2 sẽ hỏi.

**Không cắt:** P1, P2, P3, P6. Và **không cắt** đường lùi: nếu P3 làm đỏ e2e mà không sửa được trong 30', `git revert` P3, giữ P1+P2.

## Tiêu chí nghiệm thu của cả plan

- [ ] `pnpm test` xanh, khớp baseline P1 **+ đúng 4 spec mới có chủ đích** (`ui-invariants`, `app-shell-navigation`, `tour-does-not-block`, `guide-page`)
- [ ] `pnpm lint` · `pnpm typecheck` · `pnpm build` xanh
- [ ] `grep -rE "slate-|amber-|indigo-|bg-\[#" apps/web/src` **rỗng** (hiện có 1 vi phạm: `input.tsx` dùng `text-red-600`)
- [ ] Mọi route tới được bằng ≤1 cú bấm từ sidebar (hiện: phải gõ URL)
- [ ] Qua checklist mục 7 của [design-guidelines](../../docs/design-guidelines.md), thử ở 375px và 1440px
- [ ] Tour không xuất hiện trong bất kỳ lần chạy e2e nào
- [ ] Nút Hoàn tác 7 ngày của `auto-next-step-cell.tsx` **còn nguyên hành vi**, không bị toast thay
- [ ] Có ADR cho việc đảo hướng sang shadcn, kèm phương án bị loại

## Luật áp cho mọi phase

- **Chạy `pnpm test:e2e` sau mỗi phase, không dồn.** Riêng bước đổi `Dialog` (P3) chạy riêng một lần, không gộp với bước khác — Radix portal ra body là thay đổi cấu trúc DOM nặng nhất của cả plan.
- **Mọi bất biến khoá bằng e2e Playwright, không bằng unit test.** `vitest.config.mts` có `projects: ['packages/*', 'apps/api']` — `apps/web` không nằm trong đó, và repo không có `@testing-library/react`/`jsdom`. Đừng viết unit test component rồi tưởng nó chạy.
- **Nói với C một lần** về đủ 5 thay đổi trong `e2e/`, không hỏi lắt nhắt từng phase: `ui-invariants.spec.ts` · `app-shell-navigation.spec.ts` · `tour-does-not-block.spec.ts` · `guide-page.spec.ts` · dòng `Đăng xuất` trong `login-and-create-company.spec.ts`.
- Không sửa `apps/api/`, `packages/`, schema, hay bất cứ thứ gì ngoài `apps/web/src` + `e2e/`.
- Không tự đổi accessible name. Chỗ duy nhất được phép đổi test là dòng `Đăng xuất` ở P2, và **phải hỏi C trước** vì `e2e/` thuộc chủ quyền C.
- Không animation >300ms. Không ghi đè `prefers-reduced-motion` (đã xử lý toàn cục).
- Vùng chạm ≥44px. shadcn mặc định `h-9` = 36px → phải override, và có test khẳng định.

## Chủ quyền file — chỗ sẽ đụng plan 260813-0107

| Phase | File | Xung đột |
| --- | --- | --- |
| 1 | `apps/web/src/app/globals.css` | không ai khác chạm |
| 2 | `app/layout.tsx`, `app/(app)/layout.tsx` (mới), `components/shell/*` (mới) | `layout.tsx` không có chủ trong bảng chủ quyền cũ |
| 2, 3, 5 | `e2e/*` — 4 spec mới + 1 dòng sửa | **thuộc C** — hỏi **một lần** cho cả 5, xem "Luật áp cho mọi phase" |
| 3 | `components/ui/*` | **không có chủ** trong bảng chủ quyền của plan cũ — cần chốt trước khi bắt đầu |
| 4 | `app/{cong-ty,co-hoi,tong-quan,hang-doi}/**` | **thuộc B** — P4 cắt được nên **làm sau khi B xong P8**, không tranh chấp |
| 5 | `app/(app)/huong-dan/` (mới), `components/tour/*` (mới) | không ai khác chạm |

## Câu hỏi chưa giải quyết

- **Ai sở hữu `components/ui/`?** Bảng chủ quyền của plan 260813-0107 không ghi. P3 sống trong đó.
- **Vàng thuần `#FFFF00`** trong logo vẫn chưa có vai trò (câu hỏi mở có từ trước ở design-guidelines). P2 làm dải thương hiệu — đây là lúc phải chốt dùng hay không.
- UI overhaul có được tính là "hardening" của sáng 15/08 không? Không phải nhóm tính năng mới, cũng không phải sửa lỗi.

*(Đã gỡ: nút `Đăng xuất` — chốt sửa spec, thêm bước mở user menu. Chủ quyền P4 — giữ cắt được, làm sau B.)*

## Validation Log

### Phiên 1 — 14/08 01:30

**Verification Pass — Full tier (6 phase), 15 claim.** Verified 13 · **Failed 2** · Unverified 0.

Verified: `middleware.ts` matcher không bám tên thư mục nên route group an toàn · `usePendingProposalCounts` tồn tại · `text-red-600` trong `input.tsx` · `min-h-11` trong `button.tsx` · `/quan-tri` chưa tồn tại · ADR mới nhất **0027** → ADR của plan là **0028** · `playwright.config.ts` `workers: 1`, `fullyParallel: false`, `testDir: './e2e'`.

**FAILED 1 — bộ test khoá bất biến của P3 không chạy được.**
`vitest.config.mts` có `projects: ['packages/*', 'apps/api']` → `apps/web` không nằm trong danh sách. Root devDeps không có `@testing-library/react`, `jsdom`, `@vitejs/plugin-react`. `apps/web` không có test nào.
→ **Quyết định:** T-A…T-F chuyển sang **`e2e/ui-invariants.spec.ts`**, đo computed style trên stack thật. Phương án bị loại: dựng hạ tầng Vitest + testing-library (~30–40' hạ tầng mới trước freeze) · chỉ grep tĩnh (không bắt được nhánh cva sai lúc chạy).

**FAILED 2 — cổng `localStorage` chặn tour không có chỗ để ghi cờ, và hậu quả ngược.**
`e2e/global-setup.ts` chỉ chạy `pnpm seed`; `playwright.config.ts` **không có `storageState`** → mỗi spec tự đăng nhập, `localStorage` rỗng ở mọi spec → tour "lần đầu" sẽ tự chạy trong **cả 5 spec**.
→ **Quyết định:** **tour không auto-run.** Chỉ mở bằng nút "Xem hướng dẫn" ở header hoặc `?tour=1`. Bỏ `localStorage`, **không sửa `e2e/global-setup.ts`**. Phương án bị loại: thêm `storageState` vào playwright config (tái cấu trúc đường đăng nhập của cả 5 spec trước freeze) · chặn bằng biến môi trường (dev/demo và e2e chạy hai nhánh code khác nhau).

**Quyết định khác:** `Đăng xuất` → sửa spec, thêm bước mở user menu (loại: giữ nút cấp 1 trên header). · P4 → giữ cắt được, làm sau khi B xong P8 (loại: thu về màn không thuộc B; chuyển chủ quyền).

### Whole-Plan Consistency Sweep

Đã lan quyết định xuống `phase-02` (Đăng xuất chốt + gộp một lần hỏi C), `phase-03` (Tests First viết lại sang e2e, Related Files, Implementation Steps, Success Criteria, Risk), `phase-05` (bỏ auto-run, ba nhánh spec, Related Files, Steps, Criteria, Risk), `phase-06` (checklist mục 3 và 10, ADR-0028, năm quyết định phụ, `diff` 4 spec), `plan.md` (tiêu chí, luật chung, chủ quyền, câu hỏi mở).

Rà từ khoá cũ: `__tests__` · `crm.tour.seen` · `storage state` · `T-A…T-F` dạng unit test · `00XX` → **0 mâu thuẫn còn lại**.

Một thay đổi hình dạng cần chú ý khi thực thi: `e2e/ui-invariants.spec.ts` phải **xanh trước khi migrate** (nó khoá hành vi đang đúng), khác với TDD thường là đỏ trước. Đã ghi rõ trong `phase-03`.

## Dependencies

- **blockedBy:** [`260813-0107-feature-groups-1-6-and-acceptance-suite`](../260813-0107-feature-groups-1-6-and-acceptance-suite/plan.md) — P7 + P8 phải `done` trước khi P1 của plan này bắt đầu.

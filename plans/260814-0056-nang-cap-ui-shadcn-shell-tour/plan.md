---
title: "Nâng cấp UI toàn diện — shadcn, app shell, tour"
description: "Migrate 6 primitive sang shadcn giữ nguyên bề mặt API, thêm app shell (header/sidebar/footer/drawer), mở thang bo góc, tour driver.js, trang hướng dẫn, ⌘K"
status: pending
priority: P2
effort: large
branch: "feat/phase-6"
tags: [ui, shadcn, app-shell, tour, design-tokens]
blockedBy: []
blocks: [260813-0107-feature-groups-1-6-and-acceptance-suite]
created: "2026-08-13T18:11:40.849Z"
createdBy: "ck:plan"
mode: tdd
scope: project
source: plans/reports/from-brainstorm-to-planner-260814-0056-nang-cap-ui-toan-dien-shadcn-shell-tour-report.md
---

# Nâng cấp UI toàn diện — shadcn, app shell, tour

> Thiết kế chốt ở [báo cáo brainstorm 14/08 01:00](../reports/from-brainstorm-to-planner-260814-0056-nang-cap-ui-toan-dien-shadcn-shell-tour-report.md).
> **Đảo thứ tự 14/08 — plan này chạy TRƯỚC [plan 260813-0107](../260813-0107-feature-groups-1-6-and-acceptance-suite/plan.md).** Quyết định của người dùng, thay cho quyết định cũ ("UI không được lấy giờ của điểm nghiệm thu"). Cái giá và các bàn giao bắt buộc ghi ở mục [Đảo thứ tự](#đảo-thứ-tự--ui-chạy-trước-p8) — đọc mục đó trước khi gõ dòng đầu tiên.
> **Plan này không thêm nhóm tính năng nào.** Không API mới, không bảng mới, không endpoint mới. Chỉ tầng trình bày.

## Mục tiêu

Bịt lỗ **không có đường đi giữa các màn** (hiện `layout.tsx` chỉ có font + `QueryProvider`; 7 route mỗi trang tự dựng `<main>` + link `← Công ty` tự phát), và đưa 6 primitive viết tay sang shadcn **mà không làm đỏ một spec nào**.

## Nguyên tắc chi phối cả plan

**Đổi ruột, khoá vỏ.** Prop và accessible name của mọi component đóng băng; chỉ nội thất và class được đổi. Lý do: e2e chọn phần tử gần như hoàn toàn bằng accessible name (`getByRole('button',{name})`, `getByLabel(...)`, `getByRole('cell',{name})`, `getByRole('region',{name})`), nên bề mặt API **chính là** hợp đồng test. Đổi tên prop là quyết định riêng, ngoài phạm vi plan này.

Ba hệ quả không thương lượng:

- **Không dùng `shadcn init`** — nó ghi theme riêng (`--background`, `--primary`, palette oklch) + block `.dark` + `tw-animate-css` vào `globals.css`, đụng trực diện `@theme` hiện có và danh sách cấm của [design-guidelines](../../docs/design-guidelines.md). Tự viết `components.json`, cài deps tay, `shadcn add` từng component.
- **Không có nền tối.** design-guidelines đã chốt loại ở mục "Phạm vi đã chốt". CLI sinh block `.dark` thì xoá ngay.
- **Tên semantic của shadcn là lớp dịch cho component vendored, không phải từ vựng của app.** Code màn hình vẫn viết `ink-*`/`brand-*`/`machine-*`.

## Đảo thứ tự — UI chạy trước P8

Bản đầu chặn plan này sau P7 + P8. **Đổi 14/08: chạy hết UI trước.** Ghi lại đầy đủ để BGK và người sau đọc được cái giá, không phải chỉ đọc kết quả.

### Cái giá, nói thẳng

P8 của plan cũ (**bảng điều khiển nhóm 6 + đóng T-1…T-10**, 4h) là phần rubric chấm điểm nghiệm thu; plan này 7h20' là tầng trình bày. Đảo thứ tự nghĩa là **7h20' đứng trước 4h chấm điểm**, trong ngày feature freeze. Nếu chỉ một trong hai kịp, thứ kịp sẽ là thứ không được chấm bằng T-1…T-10.

Đối sách bắt buộc, không phải gợi ý: **P4 và P5 giữ nguyên trạng thái cắt được**, và mốc cắt là một cái đồng hồ chứ không phải cảm giác — xem [Mốc cắt cứng](#mốc-cắt-cứng).

### Trạng thái thật của plan cũ khi đảo (kiểm 14/08)

| | Trạng thái | Bằng chứng |
| --- | --- | --- |
| P7 vòng quét | **có code** | [`apps/api/src/watch/watch-cycle-service.ts`](../../apps/api/src/watch/watch-cycle-service.ts), `watch.module.ts` |
| P8 bảng điều khiển + T-8/T-9/T-10 | **chưa làm** | không có `app/quan-tri/`; `e2e/` mới có 5 spec |
| working tree | sạch, `master` sau merge PR#7 | `git status` |

Bảng phase của plan cũ vẫn ghi P7 `pending`. **Không tự sửa trạng thái của plan người khác** — hỏi C.

### Ba bàn giao bắt buộc — nói với C và B TRƯỚC khi P2 chạy

Đây là chỗ đảo thứ tự đẻ ra việc mới, không phải chỗ nó tiết kiệm được gì.

1. **`app/quan-tri/` của P8 phải sinh vào `app/(app)/quan-tri/`.** P2 dời 6 thư mục route vào route group `(app)/`. C viết màn quản trị sau, vào chỗ cũ thì màn đó **không có shell** — không sidebar, không header — và không ai phát hiện cho tới lúc demo. URL vẫn là `/quan-tri`, chỉ đường thư mục đổi.
2. **`app/{cong-ty,co-hoi,tong-quan,hang-doi}/` (chủ quyền B) sẽ bị P4 sửa trước.** B rebase lên, không phải ta né. Đảo thứ tự chuyển gánh nặng merge từ ta sang B — B phải biết trước, không phải phát hiện lúc pull.
3. **`e2e/` (chủ quyền C) giờ bị hai plan sờ cùng lúc**, vì C viết T-8/T-9/T-10 song song với 4 spec mới của ta. Không còn là "hỏi một lần rồi yên tâm": 4 file của ta đều **tạo mới**, không sửa file của C, trừ đúng một dòng `Đăng xuất` trong `login-and-create-company.spec.ts`. Nói rõ ranh giới đó khi hỏi.

### Hai chỗ nội dung phải đổi vì P8 chưa có

Không phải đổi thứ tự là xong — hai thành phần của P2/P5 đọc thứ P8 tạo ra.

- **Pill trạng thái AI (P2) không đọc được `GET /settings`.** Endpoint có tồn tại nhưng **admin-only** (`@Roles('admin')` ở [`settings.controller.ts`](../../apps/api/src/settings/settings.controller.ts)), nên Sales mở bất kỳ màn nào cũng ăn **403**. Mà plan này cấm sửa `apps/api/`. → **Quyết định: không đọc được thì không hiện pill.** Không hiện "AI đang bật" mặc định — đó là bịa một dòng trạng thái, đúng thứ [luật 4](../../CLAUDE.md#2-bảy-luật-bất-di-bất-dịch) cấm. Chi tiết ở [phase-02](./phase-02-app-shell-header-sidebar-footer.md#pill-trạng-thái-ai--không-đọc-được-thì-không-hiện).
- **Sidebar 7 mục → 6 mục.** *Quản trị* trỏ vào route chưa tồn tại; middleware bắt mọi đường dẫn nên bấm vào là 404 trong shell. Mục *Quản trị* thêm lại khi P8 xong — một dòng trong `nav-items.tsx`. Tour bước 6 (P5) cũng phải bỏ nhánh trỏ `/quan-tri`.

### Mốc cắt cứng

| Đồng hồ | Nếu chưa xong cái này thì cắt |
| --- | --- |
| P1+P2+P3 xong | Bàn giao ngay cho C/B để P8 chạy song song, không chờ P4/P5 |
| **P4 chưa xong** | Cắt P4, nhảy thẳng P6. Không làm dở nửa màn |
| **P5 chưa xong** | Giữ `/huong-dan`, cắt tour + ⌘K |
| Còn ≤30' | Chỉ chạy P6 (checklist + ADR). ADR là điều kiện, không phải phần thưởng |

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

Cộng thật: **7h20'**. Người dùng đã chốt làm **trước P8** (đảo thứ tự 14/08), nghĩa là 7h20' này rơi vào **14/08 — ngày feature freeze**, đứng trước 4h của P8.

Bảo vệ được: đây không phải nhóm tính năng mới, và P1+P2+P3 (3h20') **không đụng file của B hay C** nên P8 chạy song song được ngay sau khi ta xong P3. Không bảo vệ được: nếu chạy tuần tự một người, 7h20' + 4h trong một ngày là **không vừa**, và phải cắt.

Hai đường ra, chọn một và ghi lại đã chọn đường nào:

- **Song song (khuyến nghị):** ta chạy P1→P3 rồi bàn giao ba việc ở mục [Đảo thứ tự](#ba-bàn-giao-bắt-buộc--nói-với-c-và-b-trước-khi-p2-chạy); C/B bắt đầu P8 ngay từ lúc đó. P4/P5 của ta chạy chồng lên P8.
- **Tuần tự một người:** cắt theo danh sách dưới, và [Mốc cắt cứng](#mốc-cắt-cứng) là đồng hồ chứ không phải cảm giác.

Thứ tự cắt, cắt từ dưới lên:

1. **P5 ⌘K Command palette** (45') — hữu ích cho BGK di chuyển, nhưng rubric không chấm.
2. **P4 restyle màn hình** (1h30') — P1+P2+P3 đã đổi diện mạo đủ nhiều; Card/Skeleton là lớp sơn thứ hai.
3. **P5 tour driver.js** (45') — cắt tour thì giữ `/huong-dan` (30'), vì trang đó đánh vào luật 7 "giải thích được" mà vòng 2 sẽ hỏi.

**Không cắt:** P1, P2, P3, P6. Và **không cắt** đường lùi: nếu P3 làm đỏ e2e mà không sửa được trong 30', `git revert` P3, giữ P1+P2.

## Tiêu chí nghiệm thu của cả plan

- [ ] `pnpm test` xanh, khớp baseline P1 **+ đúng 4 spec mới có chủ đích** (`ui-invariants`, `app-shell-navigation`, `tour-does-not-block`, `guide-page`)
- [ ] `pnpm lint` · `pnpm typecheck` · `pnpm build` xanh
- [ ] `grep -rE "slate-|amber-|indigo-|bg-\[#" apps/web/src` **rỗng** (hiện có 1 vi phạm: `input.tsx` dùng `text-red-600`)
- [ ] Mọi route **đang tồn tại** tới được bằng ≤1 cú bấm từ sidebar (hiện: phải gõ URL). *Quản trị* nằm ngoài, vì P8 chưa tạo route đó — xem [Đảo thứ tự](#hai-chỗ-nội-dung-phải-đổi-vì-p8-chưa-có)
- [ ] Đã nói với C và B đủ **ba bàn giao** của mục Đảo thứ tự, trước khi P2 chạy
- [ ] Không có dòng trạng thái AI nào hiện ra mà không đọc được giá trị thật (luật 4)
- [ ] Qua checklist mục 7 của [design-guidelines](../../docs/design-guidelines.md), thử ở 375px và 1440px
- [ ] Tour không xuất hiện trong bất kỳ lần chạy e2e nào
- [ ] Nút Hoàn tác 7 ngày của `auto-next-step-cell.tsx` **còn nguyên hành vi**, không bị toast thay
- [ ] Có ADR cho việc đảo hướng sang shadcn, kèm phương án bị loại

## Luật áp cho mọi phase

- **Chạy `pnpm test:e2e` sau mỗi phase, không dồn.** Riêng bước đổi `Dialog` (P3) chạy riêng một lần, không gộp với bước khác — Radix portal ra body là thay đổi cấu trúc DOM nặng nhất của cả plan.
- **Mọi bất biến khoá bằng e2e Playwright, không bằng unit test.** `vitest.config.mts` có `projects: ['packages/*', 'apps/api']` — `apps/web` không nằm trong đó, và repo không có `@testing-library/react`/`jsdom`. Đừng viết unit test component rồi tưởng nó chạy.
- **Nói với C và B một lần**, ở bước 4 của P2, gồm cả ba bàn giao do đảo thứ tự — không hỏi lắt nhắt từng phase. Với C: 5 thay đổi trong `e2e/` (`ui-invariants.spec.ts` · `app-shell-navigation.spec.ts` · `tour-does-not-block.spec.ts` · `guide-page.spec.ts` đều **tạo mới**; chỉ dòng `Đăng xuất` trong `login-and-create-company.spec.ts` là **sửa**) cộng `app/(app)/quan-tri/`. Với B: P4 sửa file của B trước, B rebase.
- Không sửa `apps/api/`, `packages/`, schema, hay bất cứ thứ gì ngoài `apps/web/src` + `e2e/`.
- Không tự đổi accessible name. Chỗ duy nhất được phép đổi test là dòng `Đăng xuất` ở P2, và **phải hỏi C trước** vì `e2e/` thuộc chủ quyền C.
- Không animation >300ms. Không ghi đè `prefers-reduced-motion` (đã xử lý toàn cục).
- Vùng chạm ≥44px. shadcn mặc định `h-9` = 36px → phải override, và có test khẳng định.

## Chủ quyền file — chỗ sẽ đụng plan 260813-0107

| Phase | File | Xung đột |
| --- | --- | --- |
| 1 | `apps/web/src/app/globals.css` | không ai khác chạm |
| 2 | `app/layout.tsx`, `app/(app)/layout.tsx` (mới), `components/shell/*` (mới) | `layout.tsx` không có chủ trong bảng chủ quyền cũ |
| 2 | `app/{cong-ty,co-hoi,hang-doi,tong-quan,thong-bao}/` → `app/(app)/` | **`git mv` thuần, không sửa nội dung file.** Nhưng nó đổi đường thư mục của B → bàn giao số 2. Và P8 phải sinh `app/(app)/quan-tri/` → bàn giao số 1 |
| 2, 3, 5 | `e2e/*` — 4 spec **mới** + 1 dòng sửa | **thuộc C**, và giờ C viết T-8/T-9/T-10 song song. Hỏi **một lần** cho cả 5, nói rõ 4 file là tạo mới — xem "Luật áp cho mọi phase" |
| 3 | `components/ui/*` | **không có chủ** trong bảng chủ quyền của plan cũ — cần chốt trước khi bắt đầu |
| 4 | `app/{cong-ty,co-hoi,tong-quan,hang-doi}/**` | **thuộc B.** Đảo thứ tự nghĩa là ta sửa trước, **B rebase lên** — không còn là "chờ B xong P8". Phải báo B trước, không để B phát hiện lúc pull |
| 5 | `app/(app)/huong-dan/` (mới), `components/tour/*` (mới) | không ai khác chạm |

## Câu hỏi chưa giải quyết

- **Ai sở hữu `components/ui/`?** Bảng chủ quyền của plan 260813-0107 không ghi. P3 sống trong đó.
- **Vàng thuần `#FFFF00`** trong logo vẫn chưa có vai trò (câu hỏi mở có từ trước ở design-guidelines). P2 làm dải thương hiệu — đây là lúc phải chốt dùng hay không.
- **C có nhận ba bàn giao không, và bao giờ P8 bắt đầu?** Câu trả lời quyết định chọn đường "song song" hay "tuần tự" ở mục Ngân sách. Chưa hỏi được thì mặc định **tuần tự**, vì giả định người khác rảnh là giả định đắt nhất.
- **Ai thêm mục *Quản trị* vào `nav-items.tsx` khi P8 xong?** Một dòng, nhưng không có chủ thì không ai làm và màn quản trị thành màn không có đường tới.

*(Đã gỡ: nút `Đăng xuất` — chốt sửa spec, thêm bước mở user menu. Chủ quyền P4 — ta sửa trước, B rebase. "UI có phải hardening của 15/08 không" — hết nghĩa sau khi đảo thứ tự, UI chạy 14/08.)*

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

### Phiên 2 — 14/08, đảo thứ tự

Người dùng chốt chạy hết UI **trước** P8. Rà lại 6 phase xem chỗ nào giả định P7/P8 đã xong. **Tìm được 4 chỗ, sửa cả 4.**

**FAILED 3 — pill trạng thái AI không đọc được endpoint.** `phase-02` viết *"Đọc endpoint settings của P8"* và đối sách khi thiếu là *"đọc trạng thái mặc định bật"*. Hai vấn đề: endpoint **đã tồn tại** (không phải chờ P8) nhưng `@Roles('admin')` → Sales ăn 403 ở mọi màn; và "mặc định bật" là **bịa một dòng trạng thái**, trái luật 4 mà chính dòng đối sách đó viện dẫn.
→ **Quyết định:** đọc được thì hiện, không đọc được thì **không hiện gì**. Phương án bị loại: nới `@Roles` thành đọc-cho-mọi-vai (phải sửa `apps/api/`, plan này cấm — và là quyết định về quyền, cần ADR riêng) · hiện pill "không rõ" (một pill nói "không rõ" ở mọi màn là nhiễu, không phải thông tin).

**FAILED 4 — sidebar 7 mục có 1 mục 404.** `/quan-tri` do P8 tạo, giờ P8 chạy sau. `middleware.ts` khớp mọi đường dẫn nên bấm vào là 404 **bên trong shell**, trông như shell hỏng.
→ **Quyết định:** sidebar 6 mục; *Quản trị* thêm lại bằng một dòng `nav-items.tsx` khi P8 xong. `app-shell-navigation.spec.ts` khẳng định 6 mục. Phương án bị loại: để mục đó `disabled` kèm tooltip "sắp có" (một mục nav chết trong bản demo tệ hơn không có mục đó).

**FAILED 5 — tour bước 6 neo vào `/quan-tri`.** Cùng gốc với trên. → Bước 6 nói về vùng 4 + nút tắt sạch AI **bằng lời + neo `data-tour="ai-status"`**, bỏ link sang `/quan-tri` cho tới khi route tồn tại.

**FAILED 6 — chủ quyền P4 đảo chiều mà không ai được báo.** `phase-04` viết *"chờ B xong P8"*. Đảo thứ tự làm câu đó sai ngược: giờ ta sửa trước và **B rebase lên**. → Thành bàn giao số 2, phải báo B **trước** khi P2 chạy, không phải lúc B pull.

**Ba bàn giao** (`(app)/quan-tri/` · B rebase · ranh giới `e2e/`) là việc mới do đảo thứ tự đẻ ra. Ghi ở mục [Đảo thứ tự](#ba-bàn-giao-bắt-buộc--nói-với-c-và-b-trước-khi-p2-chạy) và có dòng riêng trong tiêu chí nghiệm thu.

**Đã kiểm, không đổi:** `middleware.ts` matcher không bám tên thư mục → route group vẫn an toàn · `usePendingProposalCounts` vẫn ở `pending-proposal-marker.tsx` · `globals.css` có `--radius-card: 0.75rem` + `--radius-control`, **chưa có** `--radius-pill`, không có `.dark` · working tree sạch trên `master`.

## Dependencies

- **blockedBy:** không còn. Chặn cũ (P7 + P8 của [`260813-0107`](../260813-0107-feature-groups-1-6-and-acceptance-suite/plan.md)) đã gỡ ngày 14/08 theo quyết định của người dùng.
- **blocks:** [`260813-0107`](../260813-0107-feature-groups-1-6-and-acceptance-suite/plan.md) **một phần** — P8 của plan đó phải sinh `app/(app)/quan-tri/` chứ không phải `app/quan-tri/`, nên P8 cần P2 của plan này xong (hoặc ít nhất biết trước). Không phải chặn toàn phần: P8 phía API không phụ thuộc gì ở đây.

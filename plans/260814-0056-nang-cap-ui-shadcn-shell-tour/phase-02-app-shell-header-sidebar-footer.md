---
phase: 2
title: "App shell — header, sidebar, footer, drawer"
status: pending
priority: P1
effort: "1h20'"
dependencies: [1]
---

# Phase 2: App shell — header, sidebar, footer, drawer

## Overview

Bịt **lỗ sản phẩm thật** của cả plan: hiện không có đường đi giữa các màn. `layout.tsx` chỉ có font + `QueryProvider`; 7 route mỗi trang tự dựng `<main className="mx-auto max-w-5xl p-6">` + link `← Công ty` tự phát. BGK phải gõ URL để đi giữa 8 màn, Sales chấm vòng 3.

Phase có ROI cao nhất trong plan và rủi ro thấp thứ hai.

## Requirements

- Functional: mọi route tới được bằng ≤1 cú bấm từ sidebar · vị trí hiện tại thấy được · số gợi ý chờ hiện trên mục *Hàng đợi* · trạng thái AI bật/tắt thấy được ở mọi màn · dùng được ở 375px.
- Non-functional: URL **không đổi một ký tự** · `pnpm test` khớp baseline P1 trừ đúng một dòng `Đăng xuất` đã thoả thuận trước · vùng chạm ≥44px · thứ tự tab khớp thứ tự nhìn.

## Architecture

### Route group — vì sao URL không đổi

```
app/(app)/layout.tsx        ← render AppShell
app/(app)/cong-ty/…         ← chuyển từ app/cong-ty/
app/(app)/co-hoi/…
app/(app)/hang-doi/…
app/(app)/tong-quan/…
app/(app)/thong-bao/…
app/(app)/dang-theo-doi/…   ← P7 của plan cũ tạo (14/08 02:35)
app/(app)/quan-tri/…        ← P7 tạo `quan-tri/nhat-ky-vong-quet/`; P8 thêm bảng điều khiển
app/dang-nhap/              ← Ở NGOÀI group, không có shell
app/page.tsx                ← giữ nguyên, chỉ redirect
```

Thư mục bọc trong `()` **không tham gia vào đường dẫn** — `app/(app)/cong-ty/page.tsx` vẫn là `/cong-ty`. Nên e2e không hay biết. Đây là lý do chọn route group thay vì thêm điều kiện vào `layout.tsx` gốc: `/dang-nhap` không được có sidebar, và một `layout.tsx` phải `usePathname()` để quyết định là biến layout thành client component vô cớ.

**Kiểm ngay sau khi di chuyển:** `middleware.ts` có matcher nào bám đường dẫn không → route group không đổi path nên phải không ảnh hưởng, nhưng đọc để chắc. *(Đã kiểm 14/08: matcher là `'/((?!api|_next/static|_next/image|favicon.ico).*)'` — không bám tên thư mục nào. An toàn.)*

### ⚠️ Bàn giao số 1 — `app/(app)/quan-tri/`, nói với C TRƯỚC khi `git mv`

Plan này giờ chạy **trước** P8. C sẽ viết màn quản trị sau khi ta đã dời thư mục. Viết vào `app/quan-tri/` thì màn đó nằm **ngoài route group** → không sidebar, không header, và không ai phát hiện cho tới lúc demo. URL không đổi (`/quan-tri` vẫn là `/quan-tri`), chỉ đường thư mục đổi.

Nói với C **cùng lúc** với việc hỏi `e2e/` ở bước 4, không phải hai lần.

### Header — `h-14`, sticky, `z-sticky`

| Thành phần | Ghi chú |
| --- | --- |
| Dải cam thương hiệu + logo | `brand-400` làm **nền**, không bao giờ làm chữ |
| Breadcrumb | Thay hết link `← Công ty` tự phát ở `tong-quan/page.tsx`, `cong-ty/[id]/page.tsx`… Xoá chúng ở P4 |
| Trigger ⌘K | P5 làm chức năng; P2 chỉ dựng nút |
| **Pill trạng thái AI** | Xem mục riêng dưới — **không đơn giản như bản đầu viết** |
| Chuông thông báo + số | `Link` sang `/thong-bao` |
| User menu | `DropdownMenu` — xem cảnh báo dưới |

### Pill trạng thái AI — không đọc được thì không hiện

Bản đầu viết *"Đọc endpoint settings của P8"*, và đối sách khi thiếu là *"mặc định bật + TODO"*. Cả hai đều sai, kiểm 14/08:

- Endpoint **đã có** — [`apps/api/src/settings/settings.controller.ts`](../../apps/api/src/settings/settings.controller.ts), `GET /settings`. Không phải chờ P8.
- Nhưng nó **`@Roles('admin')`**. Header hiện ở **mọi màn**, người dùng chính là **Sales** → mỗi lần tải trang là một cú **403**. Plan này cấm sửa `apps/api/`, và nới quyền là quyết định về quyền hạn — cần ADR riêng, không nhét vào một phase UI.
- *"Mặc định bật"* là **bịa một dòng trạng thái**. Trạng thái AI thật nằm ở `system_settings.ai_enabled`, đổi được bất cứ lúc nào (e2e lật nó bằng SQL trong `turn-ai-off.ts`). Hiện "AI đang bật" trong khi nó đang tắt là đúng thứ [luật 4](../../CLAUDE.md#2-bảy-luật-bất-di-bất-dịch) cấm — và tệ hơn im lặng, vì Sales tin vào nó.

**Quyết định: đọc được thì hiện, không đọc được thì không hiện gì.**

- Gọi `GET /settings`. **200** → hiện pill theo `aiEnabled` (tắt → pill `warning` + chữ "AI đang tắt"). **403 hoặc lỗi** → **không render pill**, không render chỗ trống, không render "không rõ".
- Không nuốt lỗi trong im lặng: `console.warn` một dòng nói rõ vì sao pill vắng mặt.
- Pill vẫn chỉ là **phụ trợ** cho banner của T-9, không thay banner. T-9 không phụ thuộc pill này.

Phương án bị loại: nới `@Roles` cho mọi vai đọc được (sửa `apps/api/`, ngoài phạm vi + cần ADR) · pill "không rõ" (một pill nói "không rõ" ở mọi màn là nhiễu, không phải thông tin).

### `nav-items.tsx` chỉ chứa route đã tồn tại

Một mục nav trỏ vào route chưa có là **404 bên trong shell** — `middleware.ts` khớp mọi đường dẫn nên trông như shell hỏng chứ không như "tính năng sắp có". Luật: mảng nav chỉ nhận đường dẫn đã có `page.tsx`; ai tạo route mới thì thêm dòng của mình vào mảng.

*Quản trị* nay đã có `quan-tri/nhat-ky-vong-quet/` do P7 tạo nên vào được mảng; bảng điều khiển của P8 nằm cùng nhánh đó, không thêm mục cấp 1 mới.

Phương án bị loại: để mục `disabled` kèm tooltip "sắp có" — một mục nav chết trong bản demo tệ hơn không có mục đó.

### ⚠️ Nút `Đăng xuất` — chỗ chắc chắn vỡ

`e2e/login-and-create-company.spec.ts` có `getByRole('button', { name: 'Đăng xuất' })`. Nhét *Đăng xuất* vào `DropdownMenu` → Playwright phải mở menu trước → **đỏ**.

**Đã chốt: sửa spec, thêm bước mở user menu.** Đăng xuất thuộc user menu — đó là chỗ đúng của nó, và giữ một nút Đăng xuất cấp 1 trên header chỉ để test không phải sửa là để test lái thiết kế.

Phương án bị loại: giữ *Đăng xuất* hiện sẵn ở header desktop. Không phải sửa test, nhưng thêm một nút cấp 1 không đáng vào header và trái quy ước thông thường.

**Vẫn phải nói với C trước khi gõ** — `e2e/` thuộc chủ quyền C. Hỏi một lần cho cả **ba** file e2e của plan này: `ui-invariants.spec.ts` (P3), `tour-does-not-block.spec.ts` + `guide-page.spec.ts` (P5), cộng `app-shell-navigation.spec.ts` (phase này) và dòng sửa trong `login-and-create-company.spec.ts`.

### Sidebar

- 8 mục: Công ty · **Đang theo dõi** · Cơ hội · Hàng đợi · Tổng quan · Thông báo · Quản trị · Hướng dẫn. *(Nhật ký vòng quét nằm **trong** Quản trị, không lên cấp 1.)* Con số 7 của bản 14/08 00:56 viết trước khi P7 chốt hai route mới.
- **Icon Lucide kèm nhãn chữ** — icon-only nav vi phạm `nav-label-icon`, và ở đây còn tệ hơn: 8 icon không nhãn thì Sales phải đoán.
- Active: `usePathname()` + `aria-current="page"`. Màu không được là kênh duy nhất → active có cả nền `ink-100` **và** thanh chỉ thị.
- Badge số trên *Hàng đợi*: dùng lại `usePendingProposalCounts()` từ `components/proposal/pending-proposal-marker.tsx`. **Không viết query mới.**
- `rounded-pill` cho từng mục (token của P1).
- ≥1024px: thu về icon rail được, trạng thái lưu `localStorage`.

### Mobile <1024px

Hamburger → `Sheet` drawer. **Không làm bottom nav**: 8 mục vượt trần 5 của `bottom-nav-limit`, và trộn bottom nav với sidebar là vi phạm `avoid-mixed-patterns`.

### Footer

Một dòng: phiên bản · trạng thái AI · link `/huong-dan`. Giá trị thấp, nằm trong yêu cầu, giữ đúng một dòng.

## Related Code Files

- Create: `apps/web/src/app/(app)/layout.tsx`
- Create: `apps/web/src/components/shell/{app-shell,app-header,app-sidebar,app-footer,nav-items,ai-status-pill,breadcrumbs}.tsx`
- Move: `app/{cong-ty,dang-theo-doi,co-hoi,hang-doi,tong-quan,thong-bao,quan-tri}/` → `app/(app)/` — 7 thư mục, `dang-theo-doi` là của P7
- Modify: `apps/web/src/app/layout.tsx` — giữ font + QueryProvider, thêm `Toaster` của Sonner (P4 dùng)
- Modify: `e2e/login-and-create-company.spec.ts` — **chỉ khi C đồng ý**
- Đọc: `apps/web/src/middleware.ts` · `components/proposal/pending-proposal-marker.tsx`
- Không sửa: nội dung bất kỳ `page.tsx` nào (link `← Công ty` cũ để P4 dọn — để lại tạm thời **không sai**, chỉ dư)

## Tests First

1. **e2e mới `e2e/app-shell-navigation.spec.ts`** — viết trước khi dựng shell, phải đỏ:
   - Đăng nhập → từ `/cong-ty`, bấm **từng** mục sidebar → tới đúng route của nó, mỗi mục đúng 1 cú bấm. Spec **đọc số mục từ DOM** rồi đi hết, không hard-code con số — nav còn dài ra khi P8 thêm bảng điều khiển vào *Quản trị*, spec không được đỏ vì thế.
   - **Không mục nav nào dẫn tới 404.** Khẳng định này là thứ bắt được lỗi "thêm mục trỏ route chưa có".
   - Mục đang mở có `aria-current="page"`.
   - Ở 375px: sidebar ẩn, mở được bằng hamburger, mục bấm được.
   - `/dang-nhap` **không** có sidebar (khẳng định phủ định — đây là thứ dễ quên nhất).
   - **Không** khẳng định pill trạng thái AI có mặt: user của spec là Sales, `GET /settings` trả 403 nên pill vắng mặt là **đúng**. Khẳng định nó có mặt là khoá vào một hành vi ta vừa quyết định không làm.
2. Chạy `pnpm test:e2e` **ngay sau khi di chuyển thư mục, trước khi thêm shell**. Bước này tách "route group làm vỡ gì" khỏi "shell làm vỡ gì". Không gộp.

## Implementation Steps

1. Viết `app-shell-navigation.spec.ts`, chạy → đỏ.
2. `git mv` 7 thư mục route vào `(app)/`. Thêm `(app)/layout.tsx` **rỗng** (chỉ `{children}`).
3. **`pnpm test:e2e` ngay** — phải xanh y baseline. Đỏ ở đây nghĩa là có gì bám đường dẫn, dừng lại điều tra trước khi đi tiếp.
4. **Nói với C và B một lần**, gồm cả ba bàn giao của việc đảo thứ tự:
   - 5 thay đổi trong `e2e/` (thuộc C): `app-shell-navigation.spec.ts` (mới) · `ui-invariants.spec.ts` (P3, mới) · `tour-does-not-block.spec.ts` + `guide-page.spec.ts` (P5, mới) · dòng `Đăng xuất` trong `login-and-create-company.spec.ts` — **file duy nhất bị sửa**, bốn file kia là tạo mới nên không đụng T-8/T-9/T-10 C đang viết.
   - **P8 phải viết bảng điều khiển vào `app/(app)/quan-tri/`**, cạnh `nhat-ky-vong-quet/` của P7 (bàn giao 1, với C).
   - **P4 sẽ sửa `app/{cong-ty,co-hoi,tong-quan,hang-doi}/` trước, B rebase lên** (bàn giao 2, với B).
5. Dựng `nav-items.tsx` (một mảng: path, nhãn, icon) rồi `app-sidebar` đọc mảng đó. Một nguồn sự thật cho nav, không rải `<Link>` khắp nơi. **Chỉ đưa vào mảng route đã tồn tại.**
6. `app-header` + `breadcrumbs` + `ai-status-pill`. Pill theo quyết định ở mục [Pill trạng thái AI](#pill-trạng-thái-ai--không-đọc-được-thì-không-hiện): 200 thì hiện, 403/lỗi thì **không render gì** + `console.warn` một dòng. Không mặc định "bật".
7. `Sheet` cho mobile (`shadcn add sheet`).
8. `app-footer`.
9. `pnpm test:e2e` + kiểm tay ở 375px và 1440px.

## Success Criteria

- [ ] `app-shell-navigation.spec.ts` xanh, và đã từng đỏ
- [ ] `pnpm test` khớp baseline P1 (trừ dòng `Đăng xuất` đã thoả thuận)
- [ ] Không route nào đổi URL — `middleware.ts` không phải sửa
- [ ] `/dang-nhap` không có shell
- [ ] 8 mục nav đều có icon **và** nhãn chữ; active có nền **và** thanh chỉ thị, không chỉ màu
- [ ] **Không mục nav nào dẫn tới 404** — `nav-items.tsx` chỉ chứa route đã tồn tại
- [ ] Pill trạng thái AI: 403 thì **vắng mặt**, không có chuỗi "AI đang bật" nào render khi chưa đọc được giá trị thật
- [ ] Đã nói với C và B đủ **ba bàn giao** ở bước 4, trước khi `git mv`
- [ ] Badge *Hàng đợi* dùng lại `usePendingProposalCounts`, không query mới
- [ ] Mọi mục nav vùng chạm ≥44px
- [ ] Tab được hết bằng bàn phím, thứ tự tab khớp thứ tự nhìn
- [ ] 375px: không tràn ngang

## Risk Assessment

| Rủi ro | Xác suất | Đối sách |
| --- | --- | --- |
| **`Đăng xuất` làm đỏ spec của C** | **chắc chắn** | Đường đã chốt (sửa spec, thêm bước mở menu). Vẫn nói với C ở bước 4 trước khi gõ — gộp một lần cho cả 5 thay đổi trong `e2e/` của plan này |
| `git mv` làm hỏng import tương đối | thấp | Toàn repo dùng alias `@/`, không dùng `../..`. Bước 3 bắt được ngay |
| **`GET /settings` là admin-only → pill 403 ở mọi màn Sales** | **chắc chắn** | Không render pill khi không đọc được. Không mặc định "bật" — luật 4: một dòng sai tệ hơn một dòng trống |
| **C viết `app/quan-tri/` thay vì `app/(app)/quan-tri/`** | **cao nếu không báo** | Bàn giao 1 ở bước 4. Triệu chứng: màn quản trị không có sidebar. Sửa = `git mv` một thư mục, nhưng chỉ khi ai đó nhìn ra |
| **B đụng merge vì P4 sửa file của B trước** | TB | Bàn giao 2 ở bước 4. Báo trước khi `git mv`, không để B phát hiện lúc pull |
| Nav dài ra khi P5/P8 xong làm `app-shell-navigation.spec.ts` đỏ | TB | Spec đọc số mục từ DOM, không hard-code. Đã ghi ở Tests First |
| Sidebar chiếm chỗ, màn cơ hội (kéo thả dnd-kit) hẹp lại | TB | Icon rail thu được. Kiểm riêng màn `/co-hoi` ở 1024px vì nó là màn rộng nhất |
| Nav thành file dùng chung, đụng người khác | TB | `nav-items.tsx` là file mới, một mảng. Sửa nhỏ, pull trước khi push |

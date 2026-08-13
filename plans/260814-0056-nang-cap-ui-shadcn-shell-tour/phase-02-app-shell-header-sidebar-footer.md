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
app/(app)/quan-tri/…        ← P8 của plan cũ tạo; nếu chưa có thì bỏ qua
app/dang-nhap/              ← Ở NGOÀI group, không có shell
app/page.tsx                ← giữ nguyên, chỉ redirect
```

Thư mục bọc trong `()` **không tham gia vào đường dẫn** — `app/(app)/cong-ty/page.tsx` vẫn là `/cong-ty`. Nên e2e không hay biết. Đây là lý do chọn route group thay vì thêm điều kiện vào `layout.tsx` gốc: `/dang-nhap` không được có sidebar, và một `layout.tsx` phải `usePathname()` để quyết định là biến layout thành client component vô cớ.

**Kiểm ngay sau khi di chuyển:** `middleware.ts` có matcher nào bám đường dẫn không → route group không đổi path nên phải không ảnh hưởng, nhưng đọc để chắc.

### Header — `h-14`, sticky, `z-sticky`

| Thành phần | Ghi chú |
| --- | --- |
| Dải cam thương hiệu + logo | `brand-400` làm **nền**, không bao giờ làm chữ |
| Breadcrumb | Thay hết link `← Công ty` tự phát ở `tong-quan/page.tsx`, `cong-ty/[id]/page.tsx`… Xoá chúng ở P4 |
| Trigger ⌘K | P5 làm chức năng; P2 chỉ dựng nút |
| **Pill trạng thái AI** | Đọc endpoint settings của P8. AI tắt → pill `warning` + chữ "AI đang tắt". Phụ trợ yêu cầu banner của T-9, **không thay** banner |
| Chuông thông báo + số | `Link` sang `/thong-bao` |
| User menu | `DropdownMenu` — xem cảnh báo dưới |

### ⚠️ Nút `Đăng xuất` — chỗ chắc chắn vỡ

`e2e/login-and-create-company.spec.ts` có `getByRole('button', { name: 'Đăng xuất' })`. Nhét *Đăng xuất* vào `DropdownMenu` → Playwright phải mở menu trước → **đỏ**.

**Đã chốt: sửa spec, thêm bước mở user menu.** Đăng xuất thuộc user menu — đó là chỗ đúng của nó, và giữ một nút Đăng xuất cấp 1 trên header chỉ để test không phải sửa là để test lái thiết kế.

Phương án bị loại: giữ *Đăng xuất* hiện sẵn ở header desktop. Không phải sửa test, nhưng thêm một nút cấp 1 không đáng vào header và trái quy ước thông thường.

**Vẫn phải nói với C trước khi gõ** — `e2e/` thuộc chủ quyền C. Hỏi một lần cho cả **ba** file e2e của plan này: `ui-invariants.spec.ts` (P3), `tour-does-not-block.spec.ts` + `guide-page.spec.ts` (P5), cộng `app-shell-navigation.spec.ts` (phase này) và dòng sửa trong `login-and-create-company.spec.ts`.

### Sidebar

- 7 mục: Công ty · Cơ hội · Hàng đợi · Tổng quan · Thông báo · Quản trị · Hướng dẫn.
- **Icon Lucide kèm nhãn chữ** — icon-only nav vi phạm `nav-label-icon`, và ở đây còn tệ hơn: 7 icon không nhãn thì Sales phải đoán.
- Active: `usePathname()` + `aria-current="page"`. Màu không được là kênh duy nhất → active có cả nền `ink-100` **và** thanh chỉ thị.
- Badge số trên *Hàng đợi*: dùng lại `usePendingProposalCounts()` từ `components/proposal/pending-proposal-marker.tsx`. **Không viết query mới.**
- `rounded-pill` cho từng mục (token của P1).
- ≥1024px: thu về icon rail được, trạng thái lưu `localStorage`.

### Mobile <1024px

Hamburger → `Sheet` drawer. **Không làm bottom nav**: 7 mục vượt trần 5 của `bottom-nav-limit`, và trộn bottom nav với sidebar là vi phạm `avoid-mixed-patterns`.

### Footer

Một dòng: phiên bản · trạng thái AI · link `/huong-dan`. Giá trị thấp, nằm trong yêu cầu, giữ đúng một dòng.

## Related Code Files

- Create: `apps/web/src/app/(app)/layout.tsx`
- Create: `apps/web/src/components/shell/{app-shell,app-header,app-sidebar,app-footer,nav-items,ai-status-pill,breadcrumbs}.tsx`
- Move: `app/{cong-ty,co-hoi,hang-doi,tong-quan,thong-bao,quan-tri}/` → `app/(app)/`
- Modify: `apps/web/src/app/layout.tsx` — giữ font + QueryProvider, thêm `Toaster` của Sonner (P4 dùng)
- Modify: `e2e/login-and-create-company.spec.ts` — **chỉ khi C đồng ý**
- Đọc: `apps/web/src/middleware.ts` · `components/proposal/pending-proposal-marker.tsx`
- Không sửa: nội dung bất kỳ `page.tsx` nào (link `← Công ty` cũ để P4 dọn — để lại tạm thời **không sai**, chỉ dư)

## Tests First

1. **e2e mới `e2e/app-shell-navigation.spec.ts`** — viết trước khi dựng shell, phải đỏ:
   - Đăng nhập → từ `/cong-ty`, bấm **từng** mục sidebar → tới đúng 6 route còn lại, mỗi mục đúng 1 cú bấm.
   - Mục đang mở có `aria-current="page"`.
   - Ở 375px: sidebar ẩn, mở được bằng hamburger, mục bấm được.
   - `/dang-nhap` **không** có sidebar (khẳng định phủ định — đây là thứ dễ quên nhất).
2. Chạy `pnpm test:e2e` **ngay sau khi di chuyển thư mục, trước khi thêm shell**. Bước này tách "route group làm vỡ gì" khỏi "shell làm vỡ gì". Không gộp.

## Implementation Steps

1. Viết `app-shell-navigation.spec.ts`, chạy → đỏ.
2. `git mv` 6 thư mục route vào `(app)/`. Thêm `(app)/layout.tsx` **rỗng** (chỉ `{children}`).
3. **`pnpm test:e2e` ngay** — phải xanh y baseline. Đỏ ở đây nghĩa là có gì bám đường dẫn, dừng lại điều tra trước khi đi tiếp.
4. Nói với C **một lần** về đủ 5 thay đổi trong `e2e/`: `app-shell-navigation.spec.ts` (mới) · dòng `Đăng xuất` trong `login-and-create-company.spec.ts` · `ui-invariants.spec.ts` (P3) · `tour-does-not-block.spec.ts` + `guide-page.spec.ts` (P5). Không hỏi lắt nhắt từng phase.
5. Dựng `nav-items.tsx` (một mảng: path, nhãn, icon) rồi `app-sidebar` đọc mảng đó. Một nguồn sự thật cho nav, không rải `<Link>` khắp nơi.
6. `app-header` + `breadcrumbs` + `ai-status-pill`. Nếu endpoint settings của P8 chưa có thì pill đọc trạng thái mặc định "bật" và **để TODO nhìn thấy được**, không giả số.
7. `Sheet` cho mobile (`shadcn add sheet`).
8. `app-footer`.
9. `pnpm test:e2e` + kiểm tay ở 375px và 1440px.

## Success Criteria

- [ ] `app-shell-navigation.spec.ts` xanh, và đã từng đỏ
- [ ] `pnpm test` khớp baseline P1 (trừ dòng `Đăng xuất` đã thoả thuận)
- [ ] Không route nào đổi URL — `middleware.ts` không phải sửa
- [ ] `/dang-nhap` không có shell
- [ ] 7 mục nav đều có icon **và** nhãn chữ; active có nền **và** thanh chỉ thị, không chỉ màu
- [ ] Badge *Hàng đợi* dùng lại `usePendingProposalCounts`, không query mới
- [ ] Mọi mục nav vùng chạm ≥44px
- [ ] Tab được hết bằng bàn phím, thứ tự tab khớp thứ tự nhìn
- [ ] 375px: không tràn ngang

## Risk Assessment

| Rủi ro | Xác suất | Đối sách |
| --- | --- | --- |
| **`Đăng xuất` làm đỏ spec của C** | **chắc chắn** | Đường đã chốt (sửa spec, thêm bước mở menu). Vẫn nói với C ở bước 4 trước khi gõ — gộp một lần cho cả 5 thay đổi trong `e2e/` của plan này |
| `git mv` làm hỏng import tương đối | thấp | Toàn repo dùng alias `@/`, không dùng `../..`. Bước 3 bắt được ngay |
| Pill trạng thái AI phụ thuộc endpoint P8 chưa tồn tại | TB | Mặc định "bật" + TODO nhìn thấy được. **Không giả số** — luật 4: một dòng sai tệ hơn một dòng trống |
| Sidebar chiếm chỗ, màn cơ hội (kéo thả dnd-kit) hẹp lại | TB | Icon rail thu được. Kiểm riêng màn `/co-hoi` ở 1024px vì nó là màn rộng nhất |
| Nav thành file dùng chung, đụng người khác | TB | `nav-items.tsx` là file mới, một mảng. Sửa nhỏ, pull trước khi push |

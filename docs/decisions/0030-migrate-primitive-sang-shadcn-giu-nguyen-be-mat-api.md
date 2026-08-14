# ADR-0030 · Migrate primitive sang shadcn, giữ nguyên bề mặt API

- **Ngày:** 2026-08-14
- **Trạng thái:** Đã chốt
- **Liên quan:** [ADR-0027](./0027-nut-hoan-tac-nam-tren-the-co-hoi-du-lieu-di-qua-endpoint-rieng.md) · [design-guidelines](../design-guidelines.md) · [plan 260814-0056](../../plans/260814-0056-nang-cap-ui-shadcn-shell-tour/plan.md)

## Bối cảnh

Giao diện có hai vấn đề khác nhau bị gộp làm một khi nói "UI xấu":

1. **Không có đường đi giữa các màn.** `layout.tsx` chỉ có font và `QueryProvider`; bảy route mỗi trang tự dựng `<main>` và tự phát một link `← Công ty`. BGK phải gõ URL để đi giữa các màn.
2. **Sáu primitive viết tay** trong `components/ui/`, trong đó `button.tsx` mang comment *"Hand-written rather than pulled from shadcn/ui"*.

Vấn đề 1 là lỗ sản phẩm thật. Vấn đề 2 là chuyện nền móng.

## Quyết định

**Chuyển sáu primitive sang nền shadcn (Radix + cva), giữ nguyên bề mặt API**, và dựng app shell dùng chung. Nguyên tắc chi phối: **đổi ruột, khoá vỏ** — prop và accessible name đóng băng, chỉ nội thất và class được đổi.

Lý do đảo được comment cũ của `button.tsx`: đường import đã chừa sẵn từ đầu (`@/components/ui/button`), nên đổi ruột không lan ra call site nào.

**Hai chỗ cố ý cãi lại mặc định của shadcn**, và đây là phần đáng giá nhất của quyết định:

| Chỗ | shadcn mặc định | Ta giữ | Vì sao |
| --- | --- | --- | --- |
| `Button` chiều cao | `h-9` = **36px** | `min-h-11` = **44px** | Sales mở sản phẩm này trên điện thoại giữa hai cuộc họp. 36px là cỡ ngón tay bấm trượt |
| `Badge` API | `variant`: `default` / `secondary` / `destructive` / `outline` | `tone`: `neutral` / `fact` / `inference` / `system` / `warning` / `success` | Bốn tên của shadcn tả được badge to nhỏ, **không tả được ai sinh ra dòng này**. Đó chính là chỗ [luật 2](../../CLAUDE.md#2-bảy-luật-bất-di-bất-dịch) được ép |

Nhận nguyên hai mặc định đó sẽ **xoá mất một luật trong khi mọi test hiện có vẫn xanh** — đó là lý do `e2e/ui-invariants.spec.ts` tồn tại.

## Phương án bị loại

**A · Chỉ làm app shell, không đụng primitive** (2–3h, rủi ro e2e ~0). Bịt đúng lỗ sản phẩm thật và gần như không thể làm đỏ bộ nghiệm thu. Loại vì không đạt yêu cầu "nâng cấp UI toàn diện" mà người dùng đặt ra.

**B · shadcn map-token chọn lọc** (5–7h) — **đây là phương án người phản biện khuyến nghị**: giữ `Button` / `Badge` / `Table` / `Input` viết tay vì chúng cõng luật 1–3, chỉ lấy shadcn cho những component mới. Loại theo quyết định của người dùng, sau khi đã nghe lập luận. Rủi ro của việc bác nó được bù bằng `ui-invariants` + commit tách từng primitive để `git revert` được đúng thủ phạm.

## Sáu quyết định phụ

1. **`shadcn add`, không `shadcn init`.** `init` ghi theme riêng (`--background`, palette oklch), thêm block `.dark` và kéo `tw-animate-css` vào `globals.css` — đụng trực diện khối `@theme` hiện có và điều cấm "chỉ nền sáng". Viết tay `components.json`, kiểm `globals.css` bằng `diff` sau mỗi lần `add`.
2. **Không oval hoá toàn cục.** Nâng `--radius-card` lên `1rem` và thêm `--radius-pill`; **bảng và ô nhập giữ cạnh thẳng**, vì trên màn dày dữ liệu cạnh thẳng là thứ mắt dùng để căn cột.
3. **`driver.js` thay vì react-joyride** — 5KB, không peer dependency vào React, nạp bằng `import()` nên không vào bundle trang đầu.
4. **Bất biến khoá bằng e2e computed-style, không bằng unit test.** `vitest.config.mts` có `projects: ['packages/*', 'apps/api']` — `apps/web` không nằm trong đó, và repo không có `@testing-library/react` hay `jsdom`. Dựng hạ tầng test component mới vào đêm trước freeze là việc không đáng; đo trên stack production còn mạnh hơn vì nó kiểm **pixel người dùng thấy**, không kiểm chuỗi class.
5. **Tour không auto-run.** Bản đầu định chạy lần đầu rồi chặn bằng cờ `localStorage`. Cờ đó **không có chỗ để ghi**: `playwright.config.ts` không đặt `storageState` và `e2e/global-setup.ts` chỉ reseed, nên `localStorage` rỗng ở mọi spec và tour sẽ phủ overlay lên cả năm spec. Hai đường vào, cả hai cần người bấm: nút header và `?tour=1`.
6. **Pill trạng thái AI: đọc được thì hiện, không đọc được thì không hiện gì.** `GET /settings` là `@Roles('admin')`, nên Sales ăn 403 ở mọi màn. Bản đầu định mặc định hiện "AI đang bật" khi lỗi — đó là **bịa một dòng trạng thái vào đúng lúc máy đang tắt**, trái [luật 4](../../CLAUDE.md#2-bảy-luật-bất-di-bất-dịch). Loại luôn phương án nới `@Roles` (sửa `apps/api/`, là quyết định về quyền hạn, cần ADR riêng).

## Cách verify — nêu tên test, không nói "đã test"

| Bất biến | Test |
| --- | --- |
| Vùng chạm ≥44px trên `/cong-ty` và `/hang-doi` | `e2e/ui-invariants.spec.ts` **T-A** — `boundingBox().height >= 44` |
| Nút chính mang nền `rgb(255,194,15)` + chữ tối; `danger` không mang nền đó | **T-B** — `getComputedStyle` |
| Nhãn máy mang màu tím, nhãn dữ liệu người nhập thì không | **T-C** — `getComputedStyle`, đo trên công ty Marlin (không spec nào khác đụng) |
| `getByLabel` còn tìm ra ô nhập sau migrate | **T-D** |
| Hộp thoại có accessible name và đóng bằng Escape | **T-E** |
| Cờ cảnh báo mang chữ đọc được | **T-F** |
| Mọi màn tới được bằng 1 cú bấm, không mục nav nào 404 | `e2e/app-shell-navigation.spec.ts` |
| Tour không tự chạy · `?tour=1` chạy · nút header chạy | `e2e/tour-does-not-block.spec.ts` — ba nhánh |
| `/huong-dan` đủ bốn vùng, mọi link không 404 | `e2e/guide-page.spec.ts` |
| Nút Hoàn tác cấp 1 còn bấm được sau khi toast tắt | `e2e/t6-t7-auto-next-step-and-undo.spec.ts` |

**Baseline vs sau khi làm:** unit **225/225 → 225/225** (không đổi). e2e **11 → 26**, lệch đúng 15 test của bốn spec mới có chủ đích. `pnpm test` EXIT 0.

**T-E là test đã bắt được lỗi thật**, không phải test viết cho đẹp: thẻ `<dialog>` gốc render tiêu đề thành `<h2>` mà không có gì trỏ tới, nên trình đọc màn hình đọc "dialog" rồi dừng. Radix bắt buộc `DialogTitle` và tự nối `aria-labelledby`.

## Tái khẳng định

**Chỉ nền sáng, không đổi.** Mọi thứ CLI sinh ra có dính nền tối đều đã gỡ: block `.dark`, `next-themes` mà `shadcn add sonner` kéo theo, và các class `animate-in` thuộc `tw-animate-css` (chạy quá trần 300ms).

## Hệ quả

- **Tên semantic của shadcn (`bg-background`, `text-primary`) chỉ được dùng trong `components/ui/`.** Nếu dùng được ở mọi nơi thì repo có hai từ vựng cho một màu, và điều cấm "không dùng class màu thô" mất hiệu lực trong im lặng — `bg-background` lọt qua mọi lần grep mà không nói cho người đọc biết đó là màu gì. Luật đã ghi vào design-guidelines; kiểm ở mục 11 checklist.
- **`components/ui/` giờ có file do CLI sinh.** Mỗi lần `shadcn add` phải đọc lại file nó vừa ghi trước khi tin. Đã xảy ra thật: `shadcn add command` hỏi ghi đè `dialog.tsx` — file vừa mang toàn bộ lý do của lần chuyển sang Radix. Bảng lệnh cuối cùng viết tay bằng `cmdk`.
- **Mục *Quản trị* chưa có trên thanh bên** vì `/quan-tri` chưa tồn tại. Thêm lại là một dòng trong `nav-items.tsx` khi màn quản trị ship.

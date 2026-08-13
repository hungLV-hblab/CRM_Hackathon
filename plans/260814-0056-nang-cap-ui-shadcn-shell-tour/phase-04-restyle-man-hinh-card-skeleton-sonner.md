---
phase: 4
title: "Restyle màn hình — Card, Skeleton, Sonner"
status: pending
priority: P3
effort: "1h30'"
dependencies: [2, 3]
---

# Phase 4: Restyle màn hình — Card, Skeleton, Sonner

## Overview

Lớp sơn thứ hai: bọc `Card`, thay chuỗi "Đang tải…" bằng `Skeleton`, thêm toast, dọn các link `← Công ty` mà P2 đã thay bằng breadcrumb.

**Phase cắt được.** Nếu hết giờ thì bỏ — P1+P2+P3 đã đổi diện mạo đủ rõ. Xem thứ tự cắt ở [plan.md](./plan.md).

## Requirements

- Functional: khối thông tin nằm trong `Card` có bo `radius-card` mới · trạng thái tải hiện `Skeleton` chứ không phải một dòng chữ · link `← Công ty` tự phát bị xoá vì breadcrumb đã gánh việc đó.
- Non-functional: `pnpm test` khớp baseline · **không đổi một accessible name nào** · nút Hoàn tác 7 ngày còn nguyên hành vi.

## ⚠️ Sonner là THÊM, không THAY

`components/next-step/auto-next-step-cell.tsx` có nút Hoàn tác **tồn 7 ngày** (vùng tự chủ 3, nghiệm thu T-7). Toast sống 5 giây.

**Thay nút Hoàn tác bằng toast là phá [luật 3](../../CLAUDE.md#2-bảy-luật-bất-di-bất-dịch)** ("sửa lại phải dễ hơn cả lúc máy làm") **và làm hỏng T-7.** design-guidelines nói thẳng: *"Hoàn tác là nút cấp 1, không giấu trong menu ⋯"*.

Toast được dùng cho đúng ba việc, và chỉ ba việc:

1. Xác nhận đã lưu (thêm công ty, sửa ô) — thay `alert`/không phản hồi hiện tại.
2. Xác nhận đã duyệt / đã bỏ một gợi ý.
3. Báo lỗi mạng khi mutation thất bại.

Không toast nào mang hành động Hoàn tác thay cho nút. Nếu muốn tiện, toast **có thể** thêm nút Hoàn tác **bên cạnh** nút cấp 1 vẫn đứng nguyên — hai đường về cùng một chỗ, không phải một đường thay đường kia.

## Architecture

| Màn | Làm gì |
| --- | --- |
| `tong-quan` | 4 khối → `Card`. Khối "Việc tiếp theo quá hạn" **giữ vị trí đầu tiên** (luật 5: nhịp tim đập vào mắt trước). Xoá link `← Công ty` |
| `cong-ty` (danh sách) | Bảng giữ nguyên API, bọc `Card`. Vùng lọc → `Card` riêng, filter chip `rounded-pill` |
| `cong-ty/[id]` | 3 section → `Card`. Vùng đọc/phát hiện **giữ nền `machine-50` + nhãn "do AI sinh"** — không được để `Card` trắng ăn mất tín hiệu tím. Xoá link back |
| `co-hoi` | Thẻ cơ hội → `Card`. **Kiểm kéo thả dnd-kit sau khi bọc** — `Card` thêm một lớp DOM giữa sensor và node |
| `hang-doi` | Thẻ gợi ý → `Card` + `ring-machine-200`. Hai nút Duyệt/Bỏ **giữ cạnh bằng chứng**, không tách ra chân thẻ |
| `thong-bao` | `Card` + `Skeleton` |
| Mọi màn | `overview.isPending && <p>Đang tải…</p>` → `Skeleton` cùng hình dáng nội dung thật (tránh nhảy layout) |

`PageHeader` (tiêu đề + mô tả + slot hành động) đặt ở `components/shell/page-header.tsx`, dùng chung cho 6 màn.

## Related Code Files

- Create: `apps/web/src/components/shell/page-header.tsx`
- Modify: `app/(app)/tong-quan/page.tsx` · `app/(app)/cong-ty/page.tsx` · `app/(app)/cong-ty/[id]/{page,company-profile-section,contact-section,timeline-section}.tsx` · `app/(app)/co-hoi/{page,opportunity-card,stage-board}.tsx` · `app/(app)/hang-doi/{page,proposal-card}.tsx` · `app/(app)/thong-bao/page.tsx`
- Modify: mutation call site — thêm toast thành công/lỗi
- **Đọc, không sửa hành vi:** `components/next-step/auto-next-step-cell.tsx`

> **Chủ quyền:** `app/{cong-ty,co-hoi,tong-quan,hang-doi}/` **thuộc B** trong bảng chủ quyền của plan 260813-0107. Phase này đụng gần hết. Phải chờ B xong P8 hoặc thoả thuận trước.

## Tests First

Phase này **không thêm hành vi mới**, nên tests-first ở đây là **khoá cái không được đổi**:

1. Trước khi sửa `co-hoi`: chạy riêng `e2e/t1-crm-without-ai.spec.ts` (nó lái kéo thả qua `KeyboardSensor` — đường lái chính của T-1), ghi lại kết quả. Chạy lại **sau** khi bọc `Card`. Đây là test duy nhất có thể bị `Card` làm vỡ.
2. Trước khi thêm toast: chạy riêng `e2e/t6-t7-auto-next-step-and-undo.spec.ts`, ghi kết quả. Chạy lại sau. Nó khoá nút Hoàn tác 7 ngày.
3. Khẳng định thêm vào spec T-6/T-7 (viết trước khi thêm toast): **nút Hoàn tác cấp 1 vẫn tồn tại và bấm được sau khi toast đã tự tắt**. Không có khẳng định này thì không có gì ngăn người sau gỡ nút đi vì "đã có toast".

## Implementation Steps

1. `shadcn add sonner` + `Toaster` vào `app/layout.tsx` (P2 đã chừa chỗ).
2. `page-header.tsx`, áp cho `tong-quan` trước — màn đơn giản nhất, không có AI, không có kéo thả.
3. Lan sang `cong-ty` danh sách → `thong-bao` → `cong-ty/[id]` → `hang-doi`.
4. `co-hoi` **làm cuối** vì kéo thả. Chạy T-1 riêng trước và sau.
5. Toast: thêm khẳng định ở bước Tests First mục 3 → **rồi** mới thêm toast.
6. Xoá các link `← Công ty` tự phát. `grep -rn "← Công ty" apps/web/src` để không sót.
7. `Skeleton` thay mọi chuỗi "Đang tải…": `grep -rn "Đang tải" apps/web/src`.
8. `pnpm test` đủ.

## Success Criteria

- [ ] `pnpm test` khớp baseline P1
- [ ] T-1 xanh sau khi bọc `Card` quanh thẻ cơ hội (kéo thả + đường bàn phím còn chạy)
- [ ] T-6/T-7 xanh, **và** có khẳng định mới: nút Hoàn tác cấp 1 còn bấm được sau khi toast tắt
- [ ] Vùng đọc/phát hiện vẫn nền `machine-50` + nhãn "do AI sinh" — `Card` không ăn mất tín hiệu tím
- [ ] Thẻ gợi ý: hai nút Duyệt/Bỏ vẫn nằm cạnh bằng chứng trong cùng thẻ
- [ ] `grep -rn "← Công ty\|Đang tải" apps/web/src` rỗng
- [ ] Khối "Việc tiếp theo quá hạn" vẫn đứng đầu màn tổng quan
- [ ] Không accessible name nào bị đổi

## Risk Assessment

| Rủi ro | Xác suất | Đối sách |
| --- | --- | --- |
| **`Card` bọc thẻ cơ hội làm vỡ dnd-kit** | TB | Làm `co-hoi` cuối cùng, chạy T-1 riêng trước/sau. Vỡ thì bỏ `Card` đúng ở màn đó |
| Toast bị coi là đã thay được nút Hoàn tác | TB | Khẳng định e2e ở Tests First mục 3. Đây là chỗ dễ mất T-7 nhất |
| `Card` nền trắng phủ mất nền `machine-50` của vùng AI | **cao** | Vùng AI dùng `Card` với `className` nền tím, hoặc không dùng `Card`. Kiểm bằng mắt từng chỗ có nhãn "do AI sinh" |
| Đụng file của B | **cao** | Chờ B xong P8. Phase này cắt được nên không đáng tranh chấp |
| `Skeleton` sai hình dáng → nhảy layout | thấp | Skeleton phải cùng số dòng/cỡ với nội dung thật |

---
phase: 7
title: "/thong-bao — trang riêng"
status: pending
priority: P2
dependencies: [6]
---

# Phase 7: /thong-bao — trang riêng

## Overview

Thiết kế lại `/thong-bao` thành trang lịch sử đúng nghĩa: chưa đọc phân biệt được với đã đọc, có "Đánh dấu tất cả đã xem", có phân trang. Đây là yêu cầu UX gốc của người dùng ("nút Đã xem đã có nhưng UI/UX chưa phù hợp").

Bản plan đầu đặt tiêu chí "T-6/T-7 không gãy" — red team chứng minh tiêu chí đó **bất khả thi theo cấu trúc**. Bản này sửa cách tiếp cận: T-7 được sửa **có chủ đích**, kèm ràng buộc rõ về cái gì được đổi và cái gì không.

## Ràng buộc từ bài nghiệm thu — đọc trước khi chạm code

`e2e/t6-t7-auto-next-step-and-undo.spec.ts:163-179` mở `/thong-bao` rồi:

1. `expect(getByTestId('notification-strip')).toContainText(OPPORTUNITY)` — dùng **testid của strip** ngay trên trang này. Phase này gỡ strip khỏi trang → selector chết chắc chắn.
2. Bấm "Đã xem" rồi `expect(row).toContainText('Đã xem')` — đây là **chỗ duy nhất** trong toàn bộ suite chứng minh "đánh dấu chứ không xoá", tức là bằng chứng cho ontology 3.3.

Hai hệ quả bắt buộc:

- Trang mới phải phơi một **testid ổn định** cho container, và T-7 được sửa sang testid đó — sửa có chủ đích, ghi vào commit message, không phải vá cho xanh.
- Trạng thái đã đọc **phải giữ một dấu hiệu bằng chữ** (ví dụ nhãn "Đã xem" trên dòng đã đọc), không chỉ chấm màu + làm mờ. Hai lý do độc lập: nó giữ được bằng chứng của T-7, và luật 2 design-guidelines vốn đã cấm phân biệt chỉ bằng màu.

## Requirements

- Functional: danh sách phẳng mới→cũ; chưa đọc nổi bật, đã đọc mờ **nhưng vẫn có nhãn chữ**; "Đã xem" ở dòng chưa đọc; "Đánh dấu tất cả đã xem" ở header, disable khi hết chưa đọc; "Hoàn tác" khi `canUndo`; điều khiển trang.
- Non-functional: strip trên `/co-hoi` giữ nguyên hành vi (chưa đọc, gộp theo câu); `read_at` chỉ ghi khi người bấm; **không thông báo nào còn hạn hoàn tác mà không tới được từ UI**.
- Design: checklist mục 7 design-guidelines; tím `machine-*` cho nội dung máy sinh, cam `brand-*` cho việc người sắp bấm; vùng chạm ≥44px.

## Architecture

- Tách `notification-row.tsx`: render một dòng (nội dung + Hoàn tác + Đã xem), nhận props, không tự fetch. Strip dùng cho từng group (giữ logic gộp), trang dùng cho từng dòng.
- Về ADR-0027: comment ở `thong-bao/page.tsx:12-16` nói "hai danh sách sẽ là hai cách hiện thực của luật không-biến-mất". Việc tách một component **render** dùng chung không tạo hai hiện thực — luật đó sống ở tầng dữ liệu (`read_at`, và `crm_system` không có quyền trên cột đó). Ghi một dòng vào ADR-0027 nói rõ ranh giới này, **trước** khi tách, không phải sau khi bị hỏi.
- Trang quản state `page`, gọi `api.listNotifications({ page, pageSize: 20 })` với key `['notifications', {unreadOnly, page, pageSize}]` (chốt ở phase 6), `placeholderData: keepPreviousData`.
- Giữ nguyên đoạn giải thích ở header trang (cửa sổ hoàn tác 7 ngày không phụ thuộc đã xem hay chưa).

## Related Code Files

- Create: `apps/web/src/components/notification/notification-row.tsx`
- Modify: `apps/web/src/components/notification/notification-strip.tsx`
- Rewrite: `apps/web/src/app/(app)/thong-bao/page.tsx`
- **Modify: `e2e/t6-t7-auto-next-step-and-undo.spec.ts:163-179`** (testid + dấu hiệu đã đọc — sửa có chủ đích)
- Modify: `docs/decisions/0027-*.md` (một dòng về ranh giới data/layout)
- Đọc, có thể phải sửa: `e2e/responsive-no-horizontal-overflow.spec.ts` (có assert `/thong-bao`)
- Create: `e2e/notification-history-page.spec.ts`

## Implementation Steps

1. Đọc trọn `t6-t7-auto-next-step-and-undo.spec.ts` phần `/thong-bao` và `responsive-no-horizontal-overflow.spec.ts`; ghi ra danh sách selector sẽ đổi **trước khi** sửa component.
2. Ghi một dòng ranh giới vào ADR-0027.
3. **Test đỏ trước** (e2e mới):
   - Sau khi hệ thống tự đặt Việc tiếp theo: `/thong-bao` có dòng chưa đọc nổi bật; bấm "Đã xem" → dòng chuyển sang trạng thái đã đọc **và vẫn còn trên trang**; strip trên `/co-hoi` mất dòng đó.
   - "Đánh dấu tất cả đã xem" → mọi dòng chưa đọc thành đã đọc, nút disable.
   - Hoàn tác vẫn bấm được sau khi đã "Đã xem".
   - Phân trang: dùng `pageSize` nhỏ trong test thay vì cố tạo >20 thông báo — `seed()` **không tạo notification nào** (`seed/index.ts:50-68`), thông báo chỉ sinh khi vòng quét ghi vào cơ hội đang mở, nên kịch bản ">20 dòng" không dựng được rẻ.
4. Tách `notification-row.tsx`, refactor strip dùng nó — chạy cụm T-6/T-7 ngay sau bước này, trước khi đụng trang.
5. Viết lại page.
6. Sửa T-7 sang testid mới.
7. Checklist design-guidelines; chạy e2e đầy đủ.

## Success Criteria

- [ ] Chưa đọc vs đã đọc phân biệt được **cả khi bỏ màu** (dấu hiệu bằng chữ)
- [ ] T-6/T-7 xanh sau khi sửa selector có chủ đích; assertion "đánh dấu chứ không xoá" vẫn còn nguyên ý nghĩa
- [ ] Không có đường nào ghi `read_at` ngoài hành động bấm của người
- [ ] Không thông báo nào còn hạn hoàn tác mà không tới được từ UI

## Risk Assessment

- Refactor strip là chỗ dễ gãy T-6 nhất → tách component và chạy cụm T-6/T-7 **trước** khi viết lại trang, để biết lỗi đến từ đâu.
- Cám dỗ "sửa selector cho xanh" khi T-7 đỏ: sai. Phải hỏi trước "assertion này đang chứng minh điều gì" rồi giữ lại điều đó bằng selector mới.

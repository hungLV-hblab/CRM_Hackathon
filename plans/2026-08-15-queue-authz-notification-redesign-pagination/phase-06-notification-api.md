---
phase: 6
title: "Thông báo — API"
status: pending
priority: P1
dependencies: [1]
---

# Phase 6: Thông báo — API

## Overview

Ba việc: fix bug `markRead` không scope theo actor, thêm `read-all`, và phân trang `GET /notifications`. Kèm ba lỗi mà red team bắt được trong bản plan đầu: `z.coerce.boolean()` sai, cache key dùng chung sai, và hai test API tiêu thụ shape cũ mà plan không liệt kê.

## Requirements

- Functional: `markRead` chỉ tác động thông báo của chính actor (id người khác → 404); `POST /notifications/read-all`; `GET /notifications?page&pageSize&unreadOnly` envelope `Paginated<NotificationDto>`.
- Non-functional: một endpoint duy nhất (khác param), `canUndo` vẫn tính bằng giờ server, không endpoint tạo/xoá notification.
- **Bất biến phải giữ**: không thông báo nào còn hạn hoàn tác mà mất mọi lối vào từ UI.

## Architecture

### Ba lỗi của bản plan đầu, và cách sửa

**1. `unreadOnly` không được dùng `z.coerce.boolean()`.** Zod 3: đó là `Boolean(input)`, nên `"false"` → `true`. `toQueryString` (`api-client.ts:84-93`) chỉ bỏ `undefined`/`''`, nên `false` được gửi thành chuỗi `"false"` → server hiểu ngược. Dùng `booleanQuerySchema` từ phase 1 (`z.enum(['true','false']).transform(...)`), đúng pattern đã có ở `company.controller.ts:52-58`. **Test phải có case `unreadOnly=false`**, không chỉ `true` — bản đầu chỉ test `true` nên bug sẽ xanh qua suite.

**2. Cache key phải mang tham số.** Strip hiện dùng key hằng `['notifications']` cho cả hai chế độ (`notification-strip.tsx:46-49`); điều đó đúng khi `show` chỉ lọc client-side (`:68`). Khi phase này làm `queryFn` phụ thuộc `show`, một key cho hai request khác nhau nghĩa là ai mount trước thắng cache: mở `/co-hoi` (strip nạp tập chưa-đọc) rồi bấm "Xem tất cả thông báo" → `/thong-bao` render tập chưa-đọc như thể là toàn bộ lịch sử — đúng thứ ADR-0027 nói route đó sinh ra để chống.
→ Key chuẩn: `['notifications', { unreadOnly, page, pageSize }]`; invalidate bằng prefix `['notifications']` vẫn chạy. **Chốt ở phase này**, phase 7 thừa kế.

**3. Trạng thái tạm của `/thong-bao` không được cắt còn 20 dòng.** Phase này đổi endpoint từ "tất cả" sang "trang 1 của 20" trong khi trang chưa có UI chuyển trang (phase 7 mới làm). Nếu để vậy, một thông báo đã đọc còn trong hạn hoàn tác có thể không tới được từ đâu cả: strip lọc bỏ vì đã đọc, trang chỉ hiện 20 dòng mới nhất.
→ Trong phase này, `/thong-bao` gọi `pageSize=100` (giống trần tạm của strip). Ghi nhận đây là trần, không phải giải pháp.

### Thay đổi service

- `list(actor, { page, pageSize, unreadOnly })`: `where` gồm `userId` + (`unreadOnly` → `isNull(readAt)`); `orderBy(desc(createdAt), desc(id))` — **khoá phụ `id`** theo ADR-0047, vì `created_at` không unique và vòng quét chạy 10s/lần trong e2e nên race là thật; `limit/offset`; `count(*)` cùng điều kiện.
- `markRead(actor, id)`: gộp select+update thành một `update ... where and(eq(id), eq(userId, actor.userId))`; không row → `NotFoundException`.
- `readAll(actor)`: `update ... set readAt=now() where and(eq(userId), isNull(readAt))`, 204.
- Controller: `@Post('read-all')` **đặt trước** `@Post(':id/read')` để không bị `:id` nuốt.

## Related Code Files

- Modify: `apps/api/src/domain/notification/notification-service.ts`, `notification.controller.ts`
- Modify: `packages/contracts/src/dto/notification.ts` — **đã tồn tại** (bản plan đầu ghi nhầm là Create); thêm `listNotificationsQuerySchema`
- Modify: `apps/web/src/lib/api-client.ts`
- Modify: `apps/web/src/components/notification/notification-strip.tsx` (tối thiểu: key + `.items`)
- Modify: `apps/web/src/app/(app)/thong-bao/page.tsx` (tạm: `pageSize=100`)
- **Modify: `apps/api/src/domain/opportunity/__tests__/t6-t7-auto-next-step-and-undo.test.ts:258-266` và `:574-582`** — gọi `notifications.list(sales)` rồi `expect(list).toHaveLength(1)`, `list[0].readAt`. `Paginated<T>` không có `.length` → gãy typecheck. Sửa thành `.items`, **không** ép kiểu `any`.
- Create: `apps/api/src/domain/notification/__tests__/notification-scope-and-pagination.test.ts` (thư mục `__tests__` của notification **chưa tồn tại**; copy harness từ `overview/__tests__/overview-owner-scoping.test.ts`)

## Implementation Steps

1. **Test đỏ trước**:
   - User B `markRead` id của A → 404; `readAt` của A không đổi.
   - `read-all` của A: chỉ thông báo chưa đọc của A đổi; của B nguyên vẹn; gọi lần 2 → 204, không đổi gì.
   - `list` page=1/pageSize=2 với 5 thông báo → 2 items, `total=5`, mới→cũ; page=3 → 1 item.
   - `unreadOnly=true` → chỉ chưa đọc; **`unreadOnly=false` → cả hai loại** (case bắt bug zod).
   - Hai thông báo cùng `created_at` → không dòng nào xuất hiện hai trang, không dòng nào mất (khoá phụ `id`).
   - `read-all` không bị route `:id/read` nuốt.
2. Sửa service + controller + schema contracts (dùng `booleanQuerySchema` của phase 1).
3. Sửa api-client, strip (key + `.items`), `/thong-bao` tạm `pageSize=100`.
4. **Sửa `t6-t7-...test.ts` hai chỗ** sang `.items`.
5. Chạy: test mới → cụm T-6/T-7 → `pnpm typecheck` → e2e liên quan strip.

## Success Criteria

- [ ] Không còn đường đánh dấu hộ thông báo người khác
- [ ] `unreadOnly=false` trả cả đã đọc lẫn chưa đọc (test chứng minh)
- [ ] Cache key mang tham số; không thông báo nào còn hạn hoàn tác mà mất lối vào
- [ ] `t6-t7-...test.ts` xanh, không dùng `any`

## Risk Assessment

- `apps/web` **không có test nào** và không nằm trong `vitest.config.mts:6` — lưới an toàn duy nhất cho phía web là `tsc --noEmit` + Playwright. Đừng viết tiêu chí nghiệm thu như thể có unit test web.
- Nhánh empty-state của strip (`notification-strip.tsx:73-81`) sẽ nổ nếu `.items` là `undefined` khi server trả 400 (ví dụ `page` sai) — thêm phòng vệ hoặc test.
- `read-all` là ghi **một chiều**: không cột lịch sử, revert commit không khôi phục NULL, reset duy nhất là `pnpm reset && pnpm seed` (TRUNCATE). Cân nhắc hỏi xác nhận trước khi bấm, ít nhất trước demo.

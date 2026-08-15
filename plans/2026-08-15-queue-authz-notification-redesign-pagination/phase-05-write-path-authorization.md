---
phase: 5
title: "Phân quyền đường GHI (gồm lỗ undo)"
status: pending
priority: P1
dependencies: [2, 3]
---

# Phase 5: Phân quyền đường GHI (gồm lỗ undo)

## Overview

Đóng mọi đường một sale ghi được vào phạm vi người khác. Trong đó có **lỗ đang tồn tại** mà người dùng đã yêu cầu vá ngay: sale B ghi đè được Việc tiếp theo trên cơ hội của sale A qua nút Hoàn tác.

Đây là phần nặng ký nhất của cả plan: đường ghi mà hở thì hàng rào đọc ở phase 4 chỉ là trang trí.

## Lỗ undo — mô tả chính xác

`AutoNextStepService.undo()` (`auto-next-step-service.ts:377-383`) chỉ chặn hai thứ: actor là hệ thống, và quá hạn 7 ngày. `loadUndoable` (`:438-448`) select theo `eventId` đơn thuần — **không kiểm tra chủ sở hữu**. Kết hợp với `listActive()` (`:325-341`, không nhận actor) vốn phát ra mọi `eventId` trong hệ thống kèm `quoteText`, đường tấn công là:

1. Sale B gọi `GET /opportunities/auto-next-steps` → nhận `eventId` của mọi công ty, kể cả của sale A.
2. Sale B gọi `POST /auto-next-step-events/{eventId của A}/undo`.
3. Server ghi `next_step_text`, `next_step_due_date`, `next_step_source` trên cơ hội của A, ghi `undone_by = B`, và trả về nội dung đã khôi phục cho B.

Theo luật 5 CLAUDE.md ("Next step là nhịp tim của deal"), đó là xoá việc-phải-làm-sáng-nay của người khác — và nhật ký sẽ ghi rõ đó là hành động có chủ ý, đã xác thực.

Phase 4 đã đóng bước 1. Phase này đóng bước 2.

## Requirements

- Functional: mọi endpoint ghi dưới đây kiểm tra chủ sở hữu; vi phạm → từ chối **và ghi audit refusal** theo pattern sẵn có.
- Non-functional: chọn **404** thay vì 403 cho trường hợp id thuộc phạm vi người khác — 403 xác nhận id đó tồn tại, tức vẫn rò một bit. (Trường hợp thiếu vai trò thì 403 là đúng, vì không tiết lộ gì về dữ liệu.)

## Bề mặt phải đóng

| Endpoint | File | Hiện trạng |
| --- | --- | --- |
| `POST /proposals/:id/decide` | `proposal-decision-service.ts:44-49` | chỉ chặn `actor.kind === 'system'` |
| `POST /auto-next-step-events/:id/undo` | `auto-next-step-service.ts:377-383`, `:438-448` | chỉ chặn system + hạn 7 ngày |
| `PATCH /companies/:id` | `company-service.ts` (`update`) | không kiểm chủ sở hữu |
| `DELETE /companies/:id` | `company-service.ts` (`softDelete`) | không kiểm chủ sở hữu |
| `PATCH /companies/:id/live-source` | `company.controller.ts:85-91` | comment hiện ghi "bất kỳ ai đăng nhập cũng được" (ADR-0033) — nay phải đổi |
| `POST /companies/:id/...` (ghi timeline, contact, đọc nguồn) | grep trước khi làm | phải kiểm cùng một lượt |

Đường ghi phải join tới `companies.owner_id`: `proposals → companies`; `auto_next_step_events → opportunities → companies`.

## Related Code Files

- Modify: `apps/api/src/domain/proposal/proposal-decision-service.ts`
- Modify: `apps/api/src/domain/opportunity/auto-next-step-service.ts` (`undo`, `loadUndoable`)
- Modify: `apps/api/src/domain/company/company-service.ts` (`update`, `softDelete`, `setLiveSourceEnabled`)
- Modify: `apps/api/src/domain/company/company.controller.ts` (comment ADR-0033 ở `:77-84` thành sai)
- Modify: các controller tương ứng (truyền scope xuống)
- Create: `apps/api/src/domain/opportunity/__tests__/cross-owner-write-refused.test.ts`
- Modify: `apps/api/src/domain/opportunity/__tests__/t6-t7-auto-next-step-and-undo.test.ts` (nếu dựng actor không role)

## Implementation Steps

1. **Test đỏ trước** — đây là các test chứng minh lỗ đã bịt, và là bằng chứng vòng 2:
   - Sale B `undo` sự kiện thuộc cơ hội của sale A → 404, cơ hội của A **không đổi một cột nào**, có audit refusal.
   - Sale A `undo` sự kiện của chính mình → vẫn hoạt động (T-6/T-7 không được gãy).
   - Sale B `decide` gợi ý công ty của A → 404, proposal vẫn `pending`, có audit refusal.
   - Sale B `PATCH`/`DELETE` công ty của A → 404, hàng không đổi.
   - Actor người không role → mọi đường ghi từ chối.
   - Admin → mọi đường ghi hoạt động như trước.
2. Sửa `undo`/`loadUndoable`: join tới `companies`, so với `ownerScopeFor(actor)`. Giữ nguyên `poolFor(actor)` — không được thay bằng `dbApp` cứng, vì đó là tầng CSDL chặn `crm_system` và comment `:372-375` đã ghi rõ đây là lỗi từng mắc ngày 12/08.
3. Sửa `decide` tương tự.
4. Sửa `company-service` ba method ghi + comment `company.controller.ts:77-84`.
5. Grep các đường ghi còn lại dưới `domain/` (contact, timeline, observation ingest) và xử lý cùng lượt.
6. Chạy: test mới → **toàn bộ cụm T-6/T-7** → toàn bộ test API → e2e đầy đủ.

## Success Criteria

- [ ] Có test chứng minh sale B không ghi được vào cơ hội/công ty/gợi ý của sale A, cho **từng** endpoint trong bảng
- [ ] Mọi từ chối đều có audit refusal (đọc được ở nhật ký)
- [ ] T-6/T-7 xanh — Hoàn tác của chính chủ không bị ảnh hưởng
- [ ] `poolFor(actor)` giữ nguyên trong `undo` (grep xác nhận)

## Risk Assessment

- **Đây là phase dễ làm gãy T-6/T-7 nhất** vì nó sửa đúng đường mà hai bài đó đo. Chạy cả cụm sau mỗi thay đổi, không để dồn.
- Chọn 404 thay 403 làm một số test cũ (nếu có) assert 403 phải sửa — grep trước.
- `setLiveSourceEnabled` hiện có comment nói rõ "bất kỳ ai đăng nhập cũng được, theo ADR-0033". Sửa hành vi mà quên sửa comment sẽ để lại đúng loại mâu thuẫn tài liệu mà red team vừa bắt.

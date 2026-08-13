---
phase: 6
title: "Nhóm 4 — tự đặt Việc tiếp theo + Hoàn tác"
status: done
priority: P1
dependencies: [2, 5]
owner: A
estimate: 4h
actual: ~30'
---

# Phase 6: Nhóm 4 — tự đặt Việc tiếp theo + Hoàn tác

## Overview

Vùng tự chủ 3: **AI ghi vào dữ liệu chính thức của Sales, không hỏi ai.** Đây là chỗ nguy hiểm nhất của cả sản phẩm. Đổi lại quyền đó, ba thứ phải đúng tuyệt đối: thông báo ngay · Hoàn tác **một cú bấm** trong 7 ngày · ghi vết hai chiều.

Quyết định chi phối: [ADR-0005](../../docs/decisions/0005-tran-tu-chu-cua-viec-tu-dat-viec-tiep-theo.md) (điều kiện kích hoạt I-6, ghi cho mọi cơ hội mở, không đè ô người gõ I-7) · [ADR-0023](../../docs/decisions/0023-goi-y-viec-tiep-theo-la-proposal-type-thu-ba-kem-cot-opportunity-id.md) (nhánh I-7 hạ cánh vào `proposal_type = next_step`).

**Thiết kế chốt 14/08 00:20** — [báo cáo](../reports/from-brainstorm-to-planner-260813-2354-phase-06-nhom-4-tu-dat-viec-tiep-theo-report.md). Hai quyết định nặng nhất đã thành ADR: [ADR-0026](../../docs/decisions/0026-hoan-tac-lan-nguoc-chuoi-event-de-tim-moc-nguoi-go.md) (I-8 lần ngược chuỗi event) · [ADR-0027](../../docs/decisions/0027-nut-hoan-tac-nam-tren-the-co-hoi-du-lieu-di-qua-endpoint-rieng.md) (nút Hoàn tác trên thẻ + endpoint riêng, và vì sao **không** tạo `urgency-table.ts`).

## Nền đã có sẵn — đọc trước khi gõ

Phase này viết trước khi P2/P5 xong nên bản cũ mô tả một nền trống. Thực tế:

| Đã có | Ở đâu |
| --- | --- |
| Bảng `auto_next_step_events` + `notifications`, **GRANT theo cột đã đủ** | `0002_closed_cyclops.sql:69,86` · `0003_grants_ai_tables.sql:52-66` |
| Bảng độ gấp I-9 (`SIGNAL_DUE_DAYS`, `SIGNAL_DUE_REASON`) | `packages/contracts/src/enums.ts:77-92` |
| Hàm tính ngày hạn (đã chống lệch UTC+7) | `proposal-decision-service.ts:183` — **rút ra dùng chung**, không viết lại |
| `BlockedNextStep` + nhánh `next_step` của hàng đợi | `proposal-service.ts:79-86,138-149` · GRANT `opportunity_id` ở `0006` |
| `NotificationDto` (kèm `autoEventId`/`undoDeadline`/`canUndo`) | `packages/contracts/src/dto/notification.ts` |
| Chỗ trống chờ nhóm 4 trong pipeline | `claim-reaction-service.ts:44-45` |
| Hai ca demo trong seed | Sakura `qualified` + `next_step_source: 'human'` (I-7) · Nimbus `negotiation` + ô trống (T-6/T-7) |

**Chưa có:** service nhóm 4 · module thông báo (API + web) · endpoint map cho thẻ cơ hội · mọi thứ trên giao diện.

## Requirements

- Functional: claim đáng chú ý + công ty có ≥1 cơ hội mở → tự điền `next_step_text` + `next_step_due_date` ngay; nội dung do **code ghép** từ `claim.statement`, câu trích đi kèm qua `claim_id`; `next_step_source = system`; thông báo trong sản phẩm; nút Hoàn tác 7 ngày **ngay trên thẻ cơ hội**; ghi `AutoNextStepEvent` cả lúc đặt lẫn lúc hoàn tác.
- Non-functional: **chọn pool theo `actor`** — đường ghi này là đúng chỗ lỗi ngày 12/08 đã xảy ra. `crm_system` chỉ có `UPDATE (next_step_text, next_step_due_date, next_step_source)`, không hơn.

## Quyết định đã chốt

| Câu hỏi | Chốt |
| --- | --- |
| I-8 lấy mốc người-gõ ở đâu | **Lần ngược chuỗi event lúc hoàn tác** (`created_at DESC`, event gần nhất có `previous_source ≠ 'system'`). Không chép mốc sang mỗi hàng — `previous_*` phải giữ đúng nghĩa "thứ có ngay trước tôi" |
| Nút Hoàn tác | **Trên thẻ cơ hội**. Màn thông báo **vẫn phải làm** (Specs đòi, T-6 chấm) |
| Thẻ lấy dữ liệu bằng đường nào | **Endpoint riêng + gộp ở client**. `OpportunityDto`/`OPPORTUNITY_SELECTION`/`toDto` **không đổi một dòng** |
| Bảng độ gấp I-9 | **Rút `dueDateFor` ra file dùng chung**, decision-service đổi sang import. Không tạo `urgency-table.ts` |
| Thông báo khi công ty nhiều cơ hội mở | **Một thông báo / một event**, giao diện gộp theo tin |
| Thông báo hiện ở đâu | **Cả hai**: dải đầu bảng deal + route `/thong-bao`. `read_at` chỉ ghi khi Sales bấm "Đã xem" |
| Cơ hội "đang mở" | `stage ∉ CLOSED_STAGES` ⇒ **gồm `on_hold`**, đúng ontology 3.5. Lệch đi thì cần ADR mới |

## Bất biến phải có test

| # | Nội dung |
| --- | --- |
| I-6 | Tự đặt **chỉ khi** `confidence ∈ {certain, likely}` **và** `signal_type ∈ {funding, leadership_hire}` **và** có ≥1 cơ hội đang mở. `expansion`/`mass_hiring` → đẩy sang hàng đợi, **không** tự đặt |
| I-7 | **Không đè** `next_step_text` khi `next_step_source = human`, **kể cả đã quá hạn** → sinh `Proposal` thay vì tự ghi |
| I-8 | Hoàn tác trả về **giá trị người-gõ gần nhất** (rỗng nếu chưa từng có), không phải giá trị máy đặt lần trước |
| I-9 | `next_step_due_date` lấy từ **bảng cấu hình `signal_type → số ngày`** (`funding` 3 · `leadership_hire` 5 · còn lại 14), **không** do LLM chọn; giao diện hiện lý do |

## Files

| Tạo/sửa | Vai trò |
| --- | --- |
| `apps/api/src/domain/opportunity/next-step-due-date.ts` **mới** | `dueDateFor()` rút từ `proposal-decision-service.ts:183` + `dueReasonFor()`; decision-service đổi sang import (sửa 1 dòng file của B) |
| `apps/api/src/domain/opportunity/auto-next-step-service.ts` **mới** | I-6…I-9; **chọn pool theo `actor`**; đặt và hoàn tác |
| `apps/api/src/domain/opportunity/auto-next-step.controller.ts` **mới** | `GET /opportunities/auto-next-steps` · `POST /auto-next-step-events/:id/undo`. Controller riêng để không đụng `opportunity.controller.ts` của B |
| `apps/api/src/domain/notification/*` **mới** | `GET /notifications` · `POST /notifications/:id/read` (`crm_app`); phần sinh thông báo nhận `tx` của `crm_system` |
| `apps/api/src/domain/claim/claim-reaction-service.ts` | Điền step 1 đang để trống, truyền `blockedNextSteps` xuống `proposals.generate()` |
| `packages/contracts/src/dto/auto-next-step.ts` **mới** | DTO cho endpoint map |
| `apps/web/src/components/next-step/auto-next-step-cell.tsx` **mới** | Dấu hiệu ô do hệ thống đặt + câu trích bấm ra nguồn + lý do ngày hạn + nút Hoàn tác + **đếm rõ cửa sổ 7 ngày** |
| `apps/web/src/components/notification/notification-strip.tsx` **mới** | Dải thông báo, gộp theo tin, nút "Đã xem" |
| `apps/web/src/app/thong-bao/page.tsx` **mới** | Danh sách đầy đủ, dùng lại strip |
| *(file của B)* `co-hoi/page.tsx` · `co-hoi/opportunity-card.tsx` | Chèn `<NotificationStrip/>` một dòng; thẻ render `<AutoNextStepCell>` khi có prop |

## Implementation steps

1. Test đỏ trước cho I-6…I-9 và cho T-6, T-7.
2. Rút `dueDateFor` ra `next-step-due-date.ts`, decision-service import lại — chạy test P5 xanh trước khi đi tiếp.
3. `AutoNextStepService`: lọc I-6, **một claim mỗi lượt** (certain trước likely, rồi theo thứ tự lưu) — không thì một bản chụp hai tin sẽ ghi đè chính nó trên cùng một ô. Với **mọi** cơ hội mở của công ty, mỗi cơ hội một `AutoNextStepEvent` (ADR-0005 B1).
4. Một transaction trên `poolFor(actor)`: `UPDATE opportunities` (3 cột) → `INSERT auto_next_step_events` → `INSERT notifications`. Hai INSERT **viết SQL thô nêu đúng cột được GRANT** — `db.insert().values()` nêu mọi cột, chỉ cần nhắc tên `undo_deadline` là Postgres từ chối cả câu (bẫy P5 đã dính trên `proposals.status`).
5. Nhánh I-7: ô do người gõ → **không ghi**, trả `BlockedNextStep` cho `ClaimReactionService` truyền xuống `ProposalService.generate()`. Không copy code của B.
6. Thông báo: nội dung nói rõ đặt gì, cho cơ hội nào, vì sao, kèm đường tới câu trích.
7. Hoàn tác (`crm_app`, một transaction): lần ngược chuỗi lấy mốc người (I-8) → trả `next_step_*` về mốc đó (`source = 'human'` nếu có text, `NULL` nếu rỗng) → ghi 4 cột `undone_*` **chỉ trên event mới nhất chưa hoàn tác**. Quá hạn hoặc đã hoàn tác → từ chối. `canUndo` tính theo giờ **máy chủ**.
8. Dấu hiệu phân biệt ô hệ thống vs ô người gõ — phân biệt được **không cần đọc chữ** (màu `machine-*` + hình khối).
9. Sửa comment `opportunity-service.ts:225-231` — nó đang nói nhóm 4 không tồn tại. `updateNextStep()` giữ nguyên làm lớp chặn chung; nhóm 4 không đi qua nó vì cần cùng transaction với event + thông báo. Ghi rõ lý do hai đường ghi.

## Validation

**Đóng 14/08 00:44 — 225 test đơn vị (203 → +22) · 11 e2e (9 → +2) · lint/typecheck sạch.**

- [x] T-6 xanh: đổi công ty sang bản chụp "sau" → Việc tiếp theo tự đổi, có thông báo, ô mang dấu hiệu hệ thống — e2e `t6-t7-auto-next-step-and-undo.spec.ts` + test 1–4
- [x] T-7 xanh: một cú bấm Hoàn tác → giá trị cũ trở lại **đúng nguyên trạng**; có bản ghi cả hai chiều — e2e + test 12
- [x] I-6: `expansion` → **không** tự đặt, vào hàng đợi (test 5); `speculative` → không tự đặt (test 6); không cơ hội mở → không ghi (test 7); `on_hold` **là** cơ hội mở (test 8); một claim mỗi lượt (test 9)
- [x] I-7: ô người gõ đã quá hạn → **không** bị đè, có `Proposal` loại `next_step` (test 10); gõ đè ô máy thì trả quyền sở hữu về người (test 11)
- [x] I-8: đặt máy hai lần rồi Hoàn tác → **không** về giá trị máy lần trước (test 13); chuỗi có mốc người thì về đúng mốc người (test 14)
- [x] I-9: ngày hạn đúng bảng độ gấp ở **cả hai đường** — `dueDateFor` dùng chung, test 1 (tự đặt, 5 ngày) + test 6 của P5 (duyệt gợi ý, 3 ngày)
- [x] Thông báo chưa xem **không** biến mất; chỉ mất khi Sales bấm "Đã xem" (test 18 + e2e)
- [x] Hoàn tác quá 7 ngày → bị từ chối (test 15); nút biến mất, ô **giữ** dấu hiệu máy — xem "Lệch có ý thức" bên dưới
- [x] **Phép đo đột biến 1** (test 20): `crm_system` không ghi được `undone_*` và không tự đánh dấu thông báo đã đọc. Ghi cứng `dbApp` + xoá guard = hoàn tác hoàn chỉnh dưới danh nghĩa máy, mọi test khác vẫn xanh
- [x] **Phép đo đột biến 2** (test 21): `GRANT INSERT (undo_deadline)` cho `crm_system` → nó ghi được cửa sổ **1 phút**; `REVOKE` → `permission denied` trở lại. Nợ đo của `0003` đã trả. Kèm test 22: không bịa được bản ghi hoàn tác lúc INSERT
- [x] `crm_system` thử ghi `stage` hoặc `expected_value` qua đường này → `permission denied` (test 19)

### Lệch có ý thức so với bản kế hoạch

| Chỗ | Kế hoạch viết | Làm thật | Vì sao |
| --- | --- | --- | --- |
| Sau 7 ngày | "ô thành ô bình thường" | Nút + đồng hồ biến mất, **dấu hiệu máy ở lại** | Luật 2 không hết hạn. Ô vẫn là thứ máy viết; bỏ dấu hiệu đi là biến nó thành ô người gõ sau đúng 7 ngày |
| Công ty không có người phụ trách | không nêu | **Không tự ghi**, trả `skippedReason: 'no_owner_to_notify'` + log | Không có ai để báo thì mất một trong ba thứ mua quyền vùng 3. Hàng đợi vẫn nhận gợi ý |

### Việc phát sinh ngoài phạm vi phase

- **Hai test của P5 phải sửa** (`t4-t5-queue-waits-and-records.test.ts` test 6 và 9) và **một e2e của P5** (`t5-proposal-queue-decisions.spec.ts`). Không phải hồi quy: cả ba mã hoá giả định "nhóm 4 chưa tồn tại". Test 6 tự dựng `blockedNextSteps` bằng tay và comment của nó ghi sẵn *"stands in for the I-7 hand-off feature group 4 will make"* — giờ chạy thật, bỏ phần dựng tay. Test 9 và e2e đếm/chọn thẻ không phân loại, nay Sakura có **hai** thẻ trong hàng đợi.
- **`ADR-0026` sửa mục verify:** phản ví dụ của nó không xảy ra được vì I-7 chặn đúng bước đầu. Quyết định giữ nguyên, lý do viết lại. Chi tiết trong ADR.

## Risks

| Rủi ro | Xử lý |
| --- | --- |
| 4h trên đường găng của A, ngay trước freeze | Cắt theo thứ tự: route `/thong-bao` (dải ở bảng deal đủ đóng T-6) → gộp theo tin trong dải. **Không cắt:** nút Hoàn tác, dấu hiệu ô máy, hai phép đo |
| Ghi cứng pool → mất lớp chặn CSDL, test vẫn xanh | Phép đo 1. **Bắt buộc**, không suy diễn từ `updateNextStep` cũ |
| Hoàn tác trả về giá trị máy thay vì giá trị người | I-8 có test riêng; đây là chỗ dễ làm sai nhất vì "giá trị trước đó" nghe như là giá trị liền trước |
| Tự đặt đè lên việc Sales đang làm | I-7 + test ô người gõ quá hạn |
| Hai đường ghi vào `next_step_*` | Chấp nhận có ý thức (bước 9). Cả hai đều `poolFor(actor)` |
| Bảng deal có hai nguồn dữ liệu sau khi tách endpoint | Đổi lấy việc không đụng `opportunity-service.ts` của B trước freeze. Gộp lại được sau vòng 1 |

## Rollback

Tắt điều kiện kích hoạt (`ai_enabled = false`) → không tự đặt nữa, dữ liệu đã đặt còn nguyên và vẫn hoàn tác được trong 7 ngày.

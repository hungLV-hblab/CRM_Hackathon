---
phase: 6
title: "Nhóm 4 — tự đặt Việc tiếp theo + Hoàn tác"
status: pending
priority: P1
dependencies: [2]
owner: A
estimate: 3h
---

# Phase 6: Nhóm 4 — tự đặt Việc tiếp theo + Hoàn tác

## Overview

Vùng tự chủ 3: **AI ghi vào dữ liệu chính thức của Sales, không hỏi ai.** Đây là chỗ nguy hiểm nhất của cả sản phẩm. Đổi lại quyền đó, ba thứ phải đúng tuyệt đối: thông báo ngay · Hoàn tác **một cú bấm** trong 7 ngày · ghi vết hai chiều.

Quyết định chi phối: [ADR-0005](../../docs/decisions/0005-tran-tu-chu-cua-viec-tu-dat-viec-tiep-theo.md) (điều kiện kích hoạt I-6, ghi cho mọi cơ hội mở, không đè ô người gõ I-7).

## Requirements

- Functional: claim đáng chú ý + công ty có ≥1 cơ hội mở → tự điền `next_step_text` + `next_step_due_date` ngay; nội dung nhắc sự kiện kích hoạt **kèm câu trích**; `next_step_source = system`; thông báo trong sản phẩm; nút Hoàn tác 7 ngày; ghi `AutoNextStepEvent` cả lúc đặt lẫn lúc hoàn tác.
- Non-functional: **chọn pool theo `actor`** — đường ghi này là đúng chỗ lỗi ngày 12/08 đã xảy ra. `crm_system` chỉ có `UPDATE (next_step_text, next_step_due_date, next_step_source)`, không hơn.

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
| `apps/api/src/domain/opportunity/auto-next-step-service.ts` | I-6…I-9; **chọn pool theo `actor`** |
| `apps/api/src/domain/opportunity/urgency-table.ts` | bảng độ gấp I-9, đọc được, sửa được |
| `apps/api/src/domain/notification/*` | thông báo; không biến mất trước khi `read_at` có giá trị |
| `apps/web/src/components/next-step/*` | dấu hiệu ô do hệ thống đặt + nút Hoàn tác + **đếm rõ cửa sổ 7 ngày trên màn hình** |

## Implementation steps

1. Test đỏ trước cho I-6…I-9 và cho T-6, T-7.
2. `AutoNextStepService`: điều kiện I-6 → với **mọi** cơ hội mở của công ty, mỗi cơ hội một `AutoNextStepEvent` (ADR-0005 M-2).
3. Ngày hạn từ `urgency-table.ts`, kèm lý do hiển thị được. LLM không chạm vào đây.
4. Nhánh I-7: ô do người gõ → **không ghi**, sinh `Proposal` (gọi service của B qua interface, không copy code).
5. Thông báo: nội dung nói rõ đặt gì, cho cơ hội nào, vì sao, kèm câu trích.
6. Hoàn tác: **một cú bấm**, trả về giá trị người-gõ gần nhất (I-8), ghi `undone_*`. Hết 7 ngày nút biến mất, ô thành ô bình thường.
7. Dấu hiệu phân biệt ô hệ thống vs ô người gõ — phân biệt được **không cần đọc chữ**.

## Validation

- [ ] T-6 xanh: đổi công ty sang bản chụp "sau" → Việc tiếp theo tự đổi, có thông báo, ô mang dấu hiệu hệ thống
- [ ] T-7 xanh: một cú bấm Hoàn tác → giá trị cũ trở lại **đúng nguyên trạng**; có bản ghi cả hai chiều
- [ ] I-6: `expansion` → **không** tự đặt, vào hàng đợi
- [ ] I-7: ô người gõ đã quá hạn → **không** bị đè, có `Proposal`
- [ ] I-8: đặt máy hai lần rồi Hoàn tác → về giá trị **người gõ**, không về giá trị máy lần trước
- [ ] I-9: ngày hạn đúng bảng độ gấp; đổi bảng → ngày hạn đổi theo
- [ ] Thông báo chưa xem **không** biến mất
- [ ] **Phép đo đột biến:** ghi cứng `dbApp` trong service này → test T-10 phải đỏ ở tầng CSDL. Đây là lỗi đã xảy ra thật ngày 12/08, không phải rủi ro giả thiết
- [ ] `crm_system` thử ghi `stage` hoặc `expected_value` qua đường này → `permission denied`

## Risks

| Rủi ro | Xử lý |
| --- | --- |
| Ghi cứng pool → mất lớp chặn CSDL, test vẫn xanh | Phép đo đột biến ở Validation. **Bắt buộc**, không suy diễn từ `updateNextStep` cũ |
| Hoàn tác trả về giá trị máy thay vì giá trị người | I-8 có test riêng; đây là chỗ dễ làm sai nhất vì "giá trị trước đó" nghe như là giá trị liền trước |
| Tự đặt đè lên việc Sales đang làm | I-7 + test ô người gõ quá hạn |

## Rollback

Tắt điều kiện kích hoạt (`ai_enabled = false`) → không tự đặt nữa, dữ liệu đã đặt còn nguyên và vẫn hoàn tác được trong 7 ngày.

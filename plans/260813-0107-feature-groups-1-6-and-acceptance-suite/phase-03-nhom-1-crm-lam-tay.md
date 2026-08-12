---
phase: 3
title: "Nhóm 1 — CRM làm tay"
status: pending
priority: P1
dependencies: [1]
owner: B
estimate: 5h
---

# Phase 3: Nhóm 1 — CRM làm tay

## Overview

Toàn bộ công việc bán hàng **không có một thành phần AI nào**. Tắt sạch AI thì phase này vẫn chạy đủ (Specs nhóm 1, ràng buộc cuối). Đây là bề mặt UI lớn nhất của cả plan và là điều kiện của T-1.

## Requirements

- Functional: CRUD công ty · CRUD người liên hệ (đúng một đầu mối chính) · cơ hội với 7 giai đoạn · chốt Đủ điều kiện hỏi hai ô dấu hiệu · lý do thua · dòng thời gian gộp ba loại · Việc tiếp theo + ngày hạn có cờ cảnh báo · tìm theo tên · lọc · màn tổng quan.
- Non-functional: **không chặn thao tác nào của Sales** — thiếu dữ liệu thì mang cờ cảnh báo, vẫn lưu được. Đây là luật lặp lại 3 lần trong Specs nhóm 1.

## Ba chỗ Specs nói kỹ, dễ làm sai

1. **Không bao giờ chặn.** Kéo sang Đủ điều kiện mà bỏ hai ô dấu hiệu → **vẫn sang**, mang cờ. Sang Thua mà bỏ lý do → **vẫn sang**, mang cờ + đứng ngoài bảng thống kê lý do thua. Cơ hội mở thiếu Việc tiếp theo/ngày hạn → **vẫn lưu**, mang cờ + **không xuất hiện trong danh sách việc phải làm**.
2. **Đi lùi và nhảy cóc đều được.** Không validate thứ tự giai đoạn.
3. **Màn tổng quan tách `on_hold` khỏi pipeline đang chạy** ([ontology 3.5](../../docs/ontology.md#35-enum--giá-trị-cố-định-không-đội-nào-tự-đổi-tên)) — deal tạm dừng cộng vào tổng làm con số mang đi họp sai.

## Files

| Tạo/sửa | Vai trò |
| --- | --- |
| `apps/api/src/domain/contact/*` | CRUD + ràng buộc đúng một `is_primary` |
| `apps/api/src/domain/opportunity/*` | mở rộng: tạo/sửa, hai ô dấu hiệu, `lost_reason`, cờ cảnh báo |
| `apps/api/src/domain/timeline/*` | ghi hoạt động + tự ghi mục `stage_change` khi người đổi giai đoạn |
| `apps/api/src/domain/company/*` | sửa/xoá + tìm theo tên + lọc (ngành, loại, quốc gia, `is_watched`) |
| `apps/web/src/app/cong-ty/` | danh sách + chi tiết (hồ sơ · người liên hệ · dòng thời gian) |
| `apps/web/src/app/co-hoi/` | bảng giai đoạn kéo thả + lọc theo giai đoạn và quá hạn |
| `apps/web/src/app/tong-quan/` | công ty theo ngành · cơ hội + tổng giá trị theo giai đoạn · Việc tiếp theo quá hạn |

## Implementation steps

1. Test đỏ trước cho **ba luật không chặn** ở trên — đây là phần T-1 dễ bị làm ngược nhất.
2. API: contact (unique partial index đã có từ P1), opportunity đầy đủ, timeline, filter/search.
3. Đổi giai đoạn **luôn** sinh `TimelineEntry` loại `stage_change`, `created_by = human`.
4. Web: chi tiết công ty (3 khu: hồ sơ · người liên hệ · dòng thời gian — chừa chỗ cho khu vùng đọc của A, **không sửa file của A**).
5. Bảng cơ hội kéo thả. **Nếu quá 14/08 trưa → đổi sang dropdown** theo danh sách cắt ở [plan.md](plan.md).
6. Màn tổng quan.
7. Cờ cảnh báo: một component dùng chung cho cả ba loại thiếu dữ liệu.

## Validation

- [ ] Kéo qua ba giai đoạn có Đủ điều kiện, **bỏ trống hai ô dấu hiệu** → vẫn sang, có cờ (T-1)
- [ ] Sang Thua bỏ trống lý do → vẫn sang, có cờ, **không** vào bảng thống kê lý do thua
- [ ] Cơ hội mở thiếu Việc tiếp theo → lưu được, có cờ, **không** trong danh sách việc phải làm
- [ ] Đi lùi giai đoạn và nhảy cóc: không bị chặn
- [ ] Đúng một `is_primary` per company — thử đặt người thứ hai
- [ ] Đổi giai đoạn xong dòng thời gian có mục `stage_change`
- [ ] Tìm theo tên + 4 bộ lọc công ty + 2 bộ lọc cơ hội
- [ ] Màn tổng quan: `on_hold` **không** cộng vào pipeline đang chạy
- [ ] **T-1 chạy với `ai_enabled = false`** — không chức năng nào hỏng (test này thuộc P4, phase này phải chạy được nó)

## Risks

| Rủi ro | Xử lý |
| --- | --- |
| Phình ra ăn hết ngày 13 | Cắt theo thứ tự ở plan.md: kéo thả → dropdown trước, tổng quan gọn sau |
| Kéo thả tốn thời gian hơn ước lượng | Timebox 60'. Quá → dropdown, ghi 1 dòng vào plan, đi tiếp |
| Đụng file với A ở màn hình công ty | A sở hữu khu vùng đọc; B chừa một chỗ cắm component, không sửa file của A |

## Rollback

Từng màn hình độc lập; bỏ màn tổng quan hoặc bỏ kéo thả không ảnh hưởng phần còn lại.

---
phase: 8
title: "Nhóm 6 — bảng điều khiển + đóng bộ nghiệm thu 10 điểm"
status: pending
priority: P1
dependencies: [5, 6, 7]
owner: cả đội
estimate: 4h
---

# Phase 8: Nhóm 6 — bảng điều khiển + đóng bộ nghiệm thu 10 điểm

## Overview

Hai việc, làm cùng lúc vì cả hai đều cần mọi nhóm khác đã đứng: **bảng điều khiển Quản trị** (đọc số, chỉnh tham số, một cái phanh) và **đóng nốt T-9, T-10** cho bộ nghiệm thu chạy đủ 10 điểm bằng một lệnh.

Đây là phase cuối trước **freeze tối 14/08**.

## Requirements

- Functional: một màn hình gom đủ chỉ số theo **đúng tên** ở [ontology mục 7](../../docs/ontology.md#7-chỉ-số-đo-từ-ngày-đầu); chỉnh `watch_cycle_seconds` (hiện đơn vị + mặc định + một câu giải thích đổi nó thì cái gì đổi theo), hiệu lực ngay; **một nút tắt toàn bộ AI**, hiệu lực ngay không cần chạy lại; Sales thấy banner khi AI tắt; mỗi lần bật/tắt ghi vết.
- Non-functional: `pnpm test` chạy đủ 10 điểm bằng một lệnh, kết quả in ra rõ ràng (hạng mục nộp bài số 4).

## Chỉ số — đúng tên, không để BGK tự suy

| Chỉ số | Công thức |
| --- | --- |
| **Auto-accept rate** | `accept / (accept + edit + reject)` |
| **Error-detection rate** | `(reject[wrong_info] + reject[misread_context] + số lần Hoàn tác + số lần xoá mục hệ thống) / tổng output AI` |
| Tỉ lệ sửa-rồi-duyệt | `edit / tổng` — **tách bạch** khỏi accept (I-12) |
| Phân bố lý do bỏ · phân bố mức chắc chắn | đếm theo `reject_reason` · theo `confidence` |
| Thời gian quyết trung bình | trung vị `seconds_to_decide` — hiện **cạnh** error-detection rate, vì thấp có thể là giao diện tốt mà cũng có thể là bấm mù |
| Tỉ lệ hoàn tác | `undone / tổng AutoNextStepEvent` |

## Files

| Tạo/sửa | Vai trò |
| --- | --- |
| `apps/api/src/domain/metrics/*` | truy vấn chỉ số |
| `apps/api/src/settings/*` | mở rộng: bật/tắt AI ghi `AuditEvent` |
| `apps/web/src/app/quan-tri/page.tsx` | bảng điều khiển |
| `apps/web/src/components/ai-disabled-banner.tsx` | banner Sales thấy khi AI tắt |
| `e2e/t9-ai-kill-switch.spec.ts`, `apps/api/src/__tests__/t10-*.test.ts` | T-9, T-10 đầy đủ |

## Implementation steps

1. Truy vấn chỉ số + màn hình Quản trị.
2. Nút tắt AI: hiệu lực ngay, ghi `AuditEvent` cả hai chiều. Phạm vi đúng [ADR-0009](../../docs/decisions/0009-pham-vi-nut-tat-ai-chi-dung-sinh-moi.md): chỉ dừng **sinh mới**; hàng đợi tồn vẫn duyệt được.
3. Banner cho Sales — nói rõ tính năng gợi ý đang tắt, **không im lặng biến mất**.
4. **T-9**: bấm tắt trong lúc vòng quét đang chạy → 2 chu kỳ sau không thêm mục nào, không sinh gợi ý, không tự đặt; dữ liệu đã sinh còn nguyên; Sales thấy banner; bật lại chạy tiếp; cả hai lần có ghi vết.
5. **T-10 đầy đủ**: mở rộng T-10 mini thành ba nhánh — đổi giai đoạn · đổi giá trị tiền · xoá công ty, dưới `actor = system`, **không đi qua UI**. Cả ba bị từ chối ở **hai lớp**. Thêm khẳng định thứ tư: **không tồn tại adapter gửi thư/tin nhắn nào trong mã nguồn** (ranh giới 3, ontology mục 5).
6. Chạy `pnpm test` full + `pnpm lint` + `pnpm typecheck` + `pnpm build`, rồi nghiệm thu tay 6 điểm của plan skeleton một lần nữa trên stack mới.
7. Rà [Definition of Done](../../CLAUDE.md#7-definition-of-done) cho từng nhóm: có test · có provenance · proposal có accept/reject + metric · có ADR · **có người ngoài người viết giải thích lại được**.

## Validation

- [ ] 10/10 điểm nghiệm thu xanh bằng **một lệnh** `pnpm test`
- [ ] T-9 xanh trên stack production sau Caddy
- [ ] T-10 ba nhánh xanh, chặn ở **cả hai lớp** (bỏ lớp domain → vẫn đỏ nhờ lớp CSDL)
- [ ] Khẳng định "không có adapter gửi tin" xanh
- [ ] Đổi `watch_cycle_seconds` từ UI Quản trị → nhịp đổi, **không** restart
- [ ] Tắt AI → Sales thấy banner; dữ liệu đã sinh còn nguyên; hàng đợi tồn vẫn duyệt được
- [ ] Chỉ số hiện **đúng tên** ontology mục 7; `edit` không cộng vào `accept`
- [ ] `pnpm lint` · `pnpm typecheck` · `pnpm build` sạch
- [ ] 6 điểm nghiệm thu của plan skeleton chạy lại vẫn đạt

## Risks

| Rủi ro | Xử lý |
| --- | --- |
| Dồn quá nhiều vào phase cuối → freeze trượt | T-1…T-8 đã viết ở phase của chúng (luật 4 của plan). P8 chỉ gom, T-9 và T-10 |
| Tắt AI nhưng vòng quét vẫn chạy dở một lượt | Kiểm `ai_enabled` **đầu mỗi lượt** và trước mỗi lần ghi, không chỉ lúc hẹn nhịp |
| Chỉ số tính sai vì đếm `edit` vào `accept` | I-12 đã có test ở P5; P8 chỉ đọc |
| Q-6 (Admin thao tác CRM) còn treo | Tạm: Admin xem tất cả, không sửa dữ liệu Sales. Ghi 1 dòng vào ADR nếu BGK hỏi |

## Rollback

Bảng điều khiển là màn hình chỉ đọc + 2 tham số → bỏ biểu đồ, giữ số thô. Nút tắt AI **không được bỏ** (T-9 chấm trực tiếp).

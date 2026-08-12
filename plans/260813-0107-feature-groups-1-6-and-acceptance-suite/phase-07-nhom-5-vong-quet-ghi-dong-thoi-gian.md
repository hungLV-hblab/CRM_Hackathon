---
phase: 7
title: "Nhóm 5 — vòng quét ghi dòng thời gian"
status: pending
priority: P1
dependencies: [2, 4]
owner: C
estimate: 2h
---

# Phase 7: Nhóm 5 — vòng quét ghi dòng thời gian

## Overview

Vùng tự chủ 4: **vòng lặp khép kín, không dừng chờ ai duyệt ở bất kỳ bước nào.** Khung vòng quét đã có và đã verify chạy thật từ plan skeleton ([ADR-0011](../../docs/decisions/0011-worker-cung-image-va-vong-quet-tu-hen-nhip.md)) — phase này nối nó vào đường ống nhóm 2 và cho nó quyền ghi `TimelineEntry`.

## Requirements

- Functional: bật/tắt nhãn Đang theo dõi bằng **một thao tác** + màn hình danh sách riêng; mỗi vòng: đọc lại nguồn → so bản lưu gần nhất → có nội dung mới thì rút phát hiện → **tự thêm** `TimelineEntry` (`created_by = system`) kèm nhãn "do hệ thống thêm" + câu trích; mỗi vòng ghi một `WatchCycleRun`; mỗi 10 vòng thêm dòng cộng dồn; Sales xoá được mục hệ thống thêm.
- Non-functional: chu kỳ cấu hình được, mặc định 60s, đọc từ CSDL mỗi lượt (đã có); gọi LLM có thể tràn nhịp → **bỏ nhịp + ghi `skipped_reason`** (I-10).

## Bất biến phải có test

| # | Nội dung |
| --- | --- |
| I-3 | Hash trùng → **không** tạo bản lưu, **không** gọi LLM, ghi "đã đọc, không đổi" vào `WatchCycleRun` |
| I-10 | Vòng trước chưa xong → bỏ nhịp kế, ghi `skipped_reason` (đã có test từ skeleton, chạy lại với LLM trong vòng) |
| I-13 | Xoá `TimelineEntry` do hệ thống thêm **kèm lý do ngắn** + ghi `AuditEvent` — đây là tín hiệu error-detection duy nhất của nhóm 5 |
| T-8 | 3 công ty Đang theo dõi, đổi nguồn 2 → trong 2 chu kỳ có **2 mục mới** không ai bấm gì; Nhật ký có dòng tổng kết từng vòng |

## Files

| Tạo/sửa | Vai trò |
| --- | --- |
| `apps/api/src/watch/watch-cycle-service.ts` | nối vào `ObservationService` + `ClaimService` của A; đếm `companies_scanned`, `new_content_count`, `entries_added`, `error_count` |
| `apps/api/src/watch/watch-cycle-rollup.ts` | dòng cộng dồn mỗi 10 vòng (`is_rollup`, `cycles_covered`) |
| `apps/web/src/app/dang-theo-doi/page.tsx` | danh sách Đang theo dõi + bật/tắt một thao tác |
| `apps/web/src/app/quan-tri/nhat-ky-vong-quet/page.tsx` | Nhật ký vòng quét |

## Implementation steps

1. Test đỏ trước cho 4 dòng bảng trên.
2. Nối vòng quét vào đường ống nhóm 2 — **dùng service của A qua interface**, không viết lại logic hash/claim.
3. Ghi `TimelineEntry` với `created_by = system` + `source_claim_id` (truy vết ngược về claim, ontology mục 4).
4. Đếm đủ 4 con số mỗi vòng + `error_detail` khi nguồn lỗi. Nguồn lỗi **không** làm vòng chết.
5. Rollup mỗi 10 vòng. *(Đây là mục cắt số 2 nếu trượt lịch — xem [plan.md](plan.md).)*
6. Nhãn "do hệ thống thêm" + câu trích hiện ngay trên mục dòng thời gian, bấm ra được nguồn.
7. Xoá mục hệ thống: hỏi lý do ngắn, ghi `AuditEvent` (I-13).
8. **Trả nợ đột biến còn lại của plan skeleton:** đổi hẹn nhịp sang `@Cron('*/60 * * * * *')` → kịch bản "đổi chu kỳ không restart" phải **đỏ**. Khôi phục, tick checkbox ở phase-04 plan cũ.

## Validation

- [ ] T-8 xanh, chạy trên stack thật với chu kỳ 10s cho nhanh
- [ ] I-3: công ty có bản "sau" giống hệt bản trước → 0 bản lưu mới, 0 lần gọi LLM, `WatchCycleRun` ghi "đã đọc, không đổi"
- [ ] I-10: vòng tràn nhịp → có `skipped_reason`, **không** ghi trùng mục
- [ ] I-13: xoá mục hệ thống → đòi lý do, có `AuditEvent`
- [ ] Nguồn lỗi → `error_count` tăng, vòng vẫn chạy tiếp
- [ ] Mỗi 10 vòng có đúng 1 dòng `is_rollup`
- [ ] Mục do hệ thống thêm bấm ra được câu trích gốc
- [ ] Phép đo đột biến `@Cron` đã chạy, ghi kết quả vào plan skeleton

## Risks

| Rủi ro | Xử lý |
| --- | --- |
| Gọi LLM làm vòng dài hơn 60s → ghi trùng | I-10 đã có cơ chế; test đúng kịch bản này với extractor cố tình chậm |
| Vòng quét ghi cả claim `manual_ingest` → nhóm 2 thành nhóm 5 | I-4 đã test ở P2; P7 chỉ ghi claim có `trigger_context = watch_cycle` |
| `crm_system` thiếu GRANT `timeline_entries` | Đã có từ `0001_grants.sql`; test chiều cho ở P1 giữ |

## Rollback

`ai_enabled = false` dừng vòng ngay, mục đã thêm còn nguyên (T-9). Đường lùi sâu hơn: bỏ rollup, giữ dòng từng vòng.

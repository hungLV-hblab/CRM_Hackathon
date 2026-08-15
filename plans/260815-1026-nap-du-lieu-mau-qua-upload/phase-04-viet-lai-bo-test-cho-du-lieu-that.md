---
phase: 4
title: "Viết lại bộ test cho dữ liệu thật"
status: pending
priority: P1
dependencies: [2, 3]
---

# Phase 4: Viết lại bộ test cho dữ liệu thật

## Overview

Từ phase 2, `pnpm seed` đã nạp dữ liệu thật — mọi test còn tham chiếu Sakura/Nimbus/Kitefin/Ohara/Marlin đang đỏ (ID không còn tồn tại). Phase này trỏ lại từng chỗ vào công ty thật, giữ nguyên Ý NGHĨA kịch bản test, chỉ đổi ID/nội dung tham chiếu.

## Requirements

- Không còn "Sakura"/"Nimbus"/"Kitefin"/"Ohara"/"Marlin" trong bất kỳ file `.ts` nào (đã grep danh sách 24 file ở dưới — mỗi file phải xử lý, không phải tất cả cần SỬA, một số chỉ cần XÁC NHẬN không liên quan).
- Mỗi test giữ đúng invariant nó đang chứng minh (I-3, I-6, I-14...) — không nới lỏng assertion để "cho xanh".
- `pnpm test` (unit + e2e) xanh toàn bộ.

## Anchor company — ID thật thay cho công ty hư cấu

**Bắt buộc verify nội dung HTML thật trước khi khoá bảng này** (đọc file, không suy đoán tín hiệu funding/leadership_hire có thật trong trang `after` hay không).

| Vai trò trong test cũ | Công ty hư cấu | Công ty thật gợi ý | Vì sao |
| --- | --- | --- | --- |
| Nguồn không đọc được (`fetch_status=failed`) | Ohara (`rawHtml: ''` giả lập) | `C32` — không có website thật, 0 bản chụp | Case thật, không phải giả lập |
| Nguồn JS-block (đã có sẵn trong data thật, case mới) | — | `C29` hoặc `C35` — trang tin JS-render, HTML tĩnh rỗng | README của BTC xác nhận, dùng cho `fetch_error_reason='js_required'` |
| Công ty flip T-6/T-7 (auto next-step + undo) | Sakura | `C18` (tracked, 4 cặp trang, cơ hội `O9` mở) hoặc `C16` (`O11`) | Cần xác nhận trang `after` thật có câu funding/leadership_hire đọc được — grep nội dung trước khi chốt |
| 3 công ty T-8 (bật theo dõi, flip 2) | Sakura/Nimbus/Kitefin | 3 trong `{C18, C16, C23, C26, C28, C38}` | Đều tracked, đủ cặp trang, có cơ hội mở |
| Cơ hội cờ cảnh báo T-1 (thiếu next_action/due_date) | dựng tay trong seed | `O18`/`O19`/`O20` | Có sẵn trong data thật, không cần dựng |
| Cơ hội thắng | dựng tay | `O10` (C15, stage=Thắng) | Có sẵn |

Lookup trong test: import `companyIdFor('C18')` từ `packages/db/src/seed/parse-zip-dataset.ts` (hoặc export riêng `deterministicUuid('company', code)`) — **không hardcode UUID string trong test**, để test tự tính đúng ID hiện hành, sống được qua mọi lần nạp lại.

## Nhóm file thứ hai — phụ thuộc SYMBOL `SEED_COMPANIES`, không phải tên hư cấu (phát hiện lúc validate)

Grep theo tên hư cấu (bảng dưới) **không bắt được nhóm này** — các file này import symbol `SEED_COMPANIES`/`SEED_USERS` từ `@crm/db`, vẫn compile được sau khi đổi dataset (mảng vẫn tồn tại, chỉ đổi giá trị: 25 công ty thật thay 5 công ty hư cấu), nhưng logic bên trong giả định sai về nội dung mảng (`SEED_COMPANIES[0]` không còn là Sakura, `it.each(SEED_COMPANIES.map(...))` sinh ra 25 case thay vì 5 — có thể làm test chậm hẳn hoặc lộ ca không mong muốn):

| File | Việc cần làm |
| --- | --- |
| `apps/api/src/domain/company/__tests__/company-source-candidates.test.ts` | Dùng `SEED_COMPANIES[0]` làm 1 công ty bất kỳ — review có giả định gì về loại/tên công ty đó không |
| `apps/api/src/domain/company/__tests__/live-source-toggle.test.ts` | Dùng `SEED_COMPANIES[0]` + `.slice(1)` (lặp qua "các công ty seed còn lại") — với 25 công ty thay vì 5, vòng lặp này chạy 24 lần thay vì 4, kiểm thời gian chạy test |
| `apps/api/src/domain/observation/__tests__/live-crawl-ingest.test.ts` | Như trên |
| `apps/api/src/__tests__/login.test.ts` | Đã xử lý ở phase 2 (thêm `loadDefaultDataset()`) |
| `apps/api/src/ai/__tests__/resolve-observation-source.test.ts` | Đã xử lý ở phase 2 |

## File phải xử lý (đã grep, 24 file)

| File | Việc cần làm |
| --- | --- |
| `apps/api/src/ai/anthropic-claim-extractor.ts` | **Không bắt buộc sửa** — "Sakura" chỉ là ví dụ few-shot prompt cho LLM, không phụ thuộc seed thật. Có thể đổi cho thực tế hơn nhưng không chặn gì |
| `apps/api/src/ai/demo-snapshots.ts` | Đã xử lý ở phase 2 (xoá hằng số) |
| `apps/api/src/ai/__tests__/demo-snapshots.test.ts` | Đã xử lý ở phase 2 |
| `apps/api/src/ai/__tests__/agent-extractor-choice-and-failure.test.ts` | Kiểm nội dung tham chiếu — nếu chỉ dùng tên công ty làm chuỗi test bất kỳ (không phải ID seed thật), đổi tên cho gọn, không phải fix lỗi |
| `apps/api/src/ai/__tests__/agent-source-discovery-choice-and-verification.test.ts` | Như trên |
| `apps/api/src/ai/__tests__/normalize-snapshot-text.test.ts` | Kiểm — có thể chỉ dùng HTML mẫu độc lập, không phụ thuộc seed |
| `apps/api/src/domain/company/__tests__/company-search-and-filter.test.ts` | Đổi sang tìm/lọc trên công ty thật |
| `apps/api/src/domain/metrics/__tests__/metrics-counts-what-reached-a-person.test.ts` | Đổi ID |
| `apps/api/src/domain/observation/__tests__/reading-zone-provenance.test.ts` | Đổi ID, xác nhận I-3 (before→after→before) vẫn đúng với công ty thật |
| `apps/api/src/domain/opportunity/__tests__/t6-t7-auto-next-step-and-undo.test.ts` | Đổi sang công ty anchor T-6/T-7 |
| `apps/api/src/domain/proposal/__tests__/proposal-boundary-check-and-grants.test.ts` | Đổi ID |
| `apps/api/src/domain/proposal/__tests__/proposal-generation-gates.test.ts` | Đổi ID |
| `apps/api/src/domain/proposal/__tests__/t4-t5-queue-waits-and-records.test.ts` | Đổi ID |
| `apps/api/src/watch/__tests__/system-timeline-entry-removal.test.ts` | Đổi ID |
| `apps/api/src/watch/__tests__/system-timeline-entry-writes.test.ts` | Đổi ID, xác nhận logic gộp phase 2 không phá test này |
| `apps/api/src/watch/__tests__/watch-cycle-scans-and-writes.test.ts` | Đổi sang 3 công ty anchor T-8 |
| `e2e/reading-zone-provenance.spec.ts` | Đổi ID/tên hiển thị trên UI |
| `e2e/responsive-no-horizontal-overflow.spec.ts` | Kiểm — có thể chỉ cần tên công ty bất kỳ tồn tại |
| `e2e/t1-crm-without-ai.spec.ts` | Đổi sang tạo công ty mới trong test (T-1 tự tạo, không phụ thuộc seed cụ thể) — kiểm lại có đúng vậy không |
| `e2e/t5-proposal-queue-decisions.spec.ts` | Đổi ID |
| `e2e/t6-t7-auto-next-step-and-undo.spec.ts` | Đổi sang công ty anchor T-6/T-7 |
| `e2e/t8-watch-cycle-writes-timeline.spec.ts` | Đổi sang 3 công ty anchor T-8 |
| `e2e/ui-invariants.spec.ts` | Kiểm — có thể chỉ cần 1 công ty bất kỳ |
| `e2e/watch-cycle-scenario.ts` | Helper dùng chung cho T-8 — đổi cùng lúc với spec T-8 |

## Implementation Steps

1. **Grep xác nhận nội dung HTML thật** trước khi khoá bảng anchor — với mỗi ứng viên T-6/T-7/T-8, mở file `packages/db/seed-assets/` (giải nén tạm) đúng trang `after`, xác nhận có câu funding/leadership_hire/expansion đọc được bằng mắt. Nếu công ty gợi ý không có tín hiệu rõ, đổi sang công ty khác trong danh sách tracked+đủ cặp trang.
2. **Sửa từng file theo bảng trên, chạy `pnpm test:unit` sau mỗi vài file** — không sửa hết 24 file rồi mới chạy 1 lần (khó khoanh vùng lỗi).
3. **Chạy `pnpm test:e2e` sau khi unit xanh** — cần `pnpm start` đang chạy + `pnpm seed` đã dùng dataset thật.
4. **`seed-idempotent.test.ts`** — checksum mới, ghi lại giá trị thật vào comment test (như test hiện tại đang ghi `md5=2dd301...`).

## Success Criteria

- [ ] `grep -rn "Sakura\|Nimbus\|Kitefin\|Ohara\|Marlin" apps/ e2e/ --include='*.ts'` rỗng (trừ nếu quyết định giữ ví dụ few-shot, ghi rõ lý do)
- [ ] `pnpm test` (unit + e2e) xanh toàn bộ, đếm số test không giảm so với trước (không xoá test để né sửa)
- [ ] Mỗi test T-6/T-7/T-8 xác nhận bằng comment công ty thật nào đang đóng vai gì, lý do chọn

## Risk Assessment

| Rủi ro | Giảm thiểu |
| --- | --- |
| Công ty anchor gợi ý không có tín hiệu funding/leadership thật trong trang `after` | Bước 1 bắt buộc verify bằng mắt trước khi sửa test — không tin bảng gợi ý mù quáng |
| Sửa 24 file trong thời gian ngắn, dễ sót 1 file làm cả suite đỏ | Sửa theo nhóm nhỏ + chạy test liên tục (bước 2), không dồn cuối |
| Logic gộp timeline (phase 2) đổi số lượng entry mà test cũ assert số cụ thể | `system-timeline-entry-writes.test.ts` và T-8 phải review kỹ số lượng entry kỳ vọng, không chỉ đổi ID |

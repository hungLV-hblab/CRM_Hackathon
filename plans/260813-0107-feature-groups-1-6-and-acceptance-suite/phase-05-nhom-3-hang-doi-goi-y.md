---
phase: 5
title: "Nhóm 3 — hàng đợi gợi ý"
status: pending
priority: P1
dependencies: [2]
owner: B
estimate: 3h
---

# Phase 5: Nhóm 3 — hàng đợi gợi ý

## Overview

Vùng tự chủ 2: máy chuẩn bị, **người bấm**. Cơ chế an toàn duy nhất của vùng này là *không duyệt thì không có gì xảy ra, vô thời hạn* — không tự hết hạn thành hành động, không có chế độ tự duyệt.

Quyết định chi phối: [ADR-0008](../../docs/decisions/0008-bo-goi-y-bang-menu-ly-do-tai-cho.md) (Bỏ = menu lý do tại chỗ, "số thao tác" đọc là số bước) · [ADR-0006](../../docs/decisions/0006-bat-dang-theo-doi-la-uy-quyen-phan-ghi-tin.md) (I-5) · [ADR-0009](../../docs/decisions/0009-pham-vi-nut-tat-ai-chi-dung-sinh-moi.md) (tắt AI vẫn duyệt được hàng đợi tồn).

## Requirements

- Functional: claim mới → sinh `Proposal` (`field_update` | `timeline_entry`); hàng đợi hiện đủ 4 thứ tại chỗ (hiện tại → đề nghị · câu trích · mức chắc chắn · hệ quả nếu sai); 3 nút Duyệt / Sửa rồi duyệt / Bỏ; ghi `ProposalDecision` kèm `seconds_to_decide`; dấu hiệu "đang có gợi ý chờ duyệt" ở màn công ty và danh sách cơ hội.
- Non-functional: **số bước để Bỏ không nhiều hơn số bước để Duyệt** (ADR-0008); gợi ý đã Bỏ không sinh lại cùng nội dung trừ khi có bản lưu mới.

## Bất biến phải có test

| # | Nội dung |
| --- | --- |
| I-5 | Công ty `is_watched = true` → **không** sinh `Proposal` loại `timeline_entry` (vẫn sinh `field_update`) |
| I-11 | `target_field` chỉ trong `industry`, `country`, `size`, `website`. **Cấm** `name`, `company_type` |
| I-12 | `decision = edit` đếm riêng, **không** cộng vào `accept` |
| T-4 | Sinh gợi ý rồi không làm gì → sau ≥3 chu kỳ vòng quét hồ sơ công ty **y nguyên** |

## Files

| Tạo | Vai trò |
| --- | --- |
| `apps/api/src/domain/proposal/proposal-service.ts` | sinh gợi ý từ claim; enforce I-5, I-11 |
| `apps/api/src/domain/proposal/proposal-decision-service.ts` | Duyệt / Sửa rồi duyệt / Bỏ; áp thay đổi vào hồ sơ **chỉ khi người quyết** |
| `apps/web/src/app/hang-doi/page.tsx` | hàng đợi; mốc đo `seconds_to_decide` = **lúc mở màn hình** (ontology mục 7) |

## Implementation steps

1. Test đỏ trước cho 4 dòng ở bảng trên. T-4 là test quan trọng nhất của phase — nó chứng minh vùng 2 không tự trôi thành vùng 3.
2. `ProposalService`: sinh từ claim; `impact_if_wrong` là **một dòng thật**, không phải chuỗi rỗng.
3. `ProposalDecisionService`: ba nhánh; nhánh `edit` lưu `final_value` và đếm riêng.
4. Áp thay đổi khi duyệt: ghi hồ sơ công ty bằng `actor = human` (người bấm), **không** phải `system`.
5. Hàng đợi web: 4 thứ tại chỗ, menu 5 lý do khi Bỏ, đếm giây từ lúc mở màn hình.
6. Dấu hiệu chờ duyệt ở màn công ty + danh sách cơ hội.
7. Không sinh lại gợi ý đã Bỏ: so theo `(company_id, target_field, proposed_value)`, mở lại khi có `Observation` mới.

## Validation

- [ ] T-4 xanh (≥3 chu kỳ, hồ sơ y nguyên)
- [ ] T-5 xanh: cả ba quyết định có bản ghi ai/lúc nào/quyết gì; `edit` **không** cộng vào `accept`
- [ ] I-5, I-11 xanh — thử sinh `field_update` cho `company_type` phải bị từ chối
- [ ] Đếm số bước: Bỏ ≤ Duyệt
- [ ] Tắt AI → hàng đợi tồn **vẫn duyệt được** (ADR-0009)
- [ ] Gợi ý đã Bỏ không quay lại sau 3 chu kỳ; quay lại **được** khi có bản lưu mới
- [ ] **Phép đo đột biến:** xoá dòng kiểm I-11 → test phải đỏ

## Risks

| Rủi ro | Xử lý |
| --- | --- |
| Duyệt xong ghi bằng `actor = system` → mất ý nghĩa "người quyết" | Test khẳng định `AuditEvent`/bản ghi mang danh người bấm |
| `impact_if_wrong` bị điền cho có | Test khẳng định độ dài tối thiểu + review tay 3 gợi ý mẫu |

## Rollback

Không áp thay đổi tự động ở đâu cả → tắt UI hàng đợi là hết tác dụng, dữ liệu chính thức không bị chạm.

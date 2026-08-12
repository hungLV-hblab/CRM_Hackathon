---
phase: 1
title: "Seam — 7 bảng còn lại, GRANT, contracts"
status: pending
priority: P1
dependencies: []
owner: 1 người, cả đội chờ
estimate: 60'
---

# Phase 1: Seam — 7 bảng còn lại, GRANT, contracts

## Overview

Dựng mặt cắt để ba người fan-out mà không đụng nhau: **7 bảng còn thiếu**, **GRANT theo cột cho từng bảng mới**, và type/DTO dùng chung ở `packages/contracts`.

**Đúng 1 người làm, cả đội chờ.** Hai người kia đọc [ontology mục 6](../../docs/ontology.md#6-bất-biến--code-phải-enforce-không-phải-ghi-cho-đẹp) (I-1…I-14) trong lúc chờ — mỗi bất biến là một test họ sẽ phải viết.

## Requirements

- Functional: migration chạy sạch từ CSDL hiện có; 7 bảng đúng tên và cột theo ontology mục 3; `crm_system` có đúng quyền của vùng 1–4 trên bảng mới và **không** có gì hơn.
- Non-functional: không `drizzle-kit push`; enum mới (nếu có) sinh từ `packages/contracts/src/enums.ts`, không gõ lại giá trị.

## Bảng phải thêm

Tên và cột lấy nguyên từ [ontology mục 3](../../docs/ontology.md#3-đối-tượng-domain) — không tự thêm cột, không tự đổi tên.

| Bảng | Ontology | Ghi chú cột dễ sai |
| --- | --- | --- |
| `contacts` | 3.1 | `is_primary` — **đúng một** per company (unique partial index `WHERE is_primary`) |
| `observations` | 3.2 + [ADR-0012](../../docs/decisions/0012-ban-luu-giu-html-goc-va-text-trich-offset-tinh-tren-text.md) | giữ **cả** `raw_html` lẫn `raw_content`; `content_hash` tính trên `raw_content`; `fetch_status` |
| `claims` | 3.2 | `quote_text` **NOT NULL** (I-1); `quote_start`/`quote_end` NOT NULL; `trigger_context` |
| `proposals` | 3.2 | `target_field` chỉ nhận whitelist I-11; `current_value` / `proposed_value` / `impact_if_wrong` |
| `proposal_decisions` | 3.2 | `decision`, `reject_reason`, `final_value`, `seconds_to_decide` |
| `auto_next_step_events` | 3.3 | đủ cặp cũ/mới + `undo_deadline` + 4 cột `undone_*` |
| `notifications` | 3.3 | `read_at` nullable — chưa xem thì không được biến mất |

Ràng buộc CSDL đặt ngay ở phase này, không hoãn:

- `claims.quote_text` NOT NULL + `CHECK (length(btrim(quote_text)) > 0)` → I-1 chặn được cả khi ghi thẳng SQL (T-2 đòi đúng điều này).
- `observations` unique `(company_id, content_hash)` → I-3 rẻ hơn kiểm ở tầng ứng dụng.
- `proposals.target_field` CHECK trong whitelist `industry`, `country`, `size`, `website` → I-11.

## GRANT — chỗ dễ mất một lớp chặn nhất

`crm_system` **không có** `ALTER DEFAULT PRIVILEGES` (xem đầu file `0001_grants.sql`). Bảng mới mặc định bị cấm hoàn toàn → phải GRANT tay trong migration mới `0002_grants_ai_tables.sql`:

| Bảng | `crm_system` được | Vì sao |
| --- | --- | --- |
| `observations` | SELECT, INSERT | vùng 1 |
| `claims` | SELECT, INSERT | vùng 1 |
| `proposals` | SELECT, INSERT | vùng 2 — chỉ sinh, **không** UPDATE `status` (duyệt là hành vi của người) |
| `proposal_decisions` | — | quyết định là của người, `crm_app` ghi |
| `auto_next_step_events` | SELECT, INSERT | vùng 3 ghi vết; **không** UPDATE — hoàn tác là người bấm |
| `notifications` | SELECT, INSERT | vùng 3 báo tin; **không** UPDATE `read_at` |
| `contacts` | SELECT | AI đọc để biết đầu mối, không ghi |

Không DELETE trên bảng nào. Viết `GRANT INSERT (cột...)` khi chỉ được ghi một phần — **không bao giờ** GRANT ở mức bảng rồi REVOKE cột (đầu file `0001_grants.sql` ghi rõ tổ hợp đó chặn được **số không**).

## Implementation steps

1. Viết test đỏ trước: mở rộng `column-grants-block-system-actor.test.ts` thành bộ khẳng định cho 7 bảng mới, **cả hai chiều** (cấm phải cấm, cho phải cho).
2. Thêm 7 file schema vào `packages/db/src/schema/`, export ở `index.ts`.
3. `pnpm db:generate` → migration `0002_*`; viết tay `0002_grants_ai_tables.sql`.
4. `pnpm db:migrate` trên CSDL đang chạy, rồi thử lại từ CSDL trống (`pnpm reset && pnpm db:migrate && pnpm seed`).
5. Thêm DTO + type ở `packages/contracts/src/dto/` cho `observation`, `claim`, `proposal`, `notification` — FE của B và C code theo type này trước khi API của A xong.
6. **Trả nợ hai phép đo đột biến của plan skeleton:** sửa 1 giá trị enum → `ontology-enum-parity.test.ts` phải đỏ; đổi `0001_grants.sql` thành `GRANT UPDATE ON opportunities TO crm_system` → test quyền cột phải đỏ. Khôi phục cả hai, tick checkbox ở plan cũ.

## Validation

- [ ] Test quyền cột xanh cho **cả 7 bảng mới**, cả chiều cấm lẫn chiều cho
- [ ] `INSERT INTO claims` thiếu `quote_text` bằng SQL thẳng → bị CSDL từ chối (nền của T-2)
- [ ] `INSERT` hai `observations` cùng `(company_id, content_hash)` → bị từ chối (nền của I-3)
- [ ] `UPDATE proposals SET status` dưới `crm_system` → `permission denied`
- [ ] `pnpm reset && pnpm db:migrate && pnpm seed` sạch từ CSDL trống
- [ ] `pnpm typecheck` + `pnpm lint` sạch; `pnpm test` xanh
- [ ] Hai phép đo đột biến nợ từ plan skeleton đã chạy, kết quả ghi vào phase-01/phase-02 của plan cũ

## Risks

| Rủi ro | Xử lý |
| --- | --- |
| Quên GRANT một bảng → nhóm 4/5 ghi không được, phát hiện muộn | Test cả **chiều cho** ở bước 1, không chỉ chiều cấm |
| GRANT quá tay ở mức bảng → mất lớp chặn thứ hai mà test vẫn xanh | Chỉ `GRANT` đúng cột; phép đo đột biến ở bước 6 là cách duy nhất biết |
| Migration đụng volume cũ | `pnpm reset` rồi migrate lại — đã có lệnh sẵn |

## Rollback

Migration `0002` là thêm bảng, không sửa bảng cũ → `DROP TABLE` 7 bảng mới là quay đầu sạch. ~10'.

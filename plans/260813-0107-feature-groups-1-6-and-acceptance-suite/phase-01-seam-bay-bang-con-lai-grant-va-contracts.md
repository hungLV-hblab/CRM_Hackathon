---
phase: 1
title: "Seam — 7 bảng còn lại, GRANT theo cột, contracts"
status: done
priority: P1
dependencies: []
owner: "P1a: 1 người, cả đội chờ · P1b: cùng người, chạy song song"
estimate: "P1a 1.5h + P1b 1.5h"
---

# Phase 1: Seam — 7 bảng còn lại, GRANT theo cột, contracts

## Overview

Dựng mặt cắt để ba người fan-out mà không đụng nhau: **7 bảng còn thiếu**, **GRANT theo cột cho từng bảng mới**, và type/DTO dùng chung ở `packages/contracts`.

**Chia làm hai nửa** sau phiên phản biện 13/08 01:27 ([báo cáo](../reports/from-brainstorm-to-planner-260813-0127-phase-01-grant-insert-theo-cot-va-ba-quyet-dinh-report.md)) — cộng thật là ~3h, không phải 60', và cả đội ngồi chờ 3h trong ngân sách 24h là không trả được:

| | Nội dung | Ai | Khi |
| --- | --- | --- | --- |
| **P1a** | schema + migration + GRANT theo cột + DTO + smoke *chiều-cho* | 1 người, **cả đội chờ** | 1.5h → đội fan-out |
| **P1b** | ma trận *chiều-cấm* × 7 bảng + 3 phép đo đột biến + helper truncate | cùng người, **song song** với P2/P3/P4 | 1.5h, **phải xanh trước P5/P6/P7** |

Lý do hoãn *chiều-cấm* chứ không hoãn *chiều-cho*: thiếu GRANT làm **teammate bị chặn ngay** (P6/P7 ghi không được), GRANT dư chỉ làm **test đỏ về sau** — không ai phải viết lại code nào.

Hai người kia đọc [ontology mục 6](../../docs/ontology.md#6-bất-biến--code-phải-enforce-không-phải-ghi-cho-đẹp) (I-1…I-14) trong lúc chờ — mỗi bất biến là một test họ sẽ phải viết.

**Ba ADR chi phối phase này, đọc trước khi gõ SQL:**

- [ADR-0015](../../docs/decisions/0015-grant-insert-phai-theo-cot-khi-bang-co-cot-thuoc-quyet-dinh-cua-nguoi.md) — `GRANT INSERT` mức bảng có **cùng cái bẫy** như `UPDATE` mức bảng
- [ADR-0016](../../docs/decisions/0016-proposal-status-chi-hai-gia-tri-moi-con-so-do-lay-tu-proposal-decisions.md) — `proposals.status = pending | decided`
- [ADR-0017](../../docs/decisions/0017-i3-enforce-o-tang-service-rang-buoc-csdl-chi-danh-cho-ranh-gioi.md) — I-3 ở service, **không** `UNIQUE`

## Requirements

- Functional: migration chạy sạch từ CSDL hiện có **và** từ CSDL trống; 7 bảng đúng tên và cột theo ontology mục 3; `crm_system` có đúng quyền của vùng 1–4 trên bảng mới và **không** có gì hơn.
- Non-functional: không `drizzle-kit push`; enum mới sinh từ `packages/contracts/src/enums.ts`, không gõ lại giá trị.

---

# P1a — mở khoá đội (1.5h)

## Bảng phải thêm

Tên và cột lấy nguyên từ [ontology mục 3](../../docs/ontology.md#3-đối-tượng-domain) — không tự thêm cột, không tự đổi tên.

| Bảng | Ontology | Ghi chú cột dễ sai |
| --- | --- | --- |
| `contacts` | 3.1 | `is_primary` — **đúng một** per company (unique partial index `WHERE is_primary`) |
| `observations` | 3.2 + [ADR-0012](../../docs/decisions/0012-ban-luu-giu-html-goc-va-text-trich-offset-tinh-tren-text.md) | giữ **cả** `raw_html` lẫn `raw_content`; `content_hash` tính trên `raw_content`; `fetch_status`; `source_tier text NOT NULL DEFAULT 'company_website'`; `extractor_version text NOT NULL` |
| `claims` | 3.2 | `quote_text` **NOT NULL** (I-1); `quote_start`/`quote_end` NOT NULL; `trigger_context` |
| `proposals` | 3.2 + ADR-0016 | `status proposal_status NOT NULL DEFAULT 'pending'`; `target_field` theo `CHECK` có điều kiện dưới đây |
| `proposal_decisions` | 3.2 | `decision`, `reject_reason`, `final_value`, `seconds_to_decide`, `decided_by` → `users.id` |
| `auto_next_step_events` | 3.3 | đủ cặp cũ/mới + `undo_deadline NOT NULL DEFAULT now() + interval '7 days'` + 4 cột `undone_*` |
| `notifications` | 3.3 | `read_at` nullable, **không** default — chưa xem thì không được biến mất |

`watch_cycle_runs` **đã đủ cột** ontology 3.3 (`is_rollup`, `cycles_covered`, `skipped_reason`) từ plan skeleton — không sửa.

## Ràng buộc CSDL — chỉ đặt ở ranh giới Specs kiểm bằng SQL thẳng

Nguyên tắc phân lớp ở [ADR-0017](../../docs/decisions/0017-i3-enforce-o-tang-service-rang-buoc-csdl-chi-danh-cho-ranh-gioi.md): CSDL cho **ranh giới**, service cho **luật hành vi**.

```sql
claims.quote_text  NOT NULL, CHECK (length(btrim(quote_text)) > 0)        -- I-1 · nền của T-2
claims             CHECK (quote_start >= 0 AND quote_end > quote_start)   -- backstop I-2
proposals          CHECK ( (proposal_type = 'field_update'
                            AND target_field IN ('industry','country','size','website'))
                         OR (proposal_type = 'timeline_entry'
                            AND target_field IS NULL) )                  -- I-11, CẢ HAI NỬA
contacts           UNIQUE INDEX (company_id) WHERE is_primary             -- đúng 1 PIC
observations       INDEX (company_id, captured_at DESC)                   -- KHÔNG unique, ADR-0017
```

Hai chỗ khác bản plan gốc, cố ý:

- **`CHECK` của `proposals` phải có điều kiện.** I-11 chỉ áp cho `proposal_type='field_update'`; gợi ý loại `timeline_entry` không có ô đích nên `target_field` phải NULL. `CHECK` phẳng như plan gốc viết sẽ **chặn oan** loại `timeline_entry` (hoặc buộc nhồi giá trị rác). Dạng có điều kiện chặn được cả hai nửa I-11 **và** ép đúng cặp `type ↔ field` — mạnh hơn, cùng chi phí.
- **Không `UNIQUE (company_id, content_hash)`.** Nó chặn chuỗi trước→sau→trước, tức giám khảo diễn lại T-6/T-8 lần hai sẽ thấy AI ngừng sinh mà không báo gì. Lý do đầy đủ ở ADR-0017.

## GRANT — chỗ dễ mất một lớp chặn nhất

`crm_system` **không có** `ALTER DEFAULT PRIVILEGES` (xem đầu file `0001_grants.sql`). Bảng mới mặc định bị cấm hoàn toàn → phải GRANT tay trong migration mới `0002_grants_ai_tables.sql`.

Phân loại 7 bảng bằng đúng một câu hỏi: *bảng này có cột nào thuộc **quyết định của người** không?* ([ADR-0015](../../docs/decisions/0015-grant-insert-phai-theo-cot-khi-bang-co-cot-thuoc-quyet-dinh-cua-nguoi.md))

| Bảng | GRANT | Vì sao mức đó |
| --- | --- | --- |
| `observations` | `SELECT, INSERT` **mức bảng** | Vùng 1. Mọi cột do AI sinh, không có cột nào của người |
| `claims` | `SELECT, INSERT` **mức bảng** | Vùng 1. Như trên |
| `proposals` | `SELECT` + `INSERT` **theo cột**, thiếu `status` | Vùng 2. `DEFAULT 'pending'` luôn áp dụng → CSDL tự bảo đảm AI không sinh được gợi ý đã duyệt (T-4 ở lớp 2) |
| `auto_next_step_events` | `SELECT` + `INSERT` **theo cột**, thiếu `undo_deadline` + 4 cột `undone_*`. Không `UPDATE` | Vùng 3. AI không co được cửa sổ Hoàn tác 7 ngày, không ghi được vết hoàn tác giả (T-7) |
| `notifications` | `SELECT` + `INSERT` **theo cột**, thiếu `read_at`. Không `UPDATE` | Vùng 3. AI không đánh dấu "đã đọc" thay Sales (T-6) |
| `contacts` | `SELECT` | AI đọc đầu mối, không ghi |
| `proposal_decisions` | *(không gì)* | Quyết định là hành vi của người, `crm_app` ghi |

```sql
GRANT SELECT, INSERT ON observations TO crm_system;
GRANT SELECT, INSERT ON claims       TO crm_system;

GRANT SELECT ON proposals TO crm_system;
GRANT INSERT (id, company_id, claim_id, proposal_type, target_field,
              current_value, proposed_value, impact_if_wrong, created_at)
  ON proposals TO crm_system;                      -- thiếu `status`

GRANT SELECT ON auto_next_step_events TO crm_system;
GRANT INSERT (id, opportunity_id, claim_id, previous_text, previous_due_date,
              previous_source, new_text, new_due_date, created_at)
  ON auto_next_step_events TO crm_system;          -- thiếu `undo_deadline`, `undone_*`

GRANT SELECT ON notifications TO crm_system;
GRANT INSERT (id, user_id, auto_event_id, message, created_at)
  ON notifications TO crm_system;                  -- thiếu `read_at`

GRANT SELECT ON contacts TO crm_system;
-- proposal_decisions: KHÔNG GRANT GÌ
```

Không `DELETE` trên bảng nào. `id` nằm trong danh sách vì nó không phải cột quyết định của người — để ngoài chỉ tạo lỗi khi code truyền uuid tường minh.

**Ba `DEFAULT` là phần bắt buộc, không phải chi tiết** — thiếu nó thì cột bị loại khỏi GRANT nhận `NULL`:

```sql
proposals.status                     NOT NULL DEFAULT 'pending'
auto_next_step_events.undo_deadline  NOT NULL DEFAULT now() + interval '7 days'
notifications.read_at                NULL, không default          -- NULL = chưa xem
```

**Không bao giờ** GRANT ở mức bảng rồi REVOKE cột — đầu file `0001_grants.sql` ghi rõ tổ hợp đó chặn được **số không**.

## Contracts + ontology

- Enum mới `PROPOSAL_STATUS = { pending: 'Chờ duyệt', decided: 'Đã quyết' }` vào `contracts/src/enums.ts` + registry `ENUMS` key `proposal_status`, và `pgEnum` sinh từ đó.
- **Thêm một dòng vào ontology mục 3.5** cho `proposal_status`. `ontology-enum-parity.test.ts` sẽ **đỏ** tới khi làm — đúng thiết kế, biết trước để không đi debug oan.
- **Đóng câu hỏi mở dòng 233 của ontology:** `source_tier` giữ lại dạng `text` ghi `'company_website'` (đọc log ra nghĩa ngay, thêm nguồn mới không cần `ALTER TYPE`); `extractor_version` giữ `text`.
- DTO cho `observation`, `claim`, `proposal`, `notification` ở `contracts/src/dto/` — FE của B và C code theo type này trước khi API của A xong.

## Hai việc plan gốc bỏ sót — làm ở P1a vì nằm ở file dùng chung

- **FK còn nợ trong `timeline-entries.ts`.** Comment trong file đòi thẳng: *"When those tables land, add `references()` — do not leave this."* Hai bảng đó land đúng ở đây → thêm `contact_id → contacts.id` và `source_claim_id → claims.id`. Không làm bây giờ thì lúc P7 ghi timeline, người phải sửa file của B lại là C → đụng nhau.
- **`resetTestDatabase()` ở `packages/db`.** Danh sách `TRUNCATE` đang hardcode 7 tên bảng, bị 4 file test copy. Thêm 7 bảng mà không tách helper thì A, B, C **cùng sửa cùng danh sách ở 3 file khác nhau** suốt 2 ngày.

## Implementation steps (P1a)

1. Thêm `PROPOSAL_STATUS` vào contracts + registry; thêm dòng vào ontology 3.5; đóng câu hỏi mở dòng 233. Chạy `ontology-enum-parity.test.ts` → xanh.
2. Thêm 7 file schema vào `packages/db/src/schema/`, export ở `index.ts`. Kèm 3 `DEFAULT` và 5 ràng buộc ở trên.
3. Thêm 2 FK còn nợ vào `timeline-entries.ts`.
4. `pnpm db:generate` → migration `0002_*`; viết tay `0002_grants_ai_tables.sql` theo đúng khối SQL ở trên.
5. `pnpm db:migrate` trên CSDL đang chạy, rồi thử lại từ CSDL trống: `pnpm reset && pnpm start && pnpm db:migrate && pnpm seed`.
6. Viết **smoke chiều-cho**: 7 `INSERT`/`SELECT` bằng `crm_system` chạy được (đây là cái chặn teammate nếu thiếu GRANT), cộng 2 khẳng định `DEFAULT`.
7. Thêm DTO ở `contracts/src/dto/`. **Thông báo đội fan-out.**

## Validation (P1a) — cửa mở khoá đội

Tất cả đã chạy 13/08 02:00–02:20. Danh sách cắt (DTO `notification` → `resetTestDatabase()`) **không phải dùng**.

- [x] `pnpm reset` → volume trống → compose `migrate` job xanh → `pnpm seed` ra `2 users, 4 companies, 3 opportunities, 2 timeline entries`
- [x] 6 đường ghi chiều-cho bằng `crm_system` chạy được (vùng 1–4 + đọc `contacts`)
- [x] `INSERT INTO proposals` không truyền `status` → `pending`
- [x] `INSERT INTO auto_next_step_events` không truyền `undo_deadline` → 6.9–7.1 ngày
- [x] `INSERT INTO proposals` loại `timeline_entry` với `target_field IS NULL` → chạy được; và loại đó **kèm** `target_field` → bị `CHECK` từ chối
- [x] `ontology-enum-parity.test.ts` xanh (24 khẳng định) sau khi thêm `proposal_status` vào ontology 3.5 + contracts
- [x] `pnpm typecheck` sạch · `pnpm lint` sạch · `pnpm test` xanh: **88 unit + 3 e2e**

Ghi chú cho người sau: `apps/api` typecheck đọc `dist` của `@crm/db`, không đọc `src` như vitest. Thêm export mới vào `packages/db` mà chưa `pnpm --filter @crm/db build` thì test xanh nhưng typecheck đỏ — đã gặp một lần ở bước 6.

---

# P1b — song song, phải xanh **trước P5/P6/P7** (1.5h)

Đổi mốc so với plan gốc (cũ: dồn sang P8). P6 (Hoàn tác) và P5 (duyệt) ăn trực tiếp `undo_deadline` và `status` — hai cột mà GRANT theo cột đang bảo vệ. Để tới P8 là để hở đúng chỗ đang bán.

## Ma trận chiều-cấm × 7 bảng

Mở rộng `column-grants-block-system-actor.test.ts`. Các ca **mới** so với plan gốc, vì plan gốc nghĩ ở mức bảng:

| Thao tác của `crm_system` | Kỳ vọng | Bảo vệ điều gì |
| --- | --- | --- |
| `INSERT INTO proposals (…, status) VALUES (…, 'decided')` | `permission denied` | T-4 — AI không tự duyệt |
| `INSERT INTO auto_next_step_events (…, undo_deadline) VALUES (…, now())` | `permission denied` | T-7 — cửa sổ 7 ngày |
| `INSERT INTO auto_next_step_events (…, undone_at) VALUES (…, now())` | `permission denied` | T-7 — vết hoàn tác giả |
| `INSERT INTO notifications (…, read_at) VALUES (…, now())` | `permission denied` | T-6 — thông báo phải hiện |
| `UPDATE proposals SET status` · `UPDATE notifications SET read_at` | `permission denied` | như trên |
| `DELETE` trên cả 7 bảng | `permission denied` | ranh giới thứ tư |
| `INSERT INTO claims` thiếu `quote_text` (SQL thẳng) | CSDL từ chối | I-1 — nền của T-2 |
| `INSERT` `proposals` với `target_field='company_type'` | `CHECK` từ chối | I-11 |
| `INSERT INTO proposal_decisions` (bất kỳ) | `permission denied` | quyết định là của người |

Kèm **chiều-cho** đầy đủ (không chỉ smoke của P1a): 7 bảng, mỗi đường ghi được phép chạy đúng.

## Ba phép đo đột biến

Xoá/đổi dòng kiểm → test **phải đỏ**. Không suy diễn, chạy thật rồi khôi phục.

1. **Nợ từ plan skeleton:** sửa 1 giá trị enum → `ontology-enum-parity.test.ts` phải đỏ.
2. **Nợ từ plan skeleton:** đổi `0001_grants.sql` thành `GRANT UPDATE ON opportunities TO crm_system` → test quyền cột phải đỏ.
3. **Mới, của ADR-0015:** đổi `GRANT INSERT (cột…)` của `proposals` thành `GRANT INSERT` mức bảng → ca `INSERT (…, status)` phải đỏ. **Nếu vẫn xanh thì toàn bộ ADR-0015 là trang trí** và phải quay lại thiết kế.

Ghi kết quả cả ba vào phase-01/phase-02 của [plan skeleton](../260812-1912-base-project-walking-skeleton/plan.md) và tick checkbox ở đó. Phép đo 3 cũng là điều kiện đổi ADR-0015 từ *"nợ verify"* sang *"Chấp nhận"*.

## Validation (P1b)

- [x] Ma trận chiều-cấm xanh cho cả 7 bảng, gồm 4 ca `INSERT` theo cột — `column-grants-block-system-actor-on-ai-tables.test.ts`, **34 khẳng định**
- [x] Chiều-cho xanh cho cả 7 bảng
- [x] `REVOKE` một cột khỏi `GRANT INSERT (cột…)` có tác dụng thật → đường rollback của ADR-0015 đã đo, không phải suy diễn
- [x] Ba phép đo đột biến đã chạy, đã khôi phục, kết quả ghi vào [phase-01](../260812-1912-base-project-walking-skeleton/phase-01-workspace-va-contracts.md) và [phase-02](../260812-1912-base-project-walking-skeleton/phase-02-db-schema-role-seed.md) của plan skeleton
- [x] ADR-0015 đổi sang *Chấp nhận — đã verify bằng thực nghiệm*
- [x] `resetTestDatabase()` thay hết danh sách `TRUNCATE` hardcode; danh sách bảng về một chỗ ở `schema/all-tables.ts`, dùng chung với `seed()`

### Phép đo đột biến — kết quả

| # | Đột biến | Kết quả |
| --- | --- | --- |
| 1 | `PROPOSAL_STATUS.pending` → `waiting` | parity test **đỏ**: `expected [ 'waiting', 'decided' ] to deeply equal [ 'pending', 'decided' ]` |
| 2 | `GRANT UPDATE ON opportunities` mức bảng | `column-grants-block-system-actor.test.ts` **3/8 đỏ** |
| 3 | `GRANT INSERT ON proposals` mức bảng | khẳng định 7 **đỏ** — và `INSERT … status='decided'` trả `rowCount: 1`, **không lỗi**: AI tự duyệt gợi ý của mình thành công, không cần quyền `UPDATE` nào |

Đo 3 là chỗ ADR-0015 chuyển từ suy luận thành số đo. Trước khi chạy nó, cả thiết kế chỉ dựa trên phép loại suy từ `UPDATE` sang `INSERT` — mà ADR-0010 tồn tại vì loại suy kiểu đó đã sai một lần.

---

## Risks

| Rủi ro | Xử lý |
| --- | --- |
| Quên GRANT một bảng → nhóm 4/5 ghi không được, phát hiện muộn | Smoke **chiều-cho** nằm trong P1a chứ không hoãn sang P1b — đây chính là lý do chia hai nửa theo hướng này |
| `GRANT INSERT` mức bảng lọt vào vì trông giống bản plan cũ | Phép đo đột biến số 3. Đây là cách duy nhất biết, không phải review bằng mắt |
| P1a tràn quá 2h, đội chờ quá lâu | Danh sách cắt đã ghi ở mục Validation (P1a) |
| Ontology 3.5 chưa thêm `proposal_status` → parity test đỏ, tưởng là hỏng | Bước 1 của P1a làm việc này trước tiên, trước cả schema |
| Migration đụng volume cũ | `pnpm reset` rồi migrate lại — đã có lệnh sẵn |

## Rollback

Migration `0002` là thêm bảng + thêm 2 FK vào `timeline_entries`, không sửa cột bảng cũ → `DROP TABLE` 7 bảng mới + `DROP CONSTRAINT` 2 FK là quay đầu sạch. **~15'**.

Sai danh sách cột trong `GRANT INSERT` (AI cần một cột bị bỏ sót): thêm cột đó bằng migration mới, **~5'**.

---
date: 2026-08-13 02:28
session: 01:27 – 02:28 (Asia/Saigon)
component: Phase 1 — 7 bảng vùng AI, GRANT theo cột, DTO contracts
plan: plans/260813-0107-feature-groups-1-6-and-acceptance-suite
status: xong, chưa commit
adr: [0015, 0016, 0017]
---

# Phản biện phase 1: cái bẫy của ADR-0010 quay lại ở một động từ khác

## Bối cảnh

Phase 1 là mặt cắt cả đội chờ: 7 bảng vùng AI + quyền GRANT, và P5/P6/P7 ghi trực tiếp vào chúng. Sai ở đây thì ba người fan-out trên nền sai suốt hai ngày còn lại. Nên đọc lại phase file trước khi ai gõ dòng đầu — phase file đó do AI viết lúc 01:17, tức 10 phút trước phiên này.

Phiên gồm hai việc: phản biện (01:27–01:58), rồi thực thi luôn cả P1a và P1b (01:58–02:20).

**Kết quả: 5 chỗ sai/thiếu, 3 ADR, phase 1 xong. 88 unit + 3 e2e xanh trên CSDL dựng lại từ volume trống. Chưa commit.**

---

## Chuyện gì đã xảy ra

### Phát hiện 1 — `GRANT INSERT` mức bảng có cùng cái bẫy như `GRANT UPDATE` mức bảng

Nghiêm trọng nhất. Phase file ghi `proposals → SELECT, INSERT` mức bảng, kèm chú thích *"chỉ sinh, không UPDATE `status`"*. Chú thích đúng nhưng vô dụng: `INSERT` mức bảng phủ **mọi cột**, nên `crm_system` chỉ cần

```sql
INSERT INTO proposals (..., status) VALUES (..., 'decided');
```

là tự duyệt gợi ý của chính nó — **không cần một quyền `UPDATE` nào**. Ba bảng bị:

| Bảng | Cột lọt | Mất gì |
| --- | --- | --- |
| `proposals` | `status` | AI tự duyệt → **T-4 vỡ ở lớp CSDL** |
| `auto_next_step_events` | `undo_deadline`, 4 cột `undone_*` | AI ghi deadline quá khứ → **cửa sổ Hoàn tác 7 ngày bốc hơi** (T-7); ghi `undone_at` sẵn → vết hoàn tác giả |
| `notifications` | `read_at` | AI đánh dấu "đã đọc" thay Sales → thông báo chưa từng hiện (T-6) |

Đây là **đúng cấu trúc lỗi** [ADR-0010](../decisions/0010-chan-tang-csdl-bang-hai-role-va-quyen-theo-cot.md) đã bắt được bằng thực nghiệm hôm 12/08, chỉ đổi động từ. Để nguyên thì test quyền `UPDATE` vẫn xanh trong khi ba ranh giới đã hở — đội tưởng có hai lớp chặn nhưng chỉ còn một.

Chi tiết đau nhất: phase file **tự mâu thuẫn trong cùng một trang**. Bảng ghi `INSERT` trơn; đoạn ngay dưới bảng ghi *"Viết `GRANT INSERT (cột...)` khi chỉ được ghi một phần"*. Và cái sai lại nằm trong bảng — tức cái người đọc sẽ copy vào SQL.

### Phát hiện 2 — `proposals.status` chưa được định nghĩa ở đâu cả

Ontology 3.2 liệt kê cột `status`; ontology 3.5 không có enum nào cho nó; contracts cũng không. Tên cột đã chốt, tập giá trị chưa. P5 (hàng đợi) và P8 (số liệu) sẽ tự đặt hai kiểu khác nhau.

Chốt `pending | decided`. Mọi con số lấy từ `proposal_decisions.decision` → một nguồn sự thật, I-12 tự đúng, và `status` vắng khỏi `GRANT INSERT` nên `DEFAULT 'pending'` khoá được trạng thái ban đầu. Phát hiện 1 và 2 khớp vào nhau ở đúng chỗ này.

### Phát hiện 3 — `CHECK` whitelist `target_field` sẽ chặn oan

Phase file viết `CHECK` phẳng. Nhưng I-11 chỉ áp cho `proposal_type='field_update'`; gợi ý loại `timeline_entry` không có ô đích nên `target_field` phải NULL → `CHECK` phẳng từ chối gợi ý hợp lệ. Sửa thành có điều kiện; dạng này chặn được **cả hai nửa** I-11 và ép luôn đúng cặp `type ↔ field`.

### Phát hiện 4 — `UNIQUE (company_id, content_hash)` trái chữ I-3

I-3 nói *"khác **bản gần nhất**"*; `UNIQUE` nói *"khác **mọi bản đã từng có**"*. Chỗ khác nhau là chuỗi **A → B → A**, và T-6/T-8 đều đòi đổi bản chụp trước ⇄ sau. Giám khảo diễn lại lần hai → `UNIQUE` từ chối → AI im lặng ngừng sinh đúng lúc đang bị chấm.

### Phát hiện 5 — hai việc bỏ sót, cả hai ở file dùng chung

Hai FK còn nợ trong `timeline-entries.ts` (comment trong file đòi thẳng *"do not leave this"*, và `contacts`/`claims` land đúng ở phase này). Và danh sách `TRUNCATE` hardcode bị 3 file test copy, cộng `ALL_TABLES` riêng trong `seed()` — bốn chỗ giữ cùng một thứ.

---

## Nhìn lại

**Phép đo đột biến số 3 là điểm chuyển của cả phiên.** Trước khi chạy nó, ADR-0015 chỉ là *phép loại suy* từ `UPDATE` sang `INSERT` — mà ADR-0010 tồn tại chính vì loại suy kiểu đó đã sai một lần. Áp `GRANT INSERT ON proposals` mức bảng lên `crm_test`:

1. `information_schema.column_privileges` mọc thêm đúng một dòng: `INSERT status`.
2. Khẳng định số 7 đỏ — và đỏ theo kiểu tệ nhất: câu `INSERT … status='decided'` **không báo lỗi gì**, trả `command: "INSERT", rowCount: 1`.
3. `REVOKE` rồi cấp lại danh sách cột → `INSERT status` biến mất, 34/34 xanh lại.

Bước 2 là cái biến ADR-0015 từ nỗi lo suy diễn thành số đo. Bước 3 đo luôn đường rollback: `REVOKE` theo cột **có** tác dụng khi quyền ban đầu cấp theo cột — khác hẳn `REVOKE` theo cột trên quyền cấp mức bảng (thứ ADR-0010 đã đo là vô tác dụng).

**Ba điều rút ra, áp được cho P2–P8:**

1. **Bài học viết thành câu văn không tự suy sang động từ khác.** Comment đầu `0001_grants.sql` nói rất rõ về `UPDATE`, và AI đọc nó rồi vẫn viết `INSERT` mức bảng cho 3 bảng mới. Từ giờ mỗi phase thêm bảng phải trả lời một câu hỏi tường minh: *bảng này có cột nào thuộc quyết định của người không?* — không dựa vào việc nhớ lại comment cũ.
2. **Test chỉ chặn được cái nó nhìn thấy.** Test quyền `UPDATE` xanh suốt trong khi `INSERT` hở. Chiều cấm phải liệt kê theo **từng cột bị loại**, không theo bảng.
3. **Chiều cho quan trọng ngang chiều cấm.** Thiếu GRANT làm teammate tê liệt ngay; GRANT dư chỉ làm test đỏ về sau. Đó là lý do smoke chiều-cho được xếp vào P1a chứ không hoãn.

---

## Quyết định

| ADR | Chốt gì | Phương án bị loại | Verify |
| --- | --- | --- | --- |
| [0015](../decisions/0015-grant-insert-phai-theo-cot-khi-bang-co-cot-thuoc-quyet-dinh-cua-nguoi.md) | Bảng có cột thuộc quyết định của người → `GRANT INSERT` theo cột + `DEFAULT` ở CSDL | trigger ép giá trị (ghi đè âm thầm, không có lỗi để test bắt) · `CHECK (status='pending')` (chặn luôn người) · tách bảng 1-1 | **đã đo**: 34 khẳng định, 3 nhóm; phép đo đột biến số 3 |
| [0016](../decisions/0016-proposal-status-chi-hai-gia-tri-moi-con-so-do-lay-tu-proposal-decisions.md) | `proposal_status = pending \| decided`, con số lấy từ `ProposalDecision` | mirror 4 trạng thái (hai nguồn sự thật) · bỏ hẳn cột (mất chỗ cho `DEFAULT` bảo vệ) | parity test + khẳng định `DEFAULT 'pending'`. **Còn treo**: test I-12 tách `edit` khỏi `accept` thuộc P5 |
| [0017](../decisions/0017-i3-enforce-o-tang-service-rang-buoc-csdl-chi-danh-cho-ranh-gioi.md) | I-3 ở service, không `UNIQUE`. Nguyên tắc: **CSDL cho ranh giới Specs kiểm bằng SQL thẳng, service cho luật hành vi** | `UNIQUE` · `UNIQUE` + `ON CONFLICT DO NOTHING` (nhật ký ghi "không đổi" khi nội dung đã đổi — hệ thống nói sai về chính nó) | khẳng định 27: chuỗi A→B→A lưu được. **Còn treo**: phép đo đột biến ở service thuộc P2 |

Hai mục "còn treo" ở trên là thật, không phải hình thức: chúng cần code của P2/P5 mới chạy được, và đã ghi vào chính ADR.

---

## Đã làm được gì

- **7 bảng**: `contacts` · `observations` · `claims` · `proposals` · `proposal_decisions` · `auto_next_step_events` · `notifications`. `watch_cycle_runs` đã đủ cột từ plan skeleton nên không sửa.
- **2 migration**: `0002_closed_cyclops.sql` (drizzle sinh) + `0003_grants_ai_tables.sql` (viết tay, đăng ký tay vào `_journal.json` + snapshot).
- **3 `DEFAULT` là phần bắt buộc của thiết kế**, không phải chi tiết: `status='pending'` · `undo_deadline=now()+7d` · `read_at` NULL. Thiếu chúng thì mọi cột bị loại khỏi GRANT nhận `NULL`.
- **Ontology + contracts**: thêm `proposal_status` vào 3.5 (parity test 11 → 12 dòng); đóng câu hỏi mở `source_tier` (giữ `text`, mặc định `'company_website'`); 4 DTO mới, `decideProposalSchema` ép ADR-0008 và I-12 vào contract.
- **DRY**: danh sách bảng về một chỗ `schema/all-tables.ts`, dùng chung `seed()` + `resetTestDatabase()` mới; 2 FK còn nợ đã nối.
- **1 file test mới** (`column-grants-block-system-actor-on-ai-tables.test.ts`, 34 khẳng định), 4 file test cũ sửa.
- **Ba phép đo đột biến**, đã khôi phục hết:

| # | Đột biến | Kết quả |
| --- | --- | --- |
| 1 | `PROPOSAL_STATUS.pending` → `waiting` | parity đỏ: `expected [ 'waiting', 'decided' ]…` |
| 2 | `GRANT UPDATE ON opportunities` mức bảng | test quyền cột **3/8 đỏ** |
| 3 | `GRANT INSERT ON proposals` mức bảng | khẳng định 7 đỏ, `rowCount: 1` không lỗi |

Đo 1 và 2 là nợ từ plan skeleton, đã tick checkbox tại `phase-01`/`phase-02` của plan cũ. ADR-0015 bỏ nhãn *nợ verify*.

**Cổng chất lượng:** `pnpm typecheck` sạch · `pnpm lint` sạch · 88 unit + 3 e2e xanh, chạy sau `pnpm reset` (volume trống → compose migrate → seed).

**Ước lượng vs thực tế:** 1.5h + 1.5h → thực ~25', P1b làm liền không cần song song. Đừng đọc thành "ước lượng luôn thừa": P1 thuần schema + SQL, không có ẩn số nghiệp vụ. P2 (LLM thật) và P8 (nghiệm thu) không như vậy.

**Bẫy kỹ thuật gặp thật:** `apps/api` typecheck đọc `dist` của `@crm/db`, còn vitest đọc `src` qua alias. Thêm export vào `packages/db` mà chưa `pnpm --filter @crm/db build` → **test xanh nhưng typecheck đỏ**. Đã ghi vào phase file.

---

## Việc tiếp theo

| Việc | Khi |
| --- | --- |
| Commit (18 file sửa + 22 file mới) | trước khi P2/P3/P4 bắt đầu |
| P2 nhóm 2 · P3 nhóm 1 · P4 seed — **đội fan-out được ngay**, P1b đã xanh nên không còn chặn P5/P6/P7 | 13/08 hết ngày |
| `pnpm build` chưa chạy — README ghi `apps/web` gãy symlink trên Windows nếu chưa bật Developer Mode; không ảnh hưởng `pnpm start` vì build trong Docker | tuỳ, không nằm trong nghiệm thu P1 |

## Còn treo

- **`ontology-enum-parity.test.ts` không phủ hết.** Nó so ontology 3.5 ↔ contracts nhưng không kiểm mọi cột enum ở mục 3.1–3.4 có mặt trong 3.5 — đó là lý do `proposals.status` sống một ngày mà không có gì đỏ. Đã ghi comment vào test kèm câu chuyện, **chưa sửa**. Đề xuất: nhét vào P8 nếu còn giờ, hoặc bỏ và ghi lại.
- **Q-6: Admin có được thao tác CRM không** — chưa động tới, vẫn chặn ma trận quyền nhóm 6.
- **Telemetry thành viên 2 và 3** chưa verify trên Grafana. Không phải việc của phase 1 nhưng là điều kiện qua vòng 1.

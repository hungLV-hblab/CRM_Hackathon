# ADR-0015 — `GRANT INSERT` mức bảng có cùng cái bẫy như `GRANT UPDATE` mức bảng; bảng nào có cột thuộc quyết định của người thì phải GRANT theo cột

| | |
| --- | --- |
| **Ngày** | 2026-08-13 01:27 |
| **Giai đoạn** | Design (mở rộng lớp CSDL của [ADR-0010](0010-chan-tang-csdl-bang-hai-role-va-quyen-theo-cot.md)) |
| **Trạng thái** | Chấp nhận — **đã verify bằng thực nghiệm 13/08 02:15** |
| **Người quyết định** | HungLV |
| **Prompt log** | phiên brainstorm phase 1 ngày 13/08 01:27 — [báo cáo](../../plans/reports/from-brainstorm-to-planner-260813-0127-phase-01-grant-insert-theo-cot-va-ba-quyet-dinh-report.md) |

## Bối cảnh

ADR-0010 chốt: chỉ `GRANT` đúng cột được phép, tuyệt đối không `GRANT UPDATE` toàn bảng rồi `REVOKE` theo cột. Bài học đó được rút ra **trên động từ `UPDATE`**, vì skeleton chỉ có một đường ghi cần bảo vệ (`opportunities.stage` / `expected_value`).

Phase 1 của plan sáu-nhóm-tính-năng thêm 7 bảng, trong đó **ba bảng mới có cột thuộc quyết định của người nằm cùng bảng với cột do AI ghi**:

| Bảng | Cột AI ghi | Cột **của người** ở cùng bảng |
| --- | --- | --- |
| `proposals` | `claim_id`, `proposal_type`, `target_field`, `current_value`, `proposed_value`, `impact_if_wrong` | `status` (chờ duyệt hay đã quyết) |
| `auto_next_step_events` | cặp cũ/mới của Việc tiếp theo | `undo_deadline`, 4 cột `undone_*` |
| `notifications` | `message`, `auto_event_id` | `read_at` |

Plan phase 1 lúc đầu ghi cho cả ba bảng là `SELECT, INSERT` **mức bảng**, kèm chú thích *"chỉ sinh, không UPDATE `status`"*. Chú thích đó đúng nhưng không đủ: `INSERT` mức bảng phủ mọi cột, nên `crm_system` chỉ cần truyền `status` ngay trong câu `INSERT` là xong — **không cần `UPDATE` nào cả**.

Đây là **đúng cùng một cấu trúc lỗi** mà ADR-0010 đã bắt được, chỉ đổi động từ. Nếu để nguyên thì T-4 vỡ ở lớp CSDL trong khi test quyền `UPDATE` vẫn xanh — đội tưởng có hai lớp chặn nhưng chỉ còn một.

## Phương án đã cân nhắc

Tiêu chí: *(1)* chặn được khi lệnh không đến từ giao diện · *(2)* nguy cơ thủng âm thầm · *(3)* chi phí cài trong ~90' của P1a · *(4)* chứng minh trước BGK mất bao lâu.

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| **A.** `GRANT INSERT (danh sách cột)` — liệt kê tường minh, cột thuộc quyết định của người **không có trong danh sách**, và cột đó có `DEFAULT` đúng ở CSDL | Cùng cơ chế đã đo ở ADR-0010, không thêm khái niệm mới. CSDL **tự bảo đảm** mọi `Proposal` do AI sinh đều `status='pending'` — không phải tin vào code AI. Chứng minh bằng một câu `INSERT` trong `psql` | Mỗi lần thêm cột vào 3 bảng này phải nhớ cập nhật danh sách GRANT. Quên → AI mất quyền ghi cột mới (an toàn), không phải thừa quyền | ✅ **Chọn** |
| **B.** `INSERT` mức bảng, chặn `status`/`undo_deadline`/`read_at` bằng trigger `BEFORE INSERT` ép giá trị | Không phải liệt kê cột; thêm cột không cần sửa gì | Thêm 3 function PL/pgSQL phải test riêng. Và ADR-0010 đã loại trigger vì tiêu chí (2). Ở đây còn tệ hơn: trigger *ghi đè âm thầm* nên không có lỗi để test bắt — AI gửi `status='decided'`, trigger sửa về `pending`, mọi thứ trông như đang chạy đúng cho tới hôm nào đó trigger bị drop | ❌ Loại — biến lỗi kiểm được thành lỗi không kiểm được, đúng lý do ADR-0010 loại trigger |
| **C.** `INSERT` mức bảng + `CHECK (status = 'pending')` trên `proposals` | Một dòng SQL, không cần danh sách cột | Chặn luôn `crm_app` — con người không duyệt được gợi ý nào nữa. Phải thành `CHECK` phụ thuộc role, mà Postgres không có thứ đó. Với `undo_deadline` thì càng vô nghĩa: giá trị hợp lệ phụ thuộc `now()` nên `CHECK` không tất định | ❌ Loại — chặn sai người, và không áp được cho `undo_deadline` |
| **D.** Tách bảng: `proposals` (AI ghi) + `proposal_status` (người ghi) 1-1 | Ranh giới nằm ở biên bảng, `INSERT` mức bảng lại an toàn | Thêm 3 bảng 1-1 chỉ để mang 1 cột, mọi truy vấn hàng đợi thành join. Và `proposal_decisions` đã là bảng riêng cho phần quyết định — thêm nữa là ba nơi giữ một chuyện | ❌ Loại — chi phí mô hình dữ liệu không đổi lấy được thêm gì mà A chưa có |

## Quyết định

Chọn **A**. Phân loại 7 bảng mới bằng đúng một câu hỏi: *bảng này có cột nào thuộc quyết định của **người** không?*

```sql
-- Không có cột nào của người → INSERT mức bảng an toàn (vùng 1)
GRANT SELECT, INSERT ON observations TO crm_system;
GRANT SELECT, INSERT ON claims       TO crm_system;

-- Có cột của người → INSERT THEO CỘT, cột của người vắng mặt
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

-- Dữ liệu của người, AI chỉ đọc
GRANT SELECT ON contacts TO crm_system;

-- proposal_decisions: KHÔNG GRANT GÌ. Quyết định là hành vi của người, `crm_app` ghi.
```

Ba `DEFAULT` là phần **bắt buộc** của quyết định này, không phải chi tiết cài đặt — thiếu nó thì cột bị loại khỏi GRANT sẽ nhận `NULL`:

```sql
proposals.status                     NOT NULL DEFAULT 'pending'
auto_next_step_events.undo_deadline  NOT NULL DEFAULT now() + interval '7 days'
notifications.read_at                NULL, không default          -- NULL = chưa xem
```

`id` nằm trong danh sách GRANT vì nó không phải cột quyết định của người; để nó ngoài chỉ tạo lỗi khi code truyền uuid tường minh.

## Hệ quả

- **Vùng 3 và vùng 4 được lớp CSDL bảo vệ đúng chỗ đáng bảo vệ nhất.** Cửa sổ Hoàn tác 7 ngày (T-7) không còn phụ thuộc vào việc code AI tính `undo_deadline` tử tế: AI **không có quyền** ghi cột đó, `DEFAULT` của CSDL quyết định. Tương tự, mọi `Proposal` do AI sinh đều bắt đầu ở `pending` (T-4) vì đó là `DEFAULT`, không phải vì service nhớ set.
- Thêm cột vào 3 bảng này phải cập nhật danh sách GRANT. Giữ hướng thất bại an toàn của ADR-0010: quên → AI mất quyền, không bao giờ thừa quyền.
- **Phép đo đột biến thứ ba** (bổ sung hai phép đo còn nợ từ plan skeleton): đổi `GRANT INSERT (cột…)` của `proposals` thành `GRANT INSERT` mức bảng → test chiều-cấm **phải đỏ**. Đã chạy, đã đỏ — xem mục verify.
- Nhóm 3 (P5) và nhóm 4 (P6) ăn trực tiếp `status` và `undo_deadline` → **P1b phải xanh trước khi P5/P6 bắt đầu**, không được dồn sang P8.
- **Sẽ phải xem lại nếu:** xuất hiện một bảng mà cùng một cột lúc thì người ghi lúc thì AI ghi (không phải trường hợp nào trong 7 bảng này). Lúc đó quyền cột không phân biệt được và phải quay về RLS hoặc tách bảng như phương án D.

## AI đã tham gia thế nào

- **Vai trò AI:** đọc lại phase file do chính AI viết trước đó, đối chiếu với comment đầu `0001_grants.sql`, phát hiện mâu thuẫn.
- **AI sai ở đâu — sai trong chính plan của mình:** bản phase-01 đầu tiên (do AI viết) ghi bảng GRANT là `proposals → SELECT, INSERT` và ngay dưới đó viết *"Viết `GRANT INSERT (cột...)` khi chỉ được ghi một phần"*. Hai câu **mâu thuẫn nhau trong cùng một trang**, và cái sai lại là cái nằm trong bảng — tức là cái người đọc sẽ copy vào SQL. Đây là bằng chứng cụ thể rằng nhắc lại bài học ở dạng câu văn không đủ: ADR-0010 nói về `UPDATE`, và AI không tự suy sang `INSERT`.
- **AI đề xuất gì mà đội không nghe:** AI có nêu phương án trigger ép giá trị (B) như cách "khỏi phải liệt kê cột". Bỏ vì đúng tiêu chí (2) mà ADR-0010 đã dùng để loại trigger — và ở đây tệ hơn vì trigger ghi đè âm thầm thì không có lỗi để test bắt.

## Đội đã verify bằng cách nào

Cơ sở ban đầu chỉ là *suy luận đối xứng* từ đo 1 của ADR-0010 (`UPDATE` mức bảng phủ mọi cột) sang `INSERT`. ADR-0010 tồn tại chính vì suy luận kiểu đó đã sai một lần, nên món nợ này được ghi thẳng vào ADR và trả ngay trong cùng phase, không để sang phase sau.

**Đã trả 13/08 02:15.** 34 khẳng định trong `packages/db/src/__tests__/column-grants-block-system-actor-on-ai-tables.test.ts`, chạy trực tiếp bằng `crm_system` qua `pg` — không HTTP, không service, không Drizzle. Cả ba nhóm cùng lúc:

| Nhóm | Nội dung | Kết quả |
| --- | --- | --- |
| Chiều cho | 6 đường ghi của vùng 1–4 chạy được (thiếu GRANT thì nhóm 4/5 tê liệt, mà chỉ test chiều cấm thì không thấy) | xanh |
| Chiều cấm | `INSERT (…, status)`, `INSERT (…, undo_deadline)`, `INSERT (…, undone_at)`, `INSERT (…, read_at)`, `UPDATE status`, `UPDATE read_at`, ghi `proposal_decisions`, ghi `contacts`, `DELETE` trên cả 7 bảng | xanh, đúng `permission denied` |
| `DEFAULT` | `status='pending'`, `undo_deadline` trong khoảng 6.9–7.1 ngày, `read_at IS NULL` | xanh |

Nhóm thứ ba không phải trang trí: chiều cấm chỉ **an toàn** khi cột AI không ghi được vẫn nhận đúng giá trị. Bỏ `DEFAULT` đi thì mọi dòng "denied" ở trên biến thành `NULL` trong dữ liệu chính thức.

**Phép đo đột biến — chỗ quan trọng nhất, vì nó là thứ biến ADR này từ suy luận thành số đo.** Áp `GRANT INSERT ON proposals TO crm_system` (mức bảng) lên `crm_test`:

1. `information_schema.column_privileges` mọc thêm đúng một dòng: `INSERT status`.
2. Khẳng định số 7 **đỏ** — và đỏ theo đúng kiểu tệ nhất: câu `INSERT … status = 'decided'` **không báo lỗi gì cả**, trả `command: "INSERT", rowCount: 1`. Tức là `crm_system` **tự duyệt gợi ý của chính nó thành công**, không cần một quyền `UPDATE` nào.
3. `REVOKE INSERT ON proposals` rồi cấp lại đúng danh sách cột → `INSERT status` biến mất, `SELECT status` còn nguyên, 34/34 xanh trở lại.

Bước 2 là bằng chứng cái bẫy của ADR-0010 **có thật trên `INSERT`**, không phải nỗi lo suy diễn. Bước 3 đồng thời đo luôn đường rollback ghi ở mục dưới: `REVOKE` **có** tác dụng khi quyền ban đầu cấp theo cột — khác hẳn `REVOKE` theo cột trên một quyền cấp ở mức bảng (thứ mà ADR-0010 đã đo là vô tác dụng).

Kèm hai phép đo đột biến còn nợ từ plan skeleton, trả cùng lúc: đổi một giá trị enum → parity test đỏ; `GRANT UPDATE` mức bảng trên `opportunities` → test quyền cột đỏ 3/8. Cả ba đã khôi phục, toàn bộ `pnpm test` xanh (88 unit + 3 e2e) trên CSDL dựng lại từ volume trống.

## Rollback

Không có gì để rollback theo nghĩa thông thường — quyết định này chỉ **thu hẹp** quyền so với phương án đang có trong plan. Nếu danh sách cột hoá ra sai (AI cần ghi một cột bị bỏ sót) thì thêm cột đó vào `GRANT INSERT` trong một migration mới: **~5'**. Chiều ngược lại (phát hiện GRANT quá tay) cũng là một `REVOKE` + `GRANT` lại danh sách hẹp hơn, **~10'**, vì `REVOKE` theo cột **có** tác dụng khi quyền ban đầu cũng cấp theo cột — đã đo ở bước 3 của phép đo đột biến, không phải suy diễn.

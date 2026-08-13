# Phản biện phase 1 — `GRANT INSERT` theo cột, và ba quyết định phát sinh

| | |
| --- | --- |
| **Ngày** | 2026-08-13 01:27 |
| **Loại** | Brainstorm / phản biện thiết kế (không code) |
| **Đối tượng** | [phase-01](../260813-0107-feature-groups-1-6-and-acceptance-suite/phase-01-seam-bay-bang-con-lai-grant-va-contracts.md) của [plan sáu nhóm tính năng](../260813-0107-feature-groups-1-6-and-acceptance-suite/plan.md) |
| **Người quyết định** | HungLV |
| **Sinh ra** | [ADR-0015](../../docs/decisions/0015-grant-insert-phai-theo-cot-khi-bang-co-cot-thuoc-quyet-dinh-cua-nguoi.md) · [ADR-0016](../../docs/decisions/0016-proposal-status-chi-hai-gia-tri-moi-con-so-do-lay-tu-proposal-decisions.md) · [ADR-0017](../../docs/decisions/0017-i3-enforce-o-tang-service-rang-buoc-csdl-chi-danh-cho-ranh-gioi.md) + sửa phase-01 và plan.md |

## Vì sao có phiên này

Phase 1 là mặt cắt cả đội chờ. Sai ở đây thì ba người fan-out trên nền sai suốt 2 ngày còn lại, và ba trong bốn phase phía sau (P5/P6/P7) ghi trực tiếp vào các bảng do phase này dựng. Đọc lại trước khi ai gõ dòng đầu.

**Kết quả: tìm được 5 chỗ sai hoặc thiếu, trong đó 1 chỗ làm vỡ T-4/T-6/T-7 ở lớp CSDL mà test hiện có vẫn xanh.**

---

## Phát hiện 1 — `GRANT INSERT` mức bảng là cùng cái bẫy ADR-0010 đã bắt, chỉ đổi động từ

**Nghiêm trọng nhất.** Bảng GRANT của phase-01 ghi `proposals → SELECT, INSERT` kèm chú thích *"chỉ sinh, không UPDATE `status`"*. Chú thích đúng nhưng không đủ: `INSERT` mức bảng phủ **mọi cột**, nên `crm_system` chỉ cần

```sql
INSERT INTO proposals (..., status) VALUES (..., 'accepted');
```

là tự duyệt gợi ý của chính nó — **không cần `UPDATE` nào**. Ba bảng bị:

| Bảng | Cột lọt | Mất gì |
| --- | --- | --- |
| `proposals` | `status` | AI tự duyệt → **T-4 vỡ ở lớp CSDL** |
| `auto_next_step_events` | `undo_deadline`, 4 cột `undone_*` | AI ghi `undo_deadline` quá khứ → **cửa sổ Hoàn tác 7 ngày bốc hơi** (T-7); ghi `undone_at` sẵn → vết hoàn tác giả |
| `notifications` | `read_at` | AI ghi `read_at = now()` → thông báo chưa từng hiện mà đã "đã đọc" (T-6) |

Đây là **đúng cấu trúc lỗi** mà đo 1 của [ADR-0010](../../docs/decisions/0010-chan-tang-csdl-bang-hai-role-va-quyen-theo-cot.md) đã bắt trên `UPDATE`. Nếu để nguyên thì test quyền `UPDATE` vẫn xanh trong khi ba ranh giới đã hở — đội tưởng có hai lớp chặn nhưng chỉ còn một.

Đáng ghi lại: phase-01 **tự mâu thuẫn trong cùng một trang** — bảng ghi `INSERT` trơn, đoạn ngay dưới bảng ghi *"Viết `GRANT INSERT (cột...)` khi chỉ được ghi một phần"*. Cái sai lại nằm trong bảng, tức là cái người đọc sẽ copy vào SQL.

→ [ADR-0015](../../docs/decisions/0015-grant-insert-phai-theo-cot-khi-bang-co-cot-thuoc-quyet-dinh-cua-nguoi.md). Cài đặt: phân loại 7 bảng bằng một câu hỏi *"có cột nào thuộc quyết định của người không?"*, 3 bảng dùng `INSERT` theo cột + 3 `DEFAULT` ở CSDL.

## Phát hiện 2 — `proposals.status` chưa được định nghĩa ở đâu cả

Ontology 3.2 liệt kê cột `status`; ontology 3.5 **không có** enum nào cho nó; `contracts/src/enums.ts` cũng không. Tên cột đã chốt, tập giá trị chưa. P5 (hàng đợi) và P8 (số liệu) sẽ tự đặt hai kiểu.

Chốt `pending | decided`, mọi con số đo lấy từ `proposal_decisions.decision` → một nguồn sự thật, I-12 tự đúng, và `status` vắng khỏi `GRANT INSERT` nên `DEFAULT 'pending'` khoá được trạng thái ban đầu (phát hiện 1 và 2 khớp vào nhau ở đúng chỗ này).

Loại phương án mirror 4 trạng thái vì nó tạo hai nguồn sự thật cho đúng những con số mang ra trước BGK. → [ADR-0016](../../docs/decisions/0016-proposal-status-chi-hai-gia-tri-moi-con-so-do-lay-tu-proposal-decisions.md).

**Lỗ ontology đi kèm, chưa xử lý:** `ontology-enum-parity.test.ts` chỉ so ontology 3.5 ↔ contracts. Nó **không** kiểm mọi cột enum xuất hiện ở 3.1–3.4 có mặt trong 3.5 — đó là lý do lỗ này sống từ 12/08 tới 13/08. Xem mục *Còn treo*.

## Phát hiện 3 — `CHECK` whitelist `target_field` sẽ chặn oan gợi ý loại `timeline_entry`

Phase-01 viết `CHECK` phẳng trong whitelist `industry, country, size, website`. Nhưng I-11 chỉ áp cho `proposal_type='field_update'`; loại `timeline_entry` không có ô đích nên `target_field` phải NULL → `CHECK` phẳng từ chối gợi ý hợp lệ, hoặc buộc nhồi giá trị rác.

```sql
CHECK ( (proposal_type = 'field_update'   AND target_field IN ('industry','country','size','website'))
     OR (proposal_type = 'timeline_entry' AND target_field IS NULL) )
```

Dạng có điều kiện chặn được **cả hai nửa** I-11 (whitelist *và* cấm `name`/`company_type`) đồng thời ép đúng cặp `type ↔ field` — mạnh hơn, cùng chi phí. Sửa trực tiếp trong phase-01, không cần ADR.

## Phát hiện 4 — `UNIQUE (company_id, content_hash)` trái chữ I-3 và có thể chết đúng lúc demo

I-3 nói *"khác **bản gần nhất**"*; `UNIQUE` nói *"khác **mọi bản đã từng có**"*. Chỗ khác nhau là chuỗi **A → B → A**.

Chuỗi đó không phải giả thiết: T-6 và T-8 đều đòi đổi bản chụp trước ⇄ sau, seed của ADR-0013 dựng đúng hai bản chụp. Giám khảo đổi sang "sau" (chạy), đổi về "trước" để diễn lại lần hai → `UNIQUE` từ chối → **AI im lặng ngừng sinh đúng lúc đang bị chấm**, không banner, không dòng nhật ký.

Chốt: enforce ở service, index `(company_id, captured_at DESC)`, không `UNIQUE`. Kèm nguyên tắc tổng quát:

> **Ràng buộc CSDL dành cho ranh giới mà Specs kiểm bằng SQL thẳng. Luật hành vi enforce ở service, và test ở service.**

I-1, I-11, vùng cấm, vùng 2/3/4 → CSDL. I-3, I-5, I-6, I-7, I-9, I-10 → service. Lý do phân lằn ranh ở chỗ này: sinh trùng một bản lưu **không làm hại dữ liệu của người**, nó chỉ tốn tiền LLM. → [ADR-0017](../../docs/decisions/0017-i3-enforce-o-tang-service-rang-buoc-csdl-chi-danh-cho-ranh-gioi.md).

Loại luôn phương án `UNIQUE` + `ON CONFLICT DO NOTHING`: nó làm nhật ký ghi *"không đổi"* khi nội dung **đã đổi** — hệ thống nói sai về chính nó, khó bảo vệ ở vòng 2 hơn cả một cái crash.

## Phát hiện 5 — hai việc bỏ sót, cả hai ở file dùng chung

- **FK còn nợ trong `timeline-entries.ts`.** Comment trong file đòi thẳng: *"When those tables land, add `references()` — do not leave this."* `contacts` và `claims` land đúng ở phase 1. Không làm bây giờ thì lúc P7 ghi timeline, người phải sửa file của B lại là C → đụng nhau.
- **Danh sách `TRUNCATE` hardcode** bị 4 file test copy. Thêm 7 bảng mà không tách `resetTestDatabase()` thì A, B, C cùng sửa cùng danh sách ở 3 file khác nhau suốt 2 ngày.

---

## Ước lượng 60' là con số đoán

Cộng thật: 7 schema (35') + migration + GRANT theo cột (25') + test hai chiều gồm ca `INSERT` cột bị cấm (50') + DTO (30') + 2 phép đo đột biến (20') + FK + helper truncate (25') + `reset/migrate/seed` từ trống (15') ≈ **~3h**, chưa tính lỗi.

Vấn đề không phải con số mà là **cả đội chờ 3h** trong ngân sách 24h. Ba phương án đã cân:

| | Cách | Đội bị chặn | Kết luận |
| --- | --- | --- | --- |
| A | Một khối, sửa ước lượng 60' → 3h | 3h | ❌ Mất ~6 giờ-người trong ngân sách đã âm đệm |
| **B** | **P1a** (schema + GRANT + DTO + smoke *chiều-cho*) 1.5h → mở khoá. **P1b** (ma trận *chiều-cấm* + phép đo đột biến + helper) song song | **1.5h** | ✅ **Chọn** |
| C | Ship schema trước, GRANT sau | 40' | ❌ Vùng cấm là chỗ rubric chấm; hở 2h là hở đúng cái đang bán |

Lý do hoãn *chiều-cấm* chứ không hoãn *chiều-cho*: thiếu GRANT làm **teammate bị chặn ngay** (P6/P7 ghi không được), GRANT dư chỉ làm **test đỏ về sau** — không ai phải viết lại code nào.

**Đổi thêm một mốc:** P1b phải xanh **trước P5/P6/P7**, không phải trước P8 như plan gốc. P6 (Hoàn tác) và P5 (duyệt) ăn trực tiếp `undo_deadline` và `status`.

---

## Đã áp vào đâu

| File | Sửa gì |
| --- | --- |
| `docs/decisions/0015…md` | ADR mới — `GRANT INSERT` theo cột. Trạng thái *nợ verify* |
| `docs/decisions/0016…md` | ADR mới — `proposal_status = pending \| decided` |
| `docs/decisions/0017…md` | ADR mới — I-3 ở service + nguyên tắc phân lớp ràng buộc |
| `docs/decisions/README.md` | 3 dòng chỉ mục |
| `plans/.../phase-01-…md` | Viết lại thành P1a/P1b; GRANT theo cột; `CHECK` có điều kiện; bỏ `UNIQUE`; 2 FK; helper truncate; danh sách cắt khi tràn 2h |
| `plans/.../plan.md` | Ước lượng, bảng phases (1a/1b), sơ đồ phụ thuộc, mốc thời gian, 3 dòng rủi ro |

**Chưa làm, cố ý:** không sửa `docs/ontology.md`, không sửa `packages/contracts`, không viết code. Thêm `proposal_status` vào ontology 3.5 và contracts là **bước 1 của P1a** — làm trước cả schema, vì `ontology-enum-parity.test.ts` sẽ đỏ tới khi làm và người thực thi cần biết trước để không đi debug oan.

---

## Điểm mạnh trước BGK, nói thẳng

ADR-0015 là loại lưu vết rubric trả điểm cao nhất: **một lỗi đội tự tìm ra trong plan của chính mình**, cùng họ với một lỗi đã bắt được bằng thực nghiệm hôm trước, và có phép đo đột biến chứng minh nó bị chặn thật. Mục *"AI sai ở đâu"* của cả ba ADR đều có nội dung thật, không phải để trống cho đẹp.

Ngược lại, phần yếu nhất là ADR-0015 **hiện chỉ dựa trên suy luận đối xứng** từ đo 1 của ADR-0010 (`UPDATE` mức bảng phủ mọi cột → `INSERT` cũng vậy). ADR-0010 tồn tại chính vì suy luận kiểu đó đã sai một lần. Nợ này ghi thẳng trong ADR và phải trả ở P1b — nếu phép đo đột biến số 3 cho kết quả xanh (tức `INSERT` theo cột không chặn gì) thì cả thiết kế phải làm lại.

---

## Còn treo

- **`ontology-enum-parity.test.ts` không phủ hết.** Nó so ontology 3.5 ↔ contracts, nhưng không kiểm mọi cột enum ở 3.1–3.4 có mặt trong 3.5. Đó là lý do `proposals.status` sống 1 ngày mà không ai thấy. Sửa được bằng cách liệt kê cột-enum-theo-bảng trong test, nhưng **không xếp vào P1a** — không có trong ngân sách 1.5h, và nó không chặn ai. Đề xuất: nhét vào P8 nếu còn thời gian, hoặc bỏ và ghi lại.
- **Q-6 (Admin có được thao tác CRM không)** — chưa động tới trong phiên này, vẫn chặn ma trận quyền nhóm 6.
- **Telemetry thành viên 2 và 3** chưa verify trên Grafana. Không phải việc của phase 1 nhưng là điều kiện qua vòng 1.

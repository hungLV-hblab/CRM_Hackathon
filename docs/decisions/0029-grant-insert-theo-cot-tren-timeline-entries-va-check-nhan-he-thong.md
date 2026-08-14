# ADR-0029 — `timeline_entries` cũng phải `GRANT INSERT` theo cột, kèm `CHECK` bắt mục hệ thống phải có nguồn

| | |
| --- | --- |
| **Ngày** | 2026-08-14 02:35 |
| **Giai đoạn** | Design (mở rộng [ADR-0015](0015-grant-insert-phai-theo-cot-khi-bang-co-cot-thuoc-quyet-dinh-cua-nguoi.md) sang bảng của skeleton) |
| **Trạng thái** | Chấp nhận — **đã verify bằng thực nghiệm 14/08 02:31, kèm phép đo đột biến** |
| **Người quyết định** | HungLV |
| **Prompt log** | phiên phản biện phase 7 ngày 14/08 01:59 — [báo cáo](../../plans/reports/from-brainstorm-to-planner-260814-0159-phase-07-nhom-5-vong-quet-ghi-dong-thoi-gian-report.md) |

## Bối cảnh

ADR-0015 phân loại **7 bảng mới của phase 1** bằng một câu hỏi: *bảng này có cột nào thuộc quyết định của người không?* Bảng nào có thì `GRANT INSERT` theo cột, cột của người vắng mặt và có `DEFAULT`.

`timeline_entries` **không nằm trong 7 bảng đó** — nó có từ skeleton, và `0001_grants.sql:53` cấp:

```sql
GRANT SELECT, INSERT ON timeline_entries TO crm_system;   -- mức bảng
```

Đem đúng câu hỏi của ADR-0015 ra hỏi bảng này thì nó **trượt hai lần**:

| Cột | Vì sao nó thuộc về người / hệ thống |
| --- | --- |
| `created_by` | Là chỗ nhãn "do hệ thống thêm" được render ra. AI ghi được cột này ⇒ **AI viết được một dòng trông y như Sales tự gõ**. Luật 2 của CLAUDE.md mất, và mất một cách vô hình |
| `source_claim_id` | Là đường về câu trích. `INSERT` mức bảng cho phép để `NULL` ⇒ **một nhận định nằm trên dòng thời gian chính thức mà không có nguồn nào**. Luật 1 mất |

Cộng lại: đúng cái dòng mà không ai trong đội bảo vệ được ở vòng 2. Và đây là **cùng cấu trúc lỗi ADR-0015 đã bắt**, chỉ khác là trên một bảng mà ADR đó không xét tới — nên nó tồn tại im lặng từ 12/08.

Vùng tự chủ 4 là vùng duy nhất AI ghi vào dữ liệu chính thức **không hỏi ai**, nên đây cũng là chỗ chỉ có một lớp chặn thì ít nhất phải biết rằng chỉ có một.

## Phương án đã cân nhắc

Tiêu chí: *(1)* chặn được khi lệnh không đến từ giao diện · *(2)* nguy cơ thủng âm thầm · *(3)* có chặn sai người không · *(4)* chi phí trong ngân sách 3h của P7 · *(5)* đường lùi.

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| **A.** `REVOKE INSERT` mức bảng + `GRANT INSERT (danh sách cột)` **không có** `created_by` và `contact_id`, + `DEFAULT 'system'` cho `created_by`, + `CHECK` bắt mục `system` phải là `system_entry` và có `source_claim_id` | Cùng cơ chế đã đo hai lần (ADR-0010 trên `UPDATE`, ADR-0015 trên `INSERT`), không thêm khái niệm. Hai lớp **không trùng nhau**: `CHECK` chặn mọi role kể cả `crm_owner`, GRANT chặn riêng `crm_system` ở chỗ `CHECK` không thể (ghi `created_by='human'` là hợp lệ với `CHECK`, chỉ GRANT cản được). Chứng minh bằng một câu `INSERT` trong `psql` | Thêm cột vào bảng này về sau phải nhớ sửa danh sách GRANT. Quên → AI mất quyền ghi cột mới (**hướng an toàn**) | ✅ **Chọn** |
| **B.** Chỉ thêm `CHECK`, giữ `GRANT INSERT` mức bảng | Một dòng SQL, không lo danh sách cột | **Không chặn được `created_by='human'`** — với `CHECK` thì mệnh đề `created_by <> 'system'` đúng, nên câu lệnh hợp lệ. Đã đo: bật lại GRANT mức bảng thì test 3 và 4 đỏ trong khi `CHECK` vẫn còn nguyên. Nghĩa là B để hở đúng lỗ nghiêm trọng nhất | ❌ Loại — đo rồi, không chặn được ca chính |
| **C.** Chỉ siết GRANT theo cột, không thêm `CHECK` | Không phải nghĩ về bẫy enum trong transaction | Không chặn được `crm_owner` và mọi đường ghi thẳng bằng SQL — mà T-2 nói rõ "thử ghi thẳng, phải bị từ chối". Và seed/migration chạy dưới `crm_owner` | ❌ Loại — bỏ nửa mà T-2 đòi |
| **D.** Trigger `BEFORE INSERT` ép `created_by = 'system'` khi người gọi là `crm_system` | Không phải liệt kê cột | ADR-0010 đã loại trigger, và ở đây tệ hơn: trigger **ghi đè âm thầm** nên không có lỗi nào để test bắt. AI gửi `created_by='human'`, trigger sửa lại, mọi thứ trông đúng cho tới hôm trigger bị drop | ❌ Loại — biến lỗi kiểm được thành lỗi không kiểm được |
| **E.** Tách bảng `system_timeline_entries` riêng | Ranh giới nằm ở biên bảng, `INSERT` mức bảng lại an toàn | Phá thứ ontology 3.1 đòi: **một** dòng thời gian đọc chung, không ba tab. Mọi truy vấn dòng thời gian thành `UNION`, và luật "sắp xếp theo `occurred_at`" thành việc trộn hai nguồn ở client | ❌ Loại — phá mô hình đọc để đổi lấy thứ A đã có |

## Quyết định

Chọn **A**. Migration `0007_timeline_entry_system_label.sql`:

```sql
ALTER TABLE timeline_entries ALTER COLUMN created_by SET DEFAULT 'system';

ALTER TABLE timeline_entries ADD CONSTRAINT timeline_system_entry_needs_quote
  CHECK (created_by::text <> 'system'
         OR (entry_type::text = 'system_entry' AND source_claim_id IS NOT NULL));

REVOKE INSERT ON timeline_entries FROM crm_system;
GRANT INSERT (id, company_id, entry_type, occurred_at, description, source_claim_id, created_at)
  ON timeline_entries TO crm_system;
```

Bốn điểm của quyết định này, mỗi điểm có lý do riêng:

1. **`REVOKE` trước `GRANT`** là dòng gánh việc. Cấp thêm quyền theo cột lên trên một quyền mức bảng không siết gì cả — ADR-0010 đã đo đúng chuyện đó trên `UPDATE`: `REVOKE` theo cột không khoét được lỗ trong quyền mức bảng, nên phải bỏ quyền mức bảng đi trước.

2. **`DEFAULT 'system'`** là phần bắt buộc, không phải chi tiết. Bỏ `created_by` khỏi GRANT mà không có `DEFAULT` thì mọi câu "bị từ chối" ở trên biến thành lỗi `NOT NULL` và nhóm 5 đứng hẳn. Chọn `'system'` an toàn vì **mọi writer khác đều nêu cột tường minh** (`timeline-service.ts:53` và `opportunity-service.ts:218` đều truyền `'human'`), nên `DEFAULT` này chỉ trả lời cho câu lệnh do AI phát ra.

3. **`::text` trong `CHECK`** vì `created_by` và `entry_type` là enum, và drizzle chạy **mọi migration trong một transaction**: giá trị enum vừa được `ALTER TYPE ... ADD VALUE` trong cùng transaction chưa dùng được (lỗi 55P04). Đây là bẫy P5 đã trả giá — không so `::text` thì migration vỡ trên **mọi CSDL mới**, tức mỗi lần chạy test và mỗi lần giám khảo diễn lại từ đầu.

4. **`contact_id` cố tình vắng** khỏi danh sách GRANT, và đây là quyết định nghiệp vụ chứ không phải sót: AI gán một người liên hệ vào mục nó tự ghi là **bịa ra một cuộc gặp**. Vùng 4 mua được quyền thêm tin, không mua được quyền ghi ai đã có mặt.

Không cấp `UPDATE` và không cấp `DELETE` (cả hai vốn đã không có từ `0001`): một mục là ghi thêm, không sửa lại, và xoá là hành động của Sales — tín hiệu error-detection duy nhất của nhóm 5 (I-13).

## Verify

`packages/db/src/__tests__/column-grants-block-system-actor-on-timeline-entries.test.ts`, chạy trực tiếp bằng `pg` — không qua service, không qua HTTP, không qua drizzle. Đó là điều T-10 nói bằng "không qua giao diện". Mười test, bốn nhóm, và **cả bốn nhóm đều cần**:

| Nhóm | Chứng minh gì | Vì sao không bỏ được |
| --- | --- | --- |
| chiều-cho (1–2) | `crm_system` vẫn thêm được mục và vẫn đọc được bảng | `REVOKE` mà quên `GRANT` lại thì nhóm 5 chết im lặng, không bảo vệ được gì |
| chiều-cấm (3–6) | không ghi được `created_by='human'`, không gán `contact_id`, không `UPDATE`, không `DELETE` | Đây là lỗ ADR này tồn tại để bịt |
| `CHECK` với mọi role (7–8) | `crm_owner` cũng không ghi được mục `system` thiếu `source_claim_id`, cũng không đội lốt `entry_type` khác | T-2 đòi chặn cả đường ghi thẳng |
| chiều người (9–10) | `crm_app` vẫn ghi `created_by='human'`, vẫn `DELETE` được mục hệ thống | `DEFAULT` mới không được bịt miệng người, và I-13 phải có đường đi |

**Phép đo đột biến, chạy 14/08 02:33:** cấp lại `GRANT INSERT ON timeline_entries TO crm_system` mức bảng (tức xoá dòng `REVOKE` của `0007`) → test 3 và test 4 **đỏ**; khôi phục → 10/10 xanh.

Số đo đáng ghi lại từ phép đo đó: **`CHECK` vẫn xanh trong khi test 3 đỏ.** Nghĩa là hai lớp không dư thừa nhau — `CHECK` không hề chặn được ca "AI ghi `created_by='human'`", chỉ GRANT theo cột chặn. Ai định bỏ một trong hai lớp cho gọn thì đọc lại con số này trước.

## Hệ quả

- **Đường ghi của nhóm 5 phải viết `INSERT` nêu đúng cột**, không dùng `db.insert().values()` của drizzle. Builder đó liệt kê **mọi** cột của bảng, nên chỉ cần *nêu tên* `created_by` là Postgres từ chối cả câu lệnh. Đúng bẫy P5 đã gặp trên `proposals.status`, và cách sửa vẫn là viết cột tay chứ **không** nới GRANT.
- **Thêm cột vào `timeline_entries` về sau phải sửa danh sách GRANT trong `0007`.** Quên thì AI mất quyền ghi cột mới — hướng thất bại an toàn, và đó là lý do chọn hướng này.
- Đường lùi: `REVOKE INSERT` + `GRANT INSERT ON timeline_entries TO crm_system` mức bảng, 5 phút. Đã biết `REVOKE` có tác dụng khi quyền cấp theo cột (ADR-0015 bước 3), nên đường lùi này là số đo chứ không phải suy luận.

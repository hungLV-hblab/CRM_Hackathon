# ADR-0010 — Lớp chặn tầng CSDL cài bằng hai role Postgres + GRANT theo cột, không dùng trigger

| | |
| --- | --- |
| **Ngày** | 2026-08-12 19:10 |
| **Giai đoạn** | Design (hạ tầng, cài đặt cụ thể cho lớp CSDL của ADR-0004) |
| **Trạng thái** | Chấp nhận |
| **Người quyết định** | HungLV |
| **Prompt log** | phiên brainstorm base project 12/08 19:01 — [báo cáo](../../plans/reports/brainstorm-base-project-architecture-260812-1901-nextjs-nestjs-drizzle-monorepo-report.md) |

## Bối cảnh

[ADR-0004](0004-chan-ranh-gioi-o-tang-domain-va-tang-csdl.md) chốt **chặn hai lớp**: `actor` ở tầng service **cộng** ràng buộc ở tầng CSDL. Nhưng nó không nói lớp CSDL cài bằng gì — [ontology.md](../ontology.md) dòng 232 vẫn để hở: *"cơ chế ràng buộc lớp CSDL (trigger hay quyền cột)"*.

Phải quyết **trước khi viết `packages/db`**: cả hai cách đều đụng vào mọi migration và vào cách API mở kết nối. Sửa muộn = viết lại toàn bộ đường ghi.

Ràng buộc: còn ~48h; T-10 đòi chứng minh 3 thao tác bị từ chối **khi gọi ngoài giao diện**; vòng 2 BGK đòi *"chứng minh nó bị chặn thật"*, không nhận lời hứa.

## Phương án đã cân nhắc

Tiêu chí: *(1)* chặn được cả khi code gọi thẳng repository · *(2)* chi phí cài + chi phí debug · *(3)* trước BGK chứng minh mất bao lâu · *(4)* nguy cơ thủng âm thầm.

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| **A.** Hai role `crm_app` / `crm_system`; **chỉ GRANT đúng những cột được phép** cho `crm_system` | ~20 dòng SQL, không có code chạy lúc runtime nên không có gì để debug. Chứng minh trước BGK bằng 1 lệnh `psql`. Bảng mới **mặc định cấm** `crm_system` → hướng an toàn | API phải giữ 2 pool; mỗi migration thêm bảng phải GRANT tường minh cho `crm_system` | ✅ **Chọn** |
| **B.** Trigger PL/pgSQL đọc `current_setting('app.actor')`, kèm `SET LOCAL app.actor` mỗi transaction | Chặn theo *actor* chứ không theo *kết nối* → 1 pool là đủ | **Quên `SET LOCAL` một chỗ là thủng âm thầm** — không có lỗi, chỉ là ghi lọt. Đúng loại lỗi ADR-0004 muốn diệt. Thêm 4 function PL/pgSQL phải test riêng | ❌ Loại — biến lỗi kiểm được thành lỗi không kiểm được |
| **C.** Row Level Security | Chuẩn Postgres, chặn theo dòng | RLS chặn **dòng**, còn ranh giới của ta là **cột** (`stage`, `expected_value`) → sai công cụ. Còn phải bật policy từng bảng | ❌ Loại — không giải đúng bài |
| **D.** Chỉ chặn ở tầng domain | Rẻ nhất | ADR-0004 đã loại. Test gọi thẳng repository là vượt qua | ❌ Loại — đã quyết |

## Quyết định

Chọn **A**.

```sql
-- crm_owner : sở hữu schema, chỉ dùng để chạy migration. App KHÔNG BAO GIỜ kết nối bằng role này.
-- crm_app   : Sales/Admin thao tác qua giao diện.
-- crm_system : mọi đường ghi của AI (worker + nhánh AI trong API).

-- crm_app: full, và tự động có quyền trên bảng tạo sau này
GRANT ALL ON ALL TABLES IN SCHEMA public TO crm_app;
ALTER DEFAULT PRIVILEGES FOR ROLE crm_owner IN SCHEMA public GRANT ALL ON TABLES    TO crm_app;
ALTER DEFAULT PRIVILEGES FOR ROLE crm_owner IN SCHEMA public GRANT ALL ON SEQUENCES TO crm_app;

-- crm_system: KHÔNG đặt default privileges → bảng mới mặc định cấm, phải GRANT tay
GRANT SELECT ON opportunities TO crm_system;
GRANT UPDATE (next_step_text, next_step_due_date, next_step_source) ON opportunities TO crm_system;  -- vùng 3
GRANT SELECT, INSERT ON timeline_entries TO crm_system;                                              -- vùng 4
-- không GRANT DELETE ở bất kỳ bảng nào do người tạo
```

**Điểm mấu chốt: chỉ GRANT đúng cột được phép. Tuyệt đối không `GRANT UPDATE` toàn bảng rồi `REVOKE UPDATE (cột)`** — xem mục verify, cách đó **không chặn gì cả**.

API giữ hai pool: `db.asHuman` (crm_app) / `db.asSystem` (crm_system). Worker chỉ có `asSystem`.

## Hệ quả

- **`crm_app` và `crm_system` không được sở hữu bảng.** Chủ sở hữu bỏ qua toàn bộ quyền cột, kể cả khi `NOSUPERUSER` (đã đo). Migration chạy bằng `crm_owner`, app không bao giờ kết nối bằng role đó.
- Mỗi migration thêm bảng phải kèm `GRANT` tường minh cho `crm_system`. **Đây là tính năng, không phải phiền toái**: quên GRANT thì AI mất quyền (an toàn), không phải AI thừa quyền.
- `crm_app` có `ALTER DEFAULT PRIVILEGES` nên bảng mới tự có quyền → dev không bị chặn giữa chừng.
- **Cấm `drizzle-kit push`** trong `package.json` và `CLAUDE.md` mục 6 — push bỏ qua migration file, thổi bay GRANT.
- Hai chuỗi kết nối trong env: `DATABASE_URL_APP`, `DATABASE_URL_SYSTEM`, `DATABASE_URL_OWNER` (chỉ migration).
- Lớp domain của ADR-0004 (`actor` + `AuditEvent`) **giữ nguyên**. ADR này chỉ cài đặt lớp thứ hai; nó không thay thế lớp thứ nhất — lớp domain vẫn cần vì `AuditEvent` phải ghi *lý do bị từ chối*, còn Postgres chỉ trả lỗi trống.
- **Sẽ phải xem lại nếu:** xuất hiện ranh giới phụ thuộc *giá trị dòng* chứ không phải *cột* (ví dụ "chỉ cấm xoá dòng do người tạo, cho xoá dòng do máy tạo"). Lúc đó quyền cột không đủ, phải thêm RLS cho đúng bảng đó.

## AI đã tham gia thế nào

- **Vai trò AI:** sinh 4 phương án, phân tích trade-off, viết kịch bản thực nghiệm.
- **AI sai ở đâu — sai thật, và bị thực nghiệm bắt:** bản đề xuất đầu tiên của AI viết

  ```sql
  GRANT SELECT, UPDATE ON opportunities TO crm_system;
  REVOKE UPDATE (stage, expected_value) ON opportunities FROM crm_system;   -- ❌ VÔ TÁC DỤNG
  ```

  Đọc lên rất thuyết phục và gần đúng với trực giác "cấp rồi thu hồi bớt". Chạy thử thì `crm_system` **đổi `stage` thành `won` thành công**. Lý do: quyền `UPDATE` cấp ở mức bảng đã phủ mọi cột, `REVOKE` theo cột không đục thủng được nó. Nếu tin AI mà không chạy thử thì **T-10 sẽ đỏ vào đúng ngày thi**, và tệ hơn: đội tưởng mình đã chặn hai lớp trong khi chỉ còn một.
- **AI đề xuất gì mà đội không nghe:** AI ban đầu nghiêng về phương án B (trigger + `SET LOCAL app.actor`) vì "linh hoạt hơn, chặn theo actor chứ không theo kết nối". Bỏ vì tiêu chí (4): quên `SET LOCAL` không báo lỗi.

## Đội đã verify bằng cách nào

Chạy thật trên `postgres:16-alpine` trong container, 12/08. Không đọc tài liệu rồi suy — đo trực tiếp.

**Đo 1 — bác bỏ cách viết sai.** `GRANT UPDATE` toàn bảng + `REVOKE UPDATE (stage, expected_value)` → `UPDATE ... SET stage='won'` **chạy lọt**, `SELECT stage` trả `won`. Kết luận: cách này vô tác dụng.

**Đo 2 — xác nhận cách đúng.** Chỉ `GRANT UPDATE (next_step_text, next_step_due_date, next_step_source)`, 6 khẳng định, đúng cả 6:

| Thao tác của `crm_system` | Kỳ vọng | Kết quả thật |
| --- | --- | --- |
| `UPDATE opportunities SET stage='won'` | cấm | `ERROR: permission denied for table opportunities` |
| `UPDATE opportunities SET expected_value=1` | cấm | `ERROR: permission denied for table opportunities` |
| `DELETE FROM opportunities` | cấm | `ERROR: permission denied for table opportunities` |
| `DELETE FROM timeline_entries` | cấm | `ERROR: permission denied for table timeline_entries` |
| `UPDATE opportunities SET next_step_text='goi lai'` | **cho** | thành công |
| `INSERT INTO timeline_entries(...)` | **cho** | thành công |

Trạng thái cuối: `qualified | 100000 | goi lai`, 2 dòng timeline. Đúng cả chiều cấm lẫn chiều cho — kiểm cả hai chiều vì chỉ kiểm chiều cấm thì một GRANT quá tay vẫn xanh.

**Đo 3 — chủ sở hữu bỏ qua quyền cột.** Chuyển bảng cho `crm_owner` (đặt `NOSUPERUSER`), rồi `SET ROLE crm_owner; UPDATE ... SET stage='lost'` → **thành công**. Vì vậy hệ quả "app không được sở hữu bảng" là bắt buộc, không phải khuyến nghị.

**Đo 4 — bảng mới mặc định cấm.** Bảng tạo sau khi đã cấp quyền: `crm_system` đọc → `permission denied`; `crm_app` (đã đặt `ALTER DEFAULT PRIVILEGES`) đọc → OK. Đúng thế bất đối xứng mong muốn.

**Còn nợ:** dựng lại 4 phép đo này thành test integration trong `pnpm test` (nghiệm thu skeleton mục 5) — hiện mới chạy tay bằng `psql`.

## Rollback

Quay về phương án B (trigger): giữ nguyên schema, thêm 1 migration tạo 4 trigger + bọc mọi transaction bằng `SET LOCAL app.actor`. **~1h**, và không phải sửa tầng domain vì `actor` đã có sẵn ở đó theo ADR-0004. Dấu hiệu phải quay đầu: xuất hiện ranh giới cần biết *ai* thao tác chứ không chỉ *kết nối nào*.

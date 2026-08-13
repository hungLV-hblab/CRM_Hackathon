# ADR-0022 — "Bản chụp hiện tại" là cột `text` + CHECK trên `companies`, không phải enum của ontology

| | |
| --- | --- |
| **Ngày** | 2026-08-13 19:56 |
| **Giai đoạn** | Design (phase 4 — seed + bản chụp trước/sau + T-1) |
| **Trạng thái** | Chấp nhận |
| **Người quyết định** | HungLV |
| **Prompt log** | phiên brainstorm phase 4 ngày 13/08 19:36 — [báo cáo](../../plans/reports/from-brainstorm-to-planner-260813-1956-GH-3-phase-04-seed-ban-chup-va-t1-report.md) |

## Bối cảnh

`variant` (`before` | `after`) hiện là **tham số request**: `ingestSnapshotSchema.variant` đi trong body, `ObservationService.ingest(companyId, variant, ctx)` nhận nó, không có chỗ nào lưu "công ty X đang ở bản nào".

Với T-6 thế là đủ — người bấm "Đọc lại nguồn" thì gửi `variant: 'after'`.

Với **T-8 thì không**: *"3 công ty Đang theo dõi, đổi nguồn 2 công ty → trong 2 chu kỳ có 2 mục mới"*. Vòng quét **tự chạy**, nó không nhận tham số từ ai (`watch-cycle-service.ts` hiện chỉ `count()` công ty `isWatched`). Không có chỗ lưu variant thì vòng quét không biết đọc bản nào, và T-8 không đóng được như đề bài viết.

Nên `switch-snapshot.ts` mà phase 4 dự tính thực ra **không có gì để đổi** — phải tạo ra cái để nó đổi trước.

Câu hỏi thứ hai đến sau khi chốt "dùng một cột": cột đó có phải là **từ vựng của ontology** hay không.

## Phương án đã cân nhắc

### Chỗ lưu

Tiêu chí: *(1)* T-8 đóng được không · *(2)* I-14 (seed lại đưa mọi công ty về bản "trước") có tự đúng không · *(3)* GRANT phải thêm bao nhiêu · *(4)* rác treo khi xoá công ty.

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| **A.** Cột `companies.snapshot_variant` | Vòng quét đọc theo từng công ty, không JOIN. **I-14 tự đúng**: `seed()` TRUNCATE + insert lại ⇒ mọi công ty về `'before'`, không viết code dọn. `crm_app` đã có `GRANT ALL ON ALL TABLES` nên **0 GRANT mới**; `crm_system` chỉ có SELECT trên `companies` nên **AI không đổi được nguồn nó đọc** | Trạng thái giàn giáo demo nằm trong bảng nghiệp vụ; `SELECT *` trên `companies` mang thêm cột này, DTO phải chủ động không trả nó | ✅ **Chọn** |
| **B.** Bảng riêng `demo_snapshot_state` | Tên nói thẳng đây là giàn giáo; không bẩn `companies` | +1 bảng, +1 dòng GRANT cho `crm_system` (nó **không** có `ALTER DEFAULT PRIVILEGES`, quên là mất quyền đọc), +1 JOIN trong vòng quét | ❌ Loại — tiêu chí (3), lợi ích thuần thẩm mỹ |
| **C.** Một row `system_settings` giữ danh sách công ty đã đổi | Không migration | Dữ liệu **theo công ty** nhét vào bảng key-value, không FK về `companies` → xoá công ty để lại rác treo. Đọc phải parse chuỗi | ❌ Loại — tiêu chí (4) |
| **D.** Giữ nguyên tham số request, e2e gọi thẳng endpoint ingest cho 2 công ty | Rẻ nhất, 0 schema | Chu kỳ tự chạy vẫn không biết đọc bản nào ⇒ **T-8 phải viết lại thành "gọi ingest tay" và không còn chứng minh vòng quét tự thêm mục** | ❌ Loại — tiêu chí (1) |

### Kiểu dữ liệu

| Phương án | Kết luận |
| --- | --- |
| **`text` + `CHECK (snapshot_variant IN ('before','after'))`**, không vào `ENUMS` | ✅ **Chọn** |
| `pgEnum` + thêm dòng vào `docs/ontology.md` §3.5 + thêm vào `ENUMS` của contracts | ❌ Loại — xem dưới |

`ontology-enum-parity.test.ts` đọc bảng §3.5 của `ontology.md` **lúc chạy** và so với `ENUMS`. Nó assert `toHaveLength(12)` **và** có hẳn một ca *"has no enum in code that the ontology never declared"* — tức là thêm `snapshot_variant` vào `ENUMS` thì đỏ hai chỗ, và phải sửa `ontology.md` (file dùng chung) cộng đổi 12→13.

Nhưng chi phí đó không phải lý do chính. Lý do chính: **variant là giàn giáo demo, không phải từ vựng nghiệp vụ.** Ontology mô tả CRM mà Sales dùng; "đọc file HTML nào trong hai file đóng hộp" là thứ biến mất nguyên vẹn ngày có crawler thật. Đưa nó vào §3.5 là khai báo sai bản chất, và làm bảng enum của ontology lẫn giữa domain và scaffolding.

## Quyết định

```sql
-- 0004_snapshot_variant.sql
ALTER TABLE companies ADD COLUMN snapshot_variant text NOT NULL DEFAULT 'before';
ALTER TABLE companies ADD CONSTRAINT companies_snapshot_variant_check
  CHECK (snapshot_variant IN ('before', 'after'));
```

Không `pgEnum`. Không vào `ENUMS`. `SnapshotVariant` giữ nguyên chỗ nó đang ở (`apps/api/src/ai/demo-snapshots.ts`).

**Ai đọc cột: chỉ vòng quét.** `ObservationService.ingest()` giữ nguyên chữ ký, `ingestSnapshotSchema.variant` giữ nguyên trong body. Nghĩa là **0 dòng sửa ở `apps/api/src/ai/`, `domain/observation/`, `packages/contracts/`** — 15 test của phase 2 không phải chạm.

**Ai ghi cột:** `POST /demo/companies/:id/snapshot-variant` trong module mới `apps/api/src/demo/` (C sở hữu, nên **không** sửa `domain/company/` của B), cộng `packages/db/src/seed/switch-snapshot.ts` làm CLI diễn tay.

## Hệ quả

- **Hai nguồn nói "đọc bản nào", mỗi nguồn một người gọi.** Ingest tay đọc body; vòng quét đọc cột. Có mùi, và chấp nhận có ý thức: hợp nhất nghĩa là sửa contracts + service của A + test của A hai ngày trước freeze, đổi lấy sự gọn gàng chứ không đổi lấy hành vi nào rubric chấm. Nếu sau freeze còn thời gian thì hợp nhất theo hướng `variant` **tuỳ chọn** trong body, thiếu thì service đọc cột.
- **`crm_system` không sửa được cột này** (nó chỉ có `GRANT SELECT ON companies`) ⇒ **AI không tự đổi được nguồn nó đọc**. Tính chất này đáng một dòng test cùng họ T-10: một AI tự chuyển sang bản "sau" là một AI tự tạo tin để rồi kết luận từ tin đó.
- **I-14 không cần code dọn.** Cột có `DEFAULT 'before'` và `seed()` TRUNCATE rồi insert lại, nên seed lần hai đưa mọi công ty về bản "trước" mà không ai phải nhớ.
- DTO công ty phải **liệt kê cột trả về** thay vì `SELECT *`, nếu không cột giàn giáo lọt ra API công khai.
- **Sẽ phải xem lại nếu:** có crawler thật (cột này bị xoá, không migrate), hoặc cần nhiều hơn hai biến thể (lúc đó `CHECK` phải sửa và đó là lúc cân lại `pgEnum`).

## AI đã tham gia thế nào

- **Vai trò AI:** truy ra rằng `variant` là tham số request chứ không phải trạng thái lưu, và nối được từ đó sang "vòng quét không nhận tham số ⇒ T-8 hở". Phase-04 không thấy chỗ hở này.
- **AI sai ở đâu:** **AI đặt câu hỏi chọn phương án trước khi đọc `ontology-enum-parity.test.ts`.** Nên lúc đề xuất "cột `snapshot_variant`" nó chưa biết cái giá của việc làm nó thành `pgEnum` — thông tin đó chỉ đến sau khi quyết định đã chốt. May là quyết định con này không lật quyết định gốc, nhưng nếu parity test có ràng buộc chặt hơn thì đội đã chốt một phương án dưới thông tin thiếu. Đúng thứ tự phải là: đọc hết ràng buộc của mọi phương án **rồi** mới hỏi.
- **AI đề xuất gì mà đội không nghe:** không có ở quyết định này.

## Đội đã verify bằng cách nào

- `packages/db/migrations/0001_grants.sql:23` — `GRANT ALL ON ALL TABLES IN SCHEMA public TO crm_app`, và dòng 38 `GRANT SELECT ON companies TO crm_system`. Cả hai ở **mức bảng**, nên cột thêm sau được phủ tự động: `crm_app` UPDATE được, `crm_system` chỉ đọc. **Không** cần GRANT mới.
- `packages/contracts/src/__tests__/ontology-enum-parity.test.ts:83-107` — đọc nguyên văn ba assert (`toHaveLength(12)`, so codes theo thứ tự ontology, và ca chiều ngược "no enum in code that the ontology never declared"). Đây là cơ sở của quyết định con, không phải phỏng đoán.
- `apps/api/src/watch/watch-cycle-service.ts:106-120` — xác nhận `scan()` chỉ `count()` công ty `isWatched` và **không có đường nào nhận variant**, tức lỗ hổng T-8 là thật.
- Quét ảnh hưởng khi seed thêm dòng: chỉ `login.test.ts` dùng `SEED_USERS[0..1]`; e2e tham chiếu công ty **theo tên** (`reading-zone-provenance.spec.ts:22-25`), không theo số lượng; duy nhất `seed-idempotent.test.ts` hardcode số đếm 5/4.

~~**Chưa kiểm bằng cách chạy:** migration chưa viết, nên "cột mới được phủ bởi GRANT mức bảng" là suy luận từ ngữ nghĩa `GRANT` của Postgres, chưa phải số đo trên `crm_test`.~~

**Đã đo 13/08 20:11, nợ đã trả** — `packages/db/src/__tests__/column-grants-block-system-actor-on-snapshot-variant.test.ts`, 5 ca xanh trên `crm_test`:

| Phép đo | Kết quả |
| --- | --- |
| `crm_system` UPDATE `snapshot_variant` | `permission denied for table companies` |
| `crm_system` SELECT `snapshot_variant` | đọc được (vòng quét cần) |
| `crm_app` UPDATE `snapshot_variant` | thành công — **không GRANT mới nào được viết**, suy luận "GRANT mức bảng phủ cột thêm sau" đúng |
| Công ty mới, không ai gán | `'before'` (DEFAULT), nên I-14 tự đúng |
| Giá trị thứ ba (`'lastweek'`) | `companies_snapshot_variant_check` từ chối, kể cả từ `crm_app` |

**Phép đo đột biến (luật số 2 của plan):** `GRANT UPDATE (snapshot_variant) ON companies TO crm_system` trên `crm_test` → ca "bị từ chối" **đỏ ngay**, và ca đọc cũng đỏ vì AI đã ghi thật `'after'` vào cột. `REVOKE` → xanh lại, và `information_schema.column_privileges` xác nhận `crm_system` chỉ còn SELECT trên cả 13 cột. Test cắn thật, không xanh nhờ pool cấu hình sai.

## Rollback

Cột là dữ liệu demo, không có gì phụ thuộc ngoài vòng quét: `ALTER TABLE companies DROP COLUMN snapshot_variant`, vòng quét quay về đọc `'before'` cứng. Mất T-8, giữ mọi thứ khác.

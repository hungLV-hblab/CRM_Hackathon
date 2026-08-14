# Brainstorm — Lưu ứng viên nguồn vào DB + mở rộng panel "Nguồn đọc"

| | |
| --- | --- |
| **Ngày** | 2026-08-14 21:50 |
| **Người quyết định** | trungmd |
| **Trạng thái** | Đã chốt thiết kế, chờ plan |
| **Liên quan** | [ADR-0035](../../docs/decisions/0035-cho-phep-nguon-web-that-kem-dieu-kien-ban-chup-van-la-nguon-cua-bo-nghiem-thu.md) · [ADR-0036](../../docs/decisions/0036-llm-tim-nguon-code-doc-bytes-va-ung-vien-phai-qua-nguoi.md) (sẽ bị sửa hai dòng) · [ontology.md](../../docs/ontology.md) mục 3.6 |

## 1. Vấn đề

Hai chuyện, một màn hình (`apps/web/src/app/(app)/cong-ty/[id]/source-discovery-section.tsx`):

1. **Ứng viên do `web_search` tìm được biến mất** — khi reload (không lưu ở đâu) và khi bấm "Lưu nguồn đã chọn" (`setCandidates(null)` dòng 63). Mỗi lần tìm mất 10–20 giây và tốn tiền, nên mất là mất thật.
2. **Panel chật** — `SectionCard "Nguồn đọc"` nằm trong cột phải `24rem` (`page.tsx:97,131-135`), trong khi mỗi ứng viên cần 3–4 dòng (badge tier + url + reason + snippet).

Yêu cầu thêm: người dùng phải **select / unselect / xoá** — và đã chốt nghĩa là **cả hai**: tick ứng viên vào/ra danh sách đọc, **và** bật/tắt một nguồn đã lưu mà không xoá nó.

**Điều phải nói thẳng: đây không phải bug, đây là đảo một phần quyết định đã ghi ADR.** ADR-0036 mục (b) chọn "tìm → trả ứng viên → người tick → mới ghi", và Hệ quả ghi nguyên văn *"Đánh đổi đã nhận: refresh trang mất danh sách ứng viên"*. `company-source-candidates.test.ts` test 1 đếm `company_sources` = 0 sau `findCandidates` để chốt điều đó. Vậy thay đổi này **bắt buộc kèm ADR-0037**, không được lặng lẽ sửa.

## 2. Cái không được mất

`observation-service.ts:244-251` đọc danh sách URL bằng vai **`crm_system`** và **không lọc gì**:

```ts
const saved = await this.dbSystem
  .select({ url: companySources.url, sourceTier: companySources.sourceTier })
  .from(companySources)
  .where(eq(companySources.companyId, company.id))
```

Nghĩa là hôm nay **hàng tồn tại = đã được người duyệt**, và `0008_live_source.sql` biến điều đó thành quyền CSDL: `GRANT SELECT ON company_sources TO crm_system` — không INSERT (I-18).

Lưu ứng viên vào DB **không** vi phạm "AI không tự chọn nguồn nó rút phát hiện": cú bấm Tìm là người bấm, hàng ghi qua `crm_app`, có `found_by`. Nhưng nó **phá invariant "hàng tồn tại = đã duyệt"** nếu nhét chung bảng. Đó là toàn bộ nội dung của phần so sánh dưới.

## 3. Phương án đã cân nhắc

### (a) Lưu ứng viên ở đâu

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| **A. Bảng riêng `company_source_candidates`; "đã chọn" = có hàng `company_sources` cùng url** | `crm_system` **không được grant gì** → AI không đọc nổi danh sách ứng viên, khỏi phải tin vào WHERE nào. `observation-service` **không sửa một dòng**. 39 e2e + test 1 giữ nguyên nghĩa. Có luôn số đo offered-vs-kept trong DB (hiện chỉ `logger.log` ở `company-source-service.ts:95`) | 1 migration + 1 bảng + 3 route mới; "đã chọn" phải join theo url | ✅ **Chọn** |
| B. Một bảng, thêm cột `status ('candidate'\|'selected')` | Ít bảng hơn; `UNIQUE(company_id,url)` lo dedupe miễn phí; select/unselect là 1 UPDATE | `crm_system` có SELECT toàn bảng ⇒ quên `WHERE status='selected'` một chỗ là AI đọc trang chưa ai tick. Enforcement tụt từ **quyền CSDL** xuống **nhớ viết WHERE**. Cứu được bằng view + revoke, nhưng khi đó **đắt hơn A** và phải viết lại dòng verify của ADR-0036 | ❌ Loại |
| C. Không vào DB — `sessionStorage` / persist cache ở client | Sống qua reload và qua nút Lưu; 0 migration, 0 grant, 0 xung đột ADR; ~30 phút | Không thấy từ máy/người khác; "xoá ứng viên" chỉ là state cục bộ; không có số đo trong DB | ❌ Loại |

### (b) Ngữ nghĩa "select / unselect"

| Phương án | Kết luận |
| --- | --- |
| Tick ứng viên ↔ danh sách đọc, **và** công tắc bật/tắt trên nguồn đã lưu | ✅ **Chọn** — hai trạng thái khác nhau thật: "chưa bao giờ đưa vào" khác "đã đưa vào nhưng tạm ngưng đọc" |
| Chỉ tick ứng viên | ❌ Loại — muốn ngưng đọc một trang thì phải xoá, mất luôn snippet và lý do |
| Chỉ bật/tắt nguồn đã lưu | ❌ Loại — không giải quyết chuyện ứng viên biến mất |

### (c) Bấm "Tìm nguồn công khai" lần nữa

| Phương án | Kết luận |
| --- | --- |
| **Thay thế** ứng viên cũ của công ty (DELETE rồi INSERT, cùng transaction) | ✅ **Chọn** — ngữ nghĩa rõ: "đây là kết quả lần tìm gần nhất"; danh sách có trần tự nhiên; không có ứng viên cũ nằm lại gây nhiễu. Nguồn **đã lưu** không bị ảnh hưởng vì nằm bảng khác |
| Cộng dồn, dedupe theo url | ❌ Loại — phình dần, cần trần cứng + cách dọn, và ứng viên đã bị bỏ qua ba lần vẫn ngồi đó |

### (d) Chặn "AI đọc nguồn đã tắt" (cột `enabled`)

Cột `enabled` tạo lại đúng cái lỗ đã loại phương án (b) ở mục a: `crm_system` có SELECT toàn bảng `company_sources`.

| Phương án | Kết luận |
| --- | --- |
| **`REVOKE SELECT ON company_sources FROM crm_system` + `CREATE VIEW company_sources_enabled` (WHERE enabled) + `GRANT SELECT` trên view** | ✅ **Chọn** — quên filter thì **permission denied ồn ào**, không phải đọc lén thành công. Nâng I-18 thành "AI không thấy nổi nguồn người ta đã tắt". Giá: ~12 dòng migration, `pgView(...).existing()`, 1 query đổi, sửa 3 assertion test 14–16 |
| `WHERE enabled` + test có răng | ❌ Loại — rẻ hơn ~20 phút, nhưng guarantee nằm ở code chứ không ở quyền CSDL, và cả feature này được xây trên nguyên tắc ngược lại |

### (e) Layout panel

| Phương án | Kết luận |
| --- | --- |
| **Section full-width, đặt sau thẻ đóng của grid 2 cột** | ✅ **Chọn** — panel được toàn chiều rộng, ứng viên xếp `lg:grid-cols-2`, DOM order vẫn "đọc được gì → đọc từ đâu" |
| Dialog toàn màn khi tìm nguồn (`dialog.tsx` có sẵn) | ❌ Loại vòng này — tick trong modal thì không thấy song song danh sách đã lưu để so |
| `Sheet` trượt từ phải | ❌ Loại vòng này — ở giữa hai cái trên, không hơn cái nào ở việc gì cụ thể |

## 4. Thiết kế đã chốt

### 4.1. Dữ liệu — migration `0010`

```sql
CREATE TABLE company_source_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  url text NOT NULL,
  source_tier text NOT NULL DEFAULT 'company_website'
    CHECK (source_tier IN ('company_website','news','social')),
  reason text NOT NULL,        -- vì sao url này nói về công ty này
  snippet text,                -- đoạn trích từ kết quả tìm
  found_at timestamptz NOT NULL DEFAULT now(),
  found_by uuid REFERENCES users(id),
  CONSTRAINT company_source_candidates_company_id_url_unique UNIQUE (company_id, url)
);
CREATE INDEX company_source_candidates_company_id_idx ON company_source_candidates (company_id);
-- KHÔNG có GRANT nào cho crm_system. 0001_grants.sql không cho nó ALTER DEFAULT
-- PRIVILEGES, nên bảng mới tự động bị cấm — đây là chỗ mặc định đúng và ta giữ nó.

ALTER TABLE company_sources ADD COLUMN enabled boolean NOT NULL DEFAULT true;

REVOKE SELECT ON company_sources FROM crm_system;
CREATE VIEW company_sources_enabled AS
  SELECT id, company_id, url, source_tier, discovered_via, search_snippet, added_by, created_at
  FROM company_sources WHERE enabled;
GRANT SELECT ON company_sources_enabled TO crm_system;
```

**Không thêm cột "đã chọn" ở đâu cả.** "Ứng viên này đã vào danh sách đọc chưa" = có hàng `company_sources` cùng `(company_id, url)`. Một nguồn sự thật cho câu "đọc trang nào", không có hai cờ phải đồng bộ.

### 4.2. API

| Route | Đổi gì |
| --- | --- |
| `POST :id/source-candidates` | **Đổi nghĩa:** search → DELETE ứng viên cũ → INSERT bộ mới → trả về, một transaction. Vẫn **không** chạm `company_sources` |
| `GET :id/source-candidates` | **Mới.** Ứng viên đã lưu + `savedSourceId: string \| null`. Sống qua reload |
| `DELETE :id/source-candidates/:candidateId` | **Mới** |
| `PATCH :id/sources/:sourceId` | **Mới.** `{ enabled: boolean }` |
| `POST :id/sources` · `DELETE :id/sources/:id` · `GET :id/sources` | Không đổi; DTO thêm `enabled` |

Cả bốn route ghi có cửa `actor.kind === 'system'` → `ForbiddenException` + `audit.recordRefusal`, giống hai route hiện có. Lý do cấm AI ghi **ứng viên** dù vẫn phải qua người tick: một danh sách ứng viên do máy tự nhồi là một cú đẩy, và vùng cấm phải chặn được cả khi lệnh không đến từ giao diện.

`audit_events.action` là `text` tự do (`audit-events.ts:19`) → **không cần migration cho action mới**.

Seed company: `findCandidates` vẫn `throw` I-16 ⇒ bảng ứng viên vĩnh viễn trống cho 5 công ty seed. `GET candidates` trả `[]`, **không** throw — không tìm được khác với không được phép tìm.

`observation-service.ts:248-251` đọc `companySourcesEnabled` (view) thay cho bảng.

### 4.3. UI

`page.tsx`: kéo `SectionCard "Nguồn đọc"` ra khỏi cột phải `24rem`, đặt **sau** thẻ đóng của grid → full-width; thứ tự đọc giữ nguyên "đọc được gì → đọc từ đâu".

Trong section, `lg:grid-cols-2`:

- **Trái — Nguồn đang dùng để đọc:** badge tier · url · snippet · công tắc Bật/Tắt · nút Bỏ. Hàng đang tắt render mờ **kèm chữ** "Đang tạm tắt — không đọc trang này" (màu không bao giờ là vật mang duy nhất, design-guidelines §7).
- **Phải — Ứng viên do máy tìm:** khối `machine-*`; ứng viên đã lưu hiện badge "Đã trong danh sách đọc" + hành động bỏ tick.

**Một chỗ bắt buộc sửa chữ, không phải thẩm mỹ:** badge hiện nói `"Ứng viên do máy tìm — chưa lưu gì"` (dòng 193). Ứng viên vào DB rồi thì câu đó **thành một dòng sai** (luật 4) → `"Máy đã tìm được — chưa đưa vào danh sách đọc"`.

Bỏ `setCandidates(null)` trong `onSuccess` của `save` → danh sách không biến mất sau khi lưu. State ứng viên chuyển từ `useState` sang `useQuery(['company-source-candidates', companyId])`.

## 5. Việc dễ quên (đã soi ra, không phải suy đoán)

- **`ALL_TABLES`** (`packages/db/src/schema/all-tables.ts`) phải thêm bảng mới. Thiếu → I-14 reseed để lại rác + test rò hàng giữa các file (đúng cảnh báo trong header file đó).
- **`ontology.md`** sửa 5 dòng: 117 (bảng thực thể) · 122 (`"KHÔNG ghi gì"` hết đúng) · 127 (`"cái giá đã nhận: refresh mất danh sách"` hết đúng) · 129 (thứ tự đọc phải kể `enabled`) · 226 (I-18 mạnh lên). File này đang `⏳ chờ duyệt lại` → thêm một mốc nữa.
- **ADR-0037** thay hai dòng của ADR-0036: dòng đánh đổi, và dòng verify `"Ứng viên không được persist"` → `"Ứng viên persist ở bảng AI không đọc được; danh sách đọc vẫn 0 hàng sau khi tìm"`.

## 6. Test phải có

| Khẳng định | Test |
| --- | --- |
| AI không đọc/ghi nổi bảng ứng viên | Mở rộng `live-source-columns-and-grants.test.ts`: SELECT/INSERT/UPDATE/DELETE bằng vai `DATABASE_URL_TEST_SYSTEM` → permission denied cả 4 |
| AI không thấy nguồn đã tắt | Cùng file: `crm_system` SELECT trên bảng `company_sources` → denied; SELECT trên view → chỉ ra hàng `enabled` |
| Tìm không chạm danh sách đọc | Sửa nghĩa test 1 của `company-source-candidates.test.ts`: sau `findCandidates`, `company_source_candidates` có N hàng và `company_sources` = **0** |
| Tìm lần hai thay danh sách, nguồn đã lưu sống sót | Mới: 3 ứng viên → tick 1 → tìm lại ra 2 → ứng viên = 2, `company_sources` vẫn giữ hàng đã tick |
| `enabled=false` bị loại khỏi đường đọc | Mới trong `observation`: tắt 1 trong 2 nguồn → `liveSourceUrls` trả 1 |
| System actor bị chặn ở cả 4 route ghi | Mới, họ T-10 |
| e2e không vỡ vì đổi layout | Chạy lại các spec chạm panel nguồn |

## 7. Rủi ro

- **Freeze tối nay (hiện 21:50 14/08).** Sequencing: DB + API trước, UI sau. Phần **full-width** là UI-thuần, ~5 phút, rủi ro bằng 0 — làm được ngay cả khi phần DB phải cắt.
- **Nếu phải cắt scope:** giữ (a) bảng ứng viên + `GET`/`DELETE`, bỏ (d) view+revoke và cột `enabled` sang vòng sau. Ngược lại thì vô nghĩa — `enabled` không giải quyết chuyện ứng viên biến mất.
- **Đổi nghĩa route `POST :id/source-candidates`** từ "không ghi gì" thành "ghi ứng viên": ai đọc ADR-0036 rồi đọc code sẽ thấy vênh cho tới khi ADR-0037 lên. Viết ADR **trước** khi commit code, không phải sau.

## 8. Câu chưa trả lời

1. **Trần số ứng viên lưu mỗi công ty** — `MAX_SOURCES_PER_COMPANY = 5` là trần danh sách đọc. Ứng viên cần trần riêng (đề xuất 12) hay tin vào trần của provider `web_search`? Cần đọc `anthropic-source-discovery.ts` xem nó đã cắt chưa.
2. **Ứng viên đã bị xoá tay có nên quay lại ở lần tìm sau không?** Phương án "thay thế" hiện tại sẽ cho nó quay lại. Chấp nhận, hay cần bảng "đã loại"? (nghiêng về chấp nhận — YAGNI, và người dùng bỏ qua nó lần nữa mất 1 giây).
3. **`found_by` khi vòng quét tự chạy** — vòng quét có bao giờ gọi `findCandidates` không? Hiện không, nhưng nếu sau này có thì `found_by` NULL và cột đó mất nghĩa "ai bấm".

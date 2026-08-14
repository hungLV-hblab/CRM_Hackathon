# ADR-0037 — Ứng viên nguồn lưu ở một bảng AI không đọc được; tắt một nguồn là chuyện của quyền CSDL

| | |
| --- | --- |
| **Ngày** | 2026-08-14 22:20 |
| **Giai đoạn** | Development |
| **Trạng thái** | Chấp nhận |
| **Người quyết định** | trungmd |
| **Prompt log** | [ai-sessions/260814-2150-brainstorm-luu-ung-vien-nguon](../ai-sessions/260814-2150-brainstorm-luu-ung-vien-nguon.md) |
| **Sửa hai dòng của** | [ADR-0036](0036-llm-tim-nguon-code-doc-bytes-va-ung-vien-phai-qua-nguoi.md) |

## Bối cảnh

[ADR-0036](0036-llm-tim-nguon-code-doc-bytes-va-ung-vien-phai-qua-nguoi.md) mục (b) chốt hai bước: tìm → **trả về** ứng viên → người tick → mới ghi. Hệ quả ghi thẳng cái giá: *"refresh trang mất danh sách ứng viên. Thao tác mất 10–20 giây, và đổi lại là giữ được nguyên tắc."*

Dùng thật mới thấy cái giá đó đắt hơn lúc ước lượng, và đắt ở hai chỗ khác nhau: reload mất danh sách, **và** bấm Lưu cũng mất (`setCandidates(null)`), nên người ta không so được cái vừa lưu với cái còn lại. Mỗi lượt tìm là 10–20 giây cộng một lượt `web_search` có phí.

**Phải nói thẳng: đây là đảo một phần quyết định đã ghi ADR, không phải sửa bug.** `company-source-candidates.test.ts` test 1 đếm `company_sources = 0` sau `findCandidates` chính là để chốt điều đó. Vậy nên có file này.

Yêu cầu thứ hai đi kèm: người dùng muốn **tạm ngưng đọc** một trang mà không xoá nó — giữ lại snippet và lý do đã chọn.

## Cái không được mất

Hôm nay `observation-service.ts` đọc danh sách URL bằng vai `crm_system` và **không lọc gì**. Nghĩa là **hàng tồn tại trong `company_sources` = đã được người duyệt**, và `0008_live_source.sql` biến câu đó thành quyền CSDL (I-18).

Cả hai thứ thêm vào lần này đều có thể phá invariant đó, và mỗi thứ bị chặn bằng một cơ chế khác nhau — đó là toàn bộ nội dung mục dưới.

## Phương án đã cân nhắc

### (a) Lưu ứng viên ở đâu

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| **A. Bảng riêng `company_source_candidates`; "đã chọn" = có hàng `company_sources` cùng url** | `crm_system` **không được grant gì** ⇒ AI không đọc nổi danh sách ứng viên, khỏi phải tin vào một `WHERE` nào. `observation-service` không sửa một dòng. Có luôn số đo offered-vs-kept trong CSDL (trước chỉ `logger.log`) | 1 migration + 1 bảng + 3 route; "đã chọn" phải join theo url | ✅ **Chọn** |
| B. Một bảng, thêm cột `status ('candidate' \| 'selected')` | Ít bảng hơn; `UNIQUE (company_id, url)` lo dedupe miễn phí; select/unselect là một `UPDATE` | `crm_system` có SELECT toàn bảng ⇒ quên `WHERE status='selected'` một chỗ là AI đọc trang **chưa ai tick**. Enforcement tụt từ *quyền CSDL* xuống *nhớ viết WHERE*. Cứu được bằng view + revoke, nhưng khi đó đắt hơn A | ❌ Loại |
| C. Không vào CSDL — `sessionStorage` ở client | Sống qua reload; 0 migration, 0 grant, 0 xung đột ADR; ~30 phút | Máy khác/người khác không thấy; "xoá ứng viên" chỉ là state cục bộ; không có số đo trong CSDL | ❌ Loại |

### (b) Ngữ nghĩa "select / unselect"

| Phương án | Kết luận |
| --- | --- |
| Tick ứng viên ↔ danh sách đọc, **và** công tắc bật/tắt trên nguồn đã lưu | ✅ **Chọn** — hai trạng thái khác nhau thật: "chưa bao giờ đưa vào" khác "đã đưa vào nhưng tạm ngưng đọc" |
| Chỉ tick ứng viên | ❌ Loại — muốn ngưng đọc một trang thì phải xoá, mất luôn snippet và lý do đã chọn |
| Chỉ bật/tắt nguồn đã lưu | ❌ Loại — không giải quyết chuyện ứng viên biến mất, tức là không giải quyết yêu cầu gốc |

### (c) Bấm "Tìm nguồn công khai" lần nữa

| Phương án | Kết luận |
| --- | --- |
| **Thay thế** ứng viên cũ của công ty (`DELETE` rồi `INSERT`, một transaction) | ✅ **Chọn** — nghĩa rõ: "đây là kết quả lần tìm gần nhất". Danh sách có trần tự nhiên. Nguồn **đã lưu** không bị ảnh hưởng vì nằm bảng khác |
| Cộng dồn, dedupe theo url | ❌ Loại — phình dần, cần trần cứng + cách dọn, và ứng viên đã bị bỏ qua ba lần vẫn ngồi đó |

Kéo theo, đã nhận: một ứng viên bị xoá tay sẽ **quay lại** ở lần tìm sau. Không làm bảng "đã loại" (YAGNI) — bỏ qua nó lần nữa mất một giây, còn một bảng nữa thì phải dọn mãi.

### (d) Chặn "AI đọc nguồn vừa bị tắt"

Cột `enabled` tạo lại **đúng cái lỗ** đã loại phương án B ở mục (a): `crm_system` có SELECT toàn bảng. Bắt được điều này **trước khi viết dòng code nào**, nhờ so với bảng ở mục (a) chứ không nhờ review sau.

| Phương án | Kết luận |
| --- | --- |
| **`REVOKE SELECT ON company_sources FROM crm_system` + `CREATE VIEW company_sources_enabled` + `GRANT SELECT` trên view** | ✅ **Chọn** — quên filter thì `permission denied` **ồn ào**, không phải đọc lén thành công. Không còn filter nào ở tầng code để mà quên. Giá: ~12 dòng migration, một query đổi, viết lại một test đang xanh |
| `WHERE enabled` ở tầng code + test có răng | ❌ Loại — rẻ hơn ~20 phút, nhưng guarantee nằm ở code chứ không ở quyền CSDL, mà cả tính năng này được xây trên nguyên tắc ngược lại |

### (e) Layout panel "Nguồn đọc"

| Phương án | Kết luận |
| --- | --- |
| **Section full-width, đặt sau thẻ đóng của grid 2 cột** | ✅ **Chọn** — panel được toàn chiều rộng, thứ tự DOM vẫn "đọc được gì → đọc từ đâu", Vùng đọc không di chuyển |
| Dialog toàn màn khi tìm nguồn | ❌ Loại vòng này — tick trong modal thì không thấy song song danh sách đã lưu để so |
| `Sheet` trượt từ phải | ❌ Loại vòng này — ở giữa hai cái trên, không hơn cái nào ở việc gì cụ thể |

### (f) Nút "Lưu N nguồn đã chọn" — *quyết định phát sinh lúc thi công*

Bản plan đề xuất **bỏ** nút Lưu theo lô: khi trạng thái tick đã ở server (`savedSourceId`) thì tick chính là lưu, và `picked` hết lý do tồn tại. Lúc thi công mới thấy điều plan chưa biết: nhánh này đã có tính năng **đọc ngay sau khi lưu**, và một lần đọc là một lượt fetch cộng một lượt gọi LLM **cho mỗi URL đã lưu**.

| Phương án | Kết luận |
| --- | --- |
| A. Giữ nút Lưu theo lô (`picked` ở lại) | ✅ **Chọn** — một lượt Lưu = một lần đọc. Ứng viên vẫn persist qua reload, tức là yêu cầu gốc vẫn đạt |
| B. Bỏ nút, tick là lưu ngay | ❌ Loại — tick 4 ứng viên thành **4 lần đọc** trả tiền riêng. Cứu được bằng cách hạ "đọc ngay" thành nút bấm tay, nhưng đó là đổi một affordance ngoài phạm vi vòng này để đổi lấy một model state gọn hơn |

## Quyết định

**Ứng viên được lưu, ở một bảng `crm_system` không có một quyền nào; và "nguồn nào đang được đọc" được trả lời bằng một view mà quyền CSDL bắt phải đi qua.**

Tiêu chí so **vẫn là tiêu chí của ADR-0036**, không đổi giữa đường: cách nào giữ được cửa I-2, và giữ được "AI không tự chọn nguồn nó rút phát hiện".

Câu phân biệt, và đây là chỗ dễ đọc nhầm nhất: ADR-0036 mục (b) loại phương án "tìm xong tự lưu vào **danh sách đọc**", và **ADR-0037 không đảo điều đó**. Danh sách **đọc** vẫn chỉ có người ghi được. Ứng viên là danh sách **đề xuất** — một bảng khác, một nghĩa khác, và AI không đọc nổi bảng đó.

## Hệ quả

- **Kéo theo:** bảng `company_source_candidates` với **không một dòng GRANT nào**. Đây là lần đầu trong repo mà *dòng không có* trong migration là guarantee: `crm_system` không có `ALTER DEFAULT PRIVILEGES` (`0001_grants.sql:13`) nên bảng mới tự động bị cấm.
- **Kéo theo:** I-18 mạnh lên. Từ *"`crm_system` có SELECT và không có INSERT/UPDATE/DELETE trên `company_sources`"* thành *"`crm_system` **không đọc được** `company_sources`; nó chỉ đọc được `company_sources_enabled`, và trên bảng ứng viên nó không có quyền nào."*
- **Kéo theo:** `POST :id/source-candidates` đổi nghĩa từ "không ghi gì" thành "ghi ứng viên, không chạm danh sách đọc". Ba route mới: `GET`/`DELETE` ứng viên và `PATCH :id/sources/:sourceId`. Cả bốn route ghi đều có cửa `actor.kind === 'system'`.
- **Đánh đổi đã nhận:** "ứng viên này đã vào danh sách đọc chưa" là một **join theo url**, không phải một cột. Đổi lại: một nguồn sự thật cho câu "đọc trang nào", không có hai cờ phải đồng bộ.
- **Đánh đổi đã nhận:** ứng viên bị xoá tay quay lại ở lần tìm sau (mục c).
- **Đánh đổi đã nhận:** một test đang xanh bị **đảo có chủ ý** (test 15 — "crm_system đọc được danh sách"). Viết lại thành hai khẳng định, không xoá.
- **Sẽ phải xem lại nếu:** vòng quét gọi `findCandidates` (khi đó `found_by` NULL và cột đó mất nghĩa "ai bấm"); hoặc danh sách ứng viên cần chia sẻ giữa nhiều người với ý kiến khác nhau về cùng một URL (khi đó bảng cần thêm chiều người, không chỉ thêm cột).

## AI đã tham gia thế nào

- **Vai trò AI:** sinh phương án, phản biện thiết kế, và thi công.
- **AI khuyến nghị, người quyết định đồng ý — hai chỗ:**
  1. **Bảng riêng thay vì cột `status`**, lập luận bằng *"hàng tồn tại = đã duyệt" là invariant mạnh hơn một cột, vì nó không phụ thuộc vào việc mọi reader đều nhớ viết `WHERE`*.
  2. **View + REVOKE thay vì `WHERE enabled`**, dù đắt hơn ~20 phút. Người quyết định chọn view.
- **AI cảnh báo trước, không phải sau:** cột `enabled` tái tạo đúng cái lỗ đã dùng để loại phương án B ở mục (a). Bắt được ở bàn thiết kế, không phải ở code review — vì hai mục nằm cạnh nhau trong cùng một bảng so sánh.
- **AI đề xuất sai một chỗ, thi công mới lộ:** bản plan đề xuất bỏ nút Lưu theo lô, không biết rằng nhánh đang có tính năng đọc-ngay-sau-khi-lưu, nên bỏ nút sẽ biến 4 cú tick thành 4 lượt gọi LLM (mục f). Người quyết định giữ nút.
- **AI đề xuất một con số thừa:** plan đề nghị `MAX_CANDIDATES_PER_COMPANY = 12`. Đọc code mới thấy `anthropic-source-discovery.ts` đã cắt ở **6** kèm lý do viết sẵn (*"một người phải đọc và tick từng hàng"*). Lấy đúng số đã có thay vì thêm số thứ hai để hai chỗ lệch nhau về sau.

## Đội đã verify bằng cách nào

**Không phải "đọc thấy hợp lý".** Từng dòng dưới đây là một lần chạy.

| Khẳng định | Verify bằng |
| --- | --- |
| AI không đọc nổi bảng ứng viên | `live-source-columns-and-grants.test.ts` test 20 — `SELECT` bằng vai `DATABASE_URL_TEST_SYSTEM` → `permission denied` |
| AI không ghi nổi bảng ứng viên | Cùng file test 21 — INSERT, UPDATE, DELETE, cả ba đều `permission denied` |
| Ứng viên không có lý do thì không lưu được | Cùng file test 23 — `INSERT` thiếu `reason` bị CSDL từ chối |
| AI không thấy nguồn người ta đã tắt | Cùng file test 15 (bản viết lại) + 24 — bảng `permission denied`, view chỉ ra hàng đang bật |
| AI không ghi được vào view | Cùng file test 25 |
| Tìm nguồn ghi ứng viên, **không** chạm danh sách đọc | `company-source-candidates.test.ts` test 1 (bản viết lại) — ứng viên = N, `company_sources` = **0** |
| Tìm lại thay danh sách, nguồn đã lưu sống sót | Cùng file test 10, 11 |
| Nguồn đã tắt không được đọc | `disabled-source-not-read.test.ts` — tắt 1 trong 2 → đọc đúng nguồn đang bật; tắt cả 2 → rơi về `companies.website` |
| Cửa `system` đóng ở cả bốn route ghi | Cùng file test 13, 14 |
| Ứng viên sống qua reload | e2e `source-candidates-survive-reload.spec.ts` bước 3 |
| **Test có răng** | Xem mục dưới — từng lần đảo, và **đúng bao nhiêu test đỏ** |

### Đảo code để chứng minh test có răng

| Đảo gì | Kỳ vọng | Kết quả thật |
| --- | --- | --- |
| Thêm tay `GRANT SELECT ON company_source_candidates TO crm_system` | test 20 đỏ | ✅ **đúng 1 test đỏ** (20), 22 test còn lại xanh. Đã `REVOKE` lại và xác nhận 23/23 xanh |
| Sửa view thành `WHERE true` | test 24 đỏ | ✅ **đúng 1 test đỏ** (24), 24 test còn lại xanh. Đã khôi phục `WHERE enabled` và xác nhận 25/25 xanh |
| `.from(companySourcesEnabled)` → `.from(companySources)` | test đường đọc đỏ **bằng `permission denied`** | ✅ cả 3 test của `disabled-source-not-read.test.ts` đỏ, và đỏ đúng bằng `permission denied for table company_sources` — **không** phải bằng assertion sai. Đã khôi phục |
| Bỏ dòng `DELETE` trong transaction thay ứng viên | test 10 đỏ | *(cập nhật sau khi chạy phase 3)* |
| Bỏ một cửa gác `system` | test 13 hoặc 14 đỏ | *(cập nhật sau khi chạy phase 3)* |

## Rollback

Ba mức, từ rẻ tới đắt:

1. **Không dùng:** không bấm "Tìm nguồn công khai" thì bảng ứng viên rỗng và không có gì đổi so với trước. Công tắc `enabled` mặc định `true`, nên mọi nguồn đang có giữ nguyên hành vi.
2. **Gỡ phần công tắc, giữ phần ứng viên:** một migration `DROP VIEW company_sources_enabled` + `GRANT SELECT ON company_sources TO crm_system` + đổi lại một query. ~10 phút. Cột `enabled` để lại cũng vô hại vì không ai đọc.
3. **Gỡ hẳn:** `git revert` các commit của plan này + một migration `DROP TABLE company_source_candidates`. ~15 phút. Migration `0010`/`0011` chỉ **cộng thêm** (một bảng mới, một cột có default, một view) nên không có dữ liệu nào của `company_sources` mất khi lùi — trừ chính danh sách ứng viên, thứ tạo lại được bằng một lượt tìm.

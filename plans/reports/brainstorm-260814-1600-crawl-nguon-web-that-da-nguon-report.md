# Brainstorm — Crawl dữ liệu công ty từ nguồn web công khai, đa nguồn có phân cấp

| | |
| --- | --- |
| **Ngày** | 2026-08-14 16:00 |
| **Phiên** | `/brainstorm` — "phân tích để phát triển tính năng crawl data dữ liệu công ty khách hàng từ các nguồn public trên internet và implement vào hệ thống" |
| **Người quyết định** | trungmd |
| **Chế độ** | markdown (không `--html`, không `--wiki`) |
| **Tiền đề đã chốt trước phiên** | [ADR-0035](../../docs/decisions/0035-cho-phep-nguon-web-that-kem-dieu-kien-ban-chup-van-la-nguon-cua-bo-nghiem-thu.md) · [prompt log 260814-1124](../../docs/ai-sessions/260814-1124-req-crawl-web-that.md) |
| **Trạng thái** | Thiết kế đã được chấp nhận — **chưa có dòng code nào** |

---

## 1. Bối cảnh: việc này không bắt đầu từ số 0

Sáng 14/08 đã có một vòng `/hack:req-challenge` (4 persona) và [ADR-0035](../../docs/decisions/0035-cho-phep-nguon-web-that-kem-dieu-kien-ban-chup-van-la-nguon-cua-bo-nghiem-thu.md) chốt: nguồn web thật **được phép bổ sung**, kèm ba điều kiện, **công tắc chưa bật**. `docs/ontology.md` mục 3.6 + I-15/I-16/I-17 đã khai đầy đủ. Phiên này **không mở lại** câu hỏi "có được crawl không" — nó chỉ trả lời "crawl thế nào".

Ba điều kiện là cửa gác, và ontology mục 6 tự khai: *"I-15, I-16, I-17 chưa có test… công tắc không được bật trước khi cả ba xanh."*

---

## 2. Đảo ngược vấn đề (problem-first, rút gọn)

**Yêu cầu ban đầu là một giải pháp, không phải một vấn đề.** Nén lại thì có **hai** vấn đề khác nhau đứng sau, đòi hai mức đầu tư khác nhau:

| | Vấn đề | Mức bằng chứng |
| --- | --- | --- |
| **A** | Ontology mục 3.6 + I-15/16/17 hiện chỉ là văn bản. CLAUDE.md mục 8 gạch đúng điều này: *"❌ Ontology viết trong file md nhưng code không đọc → trang trí"* | **Mạnh** — chính ontology tự thừa nhận còn nợ test |
| **B** | Công ty ngoài seed là ngõ cụt: `SNAPSHOTS` chỉ có 5 công ty, `snapshots.read()` trả `null` cho mọi công ty Sales tự thêm → vùng đọc vĩnh viễn "không đọc được" | **Trung bình** — có `e2e/login-and-create-company.spec.ts`, chưa có ai báo đau |

**Giải A không cần mạng. Giải B mới cần crawler.** Trộn hai cái vào một là chỗ dễ vỡ nhất.

**Giả định bị thách thức và kết quả:**

| Giả định | Rủi ro nếu sai | Kết luận |
| --- | --- | --- |
| "Crawl thật thêm điểm nghiệm thu" | Đầu tư 5h cho 0 điểm | **Sai.** Giám khảo chạy T-1…T-10 trên bộ seed; I-16 chặn nguồn thật khỏi seed. Giá trị nằm ở vòng 2 (giải thích được) và vòng 3 (demo), không nằm ở 10 điểm |
| "LLM có thể truy xuất URL liên quan" | Bịa URL → dòng dữ liệu sai không nguồn | **Sai trừ khi có công cụ tìm kiếm thật.** Xem mục 4 |
| "Đa nguồn chỉ là chạy vòng lặp nhiều lần" | I-3 vô hiệu, mỗi lần đọc sinh N hàng rác | **Sai.** Xem mục 5.2 |
| "Nguồn thật giữ nguyên trần tự chủ vùng 4" | Trang bị deface/quảng cáo tự vào dòng thời gian | **Sai** — đã chốt ở I-15 sáng nay |

**Ba cách đóng khung khác đã cân nhắc rồi loại:**
- *Khung "chất lượng phát hiện"* → giải bằng prompt tốt hơn, không cần crawl. Loại: không trả lời được câu "sản phẩm có đọc dữ liệu công khai thật không".
- *Khung "kịch bản demo"* → giải bằng thêm bản chụp. Loại: đúng phương án D của ADR-0035, đã bị loại.
- *Khung "ontology là hợp đồng có test"* → **đây là khung được chọn** (vấn đề A), và nó kéo theo B như một hệ quả tự nhiên.

---

## 3. Yêu cầu chính xác (5 hạng mục bắt buộc)

**Sản phẩm đầu ra.** (1) Migration thêm `observations.source_kind` + `observations.fetch_error_reason`, thêm cột công tắc trên `companies`, bảng `company_sources`. (2) `SourceDiscovery` port (LLM + `web_search`) và `LiveCrawlSource` port (fetch của mình). (3) I-15/I-16/I-17 enforce ở tầng service kèm test. (4) Hai hành động trên giao diện công ty: **Tìm nguồn công khai** và **Đọc lại nguồn**. (5) Nhãn phân biệt loại nguồn + cấp nguồn + lý do đọc hỏng trong vùng đọc.

**Tiêu chí nghiệm thu.**
- Bật nguồn thật cho công ty seed → **bị từ chối** + có `AuditEvent` (I-16).
- Bật nguồn thật cho công ty ngoài seed đang `is_watched = true`, đọc xong → **0 `TimelineEntry`, 0 `AutoNextStepEvent`, có `Proposal` loại `timeline_entry`** (I-15, cả hai vế).
- `OBSERVATION_SOURCE` để trống / gõ sai → rơi về `demo_snapshot`, **không** báo lỗi rồi dừng; `ai_enabled=false` dừng cả nguồn thật (I-17).
- T-1…T-10 chạy nguyên vẹn, `source_kind` của mọi bản lưu trong bộ seed = `demo_snapshot`, crawler và `web_search` **được gọi 0 lần**.
- Đọc cùng một URL hai lần, nội dung không đổi → 1 bản lưu, 0 lượt gọi LLM (I-3 theo `source_url`).
- Đọc URL bị chặn bot → `fetch_status='failed'` + `fetch_error_reason` đúng loại, **không** có `Claim` nào.
- URL trỏ private IP → từ chối trước khi phát request, `fetch_error_reason='blocked_url'`.
- Toàn bộ test chạy **không cần internet**.

**Ngoài phạm vi vòng này.** Vòng quét tự crawl (giữ bản chụp) · robots.txt + rate-limit theo host (chỉ cần khi vòng quét crawl) · JS rendering / headless browser · chống anti-bot · phân trang · ma trận quyền chi tiết ai được bật công tắc (theo [ADR-0033](../../docs/decisions/0033-vong-1-admin-co-quyen-crm-nhu-sales-ma-tran-quyen-chi-tiet-ngoai-pham-vi.md)).

**Ràng buộc không thương lượng.** Bộ nghiệm thu chỉ đọc bản chụp · trần tự chủ nguồn thật dừng ở vùng 2 · mặc định tắt · không sửa `ClaimExtractor` · không thêm `db:push` · code/comment tiếng Anh, chuỗi hiển thị tiếng Việt · tên file tiếng Anh không dấu.

**Điểm chạm.** `apps/api/src/ai/` (2 file mới + provider) · `apps/api/src/domain/observation/observation-service.ts` (I-3, phân giải nguồn) · `apps/api/src/domain/claim/claim-reaction-service.ts` (truyền `sourceKind`) · `apps/api/src/domain/proposal/proposal-service.ts` (lật chiều I-5) · `apps/api/src/watch/system-timeline-entry-service.ts` (chặn I-15) · `apps/api/src/domain/opportunity/auto-next-step-service.ts` (chặn I-15) · `apps/api/src/domain/company/company.controller.ts` (công tắc) · `packages/db/src/schema/{observations,companies}.ts` + bảng mới + migration · `packages/contracts/src/enums.ts` · `apps/web/src/components/provenance/reading-zone.tsx`.

---

## 4. Quyết định kiến trúc quan trọng nhất: LLM tìm nguồn, code đọc bytes

### 4.1. Vì sao không để LLM tự "nghĩ ra" URL

LLM không có công cụ tìm kiếm thì nó **bịa** URL: `https://sakura-mfg.co.jp/news` trông đúng, phần lớn 404. Một dòng dữ liệu sai, không nguồn → vi phạm luật 1 và luật 4. **Loại tuyệt đối.**

### 4.2. Công cụ được chọn: `web_search` server tool của Anthropic

Khai `{"type": "web_search_20260209", "name": "web_search"}` trong `tools`. Anthropic chạy tìm kiếm phía họ, trả **URL thật từ chỉ mục tìm kiếm** kèm tiêu đề + đoạn trích.

| | |
| --- | --- |
| Model | Chạy trên `claude-sonnet-5` — đúng `DEFAULT_MODEL` ở `anthropic-claim-extractor.ts:33` |
| Khoá | **Dùng lại `ANTHROPIC_API_KEY`.** Không vendor mới, không key mới |
| Giá | **$10 / 1000 lượt tìm** — không đáng kể ở quy mô demo |
| Điều khiển | `max_uses` · `allowed_domains` / `blocked_domains` · `user_location` |
| Cơ sở pháp lý theo Specs | mục 3: *"gọi ra dịch vụ bên ngoài thì thoải mái, kể cả mô hình ngôn ngữ"* |
| Bẫy phải xử lý | Vòng lặp server dừng ở 10 vòng → `stop_reason: "pause_turn"`, phải nối tiếp lời gọi (không thêm message "Continue"). Lỗi server tool trả **HTTP 200** kèm object lỗi, **không** throw |

Phương án bị loại: **search API riêng** (Brave/Tavily/SerpAPI) — thêm khoá, thêm vendor, thêm code, 0 lợi ích ở đây.

### 4.3. Ranh giới: **không** dùng `web_fetch` để lấy nội dung công ty

Anthropic cũng có `web_fetch` tự tải trang. **Không dùng nó cho nội dung công ty.** [ADR-0012](../../docs/decisions/0012-ban-luu-giu-html-goc-va-text-trich-offset-tinh-tren-text.md): `content_hash` và `quote_start`/`quote_end` tính trên `raw_content` **của chính mình**. Để model tải và tóm tắt trang thì mình không còn nắm byte gốc → cửa I-2 (câu trích là chuỗi con nguyên văn) mất chỗ đứng, provenance sụp.

Phân vai dứt khoát — đúng câu đã có trong `anthropic-claim-extractor.ts:18` (*"where the Specs ask for understanding context, the LLM decides; where they ask for a guarantee, code decides"*):

| Tầng | Ai làm | Ra cái gì | Chạm dữ liệu chính thức? |
| --- | --- | --- | --- |
| **1 · Tìm nguồn** | LLM + `web_search` | Danh sách URL ứng viên + `source_tier` + lý do. **Không rút phát hiện** | Không — và không tự lưu (mục 4.4) |
| **2 · Đọc bytes** | `LiveCrawlSource` — code của mình | 1 `Observation` / 1 URL, `raw_content` qua `normalizeSnapshotText`, mình sở hữu từng byte | Vùng 1 |
| **3 · Rút phát hiện** | `ClaimExtractor` đang có — **không sửa một dòng** | `Claim` + câu trích, qua đúng cửa I-1/I-2 hiện tại | Vùng 1 |

### 4.4. Tại sao URL ứng viên phải qua một cú bấm của người

Cột `companies.snapshot_variant` có một comment đắt giá: *"`crm_system` holds SELECT on this table and no UPDATE, **so the AI cannot switch the source it then draws conclusions from** — measured, not assumed."*

Đó là một nguyên tắc đã được lập luận và enforce: **AI không được tự chọn nguồn nó sẽ đọc.** Mà "tìm nguồn rồi tự lưu vào danh sách đọc" đúng là AI tự chọn nguồn — một đường ghi mới, ngoài hai ngoại lệ Specs mở → **vi phạm mục 4 CLAUDE.md**.

**Cách giải:** `web_search` trả ứng viên trong **response HTTP, không persist**. Người tick chọn → POST → mới ghi vào `company_sources` **dưới `crm_app`, actor là người**. Kết quả:
- `crm_system` chỉ có `GRANT SELECT ON company_sources` → **không có đường INSERT nào**. "AI không tự chọn nguồn" thành ràng buộc CSDL, không phải lời dặn.
- Khớp đúng luật 3: *máy chuẩn bị sẵn, người quyết định ghi.*
- Đổi lại: refresh trang mất danh sách ứng viên. Chấp nhận — thao tác 20–40 giây, và làm ADR dễ bảo vệ hơn nhiều.

---

## 5. Bốn phát hiện từ code, ảnh hưởng trực tiếp tới thiết kế

### 5.1. `source_tier` đã được dựng sẵn cho đúng việc này — không cần cột mới
`packages/db/src/schema/observations.ts:35-38` — `text`, mặc định `'company_website'`, kèm comment: *"A second tier (news, LinkedIn) is a new value, not an ALTER TYPE."* Đa nguồn chỉ là **thêm giá trị**: `company_website · news · social`. 0 migration cho phần cấp nguồn.

### 5.2. I-3 vỡ khi có nhiều URL — và cách sửa rất sạch
`observation-service.ts:238` so `content_hash` với **bản lưu mới nhất của công ty**, không phân biệt URL. Crawl 5 URL thì hash của URL A bị đem so với bản lưu của URL B → **mỗi lần đọc sinh đủ 5 hàng, I-3 vô hiệu, và mỗi hàng kéo theo một lượt gọi LLM**.

Sửa: so theo **`(company_id, source_url)`**. Bản chụp mỗi công ty đúng 1 URL nên **tương thích ngược hoàn toàn** — mở rộng, không phải đổi hành vi. Vẫn cần một dòng ADR vì I-3 là bất biến có test.

### 5.3. GRANT: hai chỗ được miễn, một chỗ phải thêm bằng tay
Đã đối chiếu `0001_grants.sql` và `0003_grants_ai_tables.sql`:

| Thay đổi | Có phải sửa GRANT? | Vì sao |
| --- | --- | --- |
| `observations.source_kind`, `fetch_error_reason` | **Không** | `GRANT SELECT, INSERT ON observations` là **table-level** → cột mới tự có. Bẫy ADR-0015 (grant theo cột) không cắn ở đây |
| `companies.<công tắc nguồn thật>` | **Không** | `crm_system` chỉ có `GRANT SELECT ON companies`, **không có UPDATE nào** → AI **không thể** tự bật công tắc nguồn của mình. Cùng đúng cơ chế đã bảo vệ `snapshot_variant`. `crm_app` có `GRANT ALL` → người bật được |
| Bảng mới `company_sources` | **Có — một dòng** | `crm_system` cố ý **không** có `ALTER DEFAULT PRIVILEGES` → bảng mới bị cấm cho AI tới khi grant tay. Cần đúng `GRANT SELECT ON company_sources TO crm_system` — **không INSERT** (mục 4.4). `crm_app` tự có qua `ALTER DEFAULT PRIVILEGES` |

### 5.4. SSRF giờ *quan trọng hơn*, và cửa gác phải tách được để test
URL không còn do người gõ mà do **kết quả tìm kiếm** đưa vào — chuỗi mình không kiểm soát, đem cho server đi fetch. Không chặn thì `http://169.254.169.254/` hay `http://localhost:5403` đọc được nội bộ.

Vướng: test tích hợp cần fetch `127.0.0.1`, mà chính cửa gác chặn loopback. **Tách thành hai thứ:**
- `assertPublicUrl(url)` — hàm thuần, test bằng bảng IP (private/loopback/link-local/scheme lạ).
- `fetchPage(url)` — test với http server cục bộ, không đi qua cửa gác.
- Ghép hai cái ở `LiveCrawlSource`, theo cờ env.

Không tách là test phải gọi internet thật, và test gọi internet thật là test hỏng.

---

## 6. Các phương án đã cân nhắc

### 6.1. Phạm vi tổng thể

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| **PA-1** Chỉ cửa gác có test, `LiveCrawlSource` là port rỗng | Xoá cáo buộc "ontology trang trí"; 0 rủi ro mạng; ~2h | Demo vẫn không đọc thật; câu chuyện không đổi | ❌ Loại — nhưng **giữ nguyên làm chặng 1** |
| **PA-2** Lát dọc, một nguồn từ `companies.website`, chỉ bấm tay | Demo đọc thật chạy được; I-16 rẻ; ~3.5h | Không có phần "LLM tìm nhiều nguồn" mà người quyết định yêu cầu | ❌ Loại — **giữ nguyên làm chặng 2** |
| **PA-2+** PA-2 cộng `web_search` khám phá đa nguồn có phân cấp | Đúng yêu cầu; `source_tier` có nội dung thật; câu chuyện demo mạnh nhất | ~5–6h, có thể vượt freeze; chặng nhiều ẩn số nhất | ✅ **Chọn** |
| **PA-3** Thêm cả vòng quét tự crawl + robots.txt + rate-limit | Tính năng hoàn chỉnh | **Chạm đường code của T-8** vào đêm freeze để đổi lấy 0 điểm nghiệm thu | ❌ Loại cho đêm nay, không loại vĩnh viễn |

### 6.2. Chặn công ty seed (I-16)

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| Cấu trúc: có bản chụp thì đọc bản chụp | Rẻ nhất, chặn chắc nhất, không cần cột mới | **Lệch chữ I-16** — không có hành động "bật" để mà từ chối, nên không có `AuditEvent`; phải sửa lại câu I-16 trong ontology | ❌ Loại |
| **Công tắc per-company + từ chối + `AuditEvent`** | Khớp **đúng chữ** ADR-0035 và ontology, không phải sửa văn bản nào; có vết từ chối để trả lời vòng 2; `crm_system` không có UPDATE trên `companies` nên AI không bật được — miễn phí | Đắt hơn ~45 phút: cột + endpoint + UI + test từ chối | ✅ **Chọn** |
| Cả hai lớp | Chắc nhất khi bị hỏi | ~1h, và đang tranh thời gian với chặng 3 | ❌ Loại — chọn lại nếu chặng 3 xong sớm |

### 6.3. Kích hoạt `web_search`

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| **Tách hành động "Tìm nguồn", lưu danh sách URL** | Tìm một lần đọc nhiều lần → rẻ hơn, nhanh hơn; vòng quét sau này có sẵn thứ để đọc; Sales **thấy được** máy đang đọc trang nào; và là chỗ đặt cú bấm của người ở mục 4.4 | Thêm bảng `company_sources` + một endpoint | ✅ **Chọn** |
| Mỗi lần đọc là tìm lại | Không thêm schema, ít code | Mỗi cú bấm đốt một lượt tìm; 20–40s chờ; tập URL đổi giữa hai lần đọc → **mất tính lặp lại**; và không có chỗ tự nhiên cho cú bấm của người | ❌ Loại |

### 6.4. Tên miền mạng xã hội

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| Chặn bằng `blocked_domains` | Không đốt lượt tìm cho thứ biết trước là hỏng; demo không có dòng đỏ | Bỏ mất bằng chứng sống cho bảng phân loại lỗi | ❌ Loại |
| **Cho vào, để hỏng một cách trung thực** | Chính là **bằng chứng sống** cho câu chất vấn của Sales Manager trong prompt log: phân biệt *"không đọc được vì lỗi"* với *"nguồn thật sự im ắng"*. Đúng tinh thần luật 4 | Demo có dòng đỏ; đốt lượt tìm cho URL biết trước không fetch được | ✅ **Chọn** |

**Kéo theo (bắt buộc):** LinkedIn/Facebook/X sẽ hỏng gần 100%. Giao diện phải làm cho "đọc hỏng" đọc lên thành **thông tin**, không phải **sản phẩm lỗi**: hiện lý do bằng tiếng Việt cho Sales ("LinkedIn chặn máy đọc tự động"), **không** phơi mã HTTP thô. Đây là địa hạt của [design-guidelines](../../docs/design-guidelines.md) mục 7 + luật 2.

---

## 7. Giải pháp chốt

### 7.1. Lược đồ CSDL

```
observations
  + source_kind        text NOT NULL DEFAULT 'demo_snapshot'
                       CHECK (source_kind IN ('demo_snapshot','live_crawl'))
  + fetch_error_reason text  CHECK (fetch_error_reason IS NULL OR fetch_status = 'failed')
    -- source_tier: KHÔNG đổi schema, chỉ thêm giá trị 'news' | 'social'

companies
  + <công tắc nguồn thật>  boolean NOT NULL DEFAULT false

company_sources  (bảng mới)
  id · company_id → companies · url · source_tier · added_by → users
  discovered_via  text  -- 'web_search' | 'manual'
  search_snippet  text  -- đoạn trích lúc tìm, để người biết vì sao chọn
  created_at
  UNIQUE (company_id, url)
```

`fetch_error_reason` là **danh sách đóng**, không phải chuỗi tự do: `timeout · http_4xx · http_5xx · redirect_loop · js_required · not_html · too_large · blocked_url · invalid_url`. `js_required` (normalize xong ra text rỗng) là giá trị đắt nhất — nó chính là thứ phân biệt hai ca mà Sales Manager đã chất vấn.

`source_kind` vào **bảng 3.5 của ontology + `enums.ts` cùng lúc với migration**, không sớm hơn (`ontology-enum-parity.test.ts:83` assert đúng số dòng đọc từ bảng 3.5 — khai trước là test đỏ).

### 7.2. Luồng

```
[Tìm nguồn công khai]  → LLM + web_search (max_uses giới hạn)
                       → ≤6 URL ứng viên + cấp nguồn + đoạn trích   (KHÔNG persist)
                       → người tick chọn (≤5)
                       → POST → company_sources ghi dưới crm_app, actor = người

[Đọc lại nguồn]        → phân giải nguồn (mục 7.3)
                       → với mỗi URL đã lưu:
                            assertPublicUrl → fetchPage → normalizeSnapshotText
                            → so hash theo (company_id, source_url)   [I-3]
                            → Observation(source_kind='live_crawl', source_tier, fetch_error_reason?)
                            → ClaimExtractor (không sửa)
                            → ClaimReactionService, mang theo sourceKind             [I-15]
```

### 7.3. Phân giải nguồn (I-17 — nhánh an toàn là nhánh mặc định)

Theo đúng mẫu `useFactory` của [ADR-0014](../../docs/decisions/0014-nhom-2-rut-phat-hien-bang-llm-that-code-kiem-cau-trich.md), và **log ra lúc boot** để "đang chạy nguồn nào" trả lời được từ log:

```
ai_enabled = false                      → dừng, không sinh gì            [I-17]
OBSERVATION_SOURCE ≠ 'live_crawl'       → demo_snapshot                  [I-17]
công ty ∈ SEED_COMPANIES                → demo_snapshot                  [I-16]
công ty chưa bật công tắc               → demo_snapshot
còn lại                                 → live_crawl
```

Bật công tắc cho công ty seed → **từ chối + `AuditEvent`** (`actor='human'`, `action='rejected_live_source_for_seed_company'`, `entity='companies'`). Nhận dạng seed bằng `SEED_COMPANIES`, **đã kiểm: dùng được ngay** — `packages/db/src/index.ts` có `export * from './seed'` và `seed/index.ts:26` có `export * from './seed-data'`. Không cần thêm dòng export nào.

### 7.4. I-15 — hai vế, ba chỗ chạm

`ClaimReactionService.react()` nhận thêm `sourceKind` rồi truyền xuống. Với `live_crawl`:

| Chỗ | Với `live_crawl` | Bất biến |
| --- | --- | --- |
| `AutoNextStepService.react` | **không chạy** | I-15 vế 1 |
| `SystemTimelineEntryService.react` | **trả 0**, kể cả `is_watched = true` | I-15 vế 1 |
| `ProposalService.buildTimelineEntry` | cửa `isWatched` **gạt sang chiều gợi ý** — vẫn sinh `timeline_entry` | I-15 vế 2 |

Vế 2 là vế **dễ quên nhất và chết người nhất**: quên nó thì I-15 chặn mục **và** I-5 chặn gợi ý ⇒ phát hiện không có đường nào ra, rồi I-3 làm nó vĩnh viễn — đúng cái hố [ADR-0028](../../docs/decisions/0028-quyen-ghi-muc-dong-thoi-gian-den-tu-nhan-dang-theo-doi-khong-tu-trigger-context.md) mô tả. Hai bộ lọc gương ở `proposal-service.ts:245` và `system-timeline-entry-service.ts:62` **cố ý trùng lặp** — giữ nguyên cách đó, đừng gộp thành helper chung.

### 7.5. Định lượng đã chốt (không hỏi thêm)

- `web_search` trả **≤6 ứng viên**; danh sách đọc **≤5 URL** / công ty.
- Timeout fetch **8s** / URL; cắt nội dung ở **~512KB**; không retry, không backoff.
- Một lần đọc = 1 lượt tìm (nếu tìm) + N fetch + N lượt LLM ⇒ **~20–40s** với N=3. Cần phản hồi tiến trình trên giao diện, không được để nút im lặng.

---

## 8. Kế hoạch ba chặng

Người quyết định chọn **làm cả 3, không cắt**. Thứ tự dưới đây vẫn giữ nguyên tắc "cắt ở đâu cũng còn sản phẩm chạy" — không phải để cắt, mà để **mỗi chặng commit được và test xanh trước khi sang chặng sau**.

| Chặng | Nội dung | Ước lượng | Điểm dừng sạch |
| --- | --- | --- | --- |
| **1 · Cửa gác** | Migration 2 cột + cột công tắc + bảng `company_sources` + 1 dòng GRANT · `source_kind` vào `enums.ts` + bảng 3.5 · I-3 theo `(company_id, source_url)` · enforce I-15 (hai vế, ba chỗ) + I-16 + I-17 · 6 test | ~2h | Ontology hết là trang trí. 0 rủi ro mạng, migration chỉ cộng thêm |
| **2 · Đọc một nguồn thật** | `assertPublicUrl` (hàm thuần) + `fetchPage` + `LiveCrawlSource` + phân loại lỗi · provider theo env + log lúc boot · nhãn loại nguồn / cấp nguồn / lý do hỏng trong vùng đọc | ~1.5h | **Demo đọc thật chạy được**: thêm công ty thật, bật công tắc, dán URL, bấm đọc, ra phát hiện có câu trích |
| **3 · Tìm nhiều nguồn** | `SourceDiscovery` port: LLM + `web_search` (xử lý `pause_turn` + lỗi HTTP-200) · adapter fixture cho test · UI chọn ứng viên → `company_sources` | ~1.5–2h | Đa nguồn ba cấp, mạng xã hội hỏng một cách trung thực |

**Tổng ~5–6h.** Đã 16:00. Nói thẳng một lần rồi không nhắc lại: **việc này rất có thể vượt mốc freeze tối nay**, và người quyết định đã chọn vượt. Rủi ro lớn nhất không phải là code không xong mà là **chặng 3 xong nửa vời** — vì thế chặng 1 và 2 phải commit riêng, test xanh riêng.

---

## 9. Rủi ro và cách giảm

| Rủi ro | Mức | Giảm bằng |
| --- | --- | --- |
| Chặng 3 dở dang lúc hết giờ | **Cao** | Commit riêng từng chặng. Chặng 2 là điểm dừng sạch: `OBSERVATION_SOURCE=snapshot` là quay về trạng thái hôm nay |
| Test đi gọi internet thật | **Cao** | Adapter fixture cho `SourceDiscovery` (mẫu ADR-0014) · `fetchPage` test với http server cục bộ · `assertPublicUrl` test bằng bảng IP |
| Vỡ T-1…T-10 | Trung bình | I-16 chặn ở tầng service **và** công tắc mặc định `false` **và** `OBSERVATION_SOURCE` mặc định `snapshot` — ba lớp. Test assert crawler + `web_search` gọi 0 lần trên bộ seed |
| `FixtureClaimExtractor` ra 0 phát hiện trên trang thật | Trung bình | Nói trước, không che: nguồn thật chỉ có nghĩa khi có `ANTHROPIC_API_KEY`. Không key → suy giảm **trung thực** (0 phát hiện), không phải sai |
| Demo có dòng đỏ từ mạng xã hội | Trung bình | Đây là **lựa chọn**, không phải lỗi. Giao diện phải nói lý do bằng tiếng Việt để nó đọc lên thành thông tin |
| Nội dung độc hại / trang bị deface vào sản phẩm | Trung bình | Đúng chỗ I-15 gánh: nguồn thật **chỉ** vào hàng đợi duyệt, người xem trước khi nó chạm dữ liệu chính thức |
| SSRF | Trung bình | `assertPublicUrl` trước mọi request; chỉ `http`/`https`; từ chối private/loopback/link-local; `blocked_url` là một giá trị lỗi hạng nhất |
| Đọc chậm 20–40s, người dùng tưởng treo | Thấp | Phản hồi tiến trình; `pause_turn` xử lý đúng |
| Diễn giải Specs mục 3 chưa có BTC xác nhận | Thấp (đã khai) | Rollback đã ghi ở ADR-0035; công tắc mặc định tắt nên rủi ro hiện tại ~0 |

---

## 10. Đo được cái gì

- **Số bản lưu theo `source_kind`** — trả lời "sản phẩm có đọc thật không" bằng số, không bằng lời.
- **Tỉ lệ đọc hỏng theo `fetch_error_reason`** — và đây là chỗ *có ích* thật: nó cho biết cấp nguồn nào đáng đọc, cấp nào chỉ đốt thời gian.
- **Tỉ lệ ứng viên `web_search` được người chọn** — đo trực tiếp chất lượng tầng tìm nguồn. Thấp = LLM tìm dở, và biết được ngay.
- **auto-accept rate / error-detection rate của `Proposal` sinh từ `live_crawl`, tách riêng với `demo_snapshot`** (luật 6). Đây là số trả lời câu hỏi thật: nguồn không ai kiểm có tệ hơn nguồn BTC kiểm không, và tệ bao nhiêu.

---

## 11. Việc kế tiếp

1. **ADR mới** ghi bốn quyết định của phiên này: (a) `web_search` cho tìm nguồn, code tự fetch bytes — kèm lý do ADR-0012; (b) URL ứng viên phải qua cú bấm của người, `crm_system` không có INSERT trên `company_sources`; (c) I-3 so hash theo `(company_id, source_url)`; (d) mạng xã hội cho vào để hỏng trung thực. Kèm phương án bị loại ở mục 6.
2. **Lưu prompt log** phiên này vào `docs/ai-sessions/`.
3. **Cập nhật `docs/ontology.md`**: `source_kind` vào bảng 3.5, giá trị mới của `source_tier`, `company_sources` vào mục 3, tick hai ô checklist mục 10 khi test xanh. File về trạng thái **chờ duyệt lại**.
4. `/ck:plan` từ báo cáo này, ba chặng thành ba phase.
5. Sau khi xong: một người ngoài người viết đọc lại và giải thích được (DoD).

---

## Phụ lục — AI đã tham gia thế nào

- **AI làm gì:** scout repo (ADR-0035, prompt log, ontology 3.6/I-15…I-17, `demo-snapshots.ts`, `observation-service.ts`, `proposal-service.ts`, `system-timeline-entry-service.ts`, `observations.ts`, `companies.ts`, `0001_grants.sql`, `0003_grants_ai_tables.sql`); tra tài liệu Claude API cho `web_search`/`web_fetch` (khả dụng, giá, bẫy `pause_turn`); dựng 4 phương án phạm vi + 3 phương án cho từng quyết định phụ; phát hiện 4 điểm ở mục 5.
- **AI phản đối gì:** khuyến nghị **chặn** tên miền mạng xã hội bằng `blocked_domains`. Người quyết định chọn **cho vào để hỏng trung thực** — và lập luận đó mạnh hơn: nó biến một nhược điểm thành bằng chứng sống cho bảng phân loại lỗi mà chính phiên phản biện sáng nay đòi. AI đã tối ưu cho "demo trông đẹp"; người quyết định tối ưu cho "trả lời được vòng 2".
- **AI cũng khuyến nghị** chặn seed bằng quy tắc cấu trúc (rẻ hơn); người quyết định chọn đúng chữ I-16 (công tắc + từ chối + `AuditEvent`) để không phải sửa văn bản ADR-0035 vừa chốt. Hợp lý — sửa một ADR mới ráo mực đắt hơn 45 phút code.
- **Đã verify bằng cách đọc mã, không suy diễn:** `0001_grants.sql:23,29,38` (crm_app `GRANT ALL` + `ALTER DEFAULT PRIVILEGES`; crm_system chỉ `SELECT ON companies`, không UPDATE) · `0003_grants_ai_tables.sql` (`GRANT SELECT, INSERT ON observations` là table-level ⇒ cột mới miễn grant) · `seed/index.ts:26` + `db/index.ts` (`SEED_COMPANIES` dùng được ngay) · `observations.ts:35-38` (comment dự tính sẵn cấp nguồn mới) · `companies.ts:39` (comment "AI cannot switch the source it then draws conclusions from").
- **Chưa verify được, nói thẳng:** `web_search` chưa gọi thật lần nào từ repo này — giá, `pause_turn` và hình dạng khối kết quả lấy từ tài liệu, không từ một lượt chạy · toàn bộ ước lượng thời gian ở mục 8 là phỏng đoán, chưa có chặng nào chạy · chưa biết chất lượng URL `web_search` trả về cho công ty B2B Nhật/ASEAN quy mô nhỏ, và đó là ẩn số lớn nhất của chặng 3.

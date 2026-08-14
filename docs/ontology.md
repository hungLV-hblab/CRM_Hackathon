# Ontology — AI Native CRM

> Sinh 12/08/2026 từ [template](./ontology-template.md), dựa trên [Specs BTC](./hackathon-spec-ai-native-crm.md) và [phiên phản biện 260812-1742](./ai-sessions/260812-1742-req-phan-bien-de-bai-ai-native-crm.md).
> **AI sinh nháp — người review và duyệt.** Trạng thái duyệt: ✅ HungLV đọc lại và chấp nhận 13/08/2026 · ⏳ bản sửa 14/08/2026 (nguồn web thật có điều kiện — mục 1, 2, 3.6, 5, 6, 9, 10) **chờ duyệt lại**; ⏳ bản sửa 14/08/2026 tối (đã thi công: `company_sources`, I-18, ADR-0036 — mục 3.6, 6, 9, 10) **chờ duyệt lại**; ⏳ bản sửa 14/08/2026 khuya (ứng viên nguồn persist + công tắc bật/tắt nguồn, I-18 mạnh lên, ADR-0037 — mục 3.6, 6) **chờ duyệt lại**. Sửa file này thì phải duyệt lại.
> Nền lý thuyết: [ai-native-design-principles.md](./ai-native-design-principles.md).
>
> **File này là nguồn sự thật về ĐẶT TÊN và RÀNG BUỘC.** Code không khớp file này là code sai, không phải file sai.
> Test nghiệm thu của chính file này: mọi quan hệ ở mục 4 đọc lên thành một câu tiếng Việt có nghĩa.

## 1. Domain này là gì

Một CRM bán hàng B2B cho **một đội Sales ITO** của HBLAB, cộng một lớp AI đọc **bản chụp web tĩnh** của công ty khách hàng — và, **có điều kiện**, nguồn web thật (mục 3.6) — để giữ hồ sơ khỏi cũ. Sản phẩm là **một** hệ thống: tắt sạch lớp AI thì phần CRM vẫn làm được trọn vẹn công việc bán hàng.

**Không thuộc module này** (Specs mục 2 nói rõ, đừng tự thêm): soạn message tiếp cận · phân vai buyer persona · nỗi đau ba tầng · ICP scoring thành tính năng riêng · bất kỳ kênh nào chạm tới người thật · chatbot.

**Có điều kiện, không mặc định:** đọc **nguồn web thật**. Được phép **bổ sung**, không được **thay** bản chụp, và chỉ khi đủ ba điều kiện ở mục 3.6 ([ADR-0035](decisions/0035-cho-phep-nguon-web-that-kem-dieu-kien-ban-chup-van-la-nguon-cua-bo-nghiem-thu.md)). Mặc định tắt. Đây **không** phải giấy phép nới trần tự chủ: nguồn thật đi kèm trần **thấp hơn** bản chụp, không cao hơn.

Người dùng: `Sales` (một tài khoản, sở hữu mọi công ty — không làm phân quyền theo người sở hữu) và `Admin` (xem đo lường chất lượng, chỉnh tham số, tắt AI).

## 2. Đối tượng cố định — không sửa

| Đối tượng | Từ trong Specs | Thuộc tính tối thiểu ở module này |
| --- | --- | --- |
| `Observation` | bản lưu | `id`, `company_id`, `source_url`, `source_tier`, `captured_at`, `raw_html`, `raw_content`, `extractor_version`, `content_hash`, `fetch_status`, `source_kind`, `fetch_error_reason`. Bản chụp là HTML: `raw_html` giữ nguyên bản, `raw_content` là text trích ra đã chuẩn hoá — **offset câu trích và `content_hash` tính trên `raw_content`** ([ADR-0012](decisions/0012-ban-luu-giu-html-goc-va-text-trich-offset-tinh-tren-text.md)). `source_kind` (`demo_snapshot` · `live_crawl`) là cột **trần tự chủ đọc từ đó** (I-15); `fetch_error_reason` chỉ có giá trị khi `fetch_status = failed`, và `CHECK` ghim cả cặp đó. Cả hai đã có trong schema từ [`0008_live_source.sql`](../packages/db/migrations/0008_live_source.sql) |
| `Claim` | phát hiện | `id`, `company_id`, `observation_id`, `statement`, `signal_type`, `confidence`, `quote_text`, `quote_start`, `quote_end`, `trigger_context` |
| `Proposal` | gợi ý | `id`, `company_id`, `claim_id`, `proposal_type`, `target_field`, `opportunity_id`, `current_value`, `proposed_value`, `impact_if_wrong`, `status` |
| `Provenance` | câu trích + vị trí | **Không phải bảng riêng — là ràng buộc.** Mọi `Claim` phải trỏ về `Observation` kèm `quote_start`/`quote_end`; mọi `Proposal` phải trỏ về `Claim`. Xem I-1, I-2 |

## 3. Đối tượng domain

Giao diện dùng từ tiếng Việt cột "Specs"; code/CSDL/API dùng tên cột "Tên trong code". **Không tự đặt từ đồng nghĩa.**

### 3.1. Dữ liệu chính thức của Sales (nhóm 1)

| Tên trong code | Specs | Thuộc tính | Gốc / dẫn xuất |
| --- | --- | --- | --- |
| `Company` | công ty | `name`*, `industry`*, `company_type`*, `country`, `size`, `website`, `is_watched`, `owner_id`, `deleted_at` | gốc |
| `Contact` | người liên hệ | `company_id`, `name`, `title`, `email`, `is_primary` | dẫn xuất từ `Company` |
| `Opportunity` | cơ hội | `company_id`, `name`, `expected_value`, `expected_close_month`, `stage`, `next_step_text`, `next_step_due_date`, `next_step_source`, `need_signal`, `need_signal_source`, `budget_signal`, `budget_signal_source`, `lost_reason` | dẫn xuất từ `Company` |
| `TimelineEntry` | mục dòng thời gian | `company_id`, `entry_type`, `occurred_at`, `description`, `contact_id`, `created_by`, `source_claim_id` | dẫn xuất từ `Company` |

`*` = bắt buộc khi tạo. `is_primary` = **đầu mối chính** (PIC) — đúng một per company.
`TimelineEntry` gộp cả ba thứ Specs bắt hiện chung một chỗ: hoạt động, đổi giai đoạn, ghi chú — phân biệt bằng `entry_type`. Mục do vòng quét thêm cũng là `TimelineEntry` với `created_by = system`.

### 3.2. Vùng đọc — do AI sinh (nhóm 2, 3)

| Tên trong code | Specs | Ghi chú |
| --- | --- | --- |
| `Observation` | bản lưu | Thuộc **đúng một** `Company`. Chỉ tạo khi `content_hash` khác bản gần nhất (I-3) |
| `Claim` | phát hiện | Thuộc **đúng một** `Company`, thừa kế từ `Observation`. Không gắn thẳng vào `Opportunity`/`Contact`/`TimelineEntry` |
| `Proposal` | gợi ý | Chờ người quyết. Không tự hết hạn thành hành động |
| `ProposalDecision` | quyết định trên gợi ý | `proposal_id`, `decision`, `decided_by`, `decided_at`, `reject_reason`, `final_value`, `seconds_to_decide` |

### 3.3. Vùng AI tự ghi (nhóm 4, 5)

| Tên trong code | Specs | Ghi chú |
| --- | --- | --- |
| `AutoNextStepEvent` | lần hệ thống tự đặt Việc tiếp theo | `opportunity_id`, `claim_id`, `previous_text`, `previous_due_date`, `previous_source`, `new_text`, `new_due_date`, `created_at`, `undo_deadline`, `undone_at`, `undone_by`, `undone_to_text`, `undone_to_due_date` |
| `Notification` | thông báo trong sản phẩm | `user_id`, `auto_event_id`, `message`, `created_at`, `read_at`. **Không tự biến mất trước khi `read_at` có giá trị** |
| `WatchCycleRun` | dòng Nhật ký vòng quét | `started_at`, `duration_ms`, `companies_scanned`, `new_content_count`, `entries_added`, `error_count`, `error_detail`, `skipped_reason`, `is_rollup`, `cycles_covered` |

### 3.4. Vận hành (nhóm 6 + ranh giới)

| Tên trong code | Specs | Ghi chú |
| --- | --- | --- |
| `SystemSetting` | tham số | Cặp key/value trong CSDL. Hai key: `ai_enabled`, `watch_cycle_seconds`. Biến môi trường là **giá trị khởi tạo**, CSDL là **giá trị đang hiệu lực** |
| `AuditEvent` | ghi vết | `actor`, `action`, `entity`, `entity_id`, `at`, `detail`. Dùng cho: bật/tắt AI, xoá mục do hệ thống thêm, mọi lần ranh giới từ chối một thao tác |

### 3.5. Enum — giá trị cố định, không đội nào tự đổi tên

| Enum | Giá trị (code) | Hiển thị |
| --- | --- | --- |
| `company_type` | `traditional` · `it_solution` · `it_product` · `tech_startup` · `other_ito` | Traditional · IT Solution · IT Product · Tech-based/Startup · ITO khác |
| `stage` | `prospecting` · `qualified` · `drafting` · `negotiation` · `won` · `lost` · `on_hold` | Tiếp cận · Đủ điều kiện · Soạn đề xuất · Thương lượng · Thắng · Thua · Tạm dừng |
| `signal_type` | `funding` · `leadership_hire` · `expansion` · `mass_hiring` · `new_business_line` · `other` | gọi vốn · nhân sự cấp cao · mở rộng · tuyển dụng · mảng kinh doanh mới · khác |
| `confidence` | `certain` · `likely` · `speculative` | Chắc · Có thể · Đoán |
| `proposal_type` | `field_update` · `timeline_entry` · `next_step` | sửa ô hồ sơ · thêm tin · đặt Việc tiếp theo |
| `proposal_status` | `pending` · `decided` | Chờ duyệt · Đã quyết |
| `decision` | `accept` · `edit` · `reject` | Duyệt · Sửa rồi duyệt · Bỏ |
| `reject_reason` | `wrong_info` · `irrelevant` · `outdated` · `misread_context` · `other` | thông tin sai · đúng nhưng không liên quan · đã cũ · hiểu sai ngữ cảnh · khác |
| `next_step_source` · `created_by` | `human` · `system` | (dấu hiệu phân biệt trên giao diện) |
| `trigger_context` | `manual_ingest` · `watch_cycle` | ngữ cảnh sinh ra `Claim` — **quyết định claim đó có được ghi vào timeline hay không** |
| `entry_type` | `activity` · `stage_change` · `note` · `system_entry` | |
| `fetch_status` | `ok` · `failed` | nguồn không đọc được thì ghi `failed`, **không đoán** |

**Bẫy đặt tên:** giai đoạn "Soạn đề xuất" **không** được đặt là `proposal` — trùng với đối tượng `Proposal` (gợi ý của AI). Dùng `drafting`.

`next_step` là loại thứ ba, do I-7 mở ra ([ADR-0023](decisions/0023-goi-y-viec-tiep-theo-la-proposal-type-thu-ba-kem-cot-opportunity-id.md)): nhóm 4 gặp ô `next_step_source = human` thì **không đè**, sinh gợi ý thay vì tự ghi. Nó **không phải ngoại lệ của I-11** — I-11 nói về whitelist ô **hồ sơ công ty**, còn loại này nhắm vào `opportunities.next_step_text` và **bắt buộc** mang `opportunity_id` (một công ty có thể có nhiều cơ hội mở; gợi ý không nói được cho cơ hội nào thì không quyết được). Ràng buộc CHECK ghim cả ba loại: mỗi loại một hình dạng `(target_field, opportunity_id)`, không loại nào mượn được hình dạng của loại khác.

`proposal_status` **chỉ có hai giá trị, không phải bản sao của `decision`** — nó là cờ hàng đợi. Mọi **con số** (auto-accept rate, error-detection rate, tỉ lệ `edit`) đọc từ `ProposalDecision`, nên chỉ có một nguồn sự thật và I-12 tự đúng. `pending` cũng là `DEFAULT` của cột, và cột này **vắng** khỏi `GRANT INSERT` của `crm_system` → CSDL tự bảo đảm mọi gợi ý AI sinh ra đều chờ người duyệt ([ADR-0016](decisions/0016-proposal-status-chi-hai-gia-tri-moi-con-so-do-lay-tu-proposal-decisions.md), [ADR-0015](decisions/0015-grant-insert-phai-theo-cot-khi-bang-co-cot-thuoc-quyet-dinh-cua-nguoi.md)).

`stage` mở/đóng: *đang mở* = `prospecting`, `qualified`, `drafting`, `negotiation`, `on_hold`; *đã đóng* = `won`, `lost`. Màn tổng quan **tách `on_hold` khỏi pipeline đang chạy** — deal tạm dừng cộng vào tổng làm số mang đi họp sai.

### 3.6. Hai loại nguồn đọc — bản chụp bắt buộc, nguồn thật có điều kiện

Specs mục 3: *"Nguồn web trong đề bài chính là các bản chụp này, không phải trang web thật của các công ty."* Đội đọc câu đó là **ràng buộc của bộ nghiệm thu**, không phải lệnh cấm mọi nguồn khác tồn tại trong sản phẩm ([ADR-0035](decisions/0035-cho-phep-nguon-web-that-kem-dieu-kien-ban-chup-van-la-nguon-cua-bo-nghiem-thu.md)). Hệ quả trực tiếp: bản chụp là nguồn **duy nhất** của mọi công ty giám khảo chạm tới; nguồn thật là **đường phụ**, mặc định tắt, và **trần tự chủ thấp hơn**.

| | `demo_snapshot` — bản chụp | `live_crawl` — nguồn thật |
| --- | --- | --- |
| Ai kiểm soát nội dung | BTC | **không ai** |
| Dùng cho công ty nào | mọi công ty trong seed, gồm cả bộ chạy T-1…T-10 | **chỉ** công ty người dùng tự thêm ngoài seed (I-16) |
| Trần tự chủ cao nhất | vùng 4 (tự ghi mục dòng thời gian) | **vùng 2 — hàng đợi duyệt**, hết (I-15) |
| `Claim` rút ra đi đường nào | `is_watched` quyết định: mục dòng thời gian *hoặc* gợi ý (I-4 / I-5) | **luôn** là `Proposal`, kể cả công ty Đang theo dõi (I-15) |
| Đọc hỏng thì ghi gì | `fetch_status = failed` | `fetch_status = failed` **+ `fetch_error_reason`** (timeout · 403 · redirect · cần JS…) |
| Mặc định | bật | **tắt**; thiếu hoặc sai cấu hình → rơi về bản chụp (I-17) |

**Vì sao trần hạ một bậc chứ không giữ nguyên.** Vùng 3 và 4 là ngoại lệ Specs mở ra, và thứ làm chúng an toàn **không phải** nút Hoàn tác hay nhãn "do hệ thống thêm" — mà là **nội dung nguồn có người kiểm trước**. Đổi nguồn sang web thật mà giữ nguyên trần là giữ lại cơ chế an toàn nhưng vứt mất giả định làm nó an toàn: một trang bị deface, một quảng cáo, một trang tin giả sẽ **tự vào dòng thời gian công ty** trước khi có ai kịp nhìn. Luật 4 của CLAUDE.md — một dòng sai tệ hơn một dòng trống — đọc thẳng ra I-15.

**`source_kind` không vào bảng 3.5 — và đó là kết luận sau khi đã có cột thật.** Bản 14/08 của mục này hứa ngược lại ("vào bảng 3.5 cùng lúc với migration"), vì lúc đó giả định nó sẽ là một pg enum. Khi thi công thì tiêu chí của chính repo bác điều đó: `packages/contracts/src/enums.ts` khai rõ *bảng 3.5 liệt kê những enum **tồn tại như một kiểu Postgres***, nên `user_role` và cờ cảnh báo cơ hội mới nằm ngoài `ENUMS`.

`source_kind` là `text` + `CHECK`, **giống hệt `source_tier` trên cùng bảng đó và `snapshot_variant` trên `companies`** — cả hai đều không có trong 3.5. Hai cột mô tả cùng một trục "dữ liệu này từ đâu ra" mà chia nhau hai quy ước là bất nhất, và `text` + `CHECK` còn giữ được điều đã hứa với `source_tier`: thêm một giá trị không cần `ALTER TYPE`. Lời hứa đó đã được dùng ngay: `source_tier` có thêm `news` và `social` mà không cần migration kiểu nào.

#### Đọc trang nào — `company_sources`, và vì sao nó là bảng của người

| Thực thể | Từ trong Specs | Nghĩa | Ai được tạo |
| --- | --- | --- | --- |
| `CompanySource` | **nguồn đọc** | Một trang công khai mà công ty này được phép đọc: `url`, `source_tier`, `discovered_via`, `search_snippet`, `added_by`, `enabled` | **Chỉ người.** `crm_system` **không đọc được bảng này**; nó chỉ đọc view `company_sources_enabled`, và không ghi được gì (I-18) |
| `CompanySourceCandidate` | **ứng viên nguồn** | Một trang mà lượt tìm **đề xuất**, chưa ai tick: `url`, `source_tier`, `reason`, `snippet`, `found_by`. Hàng ở đây nghĩa là "máy đề xuất", **không** phải "được phép đọc" | **Chỉ người bấm Tìm.** `crm_system` **không có quyền nào** trên bảng này — không SELECT, không INSERT/UPDATE/DELETE (ADR-0037) |

Luồng đi đúng luật 3 của CLAUDE.md — *máy chuẩn bị sẵn, người quyết định ghi*:

```
POST   /companies/:id/source-candidates      → chạy web_search, GHI ứng viên vào
                                               company_source_candidates (thay bộ cũ, một
                                               transaction). KHÔNG chạm company_sources.
GET    /companies/:id/source-candidates      → ứng viên đã lưu, kèm savedSourceId (join theo url).
DELETE /companies/:id/source-candidates/:id  → bỏ một ứng viên.
POST   /companies/:id/sources                → người đã tick; ghi dưới crm_app, added_by = người đó.
GET    /companies/:id/sources                → danh sách đọc, kể cả trang đang tạm tắt.
PATCH  /companies/:id/sources/:id            → { enabled } — tạm ngưng hoặc đọc lại một trang.
DELETE /companies/:id/sources/:id            → bỏ một nguồn khỏi danh sách đọc.
```

Cả bốn route ghi đều có cửa `actor.kind === 'system'` → `ForbiddenException` + `AuditEvent`.

**Vì sao tách hai bước thay vì "tìm xong tự lưu".** Gộp lại thì ít một cú bấm, và đổi lại AI **tự chọn nguồn nó sẽ rút phát hiện** — đúng thứ `snapshot_variant` đã được bảo vệ khỏi, và là một đường ghi thứ ba ngoài hai ngoại lệ Specs mở. Lập luận này **vẫn nguyên**; chỉ cái giá đã trả xong: ứng viên nay sống qua reload vì nằm ở **bảng riêng mà AI không đọc được** (ADR-0037), nên hai bước không còn tốn 10–20 giây và một lượt tìm có phí mỗi lần refresh. Lưu ứng viên **không** phải "tìm xong tự lưu": danh sách **đọc** vẫn chỉ người ghi được.

**Đọc ở đâu, thứ tự ưu tiên:** `company_sources` có hàng **đang bật** → đọc đúng những trang đó, **không** đọc `companies.website`; không còn hàng nào đang bật (rỗng, hoặc tắt hết) → rơi về `companies.website`; cả hai trống → ghi `fetch_error_reason = invalid_url`. Đường đọc truy vấn view `company_sources_enabled` và **không có `WHERE enabled` nào ở tầng code** — trỏ vào bảng là `permission denied`, không phải đọc lén thành công. Hai nguồn sự thật cho một câu hỏi là cái giá phải trả để người dùng bật công tắc rồi bấm đọc được ngay mà không bị bắt Tìm nguồn trước — nên thứ tự này có test riêng, không để ngầm định.

Nên: `SOURCE_KIND`, `SOURCE_TIER` và `FETCH_ERROR_REASON` khai trong `enums.ts` **ngoài** `ENUMS`, kèm comment giải thích; danh sách đóng do `CHECK` của [`0008_live_source.sql`](../packages/db/migrations/0008_live_source.sql) giữ; bảng 3.5 giữ nguyên 12 dòng và `ontology-enum-parity.test.ts` không phải sửa. Chi tiết ở ADR-0036.

## 4. Quan hệ có tên — phần quan trọng nhất

| Chủ thể | Quan hệ | Đối tượng | Đọc thành câu |
| --- | --- | --- | --- |
| `Contact` | `works_for` | `Company` | "Anh Tanaka **làm việc cho** công ty X" |
| `Contact` | `is_primary_for` | `Company` | "Anh Tanaka **là đầu mối chính của** công ty X" |
| `Opportunity` | `pursued_at` | `Company` | "Cơ hội Y **đang được theo đuổi tại** công ty X" |
| `TimelineEntry` | `recorded_against` | `Company` | "Mục này **được ghi vào dòng thời gian của** công ty X" |
| `Observation` | `captured_from` | `Company` | "Bản lưu này **chụp từ nguồn của** công ty X" |
| `Claim` | `derived_from` | `Observation` | "Phát hiện này **rút ra từ** bản lưu lúc 09:12" |
| `Claim` | `quotes` | `Observation[start..end]` | "Phát hiện này **trích nguyên văn** đoạn ký tự 412–488 của bản lưu" |
| `Claim` | `read_under_lens_of` | `company_type` | "Tin gọi vốn này **được đọc dưới góc** công ty startup" |
| `Proposal` | `supported_by` | `Claim` | "Gợi ý này **được chống đỡ bởi** phát hiện Z" |
| `Proposal` | `targets_field_of` | `Company` | "Gợi ý này **muốn sửa ô quy mô của** công ty X" |
| `ProposalDecision` | `decides` | `Proposal` | "Sales **đã bỏ** gợi ý này vì hiểu sai ngữ cảnh" |
| `AutoNextStepEvent` | `triggered_by` | `Claim` | "Lần tự đặt này **bị kích hoạt bởi** phát hiện gọi vốn Z" |
| `AutoNextStepEvent` | `overwrote_next_step_of` | `Opportunity` | "Hệ thống **đã ghi đè Việc tiếp theo của** cơ hội Y" |
| `Notification` | `announces` | `AutoNextStepEvent` | "Thông báo này **báo về** lần hệ thống tự đặt lúc 08:03" |
| `TimelineEntry` | `generated_from` | `Claim` | "Mục này **được sinh từ** phát hiện Z" |
| `WatchCycleRun` | `scanned` | `Company[]` | "Vòng quét lúc 08:00 **đã quét** 3 công ty Đang theo dõi" |
| `AuditEvent` | `rejected_action_of` | `actor` | "Hệ thống **đã từ chối thao tác đổi giai đoạn của** actor `system`" |

Quy tắc lưu: quan hệ nóng (`works_for`, `pursued_at`, `derived_from`) là khoá ngoại thật. Quan hệ do AI suy ra (`generated_from`, `triggered_by`) lưu kèm `source_claim_id` để truy vết ngược được.

## 5. Trần tự chủ của AI

Bốn vùng tự chủ tăng dần — trùng bảng ở [CLAUDE.md mục 4](../CLAUDE.md). **Vùng 3 và 4 là ngoại lệ do Specs mở, không phải mặc định của đội.**

| Vùng | Hành động | Đối tượng bị chạm | Cơ chế an toàn |
| --- | --- | --- | --- |
| 1 · Tự do | Đọc bản chụp, tạo `Observation`, rút `Claim` | O, C | Không chạm dữ liệu chính thức |
| 2 · Chờ duyệt | Sinh `Proposal` | P | Không duyệt thì không có gì xảy ra, vô thời hạn |
| 3 · Tự ghi, hoàn tác được | Đặt `next_step_text` + `next_step_due_date` | `Opportunity` | Thông báo + Hoàn tác 1 bấm / 7 ngày + ghi vết 2 chiều |
| 4 · Tự ghi, không hỏi ai | Thêm `TimelineEntry` (`created_by = system`) | `TimelineEntry` | Nhãn + câu trích + xoá được + Nhật ký vòng quét |

**Bốn vùng trên đúng cho nguồn `demo_snapshot`. Nguồn thật hạ trần xuống vùng 2** (mục 3.6, I-15): phát hiện rút từ `live_crawl` chỉ được xếp hàng chờ duyệt — không tự ghi Việc tiếp theo, không tự thêm mục dòng thời gian, kể cả công ty đang bật Đang theo dõi. Trần tự chủ là hàm của **nguồn**, không chỉ của tính năng.

### Vùng cấm tuyệt đối

`actor = system` **không bao giờ** được:

1. Ghi vào `Opportunity.stage` — giai đoạn chỉ đổi khi người thao tác.
2. Ghi vào `Opportunity.expected_value`, hoặc đặt `stage` = `won`/`lost`.
3. Liên hệ khách hàng — **không tồn tại adapter gửi thư/tin nhắn nào trong mã nguồn**.
4. Xoá dữ liệu do người tạo.

**Cách chặn (hai lớp, bắt buộc cả hai):**

- **Lớp domain:** mọi đường ghi mang `actor`; tầng service từ chối 4 hành động trên khi `actor = system`, và ghi một `AuditEvent`.
- **Lớp CSDL:** ràng buộc/trigger lặp lại cho `stage`, `expected_value`, xoá `Company`/`Contact`/`Opportunity`/`TimelineEntry` do người tạo.

Specs nói chỉ "ba ranh giới đầu" phải chặn ngoài giao diện, nhưng T-10 lại thử cả xoá công ty → **chặn cả bốn**. Ranh giới 3 chứng minh bằng test khẳng định không có adapter gửi tin.

### Nút tắt

`SystemSetting.ai_enabled = false` → dừng vòng quét, không sinh `Observation`/`Claim`/`Proposal` mới **từ bất kỳ nguồn nào, gồm cả nguồn thật** (I-17), không tự đặt Việc tiếp theo. **Dữ liệu đã sinh không bị xoá. Hàng đợi vẫn duyệt được** — duyệt là hành vi của người, không phải của AI. Sales thấy dòng thông báo AI đang tắt.

## 6. Bất biến — code phải enforce, không phải ghi cho đẹp

Mỗi bất biến dưới đây có một test. Không có test = coi như chưa làm.

| # | Bất biến | Vì sao |
| --- | --- | --- |
| **I-1** | `Claim` không có `quote_text` → **từ chối lưu** | T-2; luật 1 CLAUDE.md |
| **I-2** | `quote_text` phải là **chuỗi con nguyên văn** của `Observation.raw_content`; `quote_start`/`quote_end` do **code tính**, không nhận từ LLM. Không khớp → từ chối cả `Claim` | LLM paraphrase thì field không rỗng nhưng bấm vào không highlight được → provenance giả. T-2b (test đội tự thêm) |
| **I-3** | Chỉ tạo `Observation` khi `content_hash` khác bản gần nhất của cùng công ty. Trùng → ghi nhận "đã đọc, không đổi" vào `WatchCycleRun`, **không tạo bản lưu, không gọi LLM** | Chặn spam timeline (LLM không tất định) + chặn gợi ý đã Bỏ sinh lại mỗi 60s + cắt chi phí LLM |
| **I-4** | `Claim` chỉ sinh `TimelineEntry` khi công ty có `is_watched = true` — **điều kiện là nhãn Đang theo dõi, không phải `trigger_context`**. Công ty không theo dõi → 0 mục, dù vòng quét hay người bấm đọc; công ty đang theo dõi → có mục, dù ai đọc. **Ngoại lệ nguồn thật:** `source_kind = live_crawl` không sinh mục kể cả công ty đang theo dõi (I-15) | Uỷ quyền là thuộc tính của **công ty** ([ADR-0006](decisions/0006-bat-dang-theo-doi-la-uy-quyen-phan-ghi-tin.md)), không của người bấm. Lấy điều kiện ở `trigger_context` để hở một ô: công ty đang theo dõi mà người bấm đọc thì I-5 chặn gợi ý, I-4 chặn mục ⇒ **không đường nào ghi**, và I-3 làm nó vĩnh viễn ([ADR-0028](decisions/0028-quyen-ghi-muc-dong-thoi-gian-den-tu-nhan-dang-theo-doi-khong-tu-trigger-context.md)) |
| **I-5** | Công ty `is_watched = true` **không** sinh `Proposal` loại `timeline_entry` (vẫn sinh loại `field_update`). Cùng một điều kiện với I-4, **hai chiều ngược nhau**: mỗi phát hiện đi đúng một đường — đang theo dõi → mục hệ thống, không theo dõi → gợi ý. **Ngoại lệ nguồn thật:** với `live_crawl`, công ty đang theo dõi **vẫn** sinh gợi ý loại `timeline_entry` (I-15) | Bật Đang theo dõi = uỷ quyền phần ghi tin cho hệ thống → tránh cùng một tin vào timeline hai lần. Bộ lọc của hai nhánh phải giống nhau từng điều kiện, lệch một cái là vừa ghi vừa xếp gợi ý hoặc không làm gì cả |
| **I-6** | Tự đặt Việc tiếp theo **chỉ khi** `confidence ∈ {certain, likely}` **và** `signal_type ∈ {funding, leadership_hire}` **và** công ty có ≥1 cơ hội đang mở | "Phát hiện đáng chú ý" phải định nghĩa được mới test được. Tin mở rộng/tuyển dụng → đẩy sang hàng đợi |
| **I-7** | Không ghi đè `next_step_text` khi `next_step_source = human`, **kể cả đã quá hạn**. Trường hợp đó sinh `Proposal` thay vì tự ghi | Ô người gõ quá hạn là món nợ Sales đang giữ, không phải ô rác |
| **I-8** | Hoàn tác trả về **giá trị người-gõ gần nhất** (rỗng nếu chưa từng có), không phải giá trị máy đặt lần trước | Mục đích nút này là bảo vệ dữ liệu người, không phải làm lịch sử phiên bản |
| **I-9** | `next_step_due_date` lấy từ **bảng cấu hình `signal_type → số ngày`**, không do LLM chọn; giao diện hiện lý do | Ngày hạn cũng là một nhận định — không có nguồn thì không hiển thị |
| **I-10** | Một vòng quét đang chạy thì bỏ nhịp kế tiếp, ghi `skipped_reason` | Chu kỳ 60s + gọi LLM có thể tràn nhịp → ghi trùng, đếm sai |
| **I-11** | `Proposal` chỉ được đề xuất sửa ô trong whitelist: `industry`, `country`, `size`, `website`. **Cấm** `name`, `company_type` | `company_type` là đầu vào để đọc tín hiệu → sửa nó tạo vòng lặp tự tham chiếu |
| **I-12** | `decision = edit` đếm riêng, **không cộng vào** `accept` | T-5 |
| **I-13** | Xoá `TimelineEntry` do hệ thống thêm phải kèm lý do ngắn, ghi `AuditEvent` | Nhóm 5 không có thông báo → thao tác xoá là tín hiệu error-detection duy nhất |
| **I-14** | Nạp seed lại đưa **mọi công ty về bản chụp "trước"** và xoá sạch O/C/P/thông báo/nhật ký sinh trong demo | Giám khảo diễn lại kịch bản lần hai |
| **I-15** | `Claim` rút từ `Observation` có `source_kind = live_crawl` **chỉ** sinh được `Proposal`: không `TimelineEntry`, không `AutoNextStepEvent`, **kể cả** khi công ty có `is_watched = true`. Với nguồn thật, cửa I-5 gạt sang **chiều gợi ý** thay vì chiều mục | Vùng 3–4 an toàn nhờ nội dung nguồn có người kiểm, không nhờ nút Hoàn tác (mục 3.6). Và **phải** lật chiều I-5, nếu không công ty Đang theo dõi đọc nguồn thật rơi đúng vào cái hố [ADR-0028](decisions/0028-quyen-ghi-muc-dong-thoi-gian-den-tu-nhan-dang-theo-doi-khong-tu-trigger-context.md) mô tả: I-15 chặn mục, I-5 chặn gợi ý ⇒ **không đường nào ghi**, và I-3 làm nó vĩnh viễn |
| **I-16** | Công ty thuộc bộ seed **chỉ** đọc `demo_snapshot`. Bật nguồn thật cho một công ty seed → **từ chối** + `AuditEvent`. Nguồn thật chỉ dùng được cho công ty người dùng tự thêm. Seed lại (I-14) xoá cả bản lưu `live_crawl` | T-6 và T-8 kích hoạt bằng "đổi bản chụp trước → sau" — đó là cách **duy nhất** giám khảo tự tái tạo được kịch bản. Một nguồn đổi ngoài tầm kiểm soát của giám khảo làm hai điểm nghiệm thu hết lặp lại được |
| **I-17** | Nguồn thật **mặc định tắt**; thiếu hoặc sai cấu hình → rơi về `demo_snapshot`, không phải báo lỗi rồi dừng; `ai_enabled = false` dừng luôn cả nguồn thật | Nhánh an toàn phải là nhánh mặc định, cùng mẫu [ADR-0014](decisions/0014-nhom-2-rut-phat-hien-bang-llm-that-code-kiem-cau-trich.md). Một biến môi trường gõ sai không được biến thành một đường ghi mới |

**I-15, I-16, I-17 đã có test (14/08).** Nợ khai ở bản trước đã trả:

| Bất biến | Test |
| --- | --- |
| I-15, cả hai vế | [`live-source-autonomy-ceiling.test.ts`](../apps/api/src/domain/observation/__tests__/live-source-autonomy-ceiling.test.ts) — bảng bốn ô `(source_kind × is_watched)`, mỗi ô assert số mục, số `AutoNextStepEvent`, số gợi ý tách theo loại, cộng hai ca của I-7 |
| I-16 | [`live-source-toggle.test.ts`](../apps/api/src/domain/company/__tests__/live-source-toggle.test.ts) — từ chối + `AuditEvent`, phủ **cả năm** công ty seed; và [`live-source-columns-and-grants.test.ts`](../packages/db/src/__tests__/live-source-columns-and-grants.test.ts) cho tầng CSDL |
| I-17 | [`resolve-observation-source.test.ts`](../apps/api/src/ai/__tests__/resolve-observation-source.test.ts) — 10 kiểu cấu hình sai/thiếu, tất cả rơi về `demo_snapshot`; `ai_enabled = false` chặn cả hai loại nguồn |

**Vế đó đã nối (14/08 tối).** `ObservationService` gọi `resolveObservationSource` trên đường chạy thật, và `LiveCrawlSource` đọc trang công khai — I-17 chuyển từ "có test hàm thuần" sang "có trên đường chạy", đo bằng [`live-crawl-ingest.test.ts`](../apps/api/src/domain/observation/__tests__/live-crawl-ingest.test.ts).

Bằng chứng mạnh nhất cho I-16 nằm ở đó: chạy **đủ 39 e2e với `OBSERVATION_SOURCE=live_crawl`** → 39 xanh, mọi bản lưu trong CSDL vẫn là `demo_snapshot`, và crawler được gọi **0** lần. Bật công tắc toàn cục không mở được đường nào tới công ty seed.

**Một bất biến mới, sinh ra từ chính thiết kế này — I-18, đã mạnh lên ngày 14/08 khuya (ADR-0037):**

- `crm_system` **không đọc được** `company_sources` (`REVOKE SELECT`), và không ghi được gì ở đó — test 14, 15, 16.
- Nó chỉ đọc được view `company_sources_enabled`, tức **chỉ thấy trang đang bật**; và không ghi được qua view — test 24, 25.
- Trên `company_source_candidates` nó **không có quyền nào**, kể cả SELECT — test 20, 21.

Phát biểu cũ (`crm_system` **có** `SELECT` trên `company_sources`) đúng một nửa: crawler cần biết đọc trang nào, nhưng nó không cần — và không được — thấy trang người ta vừa tắt. Đó là "AI không tự chọn nguồn nó đọc" dịch thành quyền CSDL, cùng cơ chế đã bảo vệ `snapshot_variant` — đo trong `live-source-columns-and-grants.test.ts`.

**Bảng độ gấp (I-9)** — tham số, đọc được, sửa được:

| `signal_type` | Số ngày hạn | Lý do hiện trên giao diện |
| --- | --- | --- |
| `funding` | 3 | cửa sổ gọi vốn tính bằng ngày |
| `leadership_hire` | 5 | sếp mới xem lại lựa chọn của người cũ trong vài tuần đầu |
| `expansion` · `mass_hiring` · `new_business_line` | 14 | cửa sổ tính bằng tuần |

## 7. Chỉ số đo từ ngày đầu

Hiện trên bảng điều khiển Quản trị **đúng tên này**, không để BGK tự suy:

| Chỉ số | Công thức | Đo gì |
| --- | --- | --- |
| **Auto-accept rate** | `accept / (accept + edit + reject)` | Hệ thống khôn lên |
| **Error-detection rate** | `(reject[wrong_info] + reject[misread_context] + số lần Hoàn tác + số lần xoá mục hệ thống) / (Proposal + AutoNextStepEvent + TimelineEntry do hệ thống thêm)` | **Người** khôn lên |
| Tỉ lệ sửa-rồi-duyệt | `edit / tổng` | Tách bạch khỏi accept (I-12) |
| Phân bố lý do bỏ | đếm theo `reject_reason` | Sai ở đâu |
| Phân bố mức chắc chắn | đếm theo `confidence` | AI đang tự tin quá mức không |
| Thời gian quyết trung bình | trung vị `seconds_to_decide` | **Chỉ đọc cùng error-detection rate** — thấp có thể là giao diện tốt, cũng có thể là bấm mù |
| Tỉ lệ hoàn tác | `undone / tổng AutoNextStepEvent` | Vùng 3 có đáng tin không |

Mẫu số của error-detection rate là **ba tập AI đưa ra trước mặt người**, không phải toàn bộ phát hiện ([ADR-0031](decisions/0031-mau-so-error-detection-rate-la-ba-tap-ai-dua-ra-truoc-mat-nguoi.md)): mỗi số hạng của tử số phải là một sự kiện xảy ra **trên một phần tử của mẫu số**, và không số hạng nào phát sinh trên `Claim`. Cộng `claims` vào là chia cho một hằng số lớn tuỳ ý — tỉ lệ nằm gần 0 vĩnh viễn và không hành vi nào của người làm nó nhúc nhích.

Hai luật hiển thị áp cho **mọi** tỉ lệ ở bảng trên: hiện **kèm mẫu số** (`3/12`, không phải `25%` trơ trọi), và **mẫu số 0 thì hiện "chưa có dữ liệu"**, không hiện `0%` — `0%` cạnh error-detection rate đọc lên thành "người không bắt được lỗi nào" trong khi sự thật là "chưa có gì để bắt".

Mốc bắt đầu đo `seconds_to_decide`: **lúc rảnh tay** — lúc mở màn hình hàng đợi với gợi ý đầu tiên, và lúc quyết xong gợi ý trước với mỗi gợi ý tiếp theo. Gợi ý hiện đủ tại chỗ nên không có động tác "mở gợi ý" để bấm mốc; nhưng một mốc **chung** cho cả lượt sẽ làm trung vị thành hàm của độ dài hàng đợi, không còn là thời gian quyết một gợi ý ([ADR-0025](decisions/0025-moc-do-thoi-gian-quyet-dat-lai-sau-moi-quyet-dinh.md)). Duyệt liên tiếp 6 gợi ý thu được **6 khoảng**, không phải một khoảng cộng dồn. Mốc **kết thúc** theo [ADR-0008](decisions/0008-bo-goi-y-bang-menu-ly-do-tai-cho.md): nhánh Bỏ tính tới **lúc chọn lý do**, không phải lúc bấm nút Bỏ. Reload trang giữa lúc quyết thì mốc mất → cột **để trống**, không gửi số bịa.

## 8. Chuỗi dẫn xuất tài liệu

```
Specs BTC (hackathon-spec-ai-native-crm.md)
   → phản biện persona (ai-sessions/260812-1742-…)
   → user stories + AC  ┐
                        ├→ ontology.md (file này) → schema + types → code + test
   → ADR (lý do + phương án loại) ┘
```

Đổi Specs → đọc lại ontology. Đổi ontology → đổi schema và tên trong code. **Không đi tắt.**

## 9. Diễn giải Specs — đã chốt bằng ADR

Các chỗ Specs mơ hồ hoặc tự mâu thuẫn, đã quyết xong — mười chỗ đầu chốt 12/08, các dòng sau thêm khi phát sinh. Mỗi ADR có ≥2 phương án bị loại kèm lý do — đọc ADR trước khi định làm khác:

| Mã | Diễn giải đã chốt | Ràng buộc | ADR |
| --- | --- | --- | --- |
| M-8 | Câu trích bắt buộc là chuỗi con nguyên văn, offset do code tính | I-2 | [0002](decisions/0002-cau-trich-phai-la-chuoi-con-nguyen-van-cua-ban-luu.md) |
| M-3+M-4 | "Nội dung mới" so bằng hash ở tầng `Observation`; chỉ tạo bản lưu khi hash khác | I-3 | [0003](decisions/0003-chi-tao-ban-luu-khi-noi-dung-thay-doi.md) |
| M-7 | Chặn cả 4 ranh giới ở hai lớp: `actor` tầng domain + ràng buộc CSDL | mục 5 | [0004](decisions/0004-chan-ranh-gioi-o-tang-domain-va-tang-csdl.md) |
| M-1 | "Phát hiện đáng chú ý" = `{certain, likely}` × `{funding, leadership_hire}` | I-6 | [0005](decisions/0005-tran-tu-chu-cua-viec-tu-dat-viec-tiep-theo.md) |
| M-2 | Ghi cho **mọi** cơ hội mở, mỗi cơ hội một `AutoNextStepEvent` | mục 3.3 | [0005](decisions/0005-tran-tu-chu-cua-viec-tu-dat-viec-tiep-theo.md) |
| M-6 | Không đè ô người gõ kể cả quá hạn → sinh `Proposal` thay vì tự ghi | I-7, I-8 | [0005](decisions/0005-tran-tu-chu-cua-viec-tu-dat-viec-tiep-theo.md) |
| M-5 | Bật Đang theo dõi = uỷ quyền ghi tin → không sinh `Proposal` loại `timeline_entry` | I-5 | [0006](decisions/0006-bat-dang-theo-doi-la-uy-quyen-phan-ghi-tin.md) |
| M-5b | Uỷ quyền đó là thuộc tính của **công ty**: `is_watched` quyết định cả hai chiều I-4/I-5, `trigger_context` không quyết định quyền ghi | I-4, I-5 | [0028](decisions/0028-quyen-ghi-muc-dong-thoi-gian-den-tu-nhan-dang-theo-doi-khong-tu-trigger-context.md) |
| M-13 | Vùng 4 chặn hai lớp trên `timeline_entries`: `GRANT INSERT` theo cột (bỏ `created_by`, `contact_id`) + `CHECK` bắt mục hệ thống có `source_claim_id` | mục 5, I-13 | [0029](decisions/0029-grant-insert-theo-cot-tren-timeline-entries-va-check-nhan-he-thong.md) |
| M-9 | Ba mức đều có câu trích; khác ở **khoảng cách suy luận**. `certain` do code cấp | mục 3.5 | [0007](decisions/0007-ba-muc-chac-chan-do-bang-khoang-cach-suy-luan.md) |
| M-11 | Bỏ = menu 5 lý do tại chỗ; "số thao tác" đọc là **số bước** | (giao diện) | [0008](decisions/0008-bo-goi-y-bang-menu-ly-do-tai-cho.md) |
| M-12 | Nút tắt chỉ dừng việc **sinh mới**; hành vi do người khởi xướng không bị tắt | mục 5 | [0009](decisions/0009-pham-vi-nut-tat-ai-chi-dung-sinh-moi.md) |
| M-14 | "Nguồn web trong đề bài chính là các bản chụp" là ràng buộc **của bộ nghiệm thu**, không phải lệnh cấm nguồn khác tồn tại: nguồn thật được **bổ sung**, không được **thay**, và trần tự chủ hạ xuống vùng 2 | 3.6, I-15…I-17 | [0035](decisions/0035-cho-phep-nguon-web-that-kem-dieu-kien-ban-chup-van-la-nguon-cua-bo-nghiem-thu.md) |

| M-15 | **LLM quyết *đọc ở đâu*, code quyết *cái gì được lưu và trích thế nào*.** `web_search` trả URL + đoạn trích; `LiveCrawlSource` fetch bytes; `ClaimExtractor` rút phát hiện qua đúng cửa I-1/I-2. Cấm dùng `web_fetch` lấy nội dung công ty — mất byte gốc là mất chỗ đứng của I-2 | 3.6, I-18 | [0036](decisions/0036-llm-tim-nguon-code-doc-bytes-va-ung-vien-phai-qua-nguoi.md) |

**Luật rút ra, dùng cho mọi chỗ mơ hồ còn lại:** cách đọc nào làm một điều khoản Specs trở nên vô nghĩa thì cách đọc đó sai. Dùng ở ADR-0003, 0007, 0009.

## 10. Checklist duyệt ontology

- [x] Mọi quan hệ đọc thành câu có nghĩa (mục 4)
- [x] Mọi dữ liệu AI tạo ra đã phân loại đúng Observation / Claim / Proposal (mục 3.2, 3.3)
- [x] Mọi Claim có đường về Observation gốc (I-1, I-2)
- [x] Vùng cấm liệt kê tường minh, có cách chặn hai lớp (mục 5)
- [x] Có chỗ ghi nhận accept/reject/edit trên từng Proposal (`ProposalDecision`)
- [x] 10 diễn giải ở mục 9 đã có ADR (0002–0009)
- [x] Ba điều kiện của nguồn thật (I-15, I-16, I-17) đã có test — **đã trả 14/08**, xem bảng cuối mục 6. Công tắc chỉ được bật sau khi cả ba xanh, và cả ba đã xanh
- [x] `source_kind` đã có trong `enums.ts` cùng migration `0008` — **cố ý nằm ngoài bảng 3.5**: 3.5 liệt kê enum tồn tại như một kiểu Postgres, còn `source_kind` là `text` + CHECK, giống `source_tier` và `snapshot_variant` trên cùng bảng. Lý do đầy đủ ở [ADR-0036](decisions/0036-llm-tim-nguon-code-doc-bytes-va-ung-vien-phai-qua-nguoi.md) mục (f)
- [x] **Người (không phải AI) đã đọc và duyệt file này** — HungLV, 13/08/2026
- [x] Enum ở 3.5 đã ánh xạ vào code/CSDL thật — `packages/contracts/src/enums.ts` (13 enum trong `ENUMS`, cộng `user_role` cố ý nằm ngoài vì 3.5 không khai) → `pgEnum` sinh thẳng từ đó, giữ bởi `ontology-enum-parity.test.ts` đọc chính file này
- [ ] Phần thực nghiệm còn nợ trong ADR-0002/0003/0007 đã chạy (một lần đo, ba ADR dùng chung) — **còn nợ**, trả trong phase nhóm 2 cùng nợ verify của [ADR-0014](decisions/0014-nhom-2-rut-phat-hien-bang-llm-that-code-kiem-cau-trich.md)

## Câu hỏi chưa giải quyết

- ~~Stack TBD → kiểu dữ liệu, biểu diễn enum, cơ chế ràng buộc lớp CSDL.~~ **Đã chốt 12/08:** stack Next.js + NestJS + Drizzle + Postgres; enum dùng `pgEnum` gốc, nguồn sự thật là một file trong `packages/contracts`; ràng buộc lớp CSDL dùng **hai role + GRANT theo cột**, không dùng trigger → [ADR-0010](decisions/0010-chan-tang-csdl-bang-hai-role-va-quyen-theo-cot.md).
- ~~`source_tier` (tháp độ tin cậy 1–6) hiện luôn là "website công ty" → giữ trường nhưng chưa có tầng nào khác; bỏ hẳn hay giữ chỗ, chờ quyết.~~ **Đã chốt 13/08:** giữ trường, kiểu `text`, mặc định `'company_website'` — đọc log ra nghĩa ngay thay vì phải tra bảng số, và thêm nguồn mới (news, LinkedIn) không cần `ALTER TYPE`. Chưa dựng thang 1–6 vì hiện chỉ có một tầng; khi có tầng thứ hai mới cân nhắc đổi sang enum.
- ~~Bản chụp là HTML hay text (Q-3 gửi BTC) → ảnh hưởng cách tính `quote_start`/`quote_end` (offset trên chuỗi nào).~~ **Đã chốt 12/08:** bản chụp lưu HTML; `Observation` giữ cả `raw_html` lẫn `raw_content` (text trích ra), offset và hash tính trên `raw_content`; giao diện hai tab *Văn bản* / *Bản gốc* → [ADR-0012](decisions/0012-ban-luu-giu-html-goc-va-text-trich-offset-tinh-tren-text.md).
- ~~Chưa rõ Admin có được thao tác CRM không (Q-6) → chưa viết được ma trận quyền đầy đủ.~~ **Đã chốt 14/08:** vòng 1 Admin có quyền CRM y hệt Sales, chỉ khác màn quản trị → [ADR-0033](decisions/0033-vong-1-admin-co-quyen-crm-nhu-sales-ma-tran-quyen-chi-tiet-ngoai-pham-vi.md).
- Cách đọc Specs mục 3 ở mục 3.6 ("bản chụp là ràng buộc của bộ nghiệm thu", không phải "nguồn duy nhất được phép tồn tại") là **diễn giải của đội, chưa có BTC xác nhận** — câu hỏi đã ghi trong [prompt log 260814-1124](ai-sessions/260814-1124-req-crawl-web-that.md) mục 6. Nếu BTC trả lời "duy nhất": **xoá** đường nguồn thật khỏi mục 1 và 3.6, không phải nới thêm điều kiện. Rủi ro hiện bằng 0 vì công tắc chưa bật.
- ~~Ai được bật nguồn thật cho một công ty — Admin hay Sales sở hữu công ty đó?~~ **Đã chốt 14/08:** bất kỳ người dùng đã đăng nhập, giống mọi thao tác sửa hồ sơ công ty khác — theo [ADR-0033](decisions/0033-vong-1-admin-co-quyen-crm-nhu-sales-ma-tran-quyen-chi-tiet-ngoai-pham-vi.md), ma trận quyền chi tiết vẫn ngoài phạm vi vòng 1. Chỉ `JwtGuard`, không thêm cửa kiểm vai trò; `AuditEvent` ghi actor nên vẫn truy được ai bật.

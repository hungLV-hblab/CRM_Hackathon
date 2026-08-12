# Ontology — AI Native CRM

> Sinh 12/08/2026 từ [template](./ontology-template.md), dựa trên [Specs BTC](./hackathon-spec-ai-native-crm.md) và [phiên phản biện 260812-1742](./ai-sessions/260812-1742-req-phan-bien-de-bai-ai-native-crm.md).
> **AI sinh nháp — người review và duyệt.** Trạng thái duyệt: ✅ HungLV đọc lại và chấp nhận 13/08/2026. Sửa file này thì phải duyệt lại.
> Nền lý thuyết: [ai-native-design-principles.md](./ai-native-design-principles.md).
>
> **File này là nguồn sự thật về ĐẶT TÊN và RÀNG BUỘC.** Code không khớp file này là code sai, không phải file sai.
> Test nghiệm thu của chính file này: mọi quan hệ ở mục 4 đọc lên thành một câu tiếng Việt có nghĩa.

## 1. Domain này là gì

Một CRM bán hàng B2B cho **một đội Sales ITO** của HBLAB, cộng một lớp AI đọc **bản chụp web tĩnh** của công ty khách hàng để giữ hồ sơ khỏi cũ. Sản phẩm là **một** hệ thống: tắt sạch lớp AI thì phần CRM vẫn làm được trọn vẹn công việc bán hàng.

**Không thuộc module này** (Specs mục 2 nói rõ, đừng tự thêm): soạn message tiếp cận · phân vai buyer persona · nỗi đau ba tầng · ICP scoring thành tính năng riêng · crawl web thật · bất kỳ kênh nào chạm tới người thật · chatbot.

Người dùng: `Sales` (một tài khoản, sở hữu mọi công ty — không làm phân quyền theo người sở hữu) và `Admin` (xem đo lường chất lượng, chỉnh tham số, tắt AI).

## 2. Đối tượng cố định — không sửa

| Đối tượng | Từ trong Specs | Thuộc tính tối thiểu ở module này |
| --- | --- | --- |
| `Observation` | bản lưu | `id`, `company_id`, `source_url`, `source_tier`, `captured_at`, `raw_html`, `raw_content`, `extractor_version`, `content_hash`, `fetch_status`. Bản chụp là HTML: `raw_html` giữ nguyên bản, `raw_content` là text trích ra đã chuẩn hoá — **offset câu trích và `content_hash` tính trên `raw_content`** ([ADR-0012](decisions/0012-ban-luu-giu-html-goc-va-text-trich-offset-tinh-tren-text.md)) |
| `Claim` | phát hiện | `id`, `company_id`, `observation_id`, `statement`, `signal_type`, `confidence`, `quote_text`, `quote_start`, `quote_end`, `trigger_context` |
| `Proposal` | gợi ý | `id`, `company_id`, `claim_id`, `proposal_type`, `target_field`, `current_value`, `proposed_value`, `impact_if_wrong`, `status` |
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
| `proposal_type` | `field_update` · `timeline_entry` | sửa ô hồ sơ · thêm tin |
| `decision` | `accept` · `edit` · `reject` | Duyệt · Sửa rồi duyệt · Bỏ |
| `reject_reason` | `wrong_info` · `irrelevant` · `outdated` · `misread_context` · `other` | thông tin sai · đúng nhưng không liên quan · đã cũ · hiểu sai ngữ cảnh · khác |
| `next_step_source` · `created_by` | `human` · `system` | (dấu hiệu phân biệt trên giao diện) |
| `trigger_context` | `manual_ingest` · `watch_cycle` | ngữ cảnh sinh ra `Claim` — **quyết định claim đó có được ghi vào timeline hay không** |
| `entry_type` | `activity` · `stage_change` · `note` · `system_entry` | |
| `fetch_status` | `ok` · `failed` | nguồn không đọc được thì ghi `failed`, **không đoán** |

**Bẫy đặt tên:** giai đoạn "Soạn đề xuất" **không** được đặt là `proposal` — trùng với đối tượng `Proposal` (gợi ý của AI). Dùng `drafting`.

`stage` mở/đóng: *đang mở* = `prospecting`, `qualified`, `drafting`, `negotiation`, `on_hold`; *đã đóng* = `won`, `lost`. Màn tổng quan **tách `on_hold` khỏi pipeline đang chạy** — deal tạm dừng cộng vào tổng làm số mang đi họp sai.

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

`SystemSetting.ai_enabled = false` → dừng vòng quét, không sinh `Observation`/`Claim`/`Proposal` mới, không tự đặt Việc tiếp theo. **Dữ liệu đã sinh không bị xoá. Hàng đợi vẫn duyệt được** — duyệt là hành vi của người, không phải của AI. Sales thấy dòng thông báo AI đang tắt.

## 6. Bất biến — code phải enforce, không phải ghi cho đẹp

Mỗi bất biến dưới đây có một test. Không có test = coi như chưa làm.

| # | Bất biến | Vì sao |
| --- | --- | --- |
| **I-1** | `Claim` không có `quote_text` → **từ chối lưu** | T-2; luật 1 CLAUDE.md |
| **I-2** | `quote_text` phải là **chuỗi con nguyên văn** của `Observation.raw_content`; `quote_start`/`quote_end` do **code tính**, không nhận từ LLM. Không khớp → từ chối cả `Claim` | LLM paraphrase thì field không rỗng nhưng bấm vào không highlight được → provenance giả. T-2b (test đội tự thêm) |
| **I-3** | Chỉ tạo `Observation` khi `content_hash` khác bản gần nhất của cùng công ty. Trùng → ghi nhận "đã đọc, không đổi" vào `WatchCycleRun`, **không tạo bản lưu, không gọi LLM** | Chặn spam timeline (LLM không tất định) + chặn gợi ý đã Bỏ sinh lại mỗi 60s + cắt chi phí LLM |
| **I-4** | `Claim` có `trigger_context = manual_ingest` **không được** sinh `TimelineEntry` | Nhóm 2 cấm ghi; chỉ vòng quét (nhóm 5) được ghi |
| **I-5** | Công ty `is_watched = true` **không** sinh `Proposal` loại `timeline_entry` (vẫn sinh loại `field_update`) | Bật Đang theo dõi = uỷ quyền phần ghi tin cho hệ thống → tránh cùng một tin vào timeline hai lần |
| **I-6** | Tự đặt Việc tiếp theo **chỉ khi** `confidence ∈ {certain, likely}` **và** `signal_type ∈ {funding, leadership_hire}` **và** công ty có ≥1 cơ hội đang mở | "Phát hiện đáng chú ý" phải định nghĩa được mới test được. Tin mở rộng/tuyển dụng → đẩy sang hàng đợi |
| **I-7** | Không ghi đè `next_step_text` khi `next_step_source = human`, **kể cả đã quá hạn**. Trường hợp đó sinh `Proposal` thay vì tự ghi | Ô người gõ quá hạn là món nợ Sales đang giữ, không phải ô rác |
| **I-8** | Hoàn tác trả về **giá trị người-gõ gần nhất** (rỗng nếu chưa từng có), không phải giá trị máy đặt lần trước | Mục đích nút này là bảo vệ dữ liệu người, không phải làm lịch sử phiên bản |
| **I-9** | `next_step_due_date` lấy từ **bảng cấu hình `signal_type → số ngày`**, không do LLM chọn; giao diện hiện lý do | Ngày hạn cũng là một nhận định — không có nguồn thì không hiển thị |
| **I-10** | Một vòng quét đang chạy thì bỏ nhịp kế tiếp, ghi `skipped_reason` | Chu kỳ 60s + gọi LLM có thể tràn nhịp → ghi trùng, đếm sai |
| **I-11** | `Proposal` chỉ được đề xuất sửa ô trong whitelist: `industry`, `country`, `size`, `website`. **Cấm** `name`, `company_type` | `company_type` là đầu vào để đọc tín hiệu → sửa nó tạo vòng lặp tự tham chiếu |
| **I-12** | `decision = edit` đếm riêng, **không cộng vào** `accept` | T-5 |
| **I-13** | Xoá `TimelineEntry` do hệ thống thêm phải kèm lý do ngắn, ghi `AuditEvent` | Nhóm 5 không có thông báo → thao tác xoá là tín hiệu error-detection duy nhất |
| **I-14** | Nạp seed lại đưa **mọi công ty về bản chụp "trước"** và xoá sạch O/C/P/thông báo/nhật ký sinh trong demo | Giám khảo diễn lại kịch bản lần hai |

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
| **Error-detection rate** | `(reject[wrong_info] + reject[misread_context] + số lần Hoàn tác + số lần xoá mục hệ thống) / tổng output AI` | **Người** khôn lên |
| Tỉ lệ sửa-rồi-duyệt | `edit / tổng` | Tách bạch khỏi accept (I-12) |
| Phân bố lý do bỏ | đếm theo `reject_reason` | Sai ở đâu |
| Phân bố mức chắc chắn | đếm theo `confidence` | AI đang tự tin quá mức không |
| Thời gian quyết trung bình | trung vị `seconds_to_decide` | **Chỉ đọc cùng error-detection rate** — thấp có thể là giao diện tốt, cũng có thể là bấm mù |
| Tỉ lệ hoàn tác | `undone / tổng AutoNextStepEvent` | Vùng 3 có đáng tin không |

Mốc bắt đầu đo `seconds_to_decide`: **lúc mở màn hình hàng đợi** (gợi ý hiện đủ tại chỗ nên không có động tác "mở gợi ý").

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

Mười chỗ Specs mơ hồ hoặc tự mâu thuẫn, đã quyết xong (12/08). Mỗi ADR có ≥2 phương án bị loại kèm lý do — đọc ADR trước khi định làm khác:

| Mã | Diễn giải đã chốt | Ràng buộc | ADR |
| --- | --- | --- | --- |
| M-8 | Câu trích bắt buộc là chuỗi con nguyên văn, offset do code tính | I-2 | [0002](decisions/0002-cau-trich-phai-la-chuoi-con-nguyen-van-cua-ban-luu.md) |
| M-3+M-4 | "Nội dung mới" so bằng hash ở tầng `Observation`; chỉ tạo bản lưu khi hash khác | I-3 | [0003](decisions/0003-chi-tao-ban-luu-khi-noi-dung-thay-doi.md) |
| M-7 | Chặn cả 4 ranh giới ở hai lớp: `actor` tầng domain + ràng buộc CSDL | mục 5 | [0004](decisions/0004-chan-ranh-gioi-o-tang-domain-va-tang-csdl.md) |
| M-1 | "Phát hiện đáng chú ý" = `{certain, likely}` × `{funding, leadership_hire}` | I-6 | [0005](decisions/0005-tran-tu-chu-cua-viec-tu-dat-viec-tiep-theo.md) |
| M-2 | Ghi cho **mọi** cơ hội mở, mỗi cơ hội một `AutoNextStepEvent` | mục 3.3 | [0005](decisions/0005-tran-tu-chu-cua-viec-tu-dat-viec-tiep-theo.md) |
| M-6 | Không đè ô người gõ kể cả quá hạn → sinh `Proposal` thay vì tự ghi | I-7, I-8 | [0005](decisions/0005-tran-tu-chu-cua-viec-tu-dat-viec-tiep-theo.md) |
| M-5 | Bật Đang theo dõi = uỷ quyền ghi tin → không sinh `Proposal` loại `timeline_entry` | I-5 | [0006](decisions/0006-bat-dang-theo-doi-la-uy-quyen-phan-ghi-tin.md) |
| M-9 | Ba mức đều có câu trích; khác ở **khoảng cách suy luận**. `certain` do code cấp | mục 3.5 | [0007](decisions/0007-ba-muc-chac-chan-do-bang-khoang-cach-suy-luan.md) |
| M-11 | Bỏ = menu 5 lý do tại chỗ; "số thao tác" đọc là **số bước** | (giao diện) | [0008](decisions/0008-bo-goi-y-bang-menu-ly-do-tai-cho.md) |
| M-12 | Nút tắt chỉ dừng việc **sinh mới**; hành vi do người khởi xướng không bị tắt | mục 5 | [0009](decisions/0009-pham-vi-nut-tat-ai-chi-dung-sinh-moi.md) |

**Luật rút ra, dùng cho mọi chỗ mơ hồ còn lại:** cách đọc nào làm một điều khoản Specs trở nên vô nghĩa thì cách đọc đó sai. Dùng ở ADR-0003, 0007, 0009.

## 10. Checklist duyệt ontology

- [x] Mọi quan hệ đọc thành câu có nghĩa (mục 4)
- [x] Mọi dữ liệu AI tạo ra đã phân loại đúng Observation / Claim / Proposal (mục 3.2, 3.3)
- [x] Mọi Claim có đường về Observation gốc (I-1, I-2)
- [x] Vùng cấm liệt kê tường minh, có cách chặn hai lớp (mục 5)
- [x] Có chỗ ghi nhận accept/reject/edit trên từng Proposal (`ProposalDecision`)
- [x] 10 diễn giải ở mục 9 đã có ADR (0002–0009)
- [x] **Người (không phải AI) đã đọc và duyệt file này** — HungLV, 13/08/2026
- [x] Enum ở 3.5 đã ánh xạ vào code/CSDL thật — `packages/contracts/src/enums.ts` (16 enum) → `pgEnum` sinh thẳng từ đó, giữ bởi `ontology-enum-parity.test.ts` đọc chính file này
- [ ] Phần thực nghiệm còn nợ trong ADR-0002/0003/0007 đã chạy (một lần đo, ba ADR dùng chung) — **còn nợ**, trả trong phase nhóm 2 cùng nợ verify của [ADR-0014](decisions/0014-nhom-2-rut-phat-hien-bang-llm-that-code-kiem-cau-trich.md)

## Câu hỏi chưa giải quyết

- ~~Stack TBD → kiểu dữ liệu, biểu diễn enum, cơ chế ràng buộc lớp CSDL.~~ **Đã chốt 12/08:** stack Next.js + NestJS + Drizzle + Postgres; enum dùng `pgEnum` gốc, nguồn sự thật là một file trong `packages/contracts`; ràng buộc lớp CSDL dùng **hai role + GRANT theo cột**, không dùng trigger → [ADR-0010](decisions/0010-chan-tang-csdl-bang-hai-role-va-quyen-theo-cot.md).
- `source_tier` (tháp độ tin cậy 1–6) hiện luôn là "website công ty" → giữ trường nhưng chưa có tầng nào khác; bỏ hẳn hay giữ chỗ, chờ quyết.
- ~~Bản chụp là HTML hay text (Q-3 gửi BTC) → ảnh hưởng cách tính `quote_start`/`quote_end` (offset trên chuỗi nào).~~ **Đã chốt 12/08:** bản chụp lưu HTML; `Observation` giữ cả `raw_html` lẫn `raw_content` (text trích ra), offset và hash tính trên `raw_content`; giao diện hai tab *Văn bản* / *Bản gốc* → [ADR-0012](decisions/0012-ban-luu-giu-html-goc-va-text-trich-offset-tinh-tren-text.md).
- Chưa rõ Admin có được thao tác CRM không (Q-6) → chưa viết được ma trận quyền đầy đủ.

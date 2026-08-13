# ADR-0024 — Gợi ý sửa ô hồ sơ do LLM đề xuất, code giữ ba cửa chặn; bản chụp phải có khối dữ kiện để trích

| | |
| --- | --- |
| **Ngày** | 2026-08-13 20:51 |
| **Giai đoạn** | Design (phase 5 — nhóm 3 hàng đợi gợi ý) |
| **Trạng thái** | Chấp nhận |
| **Người quyết định** | HungLV |
| **Prompt log** | phiên brainstorm phase 5 ngày 13/08 20:51 — [báo cáo](../../plans/reports/from-brainstorm-to-planner-260813-2051-phase-05-nhom-3-hang-doi-goi-y-report.md) |

## Bối cảnh

Specs nhóm 3 đòi hai loại gợi ý, trong đó có *"điền hoặc sửa một ô còn trống hoặc đã cũ trong hồ sơ công ty"*. Đọc code thật thì **không có đường nào sinh nó mà không ghi dữ liệu sai**:

- `ClaimDraft` = `{statement, signalType, confidence, quoteText}` (`packages/contracts/src/dto/claim.ts`, `apps/api/src/ai/anthropic-claim-extractor.ts:41-46`) — **không có cặp (ô, giá trị)** ở bất kỳ đâu trong pipeline.
- Bản chụp (`apps/api/src/ai/demo-snapshots.ts`) **không có dòng dữ kiện hồ sơ nào** — không "Ngành:", "Trụ sở:", "Quy mô:", "Website:".
- Seed đã điền đủ `industry/country/size/website` cho 4/5 công ty; công ty duy nhất `website: null` là **Ohara — cố tình không đọc được** (`rawHtml: ''`, dùng để diễn `fetch_status = failed`).

Đường tắt duy nhất còn lại là suy từ claim sẵn có, và nó sai ngay ví dụ đầu tiên: claim Kitefin *"mở rộng sang thị trường Nhật Bản"* → `country = 'Nhật Bản'`, trong khi Kitefin trụ sở Hoa Kỳ. Đó là **một dòng dữ liệu sai**, tệ hơn một dòng để trống (luật 4 CLAUDE.md).

Cộng thêm I-5 (công ty `is_watched = true` không sinh `timeline_entry`) và 3/5 công ty seed đang watched: **không có `field_update` thì hàng đợi demo chỉ còn tối đa một thẻ**, từ Marlin — đúng công ty đứng đầu danh sách cắt của plan.

## Phương án đã cân nhắc

Tiêu chí so: *(1)* có sinh ra dòng dữ liệu sai được không · *(2)* bấm vào câu trích có highlight đúng đoạn nguồn không (luật 1) · *(3)* giám khảo diễn lại hai lần có ra cùng kết quả không · *(4)* phần "hiểu ngữ cảnh" có còn thuộc LLM không, hay code làm hết (rubric chấm AI-native).

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| **A+B kết hợp.** Bản chụp thêm **khối dữ kiện** để có gì mà trích → **LLM** đề xuất `fieldSuggestion {targetField, proposedValue}` (nhận thêm giá trị hiện tại của 4 ô để chỉ đề xuất khi trống/khác) → **code** giữ ba cửa chặn G1/G2/G3 | Phần phán đoán ("ô nào, cắt phần nào của dòng dữ kiện") thuộc LLM; phần bảo đảm thuộc code — cùng đường phân công của [ADR-0014](0014-nhom-2-rut-phat-hien-bang-llm-that-code-kiem-cau-trich.md). G2 làm mọi giá trị đều truy được về đoạn nguồn nguyên văn. G3 ép "chỉ ô trống hoặc đã cũ" bằng code, không tin LLM | Sửa 2 file của A + 1 dòng seed của C + prompt. LLM có thể trả 0 đề xuất ⇒ phải quan sát được | ✅ **Chọn** |
| B đơn thuần (chỉ LLM, không thêm khối dữ kiện) | Không đụng bản chụp | Không có dữ kiện trong nguồn thì mọi `proposedValue` đều **không thể** là chuỗi con của câu trích ⇒ G2 loại sạch, hoặc phải hạ G2 và mở đường cho dữ liệu bịa. Tiêu chí *(1)* trượt | ❌ Loại |
| A đơn thuần (chỉ parser tất định, không LLM) | Diễn lại 100% giống nhau; rẻ nhất về token | Việc "dòng nào ứng với ô nào" thành bảng ánh xạ cứng trong code ⇒ trượt tiêu chí *(4)*: đúng loại đường mà mục 8 CLAUDE.md gọi là ontology trang trí — AI không tham gia gì vào nhóm 3 | ❌ Loại — đội **đã bác khuyến nghị này của AI** |
| Cắt `field_update`, P5 chỉ làm `timeline_entry` | Rẻ nhất | Mất một gạch đầu dòng Specs, và cộng I-5 thì hàng đợi demo còn 1 thẻ từ công ty đứng đầu danh sách cắt | ❌ Loại |
| Lượt LLM thứ hai riêng trong `ProposalService` | Tách bạch trách nhiệm | Thêm một lần gọi LLM mỗi lần ingest (vòng quét 60s × 3 công ty), thêm một prompt phải bảo vệ ở vòng 2, mà vẫn phải gắn vào `claim_id` sẵn có | ❌ Loại — trả giá gấp đôi cho cùng kết quả |

## Quyết định

Chọn **A+B kết hợp**: *bản chụp có dữ kiện · LLM đề xuất · code chặn ba cửa.*

**Ba cửa chặn, code làm, không tin LLM:**

| Cửa | Nội dung | Không qua thì |
| --- | --- | --- |
| **G1** | `targetField ∈ {industry, country, size, website}` | từ chối ở service **và** CHECK CSDL — hai lớp, đã có sẵn |
| **G2** | `proposedValue` là **chuỗi con nguyên văn** của `quoteText`, mà `quoteText` đã qua I-2 ⇒ nguyên văn của `raw_content` | **bỏ `fieldSuggestion`, giữ claim** — claim vẫn có giá trị đọc độc lập. Đếm + log như `droppedNoVerbatimQuote` |
| **G3** | `currentValue` (code đọc từ hồ sơ) khác `proposedValue` sau trim | không sinh proposal. Đây là chỗ ép "chỉ ô trống hoặc đã cũ" |

Tiêu chí quyết là *(2)* và *(4)* đọc cùng nhau. G2 áp được cho **cả bốn ô không ngoại lệ** vì cả bốn đều là `text` tự do (`packages/db/src/schema/companies.ts:24-28`) — không có enum bucket nào buộc phải "chuẩn hoá" giá trị, tức **không có kẽ hở nào để trôi thành "gần đúng"**. Đây là điểm khác biệt thật giữa A+B và B đơn thuần: G2 chỉ là cửa chặn khả thi khi nguồn có dữ kiện để trích.

Hai điều ghim kèm:

1. **`impact_if_wrong` do code sinh theo bảng cố định theo `targetField`, không nhờ LLM.** Một dòng thật cho từng ô, ví dụ `country` → *"Sai quốc gia trụ sở thì bộ lọc theo thị trường trả danh sách sai, và người phụ trách thị trường nhận sai deal."* Đóng luôn rủi ro *"`impact_if_wrong` bị điền cho có"* mà phase file nêu: không còn ca chuỗi rỗng nào tồn tại được, và test khẳng định nội dung ổn định thay vì chỉ khẳng định độ dài.
2. **Yêu cầu dữ liệu, không phải yêu cầu code:** phải có **≥1 ô trống và ≥1 ô đã cũ trên công ty đang theo dõi**, để hàng đợi demo không phụ thuộc Marlin. Cụ thể: `size` của Sakura đổi ở bản `after` (ca "đã cũ" — Sakura watched nên đồng thời là bằng chứng I-5 vẫn cho `field_update`) + một công ty watched có `website: null` trong seed (ca "ô trống").

**Ranh giới claim** (mục 3 CLAUDE.md — *ghi chép 1-1 không phải claim*): cắt `"Trụ sở chính: Aichi, Nhật Bản"` thành `country = 'Nhật Bản'` **là biến đổi thông tin gốc** (chọn phần nào của chuỗi vị trí ứng với ô nào), nên gọi nó là claim là đúng ranh giới, không phải lách.

**`timeline_entry` khi được duyệt ghi `created_by = human`, `entry_type = note`** — vùng 2 là *người* ghi, nên mục đó **không** mang nhãn "do hệ thống thêm" (nhãn ấy thuộc vùng 4 / nhóm 5). Đây cũng là câu trả lời cho I-4: I-4 cấm **claim `manual_ingest` sinh `TimelineEntry`**, tức cấm máy tự ghi; người duyệt rồi ghi dưới danh nghĩa mình thì không nằm trong phạm vi I-4.

## Hệ quả

- Kéo theo: **B sửa 4 file của người khác** — `demo-snapshots.ts` + `anthropic-claim-extractor.ts` (A), `seed-data.ts` (C), `observation-service.ts` (A, 1 dòng) — cộng `contracts/dto/claim.ts` dùng chung. Ngoại lệ có ý thức với bảng chủ quyền, cùng loại tiền lệ [ADR-0021](0021-ban-chup-demo-giu-dang-hang-so-typescript-khong-tach-thanh-file-html.md). Làm **đầu phase**, thông báo trước, pull trước push, không refactor.
- Kéo theo: `ClaimDraft` có thêm một field **tuỳ chọn**. Claim không kèm `fieldSuggestion` vẫn hợp lệ y như cũ ⇒ không phá đường nhóm 2 đang xanh.
- Kéo theo: mỗi lần ingest có thêm một con số quan sát được (số `fieldSuggestion` bị G2/G3 loại), cùng họ với `droppedNoVerbatimQuote` của ADR-0014. **Không có con số này thì không biết prompt có đang làm việc hay không.**
- Đánh đổi chấp nhận: bản chụp demo được thêm khối dữ kiện *vì* tính năng cần nguồn để trích. Chấp nhận được vì trang giới thiệu công ty thật thường có khối dữ kiện đó; nếu bịa ra một định dạng không trang nào có thì mới là gian.
- Sẽ phải xem lại nếu: đo trên 5 công ty mà LLM trả **0** `fieldSuggestion`. Khi đó sửa **prompt**, hoặc rơi về parser tất định — **tuyệt đối không hạ G2**. *(Đã xảy ra ở dạng nhẹ hơn ngày 13/08: 2/3 đề xuất bị G2 loại vì model gắn sai chỗ. Sửa prompt, không chạm G2 — chi tiết ở mục "Đội đã verify".)*

## AI đã tham gia thế nào

- Vai trò AI: đọc chéo `ClaimDraft` + bản chụp + seed và chỉ ra rằng "claim mới → sinh `field_update`" **không có dữ liệu để chạy** — kèm ví dụ Kitefin cho thấy đường tắt duy nhất sẽ ghi sai `country`.
- **AI đề xuất gì mà đội không nghe:** AI khuyến nghị phương án **A đơn thuần** (parser tất định, không LLM) vì tất định thì T-4/T-5 diễn lại y nhau — lập luận đúng về độ tin cậy nhưng **bỏ qua rubric**: nó đẩy AI ra khỏi nhóm 3 hoàn toàn, để lại một bảng ánh xạ cứng. Đội chọn kết hợp: LLM giữ phần phán đoán, code giữ phần bảo đảm. Đây là chỗ AI tối ưu sai mục tiêu.
- **AI sai ở đâu:** chính AI viết `phase-05` với bước *"`ProposalService`: sinh từ claim"* như thể chỉ là nối dây, dù cùng lúc đó AI cũng viết `ClaimDraft` **không có** cặp (ô, giá trị). Hai file do cùng một tác nhân viết, mâu thuẫn không bị phát hiện cho tới khi đọc chéo có chủ đích.

## Đội đã verify bằng cách nào

**Đã làm** — đọc mã nguồn, ghi kèm vị trí để kiểm lại được:

1. **Đếm field của `ClaimDraft` ở cả ba nơi** (`contracts/dto/claim.ts`, `anthropic-claim-extractor.ts:41-46` zod schema, `claim-service.ts:81-91` hàng insert): không nơi nào có (ô, giá trị). Xác nhận đây là lỗ hổng thiết kế, không phải code chưa viết.
2. **Đọc toàn bộ 5 bản chụp** (`demo-snapshots.ts:47-137`) và grep `Ngành|Trụ sở|Quy mô|[Ww]ebsite|nhân viên`: **0 kết quả**. Không có dữ kiện nào để trích.
3. **Đối chiếu seed với whitelist I-11** (`seed-data.ts:41-100`): 4/5 công ty đã đủ 4 ô; công ty duy nhất `website: null` là Ohara, mà Ohara `rawHtml: ''` ở **cả hai** biến thể (`demo-snapshots.ts:134-137`) ⇒ ca "ô trống" hiện **không thể** chạm tới. Đây là bằng chứng cho yêu cầu dữ liệu ở mục Quyết định, không phải suy đoán.
4. **Kiểm G2 có khả thi cho cả 4 ô hay không bằng kiểu cột**, không bằng cảm giác: `companies.ts:24-28` — `industry` `country` `size` `website` đều `text`. Nếu `size` là enum bucket thì G2 sẽ cần ngoại lệ và cửa chặn mất giá trị; nó không phải enum, nên G2 tuyệt đối.
5. **Kiểm ví dụ sai bằng dữ liệu thật**: claim Kitefin từ `demo-snapshots.ts:98` (*"mở rộng sang thị trường Nhật Bản"*) đặt cạnh `seed-data.ts:65` (`country: 'Hoa Kỳ'`) ⇒ đường tắt sinh sai một dòng dữ liệu. Ca này có thật trong bộ demo, không phải giả thiết.

6. **Đo trên toàn bộ bộ demo qua stack thật** (13/08 22:05, 5 công ty × 2 biến thể, `pnpm seed` trước): hàng đợi ra **đúng 3 gợi ý**, mỗi công ty một thẻ — Sakura `size` `500-1000 → 1000+` (ca ô cũ, công ty **đang theo dõi** ⇒ I-5 chỉ chặn nhánh tin), Kitefin `website` `(trống) → https://kitefin.example.com` (ca ô trống, cũng đang theo dõi), Marlin một `timeline_entry` (không theo dõi). `impact_if_wrong` dài 77–113 ký tự trên cả ba, không có ô nào rỗng. **0 câu trích bị loại vì không nguyên văn.**
7. **Phép đo này tìm ra một lỗi thật**, không phải để xác nhận cái đã biết: Kitefin ra **hai thẻ y hệt nhau** (một từ bản trước, một từ bản sau — cùng dòng website, cùng ô trống). Luật chống sinh lại lúc đó chỉ chặn nội dung *đã quyết*, không chặn trùng *đang chờ*. Đã sửa: một gợi ý đang chờ **chặn** gợi ý cùng nội dung, bất kể bằng chứng mới cũ; và dedupe cả trong cùng một lượt. Có test 11 giữ chỗ này.

8. **Đo trên LLM thật — nợ ở trên đã trả, 13/08 22:32** (`claude-haiku-4-5-20251001`, key do HungLV cấp, `pnpm seed` trước mỗi lượt, 5 công ty × 2 biến thể = 10 lần đọc nguồn).

**Lượt 1 — G2 loại 2/3 đề xuất, và đó là lỗi prompt chứ không phải lỗi cửa chặn.** Hàng đợi chỉ ra **2** thẻ thay vì 3; Sakura mất thẻ `size`. Log chỉ đúng nguyên nhân: `Bỏ đề xuất ô size: "1000+" không có nguyên văn trong câu trích`. Đọc claim thật thì thấy model gắn `fieldSuggestion` vào **phát hiện sai** — nó chỉ sinh một claim (tin gọi vốn, câu trích là câu tin) rồi treo đề xuất `size` lên đó. `1000+` không có trong câu tin ⇒ G2 loại, **đúng**. Kitefin cũng vậy ở bản `before` (đề xuất `website` treo trên câu trích `Trụ sở chính: Boston, Hoa Kỳ`), nhưng ở bản `after` model làm đúng — nên đây là lỗi *mơ hồ trong prompt*, không phải model không làm nổi.

**Sửa prompt, không hạ G2** (đúng điều mục "Sẽ phải xem lại nếu" đã dặn): thêm một câu bắt buộc — *mỗi đề xuất phải nằm trên một phát hiện RIÊNG, `quoteText` của chính phát hiện đó phải là dòng dữ kiện chứa giá trị* — kèm một ví dụ ĐÚNG và một ví dụ SAI trong system prompt.

**Lượt 2 và lượt 3 (sau khi sửa prompt): G2 loại 0/3, hàng đợi ra đúng 3 thẻ, hai lượt giống nhau từng dòng** — Sakura `size 500-1000 → 1000+` (Chắc) · Kitefin `website (trống) → https://kitefin.example.com` (Chắc) · Marlin một mục dòng thời gian (Chắc). `impact_if_wrong` 77–113 ký tự. **0 câu trích bị loại vì không nguyên văn** ở cả ba lượt.

Hai thứ đo được thêm, không phải mục tiêu ban đầu:
- **Bộ chặn trùng cắn với LLM thật:** Kitefin bản `after` đề xuất lại đúng dòng website ⇒ `1 bỏ vì trùng gợi ý đang chờ`. Lỗi ở mục 7 nếu chưa sửa sẽ hiện ra ngay trên LLM thật, không chỉ trên đường tất định.
- **I-5 đếm được:** Nimbus 2 · Sakura 1 · Kitefin 1 phát hiện bị chặn không thành `timeline_entry` vì công ty đang theo dõi. Trước đây chỉ có test khẳng định; giờ có số trên bộ demo.

**Chưa làm — điểm yếu còn lại:** mẫu vẫn nhỏ (3 lượt × 10 lần đọc, một model). Đổi model hoặc bản chụp dài hơn thì **đo lại**, và chỉ số có sẵn trong mọi response nên đo lại là chuyện chạy một lệnh. Cũng chưa có Sales thật bấm thử hàng đợi — nợ này thuộc [ADR-0008](0008-bo-goi-y-bang-menu-ly-do-tai-cho.md).

## Rollback

Ba mức, đắt dần:

1. G2/G3 là hai hàm thuần ⇒ sửa ngưỡng/tắt nhánh trong vài phút, không đụng dữ liệu.
2. LLM trả 0 đề xuất ⇒ rơi về parser tất định trên đúng khối dữ kiện vừa thêm (~30'), vì nguồn đã có định dạng để parse. **Đây là lý do khối dữ kiện đáng thêm dù chọn nhánh LLM.**
3. Cắt hẳn `field_update` ⇒ mất một gạch đầu dòng Specs và hàng đợi còn 1 thẻ. Chỉ làm nếu tới trưa 14/08 vẫn đỏ.

Khối dữ kiện trong bản chụp và dòng seed thì **không rollback**: chúng làm dữ liệu demo đúng hơn ở cả hai nhánh.

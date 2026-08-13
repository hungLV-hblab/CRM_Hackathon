# ADR-0014 — Nhóm 2 rút phát hiện bằng LLM thật; câu trích do code kiểm là chuỗi con, không khớp thì bỏ claim

| | |
| --- | --- |
| **Ngày** | 2026-08-13 01:20 |
| **Giai đoạn** | Design |
| **Trạng thái** | Chấp nhận — 2/3 phép đo đã trả 13/08; **còn nợ phép đo gọi LLM thật** (chưa có API key) |
| **Người quyết định** | HungLV |
| **Prompt log** | *không có* — chốt trong phiên rà soát trạng thái 13/08, ba phương án do AI trình bày |

## Bối cảnh

Nhóm 2 là nền của nhóm 3, 4, 5: không có `Claim` thì không có gợi ý, không có tự đặt Việc tiếp theo, không có mục dòng thời gian tự thêm. Port `ClaimExtractor` đã dựng từ skeleton (`packages/contracts/src/ports/claim-extractor.ts`) nhưng **chưa có adapter nào** — skeleton cố ý không ship.

Hai ràng buộc siết cùng lúc. Specs nhóm 2 đòi "cùng một loại tin mang nghĩa khác nhau tuỳ loại công ty" — câu nhận định phải cho thấy tín hiệu đã được đọc dưới góc `company_type` nào. Đồng thời CLAUDE.md luật 1 và ADR-0002 đòi mọi phát hiện phải trỏ về **câu trích nguyên văn** trong bản lưu.

## Phương án đã cân nhắc

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| A. LLM thật sinh `ClaimDraft`; code kiểm câu trích là chuỗi con của `raw_content` và **tự tính** offset. Test cắm `FixtureClaimExtractor` qua cùng port | Làm được đúng phần Specs đòi (đọc dưới góc `company_type`); lõi nghiệp vụ có AI thật; test vẫn tất định nhờ port | Cần API key lúc demo; latency vào trong nhịp vòng quét; output không tất định | ✅ **Chọn** |
| B. Bộ trích xuất tất định (keyword/regex theo `signal_type`) | Nhanh, offline, test dễ, không tốn API | Sản phẩm gọi là AI-native mà lõi không có AI — đúng cạm bẫy rubric đã nêu tên. Câu nhận định "dưới góc loại công ty" sẽ là template điền chỗ trống, vòng 2 hỏi một câu là lộ | ❌ Loại |
| C. Chia đường: LLM khi Sales bấm ingest, tất định trong vòng quét | Giảm cost và latency ở nhịp 60s | Chỗ AI **tự chủ cao nhất** (vùng 4, T-8) lại là chỗ **ít AI nhất**. Không bảo vệ được ở vòng 2, và làm hai đường sinh claim khác chất lượng trong cùng một sản phẩm | ❌ Loại |

## Quyết định

Chọn **A**. Tiêu chí so: chỗ nào Specs đòi *hiểu ngữ cảnh* thì phải là LLM; chỗ nào đòi *bảo đảm* thì phải là code. Tách đúng theo lằn đó:

| Việc | Ai làm |
| --- | --- |
| `statement`, `signal_type`, `confidence`, chọn đoạn nào để trích | LLM |
| Kiểm `quoteText` là chuỗi con nguyên văn của `raw_content` | **Code** |
| Tính `quote_start` / `quote_end` | **Code** — không bao giờ nhận từ LLM (đã ghi trong port) |
| Từ chối claim không có câu trích | **Code** + ràng buộc CSDL (I-1) |

Câu trích không kiểm được → **bỏ claim đó**, không sửa cho gần giống, không hạ `confidence` để giữ lại. CLAUDE.md luật 4: một dòng sai tệ hơn một dòng để trống.

Model mặc định `claude-sonnet-5`, đặt qua biến môi trường cùng `ANTHROPIC_API_KEY` (`.env.example` đã có sẵn key).

## Hệ quả

- Kéo theo: `AnthropicClaimExtractor` và `FixtureClaimExtractor` cùng cắm vào `CLAIM_EXTRACTOR`. Test **không bao giờ** gọi mạng; bộ nghiệm thu 10 điểm chạy được khi không có API key.
- Kéo theo: vòng quét gọi LLM nên một nhịp có thể dài hơn `watch_cycle_seconds`. Không cần cơ chế mới — ADR-0011 đã có luật "vòng trước chưa xong thì bỏ nhịp và ghi `skipped_reason`".
- Kéo theo: tỉ lệ claim bị bỏ vì câu trích không khớp là **một chỉ số phải đo được**, không phải lỗi im lặng. Nó là bằng chứng cho luật 1 đang hoạt động.
- Đánh đổi chấp nhận: demo phụ thuộc API key và mạng. Đường lùi ở mục Rollback.
- Sẽ phải xem lại nếu: tỉ lệ câu trích không khớp cao tới mức nhóm 3/4/5 không có nguyên liệu — lúc đó vấn đề là prompt, sửa prompt trước, **không** hạ chuẩn kiểm chuỗi con.

## AI đã tham gia thế nào

- Vai trò AI: trình bày ba phương án kèm nhược điểm của từng cái, khuyến nghị A.
- AI đề xuất gì mà đội **không** nghe: phương án C (chia đường) do AI nêu như một cách giảm cost — người quyết định loại, vì nó đặt phần ít AI nhất vào đúng chỗ tự chủ cao nhất.
- AI sai ở đâu: chưa rõ. Rủi ro đã biết của phương án A là LLM diễn giải lại câu trích thay vì trích nguyên văn — đây là lý do port cố ý **không** có trường offset, và là chỗ phải đo trước khi tin.

## Đội đã verify bằng cách nào

Hẹn ba phép đo. **Hai đã trả ngày 13/08, phép thứ ba còn nợ và nợ vì một lý do cụ thể, không phải vì quên.**

**1 · Test câu trích diễn giải — ĐÃ TRẢ.** `reading-zone-provenance.test.ts` khẳng định 1: cắm adapter trả `quoteText` là một câu paraphrase (mọi chữ đều có trong nguồn, **thứ tự** thì không) → `claimsSaved = 0`, `claimsDroppedNoVerbatimQuote = 1`, bảng `claims` rỗng. Bản lưu **vẫn** được ghi (khẳng định 2): đã đọc nguồn là một sự thật, chỉ phát hiện là bị bỏ.

**2 · Phép đo đột biến — ĐÃ TRẢ.** Đổi dòng kiểm thành "không tìm thấy thì lấy offset 0 → độ dài câu trích" (đúng kiểu một người sẽ *nới* thay vì *bỏ*):

```ts
const span = locateVerbatimQuote(rawContent, draft.quoteText) ?? { quoteStart: 0, quoteEnd: draft.quoteText.length }
```

→ khẳng định 1 **đỏ**: `expected 1 to be +0`. Khôi phục → 15/15 xanh. Việc kiểm có răng.

**3 · Chạy thật với API key — CÒN NỢ.** `ANTHROPIC_API_KEY` trong `.env` là dòng rỗng (độ dài 0), nên không chạy được. Đây là chỗ đáng nói thẳng:

- Toàn bộ nhóm 2 hiện chạy trên `FixtureClaimExtractor`. Adapter đó **không phải mock**: nó đọc bản chụp thật và trả về chuỗi con nguyên văn thật, nên nó đi qua đúng những cửa kiểm I-1/I-2 mà LLM phải đi qua. Cái nó **không** kiểm được là câu hỏi duy nhất mà phép đo 3 tồn tại để trả lời: **LLM thật trả nguyên văn bao nhiêu phần trăm số lần.**
- Rủi ro ghi ở plan vẫn nguyên: nếu tỉ lệ paraphrase cao thì nhóm 3/4/5 thiếu nguyên liệu, và ta chỉ biết khi gọi thật. Fixture 100% xanh **không** làm rủi ro đó nhỏ đi, chỉ đẩy nó sang muộn hơn.
- Khi có key: chạy `POST /companies/:id/observations` cho cả bốn công ty, đối chiếu tay từng `quote_text` với `raw_content`, ghi vào đây ba con số — số draft, số bị bỏ vì không nguyên văn, số bị hạ khỏi mức Chắc. Cả ba đã có sẵn trong response `IngestResultDto` nên không phải dựng thêm gì để đo.
- **Cửa chặn:** phép đo này phải xong **trước khi P5/P6 bắt đầu**, đúng như bảng rủi ro của plan. Nếu tới lúc đó vẫn không có key thì đó là một quyết định phải ghi ADR, không phải im lặng bỏ qua.

**Ngoài ba phép đo, phát sinh thêm một cửa kiểm không có trong ADR này.** ADR-0007 đòi mức `certain` có cửa kiểm bằng máy; nó nằm ở `ClaimService.gateCertainty` và có hai khẳng định (11, 12): statement chứa "35 triệu" mà câu trích chỉ có "20 triệu USD" → hạ xuống `likely`; statement mà mọi con số đều có trong câu trích → giữ `certain`.

## Rollback

Nếu API gãy hoặc quá chậm giữa ngày thi: cắm `FixtureClaimExtractor` (đã có sẵn cho test) vào chính đường chạy thật, dùng bộ bản chụp seed. **~10 phút**, đổi một dòng cấu hình provider. Demo vẫn chạy đủ nhóm 2–5, nhưng phải nói thẳng với BGK là đang chạy bằng fixture — không được để BGK tưởng là LLM.

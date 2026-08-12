# ADR-0014 — Nhóm 2 rút phát hiện bằng LLM thật; câu trích do code kiểm là chuỗi con, không khớp thì bỏ claim

| | |
| --- | --- |
| **Ngày** | 2026-08-13 01:20 |
| **Giai đoạn** | Design |
| **Trạng thái** | Chấp nhận |
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

**Chưa verify — nợ verify, phải trả trong phase nhóm 2, ghi lại ngay tại mục này.** Hẹn ba phép đo, không được bỏ phép nào:

1. **Test câu trích diễn giải:** cắm adapter trả về `quoteText` là một câu **paraphrase** (không phải chuỗi con) → phải bị từ chối, không lưu. Đây là T-2 mở rộng.
2. **Phép đo đột biến:** xoá dòng kiểm chuỗi con → test 1 phải **đỏ**. Nếu vẫn xanh thì việc kiểm là trang trí (đúng lỗi kiểu ADR-0004 đã bắt được ngày 12/08).
3. **Chạy thật một lần với API key** trên một bản chụp, rồi **đối chiếu tay từng câu trích** với `raw_content` để biết LLM trả nguyên văn hay diễn giải, và ghi con số vào đây.

Không được ghi "đọc thấy hợp lý". Chưa có ba con số này thì nhóm 2 chưa xong.

## Rollback

Nếu API gãy hoặc quá chậm giữa ngày thi: cắm `FixtureClaimExtractor` (đã có sẵn cho test) vào chính đường chạy thật, dùng bộ bản chụp seed. **~10 phút**, đổi một dòng cấu hình provider. Demo vẫn chạy đủ nhóm 2–5, nhưng phải nói thẳng với BGK là đang chạy bằng fixture — không được để BGK tưởng là LLM.

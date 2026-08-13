# ADR-0014 — Nhóm 2 rút phát hiện bằng LLM thật; câu trích do code kiểm là chuỗi con, không khớp thì bỏ claim

| | |
| --- | --- |
| **Ngày** | 2026-08-13 01:20 |
| **Giai đoạn** | Design |
| **Trạng thái** | Chấp nhận — **3/3 phép đo đã trả** (phép đo 3 chạy 13/08 11:28 với `claude-haiku-4-5`) |
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

Hẹn ba phép đo. **Cả ba đã trả ngày 13/08.**

**1 · Test câu trích diễn giải — ĐÃ TRẢ.** `reading-zone-provenance.test.ts` khẳng định 1: cắm adapter trả `quoteText` là một câu paraphrase (mọi chữ đều có trong nguồn, **thứ tự** thì không) → `claimsSaved = 0`, `claimsDroppedNoVerbatimQuote = 1`, bảng `claims` rỗng. Bản lưu **vẫn** được ghi (khẳng định 2): đã đọc nguồn là một sự thật, chỉ phát hiện là bị bỏ.

**2 · Phép đo đột biến — ĐÃ TRẢ.** Đổi dòng kiểm thành "không tìm thấy thì lấy offset 0 → độ dài câu trích" (đúng kiểu một người sẽ *nới* thay vì *bỏ*):

```ts
const span = locateVerbatimQuote(rawContent, draft.quoteText) ?? { quoteStart: 0, quoteEnd: draft.quoteText.length }
```

→ khẳng định 1 **đỏ**: `expected 1 to be +0`. Khôi phục → 15/15 xanh. Việc kiểm có răng.

**3 · Chạy thật với API key — ĐÃ TRẢ 13/08 11:28.** Model `claude-haiku-4-5-20251001` (không phải `claude-sonnet-5` mặc định — người vận hành chọn qua `ANTHROPIC_MODEL`). Chạy `POST /companies/:id/observations` cho **4 công ty × 2 bản chụp = 8 lượt đọc**, trong đó 2 lượt là nguồn lỗi (`fetch_status = failed`, đúng thiết kế). Ba con số:

| Chỉ số | Vòng 1 (prompt cũ) | Vòng 2 (prompt đã sửa) | Cộng |
| --- | --- | --- | --- |
| Draft LLM đề xuất | 5 | 6 | **11** |
| Bị bỏ vì câu trích không nguyên văn | **0** | **0** | **0 (0%)** |
| Bị hạ khỏi mức Chắc | 2 | 5 | 7 |
| Lưu được | 5 | 6 | 11 |

**Đối chiếu độc lập, không tin vào chính đường code đã lưu.** Truy SQL thẳng trên CSDL, không qua service:

```sql
SELECT count(*) FILTER (WHERE position(c.quote_text in o.raw_content) > 0) AS verbatim,
       count(*) FILTER (WHERE substring(o.raw_content from c.quote_start+1
                                for c.quote_end-c.quote_start) = c.quote_text) AS offsets_exact,
       count(*) FROM claims c JOIN observations o ON o.id = c.observation_id;
```

→ `6 | 6 | 6`. Mọi câu trích là chuỗi con thật, **và** offset lưu trong CSDL cắt lại ra đúng chuỗi đó — nghĩa là chỗ Sales bấm vào sẽ highlight đúng đoạn, không lệch.

**Rủi ro số 1 của plan không xảy ra trên bộ dữ liệu này: 0/11 draft bị bỏ vì diễn giải.** Nói cho đúng mức: 11 draft, một ngôn ngữ, trang ngắn, một model. Đủ để P5/P6 khởi động, **không** đủ để kết luận "LLM luôn trích nguyên văn". Nếu đổi model hoặc bản chụp dài hơn thì đo lại — chỉ số `claimsDroppedNoVerbatimQuote` đã có sẵn trong mọi response nên đo lại là miễn phí.

**Phép đo bắt được hai lỗi mà fixture không thể bắt.** Đây là lý do phép đo này tồn tại:

1. **Key không bao giờ tới được container.** `infra/docker-compose.yml` không truyền `ANTHROPIC_API_KEY` vào `api` và `worker`. `.env` có key mà log khởi động vẫn báo `ANTHROPIC_API_KEY trống → dùng FixtureClaimExtractor`. Đúng cái kịch bản `claim-extractor.provider.ts` đã cảnh báo bằng chữ: *"a demo can silently run on the fixture while the team claims a real LLM"* — cảnh báo đó viết ra rồi vẫn xảy ra thật, vì nó ở tầng ứng dụng còn lỗ ở tầng compose. Đã thêm anchor `x-llm-access` cho cả hai service, để `:-` chứ không `:?` vì bộ nghiệm thu phải chạy được khi giám khảo không có key.
2. **LLM trả `statement` bằng tiếng Anh.** Nguồn tiếng Việt, prompt tiếng Việt, nhưng câu nhận định đầu tiên về Sakura trả về *"Sakura Manufacturing KK operates three assembly lines at their Aichi factory"*. Sales đọc tiếng Việt (CLAUDE.md mục 6). Prompt chưa bao giờ **nói** ra điều đó, chỉ ngầm định. Đã thêm luật ngôn ngữ vào `SYSTEM_PROMPT` — statement tiếng Việt, câu trích giữ nguyên ngôn ngữ nguồn vì nó phải khớp từng ký tự. Vòng 2 sau khi sửa: 6/6 statement tiếng Việt.

**Phát hiện thứ ba, chưa sửa, cần người quyết định: cửa kiểm mức Chắc gần như không cho ai đi qua.** 5/6 claim vòng 2 bị hạ, và **cả 5 đều vì đúng một nguyên nhân** — model viết đủ tên công ty trong statement còn bản chụp gọi tên tắt. Log không giấu:

```
Hạ mức Chắc → Có thể: "Manufacturing, KK" không có trong câu trích
Hạ mức Chắc → Có thể: "Cloud, Solutions" không có trong câu trích
Hạ mức Chắc → Có thể: "Analytics" không có trong câu trích
```

Không có lần nào model bịa số hay bịa tên riêng — thứ mà `gateCertainty` của ADR-0007 sinh ra để bắt. Hệ quả: ba mức tin cậy mà Specs nhóm 2 đòi hiển thị thì trên thực tế chỉ còn hai, và mức Chắc gần như tuyệt chủng vì một lý do không liên quan gì tới độ tin cậy. Xem [ADR-0018](0018-cua-kiem-muc-chac-bo-qua-ten-cua-chinh-cong-ty-dang-doc.md).

**Ngoài ba phép đo, phát sinh thêm một cửa kiểm không có trong ADR này.** ADR-0007 đòi mức `certain` có cửa kiểm bằng máy; nó nằm ở `ClaimService.gateCertainty` và có hai khẳng định (11, 12): statement chứa "35 triệu" mà câu trích chỉ có "20 triệu USD" → hạ xuống `likely`; statement mà mọi con số đều có trong câu trích → giữ `certain`.

## Rollback

Nếu API gãy hoặc quá chậm giữa ngày thi: cắm `FixtureClaimExtractor` (đã có sẵn cho test) vào chính đường chạy thật, dùng bộ bản chụp seed. **~10 phút**, đổi một dòng cấu hình provider. Demo vẫn chạy đủ nhóm 2–5, nhưng phải nói thẳng với BGK là đang chạy bằng fixture — không được để BGK tưởng là LLM.

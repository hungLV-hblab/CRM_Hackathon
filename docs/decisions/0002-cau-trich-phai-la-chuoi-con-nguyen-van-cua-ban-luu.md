# ADR-0002 — Câu trích của phát hiện phải là chuỗi con nguyên văn của bản lưu, vị trí do code tính

| | |
| --- | --- |
| **Ngày** | 2026-08-12 18:07 |
| **Giai đoạn** | Requirement (diễn giải chỗ mơ hồ trong Specs) |
| **Trạng thái** | Chấp nhận |
| **Người quyết định** | HungLV |
| **Prompt log** | [ai-sessions/260812-1742-req-phan-bien-de-bai-ai-native-crm.md](../ai-sessions/260812-1742-req-phan-bien-de-bai-ai-native-crm.md) — chất vấn CT-14, mơ hồ M-8 |

## Bối cảnh

Specs nhóm 2 nói *"Không lưu được một phát hiện không có câu trích"* và T-2 kiểm đúng câu đó: thử ghi thẳng một phát hiện **thiếu** câu trích, phải bị từ chối. Nhưng lỗi thật của LLM không phải bỏ trống trường — nó **diễn đạt lại**: bản lưu viết `closed a Series B round`, LLM trả về `raised Series B funding`. Trường không rỗng → qua T-2 → nhưng T-3 đòi *"mở đúng đoạn văn gốc trong bản lưu, có đánh dấu vị trí"* thì không đánh dấu được, vì chuỗi đó không tồn tại trong bản lưu.

Specs không nói câu trích phải nguyên văn tới mức nào, cũng không nói ai tính vị trí. Đây là chỗ luật số 1 của [CLAUDE.md](../../CLAUDE.md) ("không có provenance thì không hiển thị") sống hoặc chết.

## Phương án đã cân nhắc

Tiêu chí so: *(1)* có làm T-3 chạy được không · *(2)* lỗi có bị phát hiện tự động hay lọt âm thầm · *(3)* có tham số nào phải giải trình trước BGK không · *(4)* chi phí cài đặt.

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| **A.** Bản lưu chuẩn hoá một lần lúc ingest (Unicode NFC + chuẩn hoá xuống dòng), rồi `quote_text` phải là **chuỗi con exact** của chuỗi đã lưu; `quote_start`/`quote_end` do code `indexOf` ra. Không khớp → từ chối cả phát hiện | T-3 chạy được theo định nghĩa; lỗi lộ ngay tại chỗ ghi; không có ngưỡng nào phải bào chữa; cài đặt vài dòng | Mất một số phát hiện đúng nội dung nhưng LLM lỡ diễn đạt lại | ✅ **Chọn** |
| **B.** Tin trường `quote_text` LLM trả về, chỉ kiểm khác rỗng | Rẻ nhất, không mất phát hiện nào | Qua T-2 nhưng **hỏng T-3**. Provenance giả: giao diện vẫn hiện "câu trích" mà bấm vào không tới đâu — đúng thứ tệ hơn không có tính năng (domain doc mục 8) | ❌ Loại — vi phạm luật 1, và lỗi lọt âm thầm |
| **C.** Nhận luôn `quote_start`/`quote_end` do LLM khai | Không cần tìm kiếm chuỗi | LLM đếm ký tự sai là chuyện thường, càng sai với văn bản JP; highlight lệch vài chục ký tự trông như hệ thống bịa; **không có cách nào phát hiện tự động** vì offset nào cũng là số hợp lệ | ❌ Loại — biến một lỗi kiểm được thành lỗi không kiểm được |
| **D.** So khớp mờ (bỏ dấu câu, hạ chữ thường, độ tương đồng ≥ ngưỡng) rồi lấy đoạn gần nhất | Cứu được phát hiện mà LLM diễn đạt lại | Ngưỡng là con số không giải trình được — vòng 2 hỏi "vì sao 0.85" thì không có câu trả lời. Và "gần đúng" ở chỗ provenance chính là thứ luật 1 cấm: người dùng đọc câu highlight khác câu hệ thống hiện | ❌ Loại — đổi một ràng buộc cứng lấy một tham số tuỳ tiện |

## Quyết định

Chọn **A**. Tiêu chí quyết định là *(2)* và *(3)*: A là phương án duy nhất mà **một câu trích sai bị chặn ngay tại chỗ ghi thay vì lộ ra trước mặt giám khảo**, và là phương án duy nhất không đưa vào hệ thống một con số ngưỡng mà đội không bảo vệ được ở vòng 2.

Chi tiết chốt kèm:

- Chuẩn hoá **chỉ** ở mức Unicode NFC + xuống dòng, làm **một lần lúc ingest**, và `Observation.raw_content` lưu chính chuỗi đã chuẩn hoá. Mọi offset tính trên chuỗi đó. Không chuẩn hoá lúc so khớp — nếu không thì offset trỏ về một chuỗi khác với chuỗi đang hiển thị.
- LLM trả câu trích không khớp → **thử lại đúng một lần** với chỉ dẫn "chép nguyên văn, không diễn đạt lại". Vẫn không khớp → bỏ phát hiện đó, ghi nhận vào bộ đếm.
- Số lần từ chối vì câu trích không khớp là **một chỉ số**, không phải log rác: nó đo mức độ LLM bịa và là nguyên liệu cho error-detection rate.

Ghi vào [ontology.md](../ontology.md) là bất biến **I-2**.

## Hệ quả

- Kéo theo: `Observation.raw_content` là chuỗi đã chuẩn hoá (không phải HTML thô — nếu BTC phát HTML thì lưu thêm bản gốc riêng, xem câu hỏi Q-3). Tầng ingest phải có bước chuẩn hoá trước khi hash (liên quan [ADR-0003](0003-chi-tao-ban-luu-khi-noi-dung-thay-doi.md)).
- Kéo theo: đội **tự thêm test T-2b** ngoài 10 test BTC yêu cầu — thử ghi một phát hiện có câu trích bịa, phải bị từ chối. Đây cũng là một điểm để nói ở vòng 2.
- Đánh đổi chấp nhận: mất một phần phát hiện đúng nội dung. Chấp nhận được vì *một dòng dữ liệu sai tệ hơn một dòng để trống* — và ở đây "để trống" nghĩa là phát hiện không xuất hiện, không phải hồ sơ sai.
- Sẽ phải xem lại nếu: đo thực nghiệm cho thấy tỉ lệ từ chối > 30% sau khi đã thử lại một lần. Khi đó **sửa prompt hoặc đổi model, không hạ ràng buộc**.

## AI đã tham gia thế nào

- Vai trò AI: đóng persona **Tester/BA khó tính** trong phiên phản biện 17:42, tự tìm ra lỗ hổng này (CT-14) từ việc đối chiếu T-2 với T-3.
- **AI sai ở đâu:** ở phiên trước đó (17:28, index đề bài vào context), chính AI đã đọc nhóm 2 và tóm tắt "phát hiện có câu trích và vị trí" như một yêu cầu đã đủ rõ, **không nhận ra T-2 không phủ được trường hợp paraphrase**. Chỉ tới khi bị ép đóng persona đối kháng mới lộ. Bài học ghi lại: đọc Specs xuôi chiều không tìm ra lỗ; phải đọc từ phía "test này bỏ sót cái gì".
- AI đề xuất gì mà đội không nghe: AI có nêu phương án D (so khớp mờ) như một đường lui nếu tỉ lệ từ chối cao — đội **không** đưa vào ngay, chỉ giữ làm phương án dự phòng có điều kiện, vì không muốn có tham số ngưỡng trong đường provenance.

## Đội đã verify bằng cách nào

**Đã làm:**

1. **Suy dẫn cơ học từ chính bộ nghiệm thu.** T-3 đòi "đánh dấu vị trí" trong bản lưu. Đánh dấu vị trí cần một cặp offset. Offset chỉ tồn tại khi chuỗi có mặt trong bản lưu. Vậy "câu trích nguyên văn" không phải lựa chọn thiết kế mà là **điều kiện cần để T-3 chạy được** — kết luận này rút từ văn bản Specs, không phải từ cảm tính.
2. **Đối chiếu chéo ba tài liệu:** Specs nhóm 2 ("không câu trích thì không lưu") · [sales-ito-crm-domain.md](../sales-ito-crm-domain.md) mục 4.1 ("nếu không nêu được nguồn, insight vẫn chỉ là giả thuyết") · mục 8 nguyên tắc 1 ("máy nói thế không phải là bằng chứng"). Ba nguồn độc lập cùng chỉ về ràng buộc nguyên văn.

**Chưa làm — việc phải làm trước khi code nhóm 3:** chưa chạy LLM thật trên bản chụp để **đo tỉ lệ paraphrase**. Kế hoạch: khi có bản chụp (BTC phát 15/08 hoặc data đội tự chuẩn bị), chạy rút phát hiện 20 lượt, đếm số lượt `quote_text` không khớp exact. Con số đó quyết định có cần sửa prompt hay không, và là dữ liệu trả lời vòng 2. Người làm: HungLV.

## Rollback

Rẻ. Ràng buộc nằm gọn trong một hàm kiểm ở tầng ingest (`Claim` được tạo ở đúng một chỗ). Gỡ hoặc nới thành phương án D mất ~15 phút. Rủi ro khi rollback là dữ liệu đã sinh trước đó vẫn hợp lệ, không phải migrate.

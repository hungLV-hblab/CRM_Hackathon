# ADR-0012 — Bản lưu giữ cả HTML gốc và text trích ra; offset câu trích và hash tính trên text

| | |
| --- | --- |
| **Ngày** | 2026-08-12 22:55 |
| **Giai đoạn** | Design |
| **Trạng thái** | Chấp nhận |
| **Người quyết định** | HungLV |
| **Prompt log** | *không có* — quyết định chốt trực tiếp trong phiên làm việc 12/08 tối, khi trả lời câu hỏi Q-3 còn treo ở [ontology.md](../ontology.md) |

## Bối cảnh

Q-3 ("bản chụp là HTML hay text") treo từ 12/08 và chặn hai thứ đã chốt: [ADR-0002](0002-cau-trich-phai-la-chuoi-con-nguyen-van-cua-ban-luu.md) đòi `quote_text` là chuỗi con nguyên văn của bản lưu với offset do code tính, [ADR-0003](0003-chi-tao-ban-luu-khi-noi-dung-thay-doi.md) đòi hash trên "chuỗi đã chuẩn hoá". Cả hai đều nói *"chuỗi"* mà chưa nói **chuỗi nào**.

Chốt: bản chụp lưu **HTML**. Câu trả lời đó xong việc lưu, nhưng đẻ ra câu hỏi thật: offset và hash tính trên HTML hay trên text trích ra? Hai lựa chọn này không tương đương — một trong hai làm hỏng lặng lẽ cả I-2 lẫn I-3.

## Phương án đã cân nhắc

Tiêu chí so: *(1)* I-2 có từ chối đúng cái đáng từ chối không · *(2)* I-3 có chặn được vòng quét sinh trùng không · *(3)* T-3 highlight có đúng vị trí không · *(4)* chi phí cài đặt trước feature freeze tối 14/08.

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| **A.** `raw_html` giữ nguyên bản; `raw_content` = text trích ra + chuẩn hoá NFC/xuống dòng. **Offset và `content_hash` tính trên `raw_content`.** Giao diện hai tab: *Văn bản* (highlight thật) · *Bản gốc* (render HTML, không highlight) | I-2 chỉ từ chối đúng trường hợp LLM diễn đạt lại. I-3 miễn nhiễm với markup động. Highlight khớp tuyệt đối vì offset và chuỗi hiển thị là một. Vẫn giữ được bản gốc làm chứng cứ và để tái xử lý | Thêm một cột, một bước trích, một tab. Tab *Bản gốc* không highlight được | ✅ **Chọn** |
| **B.** Chỉ lưu HTML, offset và hash tính thẳng trên HTML | Một cột, không cần bước trích | **Hỏng I-2 có chọn lọc.** LLM đọc văn bản đã render; câu bắc qua thẻ (`Kanzaki <b>Holdings</b> hoàn tất vòng Series A`) không phải chuỗi con của HTML → `indexOf` trả `-1` → phát hiện bị vứt. Hỏng đúng ở tên công ty in đậm và vòng gọi vốn có link — nơi tín hiệu nằm. **Hỏng cả I-3**: token quảng cáo, dấu thời gian trong attribute đổi mỗi lượt đọc → hash luôn khác → tạo bản lưu và gọi LLM mỗi 60s, rơi đúng vào hố mà ADR-0003 đã loại phương án B để tránh | ❌ Loại — biến hai bất biến đã chốt thành lỗi im lặng |
| **C.** Chỉ lưu text, vứt HTML sau khi trích | Rẻ nhất, một cột, mọi bất biến chạy đúng | Bộ trích đổi (sửa bug, đổi thư viện) thì không tái tạo lại được bản lưu cũ — mà bản lưu là **chứng cứ** cho mọi phát hiện đã sinh. Vứt bản gốc là vứt khả năng trả lời "hệ thống đã đọc thấy gì" ở vòng 2 | ❌ Loại — mất chứng cứ gốc, không mua lại được |
| **D.** Như A nhưng highlight thẳng trên HTML đã render (ánh xạ offset text → DOM Range) | Giám khảo thấy bản chụp đúng như trang thật, có highlight trong ngữ cảnh | Cần TreeWalker duyệt text node để dựng ánh xạ; lệch một node là highlight trỏ sai chỗ **ngay trước mặt giám khảo** — hỏng ở đây tệ hơn hẳn không có. Cỡ nửa ngày, trong khi freeze là tối 14/08 | ❌ Loại — rủi ro cao nhất đặt đúng vào đường provenance, không đủ thời gian |

## Quyết định

Chọn **A**. Tiêu chí quyết định là *(1)* và *(2)*: A là phương án duy nhất giữ nguyên vẹn cả I-2 lẫn I-3 mà không phải sửa ADR-0002 hay ADR-0003 — hai ADR đó nói "chuỗi đã chuẩn hoá", A chỉ định nghĩa chuỗi đó là `raw_content`. B làm hỏng cả hai theo kiểu **không có triệu chứng**: nhìn từ log thì tỉ lệ từ chối cao trông y hệt "LLM hay paraphrase", còn hash luôn khác trông y hệt "nguồn cập nhật liên tục".

Tiêu chí *(3)* quyết phần giao diện: tab *Văn bản* là đường provenance thật vì offset và chuỗi hiển thị là cùng một chuỗi — không có bước ánh xạ nào để sai. Tab *Bản gốc* trả lời câu "hệ thống đọc từ đâu ra" mà không nhận rủi ro của phương án D.

Chi tiết chốt kèm:

- Bảng `observations` có `raw_html` (nguyên bản) và `raw_content` (text đã chuẩn hoá). **Mọi offset và `content_hash` tính trên `raw_content`** — giữ đúng chữ của ADR-0002 §Hệ quả và ADR-0003.
- Thêm cột `extractor_version`. Bộ trích đổi thì offset cũ có thể lệch; không có cột này thì việc nâng cấp bộ trích làm sai mọi highlight đã sinh mà không ai biết.
- Bước trích chạy **một lần lúc ingest**, trước khi hash — cùng một bước cho cả hash lẫn offset, đúng như ADR-0003 §Quyết định đã chốt.
- Tab *Bản gốc* render HTML trong `<iframe sandbox>`: bản chụp là HTML từ nguồn ngoài, nhúng thẳng vào DOM là mở đường cho script trong bản chụp chạy trong phiên của Sales.

## Hệ quả

- Kéo theo: `Observation` trong [ontology.md](../ontology.md) mục 2 phải thêm `raw_html` và `extractor_version` bên cạnh `raw_content` đã có. Q-3 ở cuối ontology chuyển thành đã trả lời.
- Kéo theo: có thêm một module trích text từ HTML. Nó phải **tất định** — cùng input ra cùng output, không phụ thuộc thứ tự thuộc tính hay thời điểm chạy — nếu không thì hash đổi vô cớ và I-3 hỏng.
- Kéo theo: phép đo còn nợ của ADR-0002 (đo tỉ lệ paraphrase) và của ADR-0003 (hash hai lượt đọc có bằng nhau không) bây giờ **phải chạy trên `raw_content`**, không phải trên file HTML thô. Đo nhầm chuỗi thì cả hai con số đều vô nghĩa.
- Đánh đổi chấp nhận: tab *Văn bản* mất định dạng gốc (đậm, link, ảnh). Chấp nhận được vì thứ cần chứng minh là **đoạn chữ nào ở vị trí nào**, không phải nó trông ra sao — và tab *Bản gốc* vẫn cho xem hình thức thật.
- Sẽ phải xem lại nếu: bộ dữ liệu BTC phát 15/08 có phần động **nằm trong text** (dấu thời gian hiển thị, bộ đếm lượt xem đọc được bằng mắt). Khi đó trích text không cứu được hash, phải thêm bước lược vùng động — đúng nhánh dự phòng ADR-0003 đã ghi.

## AI đã tham gia thế nào

- Vai trò AI: phân tích trade-off. AI chỉ ra hai hệ quả mà câu trả lời "lưu HTML" không nói tới — I-2 hỏng có chọn lọc ở chỗ có thẻ, và hash trên markup động làm I-3 vô hiệu — rồi dựng bốn phương án để so.
- AI đề xuất gì mà đội **không** nghe: AI khuyến nghị phương án A với giao diện **một tab văn bản**, coi tab *Bản gốc* là phần cắt được để tiết kiệm thời gian trước freeze. Đội chọn hai tab: bản gốc HTML là chứng cứ giám khảo có thể đòi xem, mà tab chỉ-để-đọc thì không mang rủi ro nào vì nó không tham gia đường provenance.
- AI sai ở đâu: khi lần đầu viết lại giải thích ontology cho đội, AI mô tả `Observation.raw_content` là "lưu nguyên văn" mà **không nêu ra câu hỏi HTML-hay-text** — dù chính câu hỏi đó đang nằm trong danh sách còn treo của ontology và đã được ADR-0002 §Hệ quả cảnh báo. Lỗ hổng chỉ lộ khi đội trả lời Q-3. Bài học: câu hỏi còn treo trong tài liệu phải được đối chiếu mỗi lần chạm vào phần liên quan, không chờ tới lúc có người hỏi.

## Đội đã verify bằng cách nào

**Đã làm:**

1. **Đối chiếu ngược với hai ADR đang hiệu lực.** Đọc lại ADR-0002 §Hệ quả — nó đã viết sẵn *"`raw_content` là chuỗi đã chuẩn hoá (không phải HTML thô — nếu BTC phát HTML thì lưu thêm bản gốc riêng, xem Q-3)"*. Quyết định này không phải phát minh mới mà là **thực thi đúng nhánh mà ADR-0002 đã dự phòng**; kiểm được bằng cách đọc, không cần suy đoán.
2. **Suy dẫn cơ học lý do loại B.** `indexOf` tìm chuỗi con exact. Text render bỏ thẻ, HTML giữ thẻ. Một câu có thẻ ở giữa thì hai chuỗi khác nhau tại đúng vị trí đó → tìm không thấy. Kết luận rút từ định nghĩa của phép tìm chuỗi, không từ cảm tính về "HTML thì bẩn".

**Chưa làm — việc phải làm khi nhận dữ liệu BTC 15/08:**

1. Trích text từ bản chụp thật, chạy hash **hai lượt đọc liên tiếp**, xác nhận bằng nhau (nợ chung với ADR-0003, nay chạy trên `raw_content`).
2. Đếm số câu trong bản chụp có thẻ nằm giữa câu. Con số này ước lượng được **B đã phá bao nhiêu phần trăm phát hiện** nếu đội chọn nhầm — là dữ liệu trả lời vòng 2 cho câu "vì sao không tính offset thẳng trên HTML".

Người làm: HungLV.

## Rollback

Rẻ ở phần lưu, đắt ở phần đã sinh. Đổi chuỗi tính offset sau khi đã có phát hiện nghĩa là mọi `quote_start`/`quote_end` cũ trỏ sai → phải nạp seed lại (I-14 đã bắt buộc nạp lại được, nên thao tác này có sẵn). Bản thân cột `raw_html` không phải bỏ đi trong bất kỳ nhánh nào — giữ bản gốc luôn đúng. Ước tính: 15 phút sửa code + một lần `pnpm reset` và seed lại.

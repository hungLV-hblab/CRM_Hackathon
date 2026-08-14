# Prompt log — 14/08/2026 16:00 · Brainstorm: đọc nguồn web thật, đa nguồn có phân cấp

> **Đây là đề thi vòng 2.** Viết cho người đọc lại sau ba tuần, không phải cho người vừa ngồi trong phiên.
> Tiền đề: [ADR-0035](../decisions/0035-cho-phep-nguon-web-that-kem-dieu-kien-ban-chup-van-la-nguon-cua-bo-nghiem-thu.md) đã mở cửa cho nguồn thật kèm ba điều kiện, và [prompt log 260814-1124](260814-1124-req-crawl-web-that.md) đã chốt câu "có được crawl không". Phiên này **không mở lại** hai câu đó.
> Kết quả: [ADR-0036](../decisions/0036-llm-tim-nguon-code-doc-bytes-va-ung-vien-phai-qua-nguoi.md) · [plan bốn chặng](../../plans/260814-1610-crawl-nguon-web-that-da-nguon/plan.md)

## Yêu cầu gốc của người quyết định

> Cho AI đọc **web thật**, nhiều nguồn, có phân cấp độ tin cậy. Không chỉ trang chủ công ty — tin tức, mạng xã hội. Nhưng đừng phá bộ nghiệm thu.

Vấn đề cụ thể đằng sau câu đó: `SNAPSHOTS` chỉ có 5 công ty seed. Sales tạo công ty mới qua giao diện (`e2e/login-and-create-company.spec.ts` có thật) → `snapshots.read()` trả `null` → vùng đọc của công ty đó **vĩnh viễn** "không đọc được nguồn". Đó là cái hố cần lấp, không phải "thêm tính năng crawl cho oai".

## Bốn câu hỏi, và người quyết định chọn gì

### 1. Lấy URL ở đâu ra?

**AI đưa bốn phương án.** Người quyết định chọn: `web_search` của Anthropic tìm URL, **code của mình fetch bytes**.

Lý do không phải "gọn hơn" mà là **cửa I-2**: câu trích phải là chuỗi con nguyên văn của `raw_content`, và `raw_content` chỉ có nghĩa khi mình giữ byte gốc. Dùng `web_fetch` của Anthropic để lấy luôn nội dung thì model trả về trang đã đọc và tóm tắt — không còn byte nào của mình để đối chiếu, và luật 1 sụp theo.

Câu hỏi kiểm tra ở vòng 2: *tại sao không dùng `web_fetch` cho gọn?* — trả lời được bằng ADR-0012 hoặc chưa hiểu quyết định này.

### 2. Mạng xã hội: chặn hay cho vào?

**AI khuyến nghị chặn** bằng `blocked_domains` — LinkedIn/Facebook chặn máy đọc, demo sẽ có dòng đỏ, trông tệ.

**Người quyết định chọn ngược: cho vào, và cho phép hỏng trung thực.**

Lý do: nếu chặn trước thì `js_required` không bao giờ xuất hiện — mà `js_required` chính là giá trị đắt nhất của cả bảng lỗi. Nó là thứ duy nhất phân biệt *"trang chặn máy đọc của mình"* với *"công ty này không đăng gì"*, và đó đúng là câu Sales Manager chất vấn ở [prompt log 260814-1124](260814-1124-req-crawl-web-that.md) mục 2. Chặn để demo đẹp là vứt mất bằng chứng sống cho chính tính năng mình đang khoe.

Hệ quả nhận trước: demo **sẽ** có dòng đỏ. Giao diện phải nói lý do bằng tiếng Việt để dòng đỏ đó đọc lên thành **thông tin về nguồn**, không phải **sản phẩm lỗi**.

### 3. Chặn công ty seed bằng cách nào?

**AI khuyến nghị quy tắc cấu trúc:** "công ty nào có bản chụp thì không crawl" — tự động, không cần danh sách.

**Người quyết định chọn danh sách ID**, dẫn xuất thẳng từ `SEED_COMPANIES` của `@crm/db`.

Lý do: quy tắc cấu trúc **im lặng đổi nghĩa** khi bộ seed đổi. Thêm một công ty demo không có bản chụp thì nó lập tức crawlable mà không ai nhận ra. Danh sách ID dẫn xuất thì hỏng **ồn ào** — và vì dẫn xuất chứ không chép tay, nó không bao giờ lệch khỏi seed.

### 4. Ứng viên tìm được thì lưu luôn hay chờ người bấm?

**Người quyết định: chờ người bấm.** `crm_system` không có INSERT trên `company_sources`.

Lý do dẫn thẳng từ một comment đã có sẵn trong repo, ở `companies.ts:39` về `snapshot_variant`: *"`crm_system` holds SELECT on this table and no UPDATE, so the AI cannot switch the source it then draws conclusions from — measured, not assumed."* Nguyên tắc đó đã được lập luận và enforce một lần rồi; "tìm nguồn rồi tự lưu vào danh sách đọc" là đúng cùng một vi phạm ở một bảng khác.

## Chỗ AI sai — tìm ra bằng cách chạy, không phải bằng cách đọc lại

Ba chỗ. Cả ba đều lọt qua vòng review plan.

1. **Cửa gác SSRF hở đường chuyển hướng.** Bản plan do AI viết để `fetchPage` **không** gọi cửa gác, để test dùng được `127.0.0.1`. Nghe hợp lý cho tới khi hỏi: một URL công khai 302 sang `169.254.169.254` thì sao? Lọt. Sửa: `assertAllowed` thành tham số **bắt buộc**, hỏi lại ở **từng hop**, và chuyển hướng đi theo tay thay vì `redirect: 'follow'`.

2. **Bảng lỗi thiếu một ô.** Chín giá trị được chốt trước khi có dòng code nào mở socket. Lần đọc thật đầu tiên vào một tên miền không tồn tại cho thấy không có ô nào đúng: `timeout` nói "Trang không phản hồi kịp" về một kết nối bị từ chối sau 3ms, `invalid_url` bảo người ta đi sửa một địa chỉ vốn đúng. Thêm giá trị thứ mười `unreachable`.

3. **Nhóm 4 bị bỏ hẳn thay vì hạ xuống chỉ-đề-xuất.** Bản plan đầu cho nhóm 4 không chạy với `live_crawl`. Phiên validation bắt được: `blockedNextSteps` là đường **duy nhất** biến hàm ý về Việc tiếp theo thành gợi ý, nên bỏ hẳn làm nó biến mất không log, không đếm, không exception — cùng hình dạng cái hố [ADR-0028](../decisions/0028-quyen-ghi-muc-dong-thoi-gian-den-tu-nhan-dang-theo-doi-khong-tu-trigger-context.md).

Bài học chung của cả ba: **plan review bắt được lỗi lập luận, không bắt được lỗi thiếu.** Cái thiếu chỉ hiện ra khi có thứ chạy được để hỏi "thế còn trường hợp này?".

## Chỗ khai thẳng là chưa verify

- **Hình dạng khối `web_search_tool_result`** lấy từ tài liệu, chưa chạy một lượt thật vì máy không có `ANTHROPIC_API_KEY`. Parser viết phòng thủ (kiểm `Array.isArray` trước khi index, bỏ qua khối lạ) và có 17 assertion trên transport kịch bản, nhưng **chưa có một lượt gọi thật nào**.
- **Chất lượng URL `web_search` trả về cho công ty B2B Nhật/ASEAN quy mô nhỏ** — ẩn số lớn nhất, không đo được trước khi chạy. Nếu tệ, tỉ lệ ứng viên được người chọn sẽ nói ra ngay.
- **Chống DNS rebinding** ngoài phạm vi: cửa gác là hàm thuần nên không phân giải tên miền, một hostname công khai trỏ về `127.0.0.1` vẫn lọt. Đã ghi thẳng giới hạn này trong `assert-public-url.ts`. Rủi ro còn lại bị chặn bởi chính hình dạng tính năng: một cú fetch tới địa chỉ do người đăng nhập tự chọn cho công ty của họ, và kết quả chỉ đi vào hàng đợi duyệt (I-15).

## Câu nói thẳng về giá trị của cả phiên

Crawl thật **không thêm điểm nghiệm thu nào**. Giám khảo chạy T-1…T-10 trên bộ seed, mà I-16 chặn nguồn thật khỏi seed. Giá trị nằm ở vòng 2 (giải thích được bằng hành vi, không bằng lời hứa) và vòng 3 (demo đọc thật). Ai kỳ vọng điểm tầng 1 từ việc này là kỳ vọng sai — và điều đó đã được nói ra **trước khi** viết dòng code đầu tiên, không phải sau khi hết giờ.

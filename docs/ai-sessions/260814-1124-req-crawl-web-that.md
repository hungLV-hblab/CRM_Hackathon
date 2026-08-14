# Phản biện yêu cầu — Crawl web thật thay/kèm bản chụp tĩnh

- Ngày: 14/08/2026 11:24
- Yêu cầu gốc: "Thêm crawl web thật để đọc dữ liệu công ty, thay vì/song song với bản chụp tĩnh hiện tại (`apps/api/src/ai/demo-snapshots.ts`)."
- Người nêu yêu cầu: kỳ vọng ban đầu là "AI đọc dữ liệu công khai" nghĩa là đọc web thật.

## 1. Tóm tắt yêu cầu

Yêu cầu là thay bản chụp HTML tĩnh (nhúng sẵn trong `demo-snapshots.ts`) bằng việc thật sự gọi ra Internet đọc trang web của từng công ty, để tầng Observation "đọc dữ liệu công khai" đúng nghĩa đen thay vì đọc dữ liệu đóng hộp giả lập. Động cơ là cảm giác bản chụp tĩnh "không phải crawl thật" nên tính năng "đang sai". Nhưng Specs mục 3 lại quy định ngược: *"Nguồn web trong đề bài chính là các bản chụp này, không phải trang web thật của các công ty"*, và ràng buộc duy nhất là nội dung công ty phải lấy từ bản chụp để mọi đội chạy trên cùng dữ liệu, kịch bản demo lặp lại được. `docs/ontology.md` đã liệt kê "crawl web thật" vào mục *"không thuộc module này, đừng tự thêm"*, và hai ADR trước đó (0021, 0022) đã bàn kỹ lý do giữ bản chụp dạng hằng số TypeScript thay vì crawler thật.

## 2. Phản biện theo từng persona

### BD/Sales trực chiến
1. "Crawl thật giúp tôi biết sáng nay phải làm gì cho deal nào, hay chỉ là đổi kỹ thuật tôi không thấy khác gì trên màn hình?" — giá trị Sales cảm nhận nằm ở chất lượng phát hiện + trích dẫn, không nằm ở nguồn HTML lấy từ đâu.
2. Nếu web công ty tôi theo dõi tuần này không có tin gì (thực tế phổ biến), crawl thật cho tôi **ít** giá trị demo hơn bộ 4 loại tin luôn sẵn sàng trong bản chụp — mất đúng thứ "Right Timing" mà sản phẩm phải chứng minh được trong 10 phút demo.
3. Nếu trang web thật bị chặn bot / đổi cấu trúc / không có tin đúng lúc tôi cần trình diễn cho sếp — tôi trông như đang dùng một công cụ hỏng, biến "máy đọc thay tôi" thành thứ tôi phải nghi ngờ.

### Sales Manager
1. "Số phát hiện từ web thật này tôi mang đi họp báo cáo BOD được không, khi nguồn có thể đổi/sập giữa chừng và tôi không tái tạo lại được để đối chiếu?" — đúng nỗi lo tính tái lập mà chính BGK cũng cần để chấm.
2. "Không đọc được" từ crawl lỗi (bot bị chặn, timeout) và "không đọc được" vì công ty thật sự im ắng là hai nguyên nhân khác hẳn nhau, nhưng UI hiện tại (`Nguồn không đọc được thì ghi lại là không đọc được` — Specs Nhóm 2) không phân biệt được hai trường hợp này.
3. Quyết định thêm crawl thật có đi qua ADR không, hay là đổi ngầm giữa chừng dự án? Nếu vòng 2 hỏi "sao code khác Specs mục 3", ai trong team trả lời được bằng bằng chứng cụ thể?

### Tester/BA khó tính
1. T-6 và T-8 (2 trong 10 kịch bản nghiệm thu bắt buộc) dựa trên thao tác "đổi công ty từ bản chụp trước sang sau bằng một lệnh/nút" — xác định, lặp lại được. Yêu cầu chưa nói rõ cách trigger "nội dung mới" xác định khi nguồn là web thật ngẫu nhiên. Thiếu acceptance criteria nghiêm trọng ở đúng hai điểm BGK chấm trực tiếp.
2. `normalize-snapshot-text.ts` hiện chỉ xử lý HTML "cố ý bẩn" của đúng bộ dữ liệu demo đã biết trước (nested tag, `&nbsp;`, script block). Web thật có vô số biến thể (JS-rendered, CAPTCHA, 404/503, rate-limit, redirect, paywall) mà yêu cầu không hề nhắc tới edge case nào.
3. "Thay vì/song song" là mơ hồ. Nếu song song, hai luồng Observation nào là sự thật khi bản chụp nói A còn crawl thật nói B? Chưa định nghĩa thứ tự ưu tiên, và một số công ty trong seed có website không tồn tại/giả — map crawl target thế nào?
4. Chưa có ước lượng effort hay test plan cho một tích hợp mạng thật (network flakiness, retry, timeout) — đúng lúc 0 giờ còn lại trước feature freeze tối nay.

### Người bảo vệ dữ liệu (luật 4 — một dòng sai tệ hơn một dòng trống)
1. Web thật không được ai kiểm duyệt nội dung — Claim rút từ trang thật có thể trích sai ngữ cảnh, quảng cáo giả, trang bị deface, mà bộ bản chụp (BTC kiểm soát nội dung) không có rủi ro này. Ai lọc nội dung độc hại trước khi nó thành Observation?
2. **Rủi ro lớn nhất tìm được:** Nhóm 5 (vòng quét) được thiết kế **tự ghi thẳng vào dòng thời gian, không chờ ai duyệt**, dựa trên giả định nền tảng là nguồn (bản chụp) do BTC kiểm soát nội dung nên an toàn để tự động hoá. Đổi nguồn sang web thật mà giữ nguyên cơ chế "tự ghi không hỏi ai" là phá vỡ chính giả định an toàn làm nền cho toàn bộ Nhóm 5 — nội dung rác/sai từ web thật sẽ tự vào timeline công ty mà không ai chặn trước.
3. Sửa lại có dễ hơn lúc máy làm không? Sales vẫn xoá được mục timeline sai (đã có sẵn), nhưng thiệt hại — đọc nhầm thông tin sai trong một cuộc họp thật — đã xảy ra trước khi kịp xoá. Đúng kịch bản luật 4 cảnh báo.

## 3. Điểm mơ hồ trong Specs

| Chỗ mơ hồ | Cách hiểu A | Cách hiểu B | Ảnh hưởng nếu chọn sai |
| --- | --- | --- | --- |
| "Nguồn web trong đề bài chính là các bản chụp này" | Bản chụp là **nguồn duy nhất** được phép dùng cho company content — bắt buộc | Bản chụp là baseline tối thiểu; đội được phép **bổ sung** crawl thật miễn giữ được khả năng demo lặp lại qua bản chụp | Nếu B sai (BTC thực ý là A), sản phẩm lệch đề ngay ở chỗ nền tảng nhất — nguồn dữ liệu — ảnh hưởng điểm tầng 1 toàn bộ |
| "Đội tự chọn cách cung cấp chúng cho sản phẩm" | Chỉ được chọn **cơ chế nạp** bản chụp (file, DB, API...) | Đội toàn quyền quyết định "cung cấp" theo nghĩa rộng, kể cả thay bản chụp bằng nguồn khác | Cách hiểu B mở đường sai cho việc lách sang crawl thật bằng chính câu cho phép linh hoạt |
| "Gọi ra dịch vụ bên ngoài thì thoải mái, kể cả mô hình ngôn ngữ" | Chỉ cho phép gọi dịch vụ ngoài để **xử lý** (LLM rút phát hiện) | "Dịch vụ bên ngoài" bao gồm cả web/search API để **lấy nội dung công ty** | Câu này đứng ngay trước câu ràng buộc ngược lại ("nội dung công ty phải lấy từ bản chụp") — dễ bị trích riêng và đọc nhầm thành cho phép crawl |

## 4. Edge case & rủi ro tự phát hiện

**Phải xử lý trước feature freeze — nếu team vẫn chọn làm (không khuyến nghị):**
- T-6/T-8 phải tiếp tục chạy qua đường bản chụp — không được thay thế, chỉ được thêm.
- Nhóm 5 (tự ghi timeline không cần duyệt) không được áp dụng cho company có nguồn crawl thật.
- Phân biệt "không đọc được vì lỗi crawl" (timeout/403/JS-required/redirect) với "nguồn thật sự không có gì mới" — hiện Specs Nhóm 2 chỉ có một trạng thái "không đọc được".

**Bỏ được (ngoài phạm vi 10 điểm nghiệm thu, không cần xử lý):**
- Không cần chống anti-bot, không cần retry/backoff phức tạp, không cần xử lý pagination hay JS rendering — vì đây không phải yêu cầu chấm điểm thật.

## 5. User stories + acceptance criteria (chỉ phần lõi, nếu team quyết vẫn làm)

**Story:** Là Admin, tôi muốn bật một nguồn đọc phụ (crawl thật) cho một công ty cụ thể ngoài bộ dữ liệu nghiệm thu, để xem AI phản ứng thế nào với dữ liệu thật — tách biệt hoàn toàn khỏi kịch bản chấm điểm.

- Chạm **Observation** (thêm loại nguồn mới), không chạm logic Claim/Proposal hiện có.
- AC: bản chụp vẫn là nguồn duy nhất cho 12–15 công ty seed dùng để chạy T-1…T-10.
- AC: Observation từ crawl thật ghi rõ loại nguồn khác biệt (khác `demo_snapshot`), để Provenance phân biệt được **ngay bằng mắt** — không lẫn với nguồn chính thức của kịch bản chấm.
- AC: mọi Claim từ crawl thật **bắt buộc đi qua hàng đợi Proposal (Nhóm 3)** — Nhóm 5 (tự ghi thẳng, không chờ duyệt) không áp dụng cho nguồn này.

## 6. Câu hỏi cần BTC/end user trả lời

- BTC: "Nguồn web trong đề bài chính là các bản chụp" — là ràng buộc bắt buộc duy nhất, hay là điều kiện tối thiểu mà đội được phép mở rộng thêm miễn giữ khả năng demo lặp lại qua bản chụp?
- BTC: Nếu sản phẩm có thêm đường crawl thật, giám khảo tính đó là điểm cộng ("đọc thật từ nguồn công khai" đúng tinh thần đề bài) hay điểm trừ (lệch dữ liệu chuẩn, khó tái lập kịch bản chấm)?
- Sales thật (end user vòng 3): trong 10 phút demo, cần thấy crawl thật để tin, hay bản chụp + giải thích rõ ràng (đúng luật 1: bằng chứng trước, khẳng định sau) đã đủ thuyết phục?

## 7. Đề xuất cắt scope

**Đề xuất: không làm crawl thật trước feature freeze tối nay.** Thứ tự lý do:

1. Rủi ro cao nhất là phá T-6/T-8 — 2 trong 10 điểm nghiệm thu bắt buộc — nếu triển khai sai, đổi lấy một điểm cộng không chắc có.
2. Không còn đủ thời gian build + test an toàn một tích hợp có external dependency thật (mạng, HTML thật, error handling) trước tối nay.
3. Giá trị "AI đọc dữ liệu công khai" mà BGK/Sales thật sự quan tâm nằm ở **chất lượng rút phát hiện (Claim) và bằng chứng (Provenance)** — đã có, đã dùng LLM thật (`anthropic-claim-extractor.ts`) — không nằm ở việc HTML lấy từ đâu.

Nếu vẫn muốn ghi điểm ở hướng "đọc thật" cho phần giải trình vòng 2: dùng chính lý do đã có trong ADR-0021/0022 làm câu trả lời — bằng chứng team đã cân nhắc kỹ, đúng tinh thần rubric "phản biện + lưu vết lý do", không cần code thêm.

---

*Đã ghi log tại `docs/ai-sessions/260814-1124-req-crawl-web-that.md`. Chốt các diễn giải Specs quan trọng thành ADR bằng `/hack:adr`.*

---

## Kết quả (ghi thêm 14/08 16:20)

Người quyết định **không nghe** đề xuất ở mục 7. Chốt tại [ADR-0035](../decisions/0035-cho-phep-nguon-web-that-kem-dieu-kien-ban-chup-van-la-nguon-cua-bo-nghiem-thu.md): nguồn web thật **được phép bổ sung có điều kiện** — ba điều kiện lấy thẳng từ mục 4 và mục 5 của chính phiên này (bộ nghiệm thu chỉ đọc bản chụp · trần tự chủ dừng ở vùng 2 · mặc định tắt), khai vào `docs/ontology.md` mục 3.6 và I-15…I-17. Phần **kết luận thời gian** của mục 7 vẫn giữ: không viết crawler trước freeze; công tắc để tắt cho tới khi ba bất biến có test.

Chỗ AI sai: lẫn *"không build crawler trước freeze"* (đúng) với *"ontology phải ghi crawl web thật là thứ cấm"* (sai — đó là ràng buộc của bộ nghiệm thu, không phải luật kiến trúc).

# ADR-0040 — Model vẫn tự khai độ tin cậy; hoãn "sổ kê bằng chứng" sang sau vòng 1

| | |
| --- | --- |
| **Ngày** | 2026-08-15 09:20 |
| **Giai đoạn** | Design |
| **Trạng thái** | Chấp nhận |
| **Người quyết định** | HungLV |
| **Prompt log** | *không có* — quyết định đến từ đọc mã nguồn `trycompai/crm@f2484fb`, không từ phiên phản biện |

## Bối cảnh

Đọc `apps/agent` của [`trycompai/crm`](https://github.com/trycompai/crm) (branch `release`, commit `f2484fb`) để tìm mẫu làm dày `agent-runtime`. Mẫu mạnh nhất tìm được lại là mẫu ta **không** áp dụng được trong hôm nay, nên nó phải thành ADR chứ không thành code.

Họ tách đôi việc mà ta đang gộp:

- `agent/skills/evidence.md` nói thẳng với model: *"You never set a confidence. You report what you saw, and the ledger prices it."*
- Model chỉ trả **loại bằng chứng** từ một enum đóng 11 giá trị (`crm.thread-reply`, `linkedin.employer-and-name`, `employer-only`, `contradiction`…).
- `agent/lib/evidence.ts` — **code**, không phải prompt — gán trọng số cho từng loại, cộng theo xác suất bù, hạ trần khi có `contradiction`, rồi quy ra band `VERIFIED`/`PROBABLE`/`POSSIBLE`.

`extract-claims` của ta làm ngược: prompt hỏi model `"confidence": certain | likely | speculative` và model tự chấm. Đó là **model tự chấm bài của chính nó**, và ta không có cách nào kiểm.

Ràng buộc siết: feature freeze tối 14/08 đã qua, vòng 1 chốt 15:00 ngày 15/08.

## Phương án đã cân nhắc

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| **A. Giữ nguyên `confidence` do model khai, ghi ADR này** | Không đụng code trong freeze. ADR chứng minh đội đã cân nhắc và cố ý hoãn — rubric §5 tính đúng chỗ này | Vẫn còn lỗ: `certain` nghĩa là gì thì không ai định nghĩa được ngoài "model thấy vậy" | ✅ **Chọn** |
| B. Port đủ sổ kê bằng chứng trước 15:00 | Đúng về thiết kế. Trả lời được câu "vì sao dòng này `certain`" bằng số học thay vì bằng cảm giác | Đụng `@crm/contracts` (enum `CONFIDENCE`), cột CSDL, `parse-claim-drafts.ts`, badge phân biệt fact/suy luận ở web, và toàn bộ test quanh chúng. Sau freeze, còn ~6h, và luật 2 (fact vs suy luận phân biệt bằng mắt) đang **đứng trên chính mấy cái badge đó** | ❌ Loại — rủi ro hồi quy đánh vào đúng luật nó định củng cố |
| C. Bỏ hẳn `confidence`, chỉ hiện có/không có câu trích | Đơn giản nhất, không ai chấm điểm ai | Mất thông tin thật: "gần như chép lại nguồn" và "phải đoán thêm" là hai thứ khác nhau và Sales cần thấy khác nhau. ADR-0007 đã đo ba mức bằng khoảng cách suy luận và chọn giữ | ❌ Loại — đảo một quyết định đã có, không có bằng chứng mới |
| D. Vẫn để model khai `confidence` nhưng code hạ mức khi câu trích không chứa số/tên riêng trong `statement` | Rẻ, chạy được hôm nay | Là heuristic đoán mò đội tôi tự nghĩ, không có gì kiểm chứng. Thêm một tầng chấm điểm không ai giải thích được thì tệ hơn một tầng ai cũng biết là yếu | ❌ Loại — vi phạm luật 7 (giải thích được, nếu không thì không merge) |

## Quyết định

Chọn **A**. Tiêu chí so là **rủi ro hồi quy trên đường demo trong 6 giờ cuối**, không phải độ đẹp của thiết kế.

Phương án B đúng hơn A về mặt kiến trúc, và ADR này ghi rõ điều đó thay vì giả vờ ngược lại. Nhưng B chạm đúng ba thứ đang gánh luật 1 và luật 2 trên màn hình — cột `confidence`, `parse-claim-drafts.ts`, badge fact/suy luận. Hỏng một trong ba lúc 14:00 thì mất nhiều hơn hẳn cái được.

Phần **lấy được ngay mà không cần B**: câu *"Do not go looking for extra evidence to push a claim over a line"* trong `evidence.md` của họ. Nó là luật về hành vi, không phải về lược đồ dữ liệu, nên nó vào thẳng `skills/_base.md` hôm nay (luật 3 của file đó).

## Hệ quả

- **Kéo theo:** `certain | likely | speculative` vẫn là ba nhãn do model tự đặt. Nếu BGK hỏi "vì sao dòng này `certain`", câu trả lời trung thực là: *model khai vậy, và ta chưa kiểm được — đây là ADR-0040*. Trả lời thế tốt hơn là bịa ra một cơ chế không tồn tại.
- **Đánh đổi chấp nhận:** `auto-accept rate` và `error-detection rate` (luật 6) vẫn đo được, vì chúng đo **người duyệt hay bác**, không đo `confidence`. Lỗ hổng này không lan sang metric.
- **Sẽ phải xem lại nếu:** sau vòng 1 còn làm tiếp, hoặc BGK hỏi thẳng vào định nghĩa `confidence`. Khi đó B là đường đã khảo sát sẵn: enum loại bằng chứng + bảng trọng số + band, mẫu ở `agent/lib/evidence.ts` của repo nguồn.

## AI đã tham gia thế nào

- **Vai trò AI:** đọc và trích xuất thiết kế từ một repo ngoài, dựng ma trận đánh đổi, viết ADR.
- **AI đề xuất gì mà đội không nghe:** bản phân tích đầu xếp mẫu sổ kê bằng chứng vào **hạng A — nên làm** vì nó "hợp luật 2 và luật 6 của dự án". Người quyết định giữ phần chẩn đoán, bỏ phần khuyến nghị: nhận định *"model tự chấm bài mình"* là đúng và giữ lại; kết luận *"nên làm"* bỏ đi, vì AI đọc luật trong CLAUDE.md mà không cân dòng timeline ngay bên trên nó — freeze đã qua từ tối trước.
- **AI sai ở đâu:** nó cũng đề xuất port hook `audit.ts` ghi event xuống CSDL. Sai nặng: tiến trình này **cố ý không giữ credential CSDL** (ADR-0038), nên port vào là tự phá quyết định kiến trúc tốt nhất đang có. Xem ADR-0041.

## Đội đã verify bằng cách nào

- Đọc trực tiếp `agent/lib/evidence.ts` của repo nguồn tại commit ghi ở đầu ADR — `WEIGHTS`, `scoreEvidence()`, `bandFor()`, `BAND_FLOOR` — chứ không dựa vào mô tả trong README của họ.
- Đối chiếu ngược vào `apps/agent-runtime/skills/extract-claims/SKILL.md` để xác nhận ta **thật sự** đang hỏi model tự khai `confidence`, và ba mức đó **thật sự** không bị code kiểm lại ở đâu.
- Dò phạm vi ảnh hưởng của phương án B trước khi loại nó: `packages/contracts` (enum), `parse-claim-drafts.ts`, cột CSDL, badge web. Loại vì phạm vi, không vì cảm giác "sẽ lâu".
- **Chưa verify:** ba mức hiện tại hiệu chỉnh tốt tới đâu trên dữ liệu thật. Không có bộ nhãn để đo, và không dựng được trong ngày.

## Rollback

Không có gì để rollback — ADR này quyết định **không đổi code**. Phần đi kèm nó (luật 3 trong `skills/_base.md`) revert bằng một commit.

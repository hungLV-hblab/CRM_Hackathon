# ADR-0001 — Lưu vết quyết định bằng ADR trong repo, tách khỏi prompt log

| | |
| --- | --- |
| **Ngày** | 2026-08-11 13:40 |
| **Giai đoạn** | Meta (áp dụng cho cả 5 giai đoạn) |
| **Trạng thái** | Chấp nhận |
| **Người quyết định** | HungLV |
| **Prompt log** | *(quyết định trong phiên tư vấn kiến trúc, chưa tách file riêng)* |

## Bối cảnh

Rubric cả 5 giai đoạn lên mức 4 đều đòi cùng một thứ: lưu vết lý do quyết định **kể cả phương án bị loại**, và team giải thích được. Vòng 2 BGK hỏi random 3–5 câu **dựa trên log của đội**. Build kéo dài từ 12/08 tới 15/08 — quyết định rải ra nhiều ngày, tới lúc Q&A ngày 15 thì phần lớn đã quên. Cơ chế lưu vết nào tốn nhiều thao tác sẽ bị bỏ ngay ngày thứ hai.

Ràng buộc: 2–3 người, làm song song, không có ai chuyên trách ghi chép.

## Phương án đã cân nhắc

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| A. ADR file trong repo + slash command sinh sẵn | Nằm cùng code, review qua PR được, versioned; slash command giảm ma sát xuống ~1 lệnh; là artifact nộp được | Vẫn cần kỷ luật gọi lệnh | ✅ **Chọn** |
| B. Chỉ dựa vào telemetry Grafana | Không tốn công gì thêm | Log ghi *đã làm gì*, không ghi *vì sao chọn* và **không ghi phương án bị loại** — thiếu đúng thứ rubric chấm. Đội cũng không đọc lại được để ôn vòng 2 | ❌ Loại |
| C. Ghi chú trong Notion/Google Doc | Viết nhanh, ai cũng quen | Tách rời repo → nộp bài phải gom tay, dễ lệch với code, không diff được, mất bằng chứng "quyết định gắn với commit nào" | ❌ Loại |
| D. Ghi lý do trong commit message | Không tốn file | Không đủ chỗ cho bảng trade-off; không sửa được sau khi push; khó tra cứu khi bị hỏi dồn 5 phút Q&A | ❌ Loại |

## Quyết định

Chọn **A**, và **tách làm 2 nơi có vai trò khác nhau**:

- `docs/decisions/` — **kết luận**: quyết định, phương án bị loại, cách verify. Ngắn, người đọc được trong 60 giây.
- `docs/ai-sessions/` — **quá trình**: prompt log và output phản biện thô, dài, không cần biên tập.

Lý do tách: nhồi cả hai vào một file thì hoặc ADR dài không ai đọc, hoặc prompt log bị cắt gọt mất tính bằng chứng. Tiêu chí so là **ma sát khi ghi** và **đọc lại được trong 5 phút Q&A** — A thắng ở cả hai.

## Hệ quả

- Kéo theo: cần 3 slash command dùng chung (`/hack:req-challenge`, `/hack:design-challenge`, `/hack:adr`) để việc ghi vết là sản phẩm phụ của việc làm, không phải việc riêng.
- Đánh đổi chấp nhận: một phần thao tác thủ công vẫn còn; nếu quên gọi lệnh thì mất vết.
- Sẽ phải xem lại nếu: BTC quy định format nộp bằng chứng khác (hỏi tại họp 12/08).

## AI đã tham gia thế nào

- Vai trò AI: phân tích rubric, đề xuất cấu trúc, chỉ ra rằng telemetry Grafana **không** thay thế được ADR vì nó thiếu chiều "phương án bị loại".
- AI đề xuất gì mà đội không nghe: đề xuất thêm template daily-log theo giờ — loại vì YAGNI, thêm ma sát trong ngày thi mà không map vào ô rubric nào.

## Đội đã verify bằng cách nào

Đối chiếu từng phương án với văn bản rubric trong `docs/hackathon-rules-and-scoring.md`: mục 5 (mức 4 của Requirement và System Design ghi rõ *"lưu phương án bị loại + lý do"*) và mục 6 (3 quality gate). Phương án B trượt kiểm tra này bằng chứng cứ văn bản, không phải bằng cảm tính.

## Rollback

Bỏ thư mục `docs/decisions/` là xong, không thứ gì trong code phụ thuộc vào nó. Chi phí quay đầu ~0.

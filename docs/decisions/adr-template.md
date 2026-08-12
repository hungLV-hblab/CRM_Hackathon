# ADR-NNNN — <Quyết định, viết thành câu khẳng định>

| | |
| --- | --- |
| **Ngày** | YYYY-MM-DD HH:MM |
| **Giai đoạn** | Requirement / Design / Development / Testing / Deployment |
| **Trạng thái** | Đề xuất · Chấp nhận · Thay thế bởi ADR-NNNN |
| **Người quyết định** | <tên> |
| **Prompt log** | [ai-sessions/...](../ai-sessions/) hoặc *không có* |

## Bối cảnh

Vấn đề gì buộc phải quyết? Ràng buộc nào đang siết (thời gian, Specs mơ hồ, nghiệp vụ Sales, rubric)? 3–5 dòng, không lan man.

## Phương án đã cân nhắc

> **Bắt buộc ≥ 2 phương án bị loại kèm lý do.** Chỉ ghi phương án được chọn = ADR vô giá trị.

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| A. <tên> | | | ✅ **Chọn** |
| B. <tên> | | | ❌ Loại — vì... |
| C. <tên> | | | ❌ Loại — vì... |

## Quyết định

Chọn **A**. Vì... (nêu đúng tiêu chí đã dùng để so, không nói chung chung "đơn giản hơn").

## Hệ quả

- Kéo theo: ...
- Đánh đổi chấp nhận: ...
- Sẽ phải xem lại nếu: ... *(điều kiện kích hoạt việc đảo quyết định)*

## AI đã tham gia thế nào

- Vai trò AI: sinh phương án / phản biện với persona <ai> / phân tích trade-off / không tham gia
- AI đề xuất gì mà đội **không** nghe: ...
- AI sai ở đâu: ... *(để trống nếu không có — nhưng nghĩ kỹ trước khi để trống)*

## Đội đã verify bằng cách nào

> Trường quan trọng nhất của ADR này. Vòng 2 hỏi đúng chỗ này.

Làm gì để biết output AI đúng? (chạy thử, đối chiếu tài liệu nghiệp vụ, hỏi Sales, viết test chứng minh, đọc lại nguồn...) — **không được ghi "đọc thấy hợp lý"**.

## Rollback

Nếu quyết định này sai giữa ngày thi thì quay đầu thế nào, tốn bao lâu?

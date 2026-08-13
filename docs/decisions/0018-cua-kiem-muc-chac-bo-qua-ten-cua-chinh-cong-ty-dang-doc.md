# ADR-0018 — Cửa kiểm mức Chắc bỏ qua tên của chính công ty đang đọc

| | |
| --- | --- |
| **Ngày** | 2026-08-13 11:40 |
| **Giai đoạn** | Implementation |
| **Trạng thái** | **Đề xuất — chờ người quyết định.** Phát hiện từ phép đo LLM thật; chưa sửa code |
| **Người quyết định** | *(chờ)* — đề xuất do phiên đo [ADR-0014](0014-nhom-2-rut-phat-hien-bang-llm-that-code-kiem-cau-trich.md) phép đo 3 nêu ra |
| **Prompt log** | Phiên chạy phép đo 13/08 11:20–11:40 |

## Bối cảnh

`ClaimService.gateCertainty` ([ADR-0007](0007-ba-muc-do-tin-cay-va-cua-kiem-muc-chac.md)) hạ `certain` → `likely` khi statement chứa **số hoặc từ viết hoa** không có trong câu trích. Mục đích: chặn model bịa con số hoặc bịa tên riêng rồi gắn mác Chắc.

Phép đo LLM thật ngày 13/08 cho thấy cửa này bắn **5/6 lần**, và cả 5 lần đều **không phải** vì bịa:

```
Hạ mức Chắc → Có thể: "Manufacturing, KK" không có trong câu trích
Hạ mức Chắc → Có thể: "Cloud, Solutions" không có trong câu trích
Hạ mức Chắc → Có thể: "Analytics" không có trong câu trích
```

Nguyên nhân chung: **model viết đủ tên công ty trong statement, bản chụp gọi tên tắt.** "Nimbus Cloud Solutions đang tuyển 40 kỹ sư" trích từ "Công ty cũng đang tuyển thêm 40 kỹ sư nền tảng trong năm nay" — con số đúng, sự việc đúng, chỉ có `Cloud` và `Solutions` là không nằm trong câu trích. Mà tên công ty thì hệ thống **đã biết chắc** từ cột `companies.name`, không cần LLM nói cũng đúng.

Hệ quả nếu để nguyên: Specs nhóm 2 đòi hiển thị ba mức tin cậy, thực tế chỉ còn hai. Mức Chắc gần tuyệt chủng vì một lý do không liên quan tới độ tin cậy. Sales quen thấy mọi thứ là "Có thể" sẽ ngừng đọc mức tin cậy — đúng lúc nó cần có nghĩa thì nó đã mất nghĩa.

## Phương án đã cân nhắc

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| A. Bỏ qua các token thuộc **tên công ty đang đọc** (`companies.name`, tách từ) khi tính token chưa được chứng minh | Sửa đúng nguyên nhân; giữ nguyên răng của cửa với số và tên **bên thứ ba** (`Mizuho Capital`, `Tan Wei Ling` vẫn phải có trong câu trích); dữ liệu đối chiếu lấy từ CSDL chứ không từ LLM | Cần truyền tên công ty vào `gateCertainty`; một chỗ nữa phải test | ✅ **Đề xuất chọn** |
| B. Để nguyên, chấp nhận mức Chắc hiếm | Không đụng code đã xanh; an toàn tuyệt đối theo hướng thận trọng | Mất một mức hiển thị mà Specs đòi; và mức tin cậy mất nghĩa với người đọc | ❌ Đề nghị loại |
| C. Bỏ cửa kiểm mức Chắc, tin `confidence` của LLM | Đơn giản nhất | Đúng thứ ADR-0007 sinh ra để chặn. Model bịa "35 triệu" rồi tự gắn Chắc là ca đã có test bắt được | ❌ Loại thẳng |
| D. Chỉ kiểm số, thôi kiểm từ viết hoa | Hết hẳn ca tên công ty | Mất luôn phần chặn bịa tên người và tên đối tác — chỗ dễ sai và đắt nhất với Sales | ❌ Loại |

## Quyết định đề xuất

Chọn **A**. Ranh giới: cửa kiểm chỉ nên bắt thứ **LLM có thể bịa**. Tên của chính công ty đang đọc không thuộc loại đó — hệ thống đã có nó trong CSDL trước khi gọi LLM, nên coi nó là "chưa được chứng minh" là sai về bản chất.

Giữ nguyên với: mọi con số · tên người · tên công ty khác · tên sản phẩm.

**Chưa sửa code.** Đây là hành vi do [ADR-0007](0007-ba-muc-do-tin-cay-va-cua-kiem-muc-chac.md) chốt và `claim-service.ts` thuộc chủ quyền của A; sửa một cửa an toàn dựa trên 11 draft mà không có người thứ hai đồng ý là đúng cái CLAUDE.md luật 7 cấm.

## Hệ quả nếu chấp nhận

- Kéo theo: `gateCertainty` nhận thêm tên công ty; `extractHardTokens` giữ nguyên, việc lọc nằm ở chỗ gọi.
- Kéo theo: phải có test cho **cả hai chiều** — tên công ty bị bỏ qua thì vẫn `certain`; `Mizuho Capital` thiếu trong câu trích thì **vẫn** bị hạ. Kèm phép đo đột biến: xoá dòng lọc → test chiều hai đỏ.
- Sẽ phải xem lại nếu: model bắt đầu nhét tên công ty vào statement để *lách* cửa kiểm cho một sự việc không có trong câu trích. Câu trích vẫn phải nguyên văn nên rủi ro này bị chặn sẵn ở lớp dưới.

## AI đã tham gia thế nào

- Vai trò AI: chạy phép đo, đọc log, quy 5 lần hạ mức về một nguyên nhân chung, trình bày bốn phương án.
- AI **không** tự sửa: phát hiện là của máy, quyết định là của người — đúng luật 3 của CLAUDE.md áp cho chính quy trình làm việc, không chỉ cho sản phẩm.
- Chỗ cần người kiểm lại: 11 draft là mẫu nhỏ. Nếu người quyết định thấy chưa đủ cơ sở, phương án đúng là **đo thêm** trước khi sửa, không phải sửa cho nhanh.

## Rollback

Đảo lại một dòng lọc. Không có migration, không đổi dữ liệu đã lưu — mức tin cậy cũ nằm trong `claims.confidence`, sửa cửa kiểm không ghi đè hàng cũ.

# Nhật ký quyết định (ADR)

> Mọi quyết định không tầm thường đều phải có một file ở đây. **Không có ADR = quyết định đó không tồn tại với BGK.**

## Vì sao bắt buộc

Rubric cả 5 giai đoạn đều lên mức 4 bằng đúng một công thức: **AI phản biện → lưu vết lý do, kể cả phương án bị loại → team giải thích được**. ADR là chỗ chứa cả ba. Kèm theo:

- **Bonus minh bạch** — có lưu lịch sử tương tác AI.
- **Chống penalty hộp đen** — vòng 2 BGK hỏi random 3–5 câu dựa trên log của đội. Trường *"team đã verify thế nào"* trong ADR chính là câu trả lời soạn sẵn.

## Khi nào viết ADR

Viết khi:

- Chọn giữa nhiều phương án kiến trúc / thư viện / mô hình dữ liệu
- Diễn giải một chỗ **mơ hồ trong Specs** theo một hướng (đây là loại ADR quan trọng nhất, hay bị quên nhất)
- Quyết định **không** làm một thứ, hoặc cắt scope
- Định nghĩa trần tự chủ của AI cho một tính năng
- Nhận output AI và quyết định tin nó (hoặc bác nó)

Không viết cho: đổi tên biến, sửa typo, format code.

## Cách viết

```bash
/hack:adr <mô tả ngắn quyết định>       # sinh ADR từ hội thoại hiện tại
```

Hoặc copy [adr-template.md](adr-template.md) thủ công.

**Quy ước tên:** `NNNN-mo-ta-ngan-kebab-case.md`, số tăng dần 4 chữ số.

**Kỷ luật quan trọng nhất:** mục *Phương án đã cân nhắc* phải có **ít nhất 2 dòng bị loại kèm lý do**. ADR chỉ ghi phương án được chọn là ADR vô giá trị — nó không chứng minh được là đã có cân nhắc.

## Chỉ mục

| ID | Giai đoạn | Quyết định | Trạng thái |
| --- | --- | --- | --- |
| [0011](0011-worker-cung-image-va-vong-quet-tu-hen-nhip.md) | Design | Worker cùng image qua `APP_ROLE`; vòng quét tự hẹn nhịp thay `@Cron` | Chấp nhận |
| [0010](0010-chan-tang-csdl-bang-hai-role-va-quyen-theo-cot.md) | Design | Lớp chặn CSDL bằng hai role Postgres + GRANT theo cột, không dùng trigger | Chấp nhận |
| [0009](0009-pham-vi-nut-tat-ai-chi-dung-sinh-moi.md) | Requirement | Nút tắt AI chỉ dừng việc sinh mới; hàng đợi tồn đọng vẫn duyệt được | Chấp nhận |
| [0008](0008-bo-goi-y-bang-menu-ly-do-tai-cho.md) | Requirement | Bỏ gợi ý bằng menu lý do tại chỗ; "số thao tác" đọc là số bước | Chấp nhận |
| [0007](0007-ba-muc-chac-chan-do-bang-khoang-cach-suy-luan.md) | Requirement | Ba mức chắc chắn đo bằng khoảng cách suy luận; mức "Chắc" do code cấp | Chấp nhận |
| [0006](0006-bat-dang-theo-doi-la-uy-quyen-phan-ghi-tin.md) | Requirement | Bật Đang theo dõi = uỷ quyền ghi tin; công ty đó không sinh gợi ý "thêm tin" | Chấp nhận |
| [0005](0005-tran-tu-chu-cua-viec-tu-dat-viec-tiep-theo.md) | Requirement | Trần tự chủ nhóm 4: điều kiện kích hoạt, phạm vi cơ hội, chính sách ghi đè | Chấp nhận |
| [0004](0004-chan-ranh-gioi-o-tang-domain-va-tang-csdl.md) | Design | Chặn cả 4 ranh giới ở hai lớp: actor context tầng domain + ràng buộc CSDL | Chấp nhận |
| [0003](0003-chi-tao-ban-luu-khi-noi-dung-thay-doi.md) | Design | "Nội dung mới" so bằng hash ở tầng bản lưu; chỉ tạo bản lưu khi hash khác | Chấp nhận |
| [0002](0002-cau-trich-phai-la-chuoi-con-nguyen-van-cua-ban-luu.md) | Requirement | Câu trích phải là chuỗi con nguyên văn của bản lưu, vị trí do code tính | Chấp nhận |
| [0001](0001-co-che-luu-vet-quyet-dinh-adr-va-prompt-log.md) | Meta | Dùng ADR + prompt log làm cơ chế lưu vết quyết định | Chấp nhận |

<!-- Thêm dòng mới lên đầu bảng mỗi khi tạo ADR -->

## Quan hệ với các nơi lưu vết khác

| Nơi | Chứa gì | Ai đọc |
| --- | --- | --- |
| **Grafana (telemetry Claude Code)** | Log tự động toàn bộ phiên làm việc | Chấm tự động vòng 1 + BGK vòng 2 |
| `docs/ai-sessions/` | Prompt log & output phản biện dạng đọc được | Đội, khi ôn vòng 2 |
| `docs/decisions/` (đây) | **Kết luận** + lý do + phương án bị loại | BGK, đội |

Ba nơi bổ trợ nhau: Grafana chứng minh *đã làm*, ai-sessions chứng minh *đã cân nhắc*, ADR chứng minh *hiểu vì sao*.

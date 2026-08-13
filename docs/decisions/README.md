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
| [0027](0027-nut-hoan-tac-nam-tren-the-co-hoi-du-lieu-di-qua-endpoint-rieng.md) | Design | Nút Hoàn tác nằm **trên thẻ cơ hội** (không chỉ trong màn thông báo); dữ liệu qua endpoint riêng, `OpportunityDto` không đổi | Chấp nhận — **chưa hỏi Sales, 4h là ước lượng chưa đo** |
| [0026](0026-hoan-tac-lan-nguoc-chuoi-event-de-tim-moc-nguoi-go.md) | Design | Hoàn tác **lần ngược chuỗi event** tìm mốc `previous_source ≠ 'system'`, không chép mốc người-gõ sang từng hàng | Chấp nhận — **test I-8 viết trong Phase 6, chưa chạy** |
| [0025](0025-moc-do-thoi-gian-quyet-dat-lai-sau-moi-quyet-dinh.md) | Design | Mốc `seconds_to_decide` đặt lại sau mỗi quyết định, không dùng một mốc chung lúc mở màn hình; **sửa ontology mục 7** | Chấp nhận — chưa có người thật bấm thử |
| [0024](0024-goi-y-sua-o-ho-so-do-llm-de-xuat-code-giu-ba-cua-chan.md) | Design | Gợi ý sửa ô hồ sơ do LLM đề xuất, code giữ ba cửa chặn (whitelist · `proposedValue` ⊂ câu trích · khác giá trị hiện tại); bản chụp phải có khối dữ kiện | Chấp nhận — **đã đo trên LLM thật**: G2 loại 2/3 → sửa prompt → 0/3, hai lượt lặp lại |
| [0023](0023-goi-y-viec-tiep-theo-la-proposal-type-thu-ba-kem-cot-opportunity-id.md) | Design | Gợi ý Việc tiếp theo (I-7) là `proposal_type = next_step` kèm cột `opportunity_id`, không ép vào hai loại có sẵn | Chấp nhận — **đã đo** |
| [0022](0022-ban-chup-hien-tai-la-cot-text-tren-companies-khong-phai-enum-cua-ontology.md) | Design | "Bản chụp hiện tại" là cột `text` + CHECK trên `companies`, không phải enum của ontology | Chấp nhận — **phép đo GRANT còn nợ ở phase 4** |
| [0021](0021-ban-chup-demo-giu-dang-hang-so-typescript-khong-tach-thanh-file-html.md) | Design | Bản chụp demo giữ dạng hằng số TypeScript trong `apps/api/src/ai/`, không tách thành file HTML | Chấp nhận |
| [0020](0020-doi-giai-doan-chi-bang-keo-tha-dnd-kit-duong-ban-phim-la-duong-lai-cua-t1.md) | Design + Build | Đổi giai đoạn chỉ bằng kéo thả dnd-kit, không kèm Select; đường bàn phím là đường lái của T-1 | Chấp nhận — **đã đo** |
| [0019](0019-co-canh-bao-suy-ra-tu-cot-null-khong-luu-thanh-cot.md) | Design | Cờ cảnh báo của cơ hội suy ra từ cột null, không lưu thành cột | Chấp nhận |
| [0018](0018-cua-kiem-muc-chac-bo-qua-ten-cua-chinh-cong-ty-dang-doc.md) | Implementation | Cửa kiểm mức Chắc bỏ qua tên của chính công ty đang đọc; vẫn kiểm số và tên bên thứ ba | **Đề xuất — chờ quyết định** |
| [0017](0017-i3-enforce-o-tang-service-rang-buoc-csdl-chi-danh-cho-ranh-gioi.md) | Design | I-3 enforce ở service, không `UNIQUE`; ràng buộc CSDL chỉ dành cho ranh giới, luật hành vi thuộc service | Chấp nhận |
| [0016](0016-proposal-status-chi-hai-gia-tri-moi-con-so-do-lay-tu-proposal-decisions.md) | Design | `Proposal.status` chỉ `pending \| decided`; mọi con số đo lấy từ `ProposalDecision` | Chấp nhận |
| [0015](0015-grant-insert-phai-theo-cot-khi-bang-co-cot-thuoc-quyet-dinh-cua-nguoi.md) | Design | `GRANT INSERT` mức bảng có cùng bẫy như `UPDATE` mức bảng; bảng có cột thuộc quyết định của người phải GRANT theo cột | Chấp nhận — **đã đo** |
| [0014](0014-nhom-2-rut-phat-hien-bang-llm-that-code-kiem-cau-trich.md) | Design | Nhóm 2 dùng LLM thật; code kiểm câu trích là chuỗi con và tự tính offset, không khớp thì bỏ claim | Chấp nhận — **đã đo 3/3** |
| [0013](0013-seed-theo-du-lieu-tu-dat-chap-nhan-migrate-khi-btc-giao-du-lieu.md) | Development | Seed bằng dữ liệu tự đặt, không chờ format BTC; chấp nhận effort migrate sau | Chấp nhận |
| [0012](0012-ban-luu-giu-html-goc-va-text-trich-offset-tinh-tren-text.md) | Design | Bản lưu giữ cả HTML gốc và text trích; offset câu trích và hash tính trên text | Chấp nhận |
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

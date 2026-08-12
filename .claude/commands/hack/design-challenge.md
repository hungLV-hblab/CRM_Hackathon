---
description: AI đóng vai virtual architect phản biện thiết kế, sinh decision matrix, lưu phương án bị loại
argument-hint: <vấn đề thiết kế cần chốt>
allowed-tools: Read, Grep, Glob, Write, Bash(date:*)
---

# Virtual architect phản biện thiết kế

Vấn đề cần chốt: **$ARGUMENTS**

## Bối cảnh bắt buộc đọc trước

- `docs/ai-native-design-principles.md` — ontology, Observation→Claim→Proposal, provenance, trần tự chủ
- `CLAUDE.md` — 7 luật, từ vựng ontology
- `docs/ontology.md` nếu đã có
- `docs/decisions/` — quyết định trước đó, **không được mâu thuẫn**

## Việc phải làm

### Bước 1 — Sinh 3 phương án thật khác nhau

Không sinh 1 phương án tốt + 2 phương án rơm. Mỗi phương án phải có người thật sự chọn được:

- Một phương án **tối giản nhất chạy được** trong quỹ thời gian còn lại tới feature freeze (tối 14/08)
- Một phương án **đúng bài AI-native nhất** theo tài liệu BTC
- Một phương án **đánh đổi khác hẳn** (đổi chiều: mua thay vì tự làm, hoãn thay vì làm, bỏ thay vì tối ưu)

### Bước 2 — Decision matrix

Chấm mỗi phương án theo tiêu chí, có trọng số, ghi rõ điểm và **lý do cho điểm**:

| Tiêu chí | Trọng số | A | B | C |
| --- | --- | --- | --- | --- |
| Làm kịp trước feature freeze tối 14/08 | cao | | | |
| Thoả "không provenance thì không hiển thị" | cao | | | |
| Fact/suy luận phân biệt được bằng mắt | cao | | | |
| Người duyệt trước khi ghi dữ liệu chính thức | cao | | | |
| Đo được auto-accept / error-detection rate | trung bình | | | |
| Demo được trong 10 phút cho Sales | cao | | | |
| Rủi ro kỹ thuật đội chưa từng làm | trung bình | | | |

### Bước 3 — Tự phản biện phương án thắng

Đổi vai thành người **muốn nó thất bại**. Nêu ≥ 3 cách phương án thắng sụp trước ngày nộp và cách chặn từng cái. Nếu không phá nổi thì nói thẳng là chưa phản biện đủ sâu.

### Bước 4 — Kiểm tra ontology

- Các đối tượng mới đặt tên đã đúng từ vựng chưa?
- Quan hệ giữa chúng **đọc lên thành câu tiếng Việt có nghĩa** chưa? Không gọi tên được quan hệ = chưa hiểu domain, dừng lại.
- Dữ liệu AI tạo ra rơi vào Observation, Claim hay Proposal? Trần tự chủ ở đâu?

## Output

Ghi ra `docs/ai-sessions/{YYMMDD-HHMM}-design-{slug}.md` (giờ lấy bằng `date +%y%m%d-%H%M`): 3 phương án + matrix + tự phản biện + kiểm tra ontology + khuyến nghị kèm điều kiện đảo quyết định.

## Kết thúc

Nhắc: *"Đã ghi log tại `<đường dẫn>`. Chốt bằng `/hack:adr <quyết định>` — nhớ bê nguyên 2 phương án bị loại kèm lý do vào ADR."*

Không code. Lệnh này chỉ phản biện và ghi vết.

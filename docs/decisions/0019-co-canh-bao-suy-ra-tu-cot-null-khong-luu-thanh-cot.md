# ADR-0019 — Cờ cảnh báo của cơ hội **suy ra** từ cột null, không lưu thành cột

| | |
| --- | --- |
| **Ngày** | 2026-08-13 12:15 |
| **Giai đoạn** | Design (nhóm 1 — CRM làm tay) |
| **Trạng thái** | Chấp nhận |
| **Người quyết định** | HungLV |
| **Prompt log** | phiên brainstorm phase 3 ngày 13/08 12:15 — [báo cáo](../../plans/reports/from-brainstorm-to-planner-260813-1215-phase-03-nhom-1-crm-lam-tay-report.md) |

## Bối cảnh

Specs nhóm 1 lặp lại ba lần rằng **không được chặn thao tác nào của Sales**: kéo sang Đủ điều kiện mà bỏ trống hai ô dấu hiệu → vẫn sang; sang Thua mà bỏ lý do → vẫn sang; cơ hội mở thiếu Việc tiếp theo → vẫn lưu. Đổi lại, dòng dữ liệu thiếu phải **mang cờ cảnh báo** để Sales thấy nó thiếu, và ở hai chỗ nữa cờ đó phải có hiệu lực: cơ hội Thua không lý do **đứng ngoài** bảng thống kê lý do thua, cơ hội thiếu Việc tiếp theo **không** vào danh sách việc phải làm.

Ba cờ đó hiện ở **ba màn hình** — bảng cơ hội, trang chi tiết công ty, màn tổng quan. Câu hỏi: lưu cờ thành cột (`has_warning`, hoặc ba cột boolean) hay suy ra mỗi lần đọc?

## Phương án đã cân nhắc

Tiêu chí: *(1)* cờ có bao giờ lệch khỏi dữ liệu nó mô tả không · *(2)* chi phí khi định nghĩa cờ thay đổi · *(3)* chi phí migration · *(4)* ba màn hình có trả lời giống nhau không.

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| **A.** Hàm thuần `opportunityWarnings(row)` suy từ các cột null, gọi lúc dựng DTO | Không có nguồn sự thật thứ hai → **không thể lệch**. Đổi định nghĩa cờ = sửa một hàm, không migration. Ba màn hình gọi chung một hàm nên bắt buộc trả lời giống nhau. Test được không cần CSDL | Tính lại mỗi lần đọc. Không lọc được cờ bằng `WHERE` trong SQL | ✅ **Chọn** |
| **B.** Cột `has_warning` (hoặc ba cột) cập nhật lúc ghi | Lọc được bằng SQL, đọc rẻ | **Nguồn sự thật thứ hai.** Lệch ngay lần đầu có ai đó điền ô dấu hiệu bằng SQL thẳng, bằng seed, hoặc bằng một đường ghi mới quên gọi hàm cập nhật — mà nhóm 4 và nhóm 5 **đều** ghi vào `opportunities`. Cộng một migration. Đổi định nghĩa cờ phải backfill | ❌ Loại — tiêu chí (1) |
| **C.** View/generated column trong Postgres | Không lệch, lọc được bằng SQL | Định nghĩa cờ nằm trong SQL, xa chỗ nó được đọc; sửa phải qua migration. Điều kiện `overdue` phụ thuộc **ngày hôm nay**, generated column không nhận hàm không tất định | ❌ Loại — tiêu chí (2), và `overdue` không biểu diễn được |

## Quyết định

Chọn **A**. Một file `apps/api/src/domain/opportunity/opportunity-warnings.ts`, thuần, không chạm CSDL, không JOIN:

```ts
export function opportunityWarnings(row: WarningSource): OpportunityWarning[]
export function isOverdue(row: WarningSource, today: string): boolean
```

`OPPORTUNITY_WARNING` khai trong `@crm/contracts` nhưng **đứng ngoài registry `ENUMS`**, cùng chỗ với `USER_ROLE`: ontology 3.5 liệt kê những enum có kiểu Postgres thật, còn cờ thì không có cột và không có `pgEnum`. Nhét vào registry là `ontology-enum-parity.test.ts` báo lệch giả.

Hai đánh đổi chốt kèm, ghi ra để đừng ai "sửa lại cho hợp lý":

- **Tập giai đoạn kiểm dấu hiệu là cố định** `{qualified, drafting, negotiation, won}`, không đọc dòng thời gian để biết deal "đã từng qualify chưa". Cái giá: deal đã qualified rồi chuyển `on_hold` sẽ **mất** cờ. Đổi lại hàm vẫn thuần và dùng được ở màn tổng quan, chỗ không có dòng thời gian trong tay.
- **Đủ = cả bốn ô** (câu **và** nguồn, cho cả nhu cầu lẫn ngân sách). Chốt chặn Qualify của Specs là "kiểm được cả hai chiều"; một câu không có nguồn thì chưa kiểm được chiều nào.

`isOverdue` nhận `today` làm tham số thay vì đọc đồng hồ, để test và màn hình nói cùng một ngày.

## Hệ quả

- **Thiếu Việc tiếp theo → có cờ → không overdue → tự vắng khỏi danh sách việc phải làm.** Một mệnh đề, không phải hai luật rời mà ai đó có thể quên một. Danh sách việc phải làm ở màn tổng quan lọc bằng chính `isOverdue`, không bằng một `WHERE` viết tay.
- Không lọc được cờ bằng SQL. Bộ lọc "chỉ hiện quá hạn" trên bảng cơ hội vì thế lọc **sau khi** dựng DTO. Với quy mô một đội Sales thì không đáng đổi; nếu bảng lên hàng chục nghìn dòng thì phải xem lại — nhưng lúc đó thêm một index trên `next_step_due_date` là đủ, vẫn không cần lưu cờ.
- Cờ được kiểm bằng test đơn vị không cần CSDL (`opportunity-warnings.test.ts`, 13 ca), nên sửa định nghĩa cờ có phản hồi trong một giây.
- **Sẽ phải xem lại nếu:** cần lọc hoặc sắp xếp theo cờ ở tầng SQL trên tập dữ liệu lớn, hoặc cần đếm cờ theo thời gian (báo cáo "tuần này có bao nhiêu deal thiếu dấu hiệu"). Lúc đó cái cần là **lịch sử**, và lịch sử không lưu được bằng một cột boolean hiện tại — nó là một bảng sự kiện riêng.

## AI đã tham gia thế nào

- **Vai trò AI:** nêu cả ba phương án và chỉ ra rằng `has_warning` sẽ lệch, vì nhóm 4 (tự đặt Việc tiếp theo) và nhóm 5 cùng ghi vào `opportunities` bằng đường khác.
- **AI sai ở đâu:** bản đầu AI đề xuất cờ dấu hiệu đọc dòng thời gian để biết deal đã từng qualify chưa — đúng về nghiệp vụ nhưng biến hàm thuần thành hàm phải JOIN, và màn tổng quan không gọi được. Đội chọn tập giai đoạn cố định và **ghi cái giá ra** thay vì giấu nó.
- **AI đề xuất gì mà đội không nghe:** AI khuyến nghị "đủ = hai ô câu, ô nguồn để tuỳ" cho nhẹ tay với Sales. Đội chọn **chặt hơn**: đủ = cả bốn. Lý do là chữ của Specs ("kiểm được cả hai chiều"), và hệ quả được nhận luôn — seed phải có ít nhất một cơ hội đủ bốn ô, không thì demo chỉ thấy một trạng thái.

## Đội đã verify bằng cách nào

- **Test đơn vị 13 ca chạy xanh**, viết trước hàm, phủ đúng hai đánh đổi: điền câu bỏ nguồn → **vẫn có cờ**; nhảy cóc `prospecting → negotiation` → có cờ; đi lùi về `prospecting` → cờ mất; `on_hold` không mang cờ dấu hiệu nhưng có cờ Việc tiếp theo; `won` không có cờ Việc tiếp theo; `lost` không lý do mang **đúng một** cờ.
- **Test tích hợp trên CSDL thật** (`opportunity-stage-never-blocks.test.ts`) xác nhận cờ đi kèm DTO trả về sau khi đổi giai đoạn, và cơ hội Thua thiếu lý do **không** vào `lostReasons` của màn tổng quan mà nằm ở `lostWithoutReason`.
- **Kiểm chéo với parity test:** `OPPORTUNITY_WARNING` để ngoài `ENUMS` — chạy `ontology-enum-parity.test.ts` ngay ở bước 1 để chắc nó không báo lệch, thay vì đợi tới cuối phase mới biết.

## Rollback

Thêm cột và backfill nếu thật sự cần lọc ở tầng SQL: một migration + một `UPDATE`, **~30'**. Nhưng lúc đó phải chọn **một** nguồn sự thật — hoặc cột, hoặc hàm — chứ không giữ cả hai, vì hai cái sẽ lệch và không ai biết cái nào đúng.

# ADR-0026 — Hoàn tác lần ngược chuỗi `AutoNextStepEvent` để tìm mốc người-gõ, không chép mốc sang từng hàng

| | |
| --- | --- |
| **Ngày** | 2026-08-14 00:20 |
| **Giai đoạn** | Design (nhóm 4, trước khi viết `AutoNextStepService`) |
| **Trạng thái** | Chấp nhận |
| **Người quyết định** | HungLV |
| **Prompt log** | *không có* — phiên phản biện thiết kế Phase 6, [báo cáo](../../plans/reports/from-brainstorm-to-planner-260813-2354-phase-06-nhom-4-tu-dat-viec-tiep-theo-report.md) |

## Bối cảnh

[ADR-0005](0005-tran-tu-chu-cua-viec-tu-dat-viec-tiep-theo.md) C1 cho máy đè ô trống **và ô do máy đặt trước đó**, chỉ cấm đè ô người gõ. Hệ quả: một cơ hội có thể tích **nhiều** `AutoNextStepEvent` liên tiếp.

Lúc đó I-8 — *"Hoàn tác trả về giá trị người-gõ gần nhất"* — không còn đọc được từ một hàng. Event mới nhất có `previous_text` = **giá trị máy đặt lần trước**, không phải giá trị người. Bấm Hoàn tác mà đọc cột đó là trả về đúng thứ Sales không muốn, và trông y như đang chạy đúng.

Phải chốt trước khi gõ code vì nó quyết định **ngữ nghĩa của ba cột `previous_*` đã tồn tại trong schema** (`packages/db/src/schema/auto-next-step-events.ts:39-41`), không phải chi tiết cài đặt sửa sau được.

## Phương án đã cân nhắc

Tiêu chí so: *(1)* cột đã có còn giữ đúng nghĩa của nó không · *(2)* thêm bao nhiêu cột/GRANT mới trước freeze · *(3)* chi phí lúc hoàn tác · *(4)* người đọc bảng sau này có hiểu đúng không.

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| **A. Lần ngược chuỗi lúc hoàn tác** — đọc event của cơ hội theo `created_at DESC`, lấy event gần nhất có `previous_source ≠ 'system'` | `previous_*` giữ nguyên nghĩa "thứ có ngay trước tôi"; 0 cột mới, 0 GRANT mới; trail đọc lên đúng chuyện đã xảy ra | Thêm một truy vấn mỗi lần hoàn tác | ✅ **Chọn** |
| B. Chép mốc người-gõ vào mỗi event lúc ghi | Hoàn tác chỉ đọc một hàng | `previous_text` **nói dối** — không còn là giá trị ngay trước. T-7 chấm "ghi vết hai chiều"; một cột sai nghĩa trong đúng bảng làm bằng chứng là chỗ tệ nhất để tối ưu. Người đọc bảng ở vòng 2 sẽ hiểu sai | ❌ Loại |
| C. Thêm cặp cột `human_baseline_*` trên `opportunities` | Hoàn tác đọc thẳng hàng cơ hội | Hai nguồn sự thật cho "người đã gõ gì" — cột mới và chuỗi event — mà thứ T-7 soi là chuỗi event. Cột mới ⇒ GRANT mới ⇒ phép đo đột biến mới, đúng ngày trước freeze. Ngược tinh thần [ADR-0019](0019-co-canh-bao-suy-ra-tu-cot-null-khong-luu-thanh-cot.md): suy ra được thì không lưu thành cột | ❌ Loại |
| D. Hoàn tác trả về `previous_*` của chính event vừa hoàn tác | Đọc xuôi chữ "giá trị trước đó", ít code nhất | Sai I-8 ngay lần máy đặt thứ hai: trả về **giá trị máy**. Đây chính là cái bẫy phase file đã cảnh báo — *"giá trị trước đó" nghe như là giá trị liền trước* | ❌ Loại |

## Quyết định

**A.** Tiêu chí quyết định là *(1)* và *(4)*: bảng `auto_next_step_events` không phải chỗ chứa dữ liệu tiện dụng, nó là **bằng chứng** biện minh cho quyền tự ghi của vùng 3. Một cột trong đó mà nghĩa lệch khỏi tên là mất luôn tác dụng làm bằng chứng, và đổi lại chỉ tiết kiệm một truy vấn trên thao tác mà Sales bấm vài lần một ngày.

Chốt kèm ba điểm cài đặt để không phải bàn lại:

- Vị từ tìm mốc là **`previous_source ≠ 'system'`** (gồm cả `NULL` = ô chưa từng có gì) → `previous_text`/`previous_due_date` của event đó là mốc người. Không tìm thấy event nào ⇒ mốc rỗng.
- Hoàn tác ghi `undone_*` **chỉ trên event mới nhất chưa hoàn tác**; các event máy cũ hơn giữ nguyên vì chúng là chuyện đã xảy ra thật.
- Trả ô về mốc: `next_step_source = 'human'` nếu mốc có text, `NULL` nếu mốc rỗng — không bao giờ trả về `'system'`.

## Hệ quả

- Kéo theo: `AutoNextStepService.undo()` cần một truy vấn lịch sử; đánh index `(opportunity_id, created_at)` khi chuỗi dài — hiện chưa cần.
- Kéo theo: mọi đường ghi `next_step_source` phải trung thực. Đường người gõ (`opportunity-service.ts:100,130`) và đường duyệt gợi ý (`proposal-decision-service.ts:129-138`) đều ghi `'human'`; đường máy ghi `actor.kind`. Vị từ ở trên đứng được là nhờ ba chỗ này.
- Đánh đổi chấp nhận: một truy vấn phụ mỗi lần hoàn tác.
- **Sẽ phải xem lại nếu:** xuất hiện đường ghi thứ tư vào `next_step_source` không phải người-gõ cũng không phải máy (ví dụ import dữ liệu BTC, hoặc `actor.kind` thêm giá trị). Lúc đó `≠ 'system'` không còn đồng nghĩa "người gõ" và vị từ phải viết lại thành danh sách trắng.

## AI đã tham gia thế nào

- Vai trò AI: đọc mã nguồn, dựng phản ví dụ, xếp bốn phương án theo tiêu chí. AI **khuyến nghị A** và đội theo.
- AI đề xuất gì mà đội không nghe: không có ở quyết định này.
- **AI sai ở đâu:** bản phase-06 do AI soạn trước đó chỉ ghi I-8 như một dòng cảnh báo *"đây là chỗ dễ làm sai nhất"* mà **không nêu cơ chế nào** để làm đúng — cảnh báo không phải thiết kế. Nếu vào code thẳng từ phase file cũ thì phương án D (sai) là thứ tự nhiên nhất để viết ra.

## Đội đã verify bằng cách nào

**Đã làm:**

1. **Dựng phản ví dụ cụ thể trên chuỗi thật.** Ô người gõ `"Gửi lại báo giá"` → máy đặt lần 1 (`previous_source = 'human'`) → máy đặt lần 2 (`previous_source = 'system'`, `previous_text` = câu máy đặt lần 1). Đọc `previous_*` của event 2 ra **câu của máy**. Đây là cách chứng minh D sai, không phải suy đoán.
2. **Kiểm vị từ `previous_source ≠ 'system'` có tin được không, bằng cách đếm đủ đường ghi vào cột đó.** Ba đường, đọc từng chỗ: tạo cơ hội (`opportunity-service.ts:100` — `'human'` khi có text), sửa cơ hội (`:130` — gõ đè ô máy thì trả quyền sở hữu về người), duyệt gợi ý `next_step` (`proposal-decision-service.ts:129-138` — ghi `'human'` kèm comment giải thích vì sao không ghi `'system'`). Không có đường thứ tư.
3. **Đối chiếu với comment schema.** `auto-next-step-events.ts:25-28` đã viết sẵn ý định "khôi phục giá trị người-gõ gần nhất, không phải phỏng đoán trước đó của máy" — phương án B/C sẽ làm code lệch khỏi tài liệu nằm ngay trong cùng file.

~~**Chưa làm:** chưa có test chạy~~ — **đã trả 14/08 00:44**, hai test trong `t6-t7-auto-next-step-and-undo.test.ts`. Nhưng lúc viết test thì lộ ra một chỗ ADR này nói sai, ghi lại nguyên văn vì nó đổi cách đọc quyết định:

**Phản ví dụ ở mục Bối cảnh không xảy ra được trong sản phẩm.** Nó bắt đầu bằng *"ô người gõ → máy đặt lần 1 (`previous_source = 'human'`)"* — mà **I-7 cấm đúng bước đó**. Máy không bao giờ đè ô người gõ, nên **không đường nào của sản phẩm sinh ra event mang `previous_source = 'human'`**. Chuỗi thật luôn bắt đầu từ ô trống: `NULL → máy 1 → máy 2`.

Quyết định **không đổi**, và lý do phải nói rõ chứ không phải "may mà vẫn đúng":

- Phương án D vẫn sai, chỉ là sai theo cách khác. Trên chuỗi thật, `previous_text` của event 2 là **câu máy đặt lần 1**; đọc cột đó ra là trả câu của máy vào ô rồi dán nhãn `human` lên nó. Bẫy y nguyên, chỉ khác giá trị đúng là **rỗng** chứ không phải một câu người gõ.
- Vị từ `previous_source IS DISTINCT FROM 'system'` vẫn là vị từ đúng, và phần `IS DISTINCT FROM` (gồm `NULL`) hoá ra không phải chi tiết phòng xa — nó là **nhánh duy nhất chạy thật**.

Hai test tách đôi theo đúng ranh giới đó: test 13 chạy chuỗi sản phẩm thật (trống → máy 1 → máy 2 → Hoàn tác phải về **trống**, có assert `not.toBe` câu máy 1); test 14 nạp thẳng chuỗi có `previous_source = 'human'` bằng vai `crm_owner` để đo vị từ ở nhánh sản phẩm chưa với tới — dữ liệu import có thể tới đường đó, và một vị từ chỉ từng chạy với `NULL` là vị từ chưa ai đo.

**Đo thêm, không nằm trong dự kiến:** `created_at` là `timestamptz` lưu tới **micro giây**, còn node-postgres trả về `Date` của JS chỉ có **mili giây**. Bản đầu của `undo()` hỏi *"có event nào mới hơn không"* bằng cách gửi ngược `Date` đó xuống làm tham số ⇒ `created_at > $1` **đúng với chính hàng vừa đọc ra**, và mọi lần Hoàn tác đều bị từ chối với câu "đã có lần tự đặt mới hơn" — kể cả khi chỉ có đúng một event. Sửa bằng cách hỏi *"event mới nhất có phải tôi không"* (so `id`) và dùng subquery cho mốc thời gian, để không giá trị thời gian nào rời khỏi CSDL rồi quay lại. Ba test bắt được lỗi này ngay lần chạy đầu.

## Rollback

Rẻ. Toàn bộ quyết định nằm trong thân hàm `undo()`; đổi sang B hoặc D là sửa một truy vấn, không có migration, không có dữ liệu phải dọn. Đắt duy nhất là nếu đã chạy demo với D rồi mới sửa — lúc đó các event đã sinh vẫn đúng, chỉ hành vi nút đổi.

# ADR-0020 — Đổi giai đoạn **chỉ** bằng kéo thả dnd-kit, không kèm Select; đường bàn phím là đường lái của T-1

| | |
| --- | --- |
| **Ngày** | 2026-08-13 12:15 (bổ sung số đo 13/08 17:10) |
| **Giai đoạn** | Design + Build (nhóm 1 — CRM làm tay) |
| **Trạng thái** | Chấp nhận |
| **Người quyết định** | HungLV |
| **Prompt log** | phiên brainstorm phase 3 ngày 13/08 12:15 — [báo cáo](../../plans/reports/from-brainstorm-to-planner-260813-1215-phase-03-nhom-1-crm-lam-tay-report.md) |

## Bối cảnh

Specs nhóm 1 đòi bảng cơ hội **kéo thả** qua 7 giai đoạn. T-1 thì chỉ đòi *"kéo qua ba giai đoạn có Đủ điều kiện, bỏ hai ô dấu hiệu vẫn kéo được + có cờ"* — tức là T-1 chấm **kết quả đổi giai đoạn**, không chấm cơ chế chuột.

Kéo thả bằng chuột nổi tiếng giòn trong e2e: nó phụ thuộc toạ độ, animation và ngưỡng kích hoạt. Nếu T-1 lái bằng chuột thì một bài nghiệm thu **không cắt được** lại treo vào phần dễ vỡ nhất của giao diện.

Cám dỗ hiển nhiên: thêm một `Select` giai đoạn cạnh mỗi thẻ làm "đường lái" cho test, giữ kéo thả cho người dùng.

## Phương án đã cân nhắc

Tiêu chí: *(1)* có bao nhiêu đường đổi giai đoạn phải giữ đúng · *(2)* T-1 có xác định không · *(3)* Specs có được đáp ứng không · *(4)* cắt được không nếu hết giờ.

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| **A.** Chỉ dnd-kit, bật **KeyboardSensor**; T-1 lái bằng bàn phím | **Một** đường đổi giai đoạn duy nhất. Bàn phím xác định (không toạ độ, không animation) nên T-1 ổn định. Đáp ứng Specs. Tiện ích tiếp cận là hệ quả miễn phí, không phải việc làm thêm | KeyboardSensor phải hoạt động thật; nếu hỏng thì mất cả đường người dùng lẫn đường test | ✅ **Chọn** |
| **B.** `Select` làm đường chính, kéo thả chồng lên sau | Test dễ nhất | **Hai** đường cho một việc → hai lần phải nhớ ghi dòng thời gian, hai lần phải nhớ mở hộp thoại hỏi dấu hiệu. Đường ít dùng sẽ mục. Và Specs đòi kéo thả nên vẫn phải làm nó | ❌ Loại — tiêu chí (1) |
| **C.** dnd-kit + `Select` ẩn chỉ cho test | T-1 ổn định, người dùng thấy một đường | Test lái một đường mà người dùng không bao giờ đi → **T-1 xanh không chứng minh cái Sales làm được**. Đây là dạng test tự lừa | ❌ Loại — tiêu chí (2) hiểu đúng nghĩa |

## Quyết định

Chọn **A**. `DndContext` với hai sensor:

```ts
useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
```

`sortableKeyboardCoordinates` (từ `@dnd-kit/sortable`) là thứ khiến phím mũi tên nhảy sang **cột kế tiếp** thay vì đẩy một con trỏ ảo 25px — mặc định của `KeyboardSensor` không dùng được cho bảng 7 cột.

Mỗi cột là một `useDroppable` mang `id` = mã giai đoạn, mỗi thẻ là `useSortable`. Khi thả, `over.id` có thể là cột **hoặc** một thẻ khác, nên `stageOf()` quy cả hai về cùng một giai đoạn — thiếu bước này thì thả trúng thẻ trong cột sẽ không làm gì cả.

Nếu hết giờ: **cắt đường chuột, giữ đường bàn phím**, không quay về dropdown (đó chính là phương án B đã loại).

## Hệ quả

- **Đo được, và số đo có điều kiện kèm theo:** đường bàn phím chạy đúng, nhưng **các phím bấm liên tiếp phải cách nhau**. Đo ngày 13/08 17:10, lặp lại hai lần cho kết quả y hệt:

  | Khoảng cách giữa các phím | Kết quả |
  | --- | --- |
  | 0ms (bấm liền) | **Không chuyển** — deal đứng nguyên |
  | 50ms | Chuyển đúng một cột |
  | 100ms | Chuyển đúng một cột |
  | 200ms | Chuyển đúng một cột |

  Nguyên nhân: `KeyboardSensor` khởi tạo toạ độ kéo sau khi `Space` nhấc thẻ; phím mũi tên bắn trong cùng một nhịp bị nuốt. Người thật không bao giờ bấm cách 0ms — đây là hiện tượng chỉ có trong test.

- **T-1 (P4) phải bấm phím có khoảng cách**, ví dụ `press(key, { delay })` hoặc chờ vùng `aria-live` của dnd-kit đổi nội dung giữa các bước. Viết `Space ArrowRight Space` liền nhau sẽ **đỏ mà không phải lỗi sản phẩm** — mất thời gian nhất đúng vào ngày cuối. Đây là lý do số đo trên nằm trong ADR chứ không nằm trong đầu một người.
- dnd-kit tự phát thông báo từng bước vào vùng `aria-live` ("moved over droppable area drafting" → "dropped over droppable area drafting"). Đây là đường chờ **xác định** cho e2e, tốt hơn `waitForTimeout`, và cũng là thứ giúp người dùng bàn phím biết mình đang ở đâu.
- Thả vào `qualified` hoặc `lost` mở hộp thoại hỏi thêm ô — hộp thoại **luôn** có nút "Để trống, bổ sung sau", và nút đó chính là chỗ luật không-chặn hiện lên màn hình.
- **Sẽ phải xem lại nếu:** dnd-kit đổi cách `sortableKeyboardCoordinates` chọn droppable, hoặc bảng có nhiều cột tới mức phải cuộn ngang khi kéo bằng bàn phím (hiện 7 cột vừa một màn 1440px, cuộn ngang chỉ xảy ra ở màn hẹp).

## AI đã tham gia thế nào

- **Vai trò AI:** dựng bảng cột/thẻ bằng mẫu multi-container của dnd-kit và chỉ ra rằng `KeyboardSensor` mặc định (đẩy con trỏ 25px) không dùng được cho bảng, phải là `sortableKeyboardCoordinates`.
- **AI sai ở đâu:** bản kiểm tra đầu tiên do AI viết bấm `Space ArrowRight Space` liền nhau rồi kết luận **"kéo thả bàn phím không hoạt động"**. Sai — cơ chế vẫn chạy; cái hỏng là harness. Nếu tin kết luận đó thì đã đi sửa một thứ không hỏng, hoặc tệ hơn, đã thêm `Select` trở lại đúng thứ ADR này loại. Chỉ khi in vùng `aria-live` ra mới thấy `"dropped over droppable area drafting"` và biết là mình đo sai.
- **AI đề xuất gì mà đội không nghe:** AI đề xuất giữ một `Select` dự phòng "cho chắc" khi lần kiểm đầu thất bại. Bỏ, vì lý do thất bại chưa được truy tới cùng — thêm đường thứ hai lúc đó là vá triệu chứng bằng đúng phương án đã loại.

## Đội đã verify bằng cách nào

- **Chạy thật trên stack production ở `:8080`**, không phải `next dev`: đăng nhập → `/co-hoi` → Tab tới thẻ → `Space` → `ArrowRight` → `Space`, rồi đọc lại cột chứa thẻ từ DOM. Deal chuyển từ "Đủ điều kiện" sang "Soạn đề xuất".
- **Quét khoảng cách phím 0/50/100/200ms, chạy lại toàn bộ hai lượt** — kết quả trùng khớp cả hai lượt, nên đây là ngưỡng thật chứ không phải nhiễu một lần.
- **Kiểm đường không-chặn qua bàn phím**: thả vào "Đủ điều kiện" → hộp thoại mở → bấm "Để trống, bổ sung sau" → deal sang cột mới **và** mang cờ "Chưa đủ dấu hiệu nhu cầu/ngân sách". Đây đúng là câu T-1 sẽ hỏi.
- **Đọc vùng `aria-live` của dnd-kit** để xác nhận từng bước (`moved over` → `dropped over`) thay vì suy đoán từ ảnh chụp màn hình.

## Rollback

Nếu tới trưa 14/08 mà đường chuột còn lỗi: **bỏ chuột, giữ bàn phím** — không sửa gì thêm, vì hai sensor độc lập. Mất điểm sản phẩm, không mất điểm nghiệm thu. Thêm `Select` trở lại là rollback **sai**: nó tạo đường đổi giai đoạn thứ hai, và mọi luật (ghi dòng thời gian, hỏi ô dấu hiệu) sẽ phải nhớ hai lần.

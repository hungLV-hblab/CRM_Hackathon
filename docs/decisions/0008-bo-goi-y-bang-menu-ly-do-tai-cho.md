# ADR-0008 — Bỏ gợi ý bằng menu lý do tại chỗ; "số thao tác" đọc là số bước, không phải số cú bấm

| | |
| --- | --- |
| **Ngày** | 2026-08-12 18:20 |
| **Giai đoạn** | Requirement (giải mâu thuẫn nội tại của Specs) |
| **Trạng thái** | Chấp nhận |
| **Người quyết định** | HungLV |
| **Prompt log** | [ai-sessions/260812-1742-req-phan-bien-de-bai-ai-native-crm.md](../ai-sessions/260812-1742-req-phan-bien-de-bai-ai-native-crm.md) — chất vấn CT-19; mơ hồ M-11 |

## Bối cảnh

Specs nhóm 3 mâu thuẫn trong **cùng một gạch đầu dòng**:

> *"Ba nút: Duyệt, Sửa rồi duyệt, Bỏ. **Bỏ là một thao tác, kèm chọn lý do** từ một danh sách ngắn... **Số thao tác để bỏ không được nhiều hơn số thao tác để duyệt.**"*

Duyệt = 1 cú bấm. Bỏ = bấm Bỏ + chọn lý do = 2 cú bấm. Đếm theo cú bấm thì không có cách nào thoả cả hai vế.

Điều khoản này không phải chuyện thẩm mỹ giao diện: nó tồn tại để **Sales không bị ma sát đẩy về phía bấm Duyệt cho nhanh**. Nếu bỏ khó hơn duyệt thì auto-accept rate bị thổi lên một cách giả tạo và cả hệ đo lường ở nhóm 6 mất nghĩa.

## Phương án đã cân nhắc

Tiêu chí so: *(1)* Sales có bị đẩy về phía Duyệt không · *(2)* còn thu được lý do bỏ để tính "phân bố lý do" ở nhóm 6 không · *(3)* có thêm màn hình trung gian không (Specs đòi hiện đủ bốn thứ tại chỗ) · *(4)* có làm méo chỉ số "thời gian quyết" không.

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| **A.** Nút Bỏ mở ngay một menu 5 lý do **tại chỗ** (popover trên chính thẻ gợi ý); chọn lý do **chính là** thao tác bỏ, không có nút xác nhận nữa. Đọc "số thao tác" = **số bước**, không phải số cú bấm | Một bước, không rời màn hình, không mất lý do. Không phạt hành vi bỏ | Vẫn là 2 cú bấm nếu đếm máy móc | ✅ **Chọn** |
| B. Thêm một bước xác nhận cho Duyệt để "cân" số thao tác | Thoả cách đọc đen của Specs | Phạt người dùng khi họ làm đúng. Và thổi **thời gian quyết** lên một cách giả tạo — đúng chỉ số Specs bắt đo ở nhóm 6 | ❌ Loại — cân bằng bằng cách làm hỏng cả hai bên |
| C. Bỏ không cần lý do; lý do là tuỳ chọn | 1 cú bấm, thoả tuyệt đối | Mất "phân bố lý do bỏ" mà nhóm 6 bắt hiện, và mất tín hiệu error-detection quan trọng nhất (bỏ vì *thông tin sai* khác hẳn bỏ vì *không liên quan*) | ❌ Loại — đổi một điều khoản Specs lấy một điều khoản Specs khác |
| D. Bấm Bỏ mở hộp thoại chọn lý do | Rõ ràng, dễ code | Thêm một màn hình — đi ngược tinh thần Specs *"hiện đủ bốn thứ tại chỗ, không phải bấm sang màn hình khác"*. Hộp thoại cũng chặn việc lướt nhanh qua nhiều gợi ý | ❌ Loại — thêm bước đúng vào nhánh cần ít bước nhất |

## Quyết định

Chọn **A**, kèm cách đọc tường minh: **"số thao tác" trong Specs đọc là số *bước quyết định*, không phải số lần ngón tay chạm chuột.** Duyệt = 1 bước (bấm Duyệt). Bỏ = 1 bước (bấm Bỏ → menu bung ra → chọn lý do là hoàn tất). Không nhánh nào có màn hình trung gian, không nhánh nào có nút xác nhận.

Tiêu chí quyết định là *(1)* đọc cùng *(4)*: mục đích của điều khoản là **giữ cho hai lựa chọn ngang giá về tâm lý**. B thoả câu chữ nhưng phá đúng mục đích đó, đồng thời làm méo một chỉ số Specs bắt đo.

## Hệ quả

- Kéo theo: menu 5 lý do phải hiện đủ trong một lần bung, không cuộn, không nhóm — 5 mục là vừa đủ cho việc này.
- Kéo theo: `seconds_to_decide` tính tới lúc **chọn lý do**, không phải lúc bấm nút Bỏ. Nếu tính ở nút Bỏ thì nhánh bỏ luôn trông nhanh hơn nhánh duyệt một cách giả.
- Kéo theo: nhánh **Sửa rồi duyệt** là 2 bước (mở ô sửa → duyệt) — nhiều hơn cả hai nhánh kia, và đó là đúng: đây là nhánh tốn công thật, không nên giả vờ rẻ.
- Đánh đổi chấp nhận: bấm nhầm nút Bỏ thì menu bung ra, người dùng phải bấm ra ngoài để huỷ. Chấp nhận vì menu bung không gây hậu quả gì cho tới khi chọn lý do.
- Sẽ phải xem lại nếu: Sales thử thật và thấy menu bung ra che mất thẻ gợi ý kế tiếp khi lướt nhanh.

## AI đã tham gia thế nào

- Vai trò AI: persona Tester/BA tìm ra mâu thuẫn nằm gọn trong một gạch đầu dòng (CT-19) — chỗ này đọc lướt rất dễ bỏ qua vì hai vế cách nhau đúng một dòng.
- **AI sai ở đâu:** phiên index 17:28 tóm tắt nhóm 3 là *"3 nút Duyệt / Sửa rồi duyệt / Bỏ (kèm lý do)"* và ghi thêm ý *"số thao tác bỏ không nhiều hơn duyệt"* **ngay cạnh nhau mà không thấy chúng đá nhau**. Hai mệnh đề mâu thuẫn đứng liền nhau trong cùng một bản tóm tắt vẫn lọt.
- AI đề xuất gì mà đội không nghe: AI nêu B như một cách "cân bằng công bằng". Đội loại ngay — công bằng bằng cách làm chậm cả hai bên là hiểu sai mục đích điều khoản.

## Đội đã verify bằng cách nào

**Đã làm:**

1. **Truy ngược mục đích của điều khoản thay vì đọc câu chữ.** Điều khoản này nằm cạnh yêu cầu đo tỉ lệ duyệt/sửa/bỏ ở nhóm 6 và yêu cầu tách bạch *sửa* khỏi *duyệt*. Ba yêu cầu cùng phục vụ một việc: **giữ cho số liệu phản ánh đánh giá thật của Sales, không phản ánh ma sát giao diện**. Đọc theo mục đích đó thì A đúng và B sai, dù B thoả câu chữ hơn.
2. **Đối chiếu với ngộ nhận đã ghi trong domain doc.** [domain doc mục 8](../sales-ito-crm-domain.md) cảnh báo CRM bị coi là *"thuế phải nộp"* rồi sales trốn nhập liệu. Thêm bước xác nhận cho hành vi đúng chính là cách tạo ra thứ thuế đó.
3. **Đếm bước trên bản phác ba nhánh** (duyệt / sửa rồi duyệt / bỏ) để chắc không nhánh nào phải rời màn hình hàng đợi: 1 / 2 / 1 bước, không nhánh nào mở màn hình mới.

**Chưa làm — điểm yếu của ADR này:** chưa có Sales thật bấm thử. Đây là quyết định về ma sát giao diện, mà ma sát chỉ đo được bằng người dùng thật, không đo được bằng suy luận. Vòng 3 do Sales chấm. Việc phải làm: dựng xong hàng đợi thì cho một người ngoài đội bấm thử 10 gợi ý, đếm xem họ bỏ mấy cái và hỏi có thấy nút Bỏ khó hơn nút Duyệt không. Người làm: HungLV, trước 14/08.

## Rollback

Rẻ nhất trong các ADR đã ghi — thuần giao diện, không đụng dữ liệu. Đổi sang D (hộp thoại) mất vài phút. Mốc đo `seconds_to_decide` thì phải sửa kèm, nếu không số liệu hai giai đoạn không so được với nhau.

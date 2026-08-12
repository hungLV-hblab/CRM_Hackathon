# ADR-0006 — Bật "Đang theo dõi" = uỷ quyền phần ghi tin cho hệ thống; công ty đó không sinh gợi ý loại "thêm tin"

| | |
| --- | --- |
| **Ngày** | 2026-08-12 18:20 |
| **Giai đoạn** | Requirement (diễn giải chỗ Specs im lặng) |
| **Trạng thái** | Chấp nhận |
| **Người quyết định** | HungLV |
| **Prompt log** | [ai-sessions/260812-1742-req-phan-bien-de-bai-ai-native-crm.md](../ai-sessions/260812-1742-req-phan-bien-de-bai-ai-native-crm.md) — chất vấn CT-11; mơ hồ M-5 |

## Bối cảnh

Hai nhóm cùng muốn ghi vào một chỗ, Specs không nói cái nào thắng:

- **Nhóm 3:** khi có phát hiện mới → sinh gợi ý, một trong hai loại là *"thêm một tin mới vào dòng thời gian của công ty"*, chờ Sales duyệt.
- **Nhóm 5:** với công ty Đang theo dõi → vòng quét **tự thêm** một mục vào đúng dòng thời gian đó, không chờ ai.

Công ty vừa bật Đang theo dõi vừa có phát hiện mới rơi vào cả hai. Kịch bản này chắc chắn xảy ra trong buổi chấm vì T-8 bắt bật Đang theo dõi cho ba công ty, còn T-4/T-5 bắt thao tác trên hàng đợi — chạy cạnh nhau là ra hai mục nội dung y hệt trên dòng thời gian, một do máy tự thêm, một do Sales bấm Duyệt.

## Phương án đã cân nhắc

Tiêu chí so: *(1)* dòng thời gian có nội dung trùng không · *(2)* có vi phạm câu "vòng lặp không dừng chờ ai duyệt ở bất kỳ bước nào" không · *(3)* quan hệ có đọc lên thành câu nghiệp vụ được không · *(4)* số thao tác thừa đổ lên Sales.

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| **A.** `is_watched = true` → **không** sinh `Proposal` loại `timeline_entry`; vẫn sinh loại `field_update` (nhóm 5 không đụng hồ sơ công ty) | Hết trùng. Đọc lên thành câu nghiệp vụ rõ: *"bật Đang theo dõi = tôi uỷ quyền phần ghi tin cho hệ thống"*. Không đụng vào vòng lặp nhóm 5 | Sales mất quyền duyệt tin cho đúng những công ty họ quan tâm nhất — nhưng bù lại họ **chủ động bật** nhãn đó, và xoá được từng mục | ✅ **Chọn** |
| B. Cả hai cùng chạy, khử trùng lúc duyệt | Giữ nguyên cả hai nhóm | Khử trùng cần so nội dung do LLM sinh, mà LLM không tất định ([ADR-0003](0003-chi-tao-ban-luu-khi-noi-dung-thay-doi.md)) → hai câu khác chữ cùng nghĩa vẫn lọt. Và Sales vẫn phải bấm duyệt cho việc máy đã làm rồi = thao tác thừa | ❌ Loại — chống trùng bằng một cơ chế không đáng tin |
| C. Công ty Đang theo dõi thì nhóm 5 chỉ rút phát hiện, việc ghi timeline vẫn qua hàng đợi | Sales giữ toàn quyền | Vi phạm thẳng Specs nhóm 5: *"vòng lặp không dừng lại chờ ai duyệt ở bất kỳ bước nào"*. Mất T-8 | ❌ Loại — Specs cấm |
| D. Bỏ hẳn loại gợi ý `timeline_entry` cho mọi công ty; chỉ vòng quét mới thêm tin | Đơn giản nhất | Công ty **không** bật Đang theo dõi sẽ không bao giờ có tin mới vào dòng thời gian → mất nửa giá trị nhóm 3 và làm nhãn Đang theo dõi thành bắt buộc trên thực tế | ❌ Loại — cắt mất một nửa tính năng để tránh một xung đột |

## Quyết định

Chọn **A**. Tiêu chí quyết định là *(3)*: đây là phương án duy nhất mà luật đọc lên thành **một câu nghiệp vụ Sales hiểu ngay** — bật nhãn là uỷ quyền, tắt nhãn là lấy lại quyền duyệt. B và C giải quyết xung đột bằng cơ chế kỹ thuật mà không giải thích được cho người dùng vì sao lại thế.

Hệ quả trực tiếp: **nhãn Đang theo dõi trở thành công tắc mức tự chủ**, không chỉ là công tắc tần suất đọc. Phải nói rõ điều này ngay trên giao diện chỗ bật nhãn, nếu không Sales bật xong mới phát hiện mình mất quyền duyệt.

Ghi vào [ontology.md](../ontology.md) là bất biến **I-5**.

## Hệ quả

- Kéo theo: chỗ bật nhãn Đang theo dõi phải có một dòng giải thích *"hệ thống sẽ tự ghi tin mới vào dòng thời gian, không hỏi duyệt"*. Không có dòng này thì quyết định trở thành bẫy.
- Kéo theo: tắt nhãn → công ty quay lại chế độ chờ duyệt. Gợi ý loại `timeline_entry` sinh lại bình thường từ bản lưu mới.
- Đánh đổi chấp nhận: với công ty Đang theo dõi, error-detection ở phần tin chỉ còn đo được qua thao tác **xoá mục** (bất biến I-13), không còn số liệu duyệt/bỏ. Đã tính vào công thức error-detection rate ở [ontology.md](../ontology.md) mục 7.
- Sẽ phải xem lại nếu: Sales phản hồi rằng họ muốn theo dõi sát **và** vẫn giữ quyền duyệt. Khi đó tách thành hai nhãn (theo dõi / tự ghi) — nhưng chỉ làm nếu có phản hồi thật, không làm sẵn.

## AI đã tham gia thế nào

- Vai trò AI: persona Tester/BA dựng kịch bản chạy T-8 cạnh T-4/T-5 và thấy va chạm (CT-11). Xung đột này không lộ khi đọc từng nhóm riêng lẻ — chỉ lộ khi mô phỏng hai bài test chạy trên cùng một công ty.
- **AI sai ở đâu:** phiên index 17:28 mô tả nhóm 3 và nhóm 5 như hai tính năng song song không liên quan, **không nhận ra cả hai cùng ghi vào `TimelineEntry`**. Đây là lỗi của việc tóm tắt theo cấu trúc tài liệu (Specs chia 6 nhóm) thay vì theo đối tượng dữ liệu bị chạm.
- AI đề xuất gì mà đội không nghe: AI nêu B (khử trùng) là phương án "an toàn nhất vì không mất tính năng nào". Đội loại vì nó dựa trên so khớp nội dung LLM sinh — cùng lý do đã loại phương án so ngữ nghĩa ở ADR-0003.

## Đội đã verify bằng cách nào

**Đã làm:**

1. **Dựng kịch bản demo trên giấy theo đúng thứ tự BGK sẽ chạy.** Bật Đang theo dõi cho 3 công ty (T-8) → đổi nguồn 2 công ty → trong đó có công ty đang có gợi ý chờ từ T-4 → Sales bấm Duyệt → đếm số mục trên dòng thời gian. Kết quả với phương án B/nguyên trạng: 2 mục cùng nội dung. Đây là phép thử trên trình tự thật của bộ nghiệm thu, không phải giả định.
2. **Kiểm ngược phương án C với văn bản Specs.** Câu *"Vòng lặp không dừng lại chờ ai duyệt ở bất kỳ bước nào"* được in đậm trong Specs nhóm 5 → C bị loại bằng chính văn bản, không cần tranh luận.
3. **Kiểm A không tạo lỗ hổng ở nhóm 3:** loại `field_update` vẫn chạy cho mọi công ty vì nhóm 5 chỉ ghi `TimelineEntry`, không chạm hồ sơ. Đối chiếu lại Specs nhóm 5 để chắc: đúng, vòng quét chỉ *"thêm một mục vào dòng thời gian"*.

**Chưa làm:** chưa hỏi Sales xem "bật nhãn = mất quyền duyệt tin" có phản trực giác không. Cùng danh sách câu hỏi với [ADR-0005](0005-tran-tu-chu-cua-viec-tu-dat-viec-tiep-theo.md). Người làm: HungLV, trước 14/08.

## Rollback

Rẻ. Một điều kiện `if (company.is_watched) skip` ở chỗ sinh `Proposal`. Đảo sang B chỉ là bỏ điều kiện đó và thêm bước khử trùng; dữ liệu đã sinh không cần dọn.

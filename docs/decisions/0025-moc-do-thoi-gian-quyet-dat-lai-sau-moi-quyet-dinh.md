# ADR-0025 — Mốc đo `seconds_to_decide` đặt lại sau mỗi quyết định, không dùng một mốc chung lúc mở màn hình

| | |
| --- | --- |
| **Ngày** | 2026-08-13 20:51 |
| **Giai đoạn** | Design (phase 5 — nhóm 3 hàng đợi gợi ý) |
| **Trạng thái** | Chấp nhận |
| **Người quyết định** | HungLV |
| **Prompt log** | phiên brainstorm phase 5 ngày 13/08 20:51 — [báo cáo](../../plans/reports/from-brainstorm-to-planner-260813-2051-phase-05-nhom-3-hang-doi-goi-y-report.md) |

## Bối cảnh

[ontology mục 7](../ontology.md) chốt: *"Mốc bắt đầu đo `seconds_to_decide`: **lúc mở màn hình hàng đợi** (gợi ý hiện đủ tại chỗ nên không có động tác 'mở gợi ý')."* Lý do đúng: theo ADR-0008, cả bốn thứ hiện tại chỗ nên không có cú bấm "mở gợi ý" nào để bấm mốc vào.

Nhưng câu đó chỉ đúng cho **thẻ đầu tiên**. Sales mở hàng đợi có 6 gợi ý và quyết lần lượt: nếu mọi thẻ dùng chung một mốc là lúc mở màn hình, thẻ thứ 6 mang giá trị bao gồm cả thời gian quyết 5 thẻ trước. Dãy thu được tăng đơn điệu theo thứ tự thẻ, nên **trung vị `seconds_to_decide` không còn là "thời gian quyết một gợi ý"** — nó là hàm của số thẻ đang có trong hàng đợi.

Chỉ số này không phải để trang trí: ontology mục 7 buộc đọc nó **cùng error-detection rate** để phân biệt "giao diện tốt" với "bấm mù". Một chỉ số phình theo độ dài hàng đợi thì không phân biệt được gì.

## Phương án đã cân nhắc

Tiêu chí so: *(1)* trung vị có đọc được thành "thời gian quyết một gợi ý" không · *(2)* có phạt nhánh nào trong ba nhánh không (đúng mục đích ADR-0008) · *(3)* đo được mà không cần thêm cột hay thêm event nào không · *(4)* giải thích được trong một câu ở vòng 2 không.

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| **A.** Mốc = lúc mở màn hình cho quyết định **đầu tiên**, sau đó **đặt lại tại mỗi quyết định vừa xong** ⇒ mỗi thẻ đo "thời gian kể từ khi rảnh tay" | Trung vị đọc được thành thời gian quyết một gợi ý. Không cần cột mới, không cần event mới — vẫn một số nguyên gửi kèm request | Lệch **câu chữ** ontology mục 7 ⇒ phải sửa ontology, không được để hai nơi nói khác nhau | ✅ **Chọn** |
| B. Giữ đúng câu chữ: một mốc chung lúc mở màn hình | 0 dòng sửa tài liệu | Chỉ số thành hàm của độ dài hàng đợi. Tệ hơn: nó **thưởng cho hàng đợi ngắn**, nên đội có động cơ ngầm sinh ít gợi ý để số đẹp — đúng loại méo mà [ADR-0008](0008-bo-goi-y-bang-menu-ly-do-tai-cho.md) dựng ra để tránh | ❌ Loại — giữ chữ, mất nghĩa |
| C. Bấm mốc khi thẻ lọt vào khung nhìn (`IntersectionObserver`) | Gần "lúc người đó bắt đầu đọc thẻ này" nhất | Cuộn qua cuộn lại là chuyện thường ⇒ mốc nhảy, số không tái lập được. Và không giải thích gọn được ở vòng 2 (tiêu chí *4*) | ❌ Loại |
| D. Bỏ hẳn chỉ số, chỉ giữ error-detection rate | Không phải quyết gì | Specs nhóm 3 đòi ghi *"mất bao nhiêu giây kể từ lúc mở gợi ý tới lúc bấm"*, và ontology mục 7 liệt kê nó là một trong bảy chỉ số. Bỏ = mất một dòng bảng điều khiển nhóm 6 | ❌ Loại |

## Quyết định

Chọn **A**, và **sửa ontology mục 7** cho khớp — không để tài liệu và code nói khác nhau.

Câu mới cho ontology mục 7: *Mốc bắt đầu đo `seconds_to_decide` là **lúc rảnh tay**: lúc mở màn hình hàng đợi với gợi ý đầu tiên, và lúc quyết xong gợi ý trước với mỗi gợi ý tiếp theo. Duyệt liên tiếp 6 gợi ý thì thu được 6 khoảng, không phải một khoảng cộng dồn.*

Mốc **kết thúc** giữ nguyên như ADR-0008 đã chốt: **lúc chọn lý do** với nhánh Bỏ, không phải lúc bấm nút Bỏ — nếu không nhánh Bỏ luôn trông nhanh hơn một cách giả. Hai ADR không xung đột: ADR-0008 nói mốc kết thúc, ADR này nói mốc bắt đầu.

Tiêu chí quyết là *(1)* và *(2)* đọc cùng nhau. B thoả câu chữ nhưng tạo đúng một động cơ ngược: hàng đợi càng ngắn thì "thời gian quyết trung bình" càng đẹp. Cùng dạng lỗi mà ADR-0008 đã loại một lần — **cân bằng con số bằng cách làm hỏng thứ nó đang đo**.

## Hệ quả

- Kéo theo: đồng hồ nằm ở **client** (`apps/web/src/app/hang-doi/`), một biến mốc duy nhất, đặt lại trong callback thành công của mỗi lần quyết. Không cột mới, không endpoint mới.
- Kéo theo: `seconds_to_decide` vẫn **nullable** — reload trang giữa lúc quyết thì mốc mất, và **để trống tốt hơn gửi một con số bịa** (luật 4). Bảng điều khiển nhóm 6 phải chịu được cột này rỗng một phần và **nói rõ mẫu là bao nhiêu**, không lặng lẽ tính trung vị trên tập con.
- Kéo theo: sửa `docs/ontology.md` mục 7 trong cùng phase. Ontology đổi ⇒ theo mục 8 của chính nó, phải rà chỗ nào trong code đọc mốc này (hiện chỉ có một chỗ, vì P5 là phase đầu tiên chạm).
- Đánh đổi chấp nhận: hai thẻ quyết cách nhau 20 phút (Sales đi họp về) sẽ cho một khoảng vô nghĩa lớn. Dùng **trung vị** như ontology đã chốt, không dùng trung bình, nên một khoảng lạc không kéo được chỉ số.
- Sẽ phải xem lại nếu: đo thật thấy trung vị dưới ~3 giây trong khi error-detection rate cũng thấp — dấu hiệu bấm mù, và khi đó vấn đề nằm ở hàng đợi chứ không ở mốc đo.

## AI đã tham gia thế nào

- Vai trò AI: chỉ ra rằng câu trong ontology chỉ đúng cho thẻ đầu tiên — chỗ này đọc một lần rất khó thấy, vì câu đó có kèm lý do nghe hợp lý ("gợi ý hiện đủ tại chỗ nên không có động tác mở gợi ý"), mà lý do ấy chỉ giải thích **vì sao không có mốc riêng cho từng thẻ**, không giải thích vì sao mốc chung lại đúng.
- AI đề xuất gì mà đội không nghe: AI nêu phương án C (`IntersectionObserver`) là "gần thực tế nhất". Đội loại vì cuộn qua cuộn lại làm số không tái lập, và vòng 2 hỏi "sao thẻ này 2 giây" thì không trả lời gọn được.
- AI sai ở đâu: trong cùng phiên này AI **thoạt đầu định giữ nguyên câu chữ ontology** rồi ghi chú "median sẽ dốc lên theo thứ tự thẻ" như một hạn chế chấp nhận được — tức đã thấy triệu chứng mà vẫn định để nguyên nguyên nhân.

## Đội đã verify bằng cách nào

**Đã làm:**

1. **Truy ngược công thức để xem chỉ số bị méo tới mức nào.** ontology mục 7 định nghĩa "Thời gian quyết trung bình" = **trung vị** `seconds_to_decide`. Với phương án B, dãy giá trị của một lượt duyệt n thẻ là cộng dồn, nên trung vị xấp xỉ **nửa tổng thời gian của cả lượt** — tức chỉ số đo "một lượt duyệt dài bao lâu", không đo "một quyết định mất bao lâu". Sai đơn vị, không phải sai độ chính xác.
2. **Đối chiếu với mục đích của ADR-0008.** Điều khoản "số thao tác bỏ không nhiều hơn duyệt" tồn tại để số liệu phản ánh **đánh giá thật của Sales**, không phản ánh ma sát giao diện. Một mốc đo phình theo độ dài hàng đợi đưa ma sát trở lại vào số liệu qua cửa sau.
3. **Kiểm ràng buộc kỹ thuật trước khi chốt**, không giả định: `secondsToDecide` là `z.number().int().nonnegative().optional()` trong `decideProposalSchema` (`packages/contracts/src/dto/proposal.ts`) và `integer` nullable trong bảng (`packages/db/src/schema/proposal-decisions.ts:34`) ⇒ đổi cách tính **không cần** migration hay đổi contract, và ca "để trống" đã hợp lệ sẵn.
4. **Kiểm không xung đột ADR-0008** bằng cách đọc lại mục Hệ quả của nó: nó chỉ ràng buộc mốc **kết thúc** (lúc chọn lý do). Không có câu nào về mốc bắt đầu ⇒ ADR này bổ sung, không đảo.

**Chưa làm — điểm yếu của ADR này:** chưa có người thật duyệt một lượt nhiều gợi ý, nên chưa biết phân bố thật của khoảng "rảnh tay → bấm". Gộp vào đúng việc ADR-0008 đang nợ: cho một người ngoài đội bấm thử 10 gợi ý trước 14/08, lần này ghi kèm dãy `seconds_to_decide` để xem có khoảng lạc nào không. Người làm: HungLV.

## Rollback

Rẻ nhất trong ba ADR của phase 5: một biến mốc ở client. Đảo về B mất vài phút. **Cảnh báo kèm:** đổi mốc giữa lúc đã có dữ liệu thì số liệu hai giai đoạn **không so được với nhau** — cùng cảnh báo ADR-0008 đã ghi. Đổi thì phải xoá dữ liệu đo cũ hoặc ghi rõ mốc thời điểm đổi.

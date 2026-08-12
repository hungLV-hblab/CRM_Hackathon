# ADR-0004 — Chặn bốn ranh giới ở hai lớp: actor context tầng domain + ràng buộc tầng CSDL

| | |
| --- | --- |
| **Ngày** | 2026-08-12 18:20 |
| **Giai đoạn** | Design (kiến trúc, không phải tính năng) |
| **Trạng thái** | Chấp nhận |
| **Người quyết định** | HungLV |
| **Prompt log** | [ai-sessions/260812-1742-req-phan-bien-de-bai-ai-native-crm.md](../ai-sessions/260812-1742-req-phan-bien-de-bai-ai-native-crm.md) — chất vấn CT-22, CT-23; mơ hồ M-7 |

## Bối cảnh

Specs mục 5 liệt kê bốn ranh giới và nói: *"Ba ranh giới đầu phải chặn được kể cả khi thao tác đến từ **ngoài giao diện người dùng**. Một lời dặn dò suông với phần AI không tính là đã chặn."* T-10 kiểm bằng cách thử đổi giai đoạn, đổi giá trị tiền và xoá một công ty **dưới danh nghĩa hệ thống, không đi qua giao diện**.

Hai chỗ chưa xác định: *"ngoài giao diện"* là tầng nào (HTTP API? tầng service? SQL trực tiếp?), và ranh giới nào phải chặn — Specs nói "ba ranh giới đầu" nhưng T-10 lại thử cả **xoá công ty**, vốn là ranh giới thứ tư.

Đây là quyết định kiến trúc, không phải tính năng: làm sau thì phải sửa mọi đường ghi trong hệ thống.

## Phương án đã cân nhắc

Tiêu chí so: *(1)* chặn được thao tác đến từ tầng nào · *(2)* trả lời được câu hỏi vòng 2 "chứng minh nó bị chặn thật" · *(3)* chi phí cài đặt và ảnh hưởng lên tốc độ code.

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| **A.** Hai lớp: mọi đường ghi mang `actor`, tầng service từ chối khi `actor = system` chạm 4 hành động cấm và ghi `AuditEvent`; **cộng** ràng buộc/trigger tầng CSDL cho `stage`, `expected_value`, và xoá dữ liệu người tạo | Chặn được cả khi test gọi thẳng service lẫn khi code AI gọi thẳng repository. Có `AuditEvent` làm bằng chứng đọc được, không phải "tin tôi đi" | Phải truyền `actor` qua mọi đường ghi ngay từ đầu — sửa muộn thì đắt | ✅ **Chọn** |
| **B.** Chặn ở tầng controller/API | Rẻ nhất, một middleware | T-10 nói rõ "không đi qua giao diện người dùng" — nếu BGK gọi tầng service thì thủng sạch. Và chính vỏ API là thứ Specs ám chỉ khi nói "ngoài giao diện" | ❌ Loại — không chống được đúng kịch bản mà T-10 mô tả |
| **C.** Chỉ lớp domain, bỏ lớp CSDL | Đủ để qua T-10 nếu BGK gọi qua service; ít việc hơn | Không trả lời được "nếu một đoạn code AI gọi thẳng repository thì sao" — mà đây là câu hỏi vòng 2 rất dễ bị hỏi. Chi phí lớp thứ hai thấp: đúng 3 trường | ❌ Loại — tiết kiệm nhầm chỗ, mất điểm governance |
| **D.** Ghi vào prompt/chỉ dẫn hệ thống rằng AI không được làm 4 việc đó | Không tốn công | Chính là thứ Specs gọi tên và loại bỏ: *"một lời dặn dò suông với phần AI không tính là đã chặn"* | ❌ Loại — Specs cấm thẳng |

## Quyết định

Chọn **A**, và **chặn cả bốn ranh giới**, không chỉ ba.

Lý do chặn cả bốn: Specs nói "ba ranh giới đầu" nhưng T-10 lại thử xoá công ty (ranh giới 4). Hai câu này lệch nhau; chọn cách đọc rộng hơn vì chi phí thêm gần bằng 0 còn rủi ro đọc hẹp là trượt một phần ba của T-10.

Ranh giới 3 (không liên hệ khách) không có kênh nào để chặn vì sản phẩm không có tính năng gửi tin. Bằng chứng thay thế: **không tồn tại adapter gửi thư/tin nhắn nào trong mã nguồn**, kèm một test khẳng định điều đó.

Ghi vào [ontology.md](../ontology.md) mục 5, phần "Vùng cấm tuyệt đối".

## Hệ quả

- Kéo theo: mọi hàm ghi ở tầng service nhận `actor` — **không có giá trị mặc định**, thiếu thì từ chối. Quy ước này phải áp từ commit đầu tiên; thêm vào sau đồng nghĩa với sửa mọi chữ ký hàm.
- Kéo theo: mỗi lần ranh giới từ chối một thao tác đều ghi `AuditEvent`. Đây vừa là bằng chứng cho vòng 2 vừa là thứ hiện được lên bảng Quản trị.
- Đánh đổi chấp nhận: hai chỗ giữ cùng một luật (domain + CSDL) — luật đổi thì phải sửa hai nơi. Chấp nhận vì luật này do Specs chốt, gần như không đổi.
- Sẽ phải xem lại nếu: stack chọn ngày 12/08 không cho phép ràng buộc ở tầng CSDL một cách gọn gàng (ví dụ dùng lưu trữ không có trigger). Khi đó thay lớp 2 bằng một tầng repository duy nhất mà mọi truy cập bắt buộc đi qua, và **nói rõ trong README đây là lớp thay thế**, không im lặng bỏ.

## AI đã tham gia thế nào

- Vai trò AI: persona Tester/BA phát hiện lệch giữa mục 5 và T-10 (CT-22), và chỉ ra "ngoài giao diện" là ba mức khó khác hẳn nhau (CT-23).
- **AI sai ở đâu:** phiên index 17:28 tóm tắt mục 5 đúng theo văn bản là "ba ranh giới đầu phải chặn ngoài UI" mà **không đối chiếu với T-10** — nếu đội code theo bản tóm tắt đó thì bỏ trống phần xoá công ty và mất một phần T-10.
- AI đề xuất gì mà đội không nghe: AI đề nghị gửi câu hỏi Q-2 cho BTC để làm rõ "ngoài giao diện" rồi mới quyết. Đội **không chờ** — chọn cách đọc chặt nhất và code luôn, vì chờ BTC trả lời có thể mất cả ngày trong khi chi phí làm chặt hơn là thấp. Câu hỏi vẫn gửi, nhưng không chặn tiến độ.

## Đội đã verify bằng cách nào

**Đã làm:**

1. **Đọc T-10 như một kịch bản tấn công, không như một câu mô tả.** T-10 viết "dưới danh nghĩa hệ thống, không đi qua giao diện người dùng" — dịch sang code nghĩa là bộ test gọi trực tiếp vào một tầng nào đó của ứng dụng với `actor = system`. Tầng thấp nhất mà một bộ test cùng repo gọi tới được là repository/CSDL. Vậy điểm chặn phải nằm ở đó hoặc thấp hơn. Đây là suy dẫn từ chính cách bộ nghiệm thu được chạy, không phải phỏng đoán.
2. **Đối chiếu chéo:** Specs mục 5 · [ai-native-design-principles.md](../ai-native-design-principles.md) mục 5 ("least privilege + separation of duties áp lên một user kiểu mới là AI agent") · [CLAUDE.md](../../CLAUDE.md) mục 4. Ba nguồn cùng đòi enforce bằng cơ chế, không bằng thiện chí.

**Chưa làm:** chưa chọn stack nên chưa biết lớp CSDL hiện thực bằng gì (trigger, quyền cột, hay check constraint). Việc phải làm ngay sau khi chốt stack: viết T-10 **trước** khi viết tính năng, để nó đỏ từ đầu và chỉ xanh khi hai lớp đã xong.

## Rollback

Không rẻ — đây là lý do phải quyết trước khi code. Gỡ lớp CSDL thì dễ; nhưng nếu bỏ `actor` khỏi chữ ký hàm rồi muốn thêm lại giữa ngày thi thì phải sửa mọi đường ghi. Quyết định thực tế: **`actor` là bắt buộc từ commit đầu tiên, không rollback**; chỉ lớp CSDL mới là phần có thể đổi cách hiện thực.

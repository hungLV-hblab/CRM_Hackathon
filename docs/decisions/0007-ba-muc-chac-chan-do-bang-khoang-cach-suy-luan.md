# ADR-0007 — Ba mức chắc chắn đo bằng khoảng cách suy luận, không bằng có/không câu trích; mức "Chắc" do code cấp

| | |
| --- | --- |
| **Ngày** | 2026-08-12 18:20 |
| **Giai đoạn** | Requirement (giải mâu thuẫn nội tại của Specs) |
| **Trạng thái** | Chấp nhận |
| **Người quyết định** | HungLV |
| **Prompt log** | [ai-sessions/260812-1742-req-phan-bien-de-bai-ai-native-crm.md](../ai-sessions/260812-1742-req-phan-bien-de-bai-ai-native-crm.md) — chất vấn CT-15, CT-16; mơ hồ M-9 |

## Bối cảnh

Specs tự mâu thuẫn ở hai câu cách nhau vài mục:

- Mục 2 định nghĩa mức **Đoán** = *"không có bằng chứng trực tiếp"*.
- Nhóm 2 chốt: *"Không lưu được một phát hiện không có câu trích."*

Đọc theo nghĩa đen thì mức Đoán không tồn tại được — một enum Specs định nghĩa mà không bao giờ có bản ghi nào mang giá trị đó.

Chỗ hở thứ hai: Specs không nói **ai** gán mức chắc chắn. Nếu để LLM tự khai thì nó tự phong "Chắc", và luật 2 của [CLAUDE.md](../../CLAUDE.md) ("fact và suy luận phân biệt được ngay bằng mắt") trở thành trang trí — màu sắc trên giao diện dựa trên một nhãn không ai kiểm.

## Phương án đã cân nhắc

Tiêu chí so: *(1)* cả ba mức có tồn tại được không · *(2)* nhãn có kiểm được bằng máy không · *(3)* có phải sửa enum Specs chốt không.

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| **A.** Cả ba mức **đều bắt buộc có câu trích**; khác nhau ở **khoảng cách từ câu trích tới câu nhận định**. `certain` = nhận định gần như trích thẳng · `likely` = suy một bước · `speculative` = suy nhiều bước từ đoạn liên quan gián tiếp. Mức `certain` chỉ được cấp khi **code kiểm được** mọi con số và danh từ riêng trong nhận định đều xuất hiện trong câu trích | Ba mức cùng tồn tại; không đụng enum Specs; mức cao nhất — mức người dùng tin nhất — có một cửa kiểm bằng máy | `likely` và `speculative` vẫn do LLM tự khai; chỉ chặn được việc tự phong mức cao nhất | ✅ **Chọn** |
| B. `speculative` = không có câu trích, được lưu như ngoại lệ | Bám sát chữ "không có bằng chứng trực tiếp" | Vỡ thẳng ràng buộc nhóm 2 và [ADR-0002](0002-cau-trich-phai-la-chuoi-con-nguyen-van-cua-ban-luu.md); mở lại đúng cái cửa hậu cho phát hiện không nguồn mà luật 1 cấm | ❌ Loại — đánh đổi luật cứng lấy một enum |
| C. LLM tự khai cả ba mức, không kiểm gì | Rẻ nhất | LLM tự phong `certain` cho thứ nó suy luận. Người dùng nhìn màu để quyết định tin hay không → màu sai thì cả cơ chế phân biệt fact/suy luận thành vô nghĩa. Đây đúng là "tính năng đúng 8/10 lần nhưng không chỉ được nguồn" mà [domain doc mục 8](../sales-ito-crm-domain.md) cảnh báo | ❌ Loại — làm hỏng luật 2 |
| D. Bỏ mức `speculative`, chỉ giữ hai mức | Hết mâu thuẫn | Specs mục 2 chốt **ba bậc**; đội không được tự đổi từ vựng Specs | ❌ Loại — vượt quyền |

## Quyết định

Chọn **A**. Tiêu chí quyết định là *(2)*: trong ba mức thì `certain` là mức duy nhất người dùng dựa vào để hành động ngay mà không kiểm lại, nên nó là mức duy nhất **bắt buộc phải có cửa kiểm bằng máy**. Hai mức còn lại sai thì thiệt hại thấp hơn nhiều vì bản thân nhãn đã nói "chưa chắc".

Cách kiểm `certain` cụ thể: mọi **số** và mọi **chuỗi viết hoa** (tên riêng, tên công ty, tên chức danh) xuất hiện trong `statement` phải có mặt trong `quote_text`. Không thoả → hạ xuống `likely`. Đây là phép kiểm thô nhưng bắt đúng lỗi nguy hiểm nhất: LLM thêm một con số hoặc một cái tên không có trong nguồn rồi gắn nhãn Chắc.

Ranh giới này khớp với định nghĩa ở [ai-native-design-principles.md](../ai-native-design-principles.md) mục 4: *ghi chép 1-1 thì không phải claim; hễ biến đổi thông tin gốc là claim*. `certain` là claim có mức biến đổi gần bằng 0.

Ghi vào [ontology.md](../ontology.md) mục 3.5 (enum `confidence`).

## Hệ quả

- Kéo theo: phải viết được định nghĩa ba mức **bằng lời** vào prompt sinh phát hiện, không chỉ liệt kê tên mức. LLM không đoán được "một bước" nghĩa là gì nếu không có ví dụ.
- Kéo theo: số lần hệ thống **hạ mức** từ `certain` xuống `likely` là một chỉ số đáng ghi — nó đo mức độ LLM tự tin quá đà, cùng họ với bộ đếm câu trích không khớp ở ADR-0002.
- Đánh đổi chấp nhận: `likely` và `speculative` vẫn là lời khai của LLM. Đội không có cách kiểm rẻ nào cho ranh giới giữa hai mức này trong khung thời gian hackathon.
- Sẽ phải xem lại nếu: phép kiểm thô chặn nhầm quá nhiều — ví dụ nhận định viết "Series B" trong khi nguồn viết "Series-B" hoặc "series B". Xử lý khi đó: chuẩn hoá trước khi so (cùng bước chuẩn hoá của ADR-0002), **không** bỏ phép kiểm.

## AI đã tham gia thế nào

- Vai trò AI: persona Tester/BA phát hiện mâu thuẫn nội tại (CT-15) và lỗ "ai gán mức" (CT-16).
- **AI sai ở đâu:** phiên index 17:28 chép lại định nghĩa ba mức từ Specs vào `llms.txt` **y nguyên, kèm cả mâu thuẫn**, mà không nhận ra "Đoán = không có bằng chứng trực tiếp" đá nhau với "không câu trích thì không lưu". Chép trung thành không phải là hiểu.
- AI đề xuất gì mà đội không nghe: AI đề xuất kiểm `certain` bằng cách so độ tương đồng giữa `statement` và `quote_text`. Đội đổi sang phép kiểm số + danh từ riêng — vì độ tương đồng lại đẻ ra một ngưỡng phải bào chữa, đúng thứ đã loại hai lần ở ADR-0002 và ADR-0003.

## Đội đã verify bằng cách nào

**Đã làm:**

1. **Kiểm mâu thuẫn bằng cách thử sinh dữ liệu cho từng mức.** Với cách hiểu B, thử viết một bản ghi hợp lệ mang mức `speculative`: bất khả — ràng buộc nhóm 2 chặn ở cửa. Một cách hiểu làm cho một giá trị enum không bao giờ tồn tại được thì cách hiểu đó sai. Cùng kiểu lập luận đã dùng ở [ADR-0003](0003-chi-tao-ban-luu-khi-noi-dung-thay-doi.md) (cách đọc nào làm một điều khoản Specs vô hiệu thì sai).
2. **Đối chiếu với ranh giới claim của tài liệu training.** [ai-native-design-principles.md](../ai-native-design-principles.md) mục 4 định nghĩa claim theo **mức độ biến đổi thông tin gốc**, không theo có/không nguồn — đây là nguồn độc lập xác nhận cách hiểu A: ba mức là ba mức biến đổi, tất cả đều có nguồn.
3. **Thử phép kiểm `certain` trên hai ví dụ dựng tay.** Nguồn: *"XYZ Corp closed a $12M Series B led by ABC Ventures"*. Nhận định A: *"XYZ Corp vừa gọi vốn Series B 12 triệu USD"* → mọi số (12) và tên riêng (XYZ, Series B) có trong câu trích → giữ `certain`. Nhận định B: *"XYZ Corp vừa gọi vốn và đang tuyển 20 kỹ sư"* → số 20 không có trong câu trích → hạ mức. Phép kiểm bắt đúng trường hợp cần bắt.

**Chưa làm:** chưa chạy trên LLM thật để đo tỉ lệ bị hạ mức. Gộp vào cùng lần chạy thực nghiệm của ADR-0002 và ADR-0003 — ba ADR chia nhau một phép đo.

## Rollback

Rẻ. Phép kiểm `certain` là một hàm ở cùng chỗ với kiểm câu trích (ADR-0002). Tắt nó thì hệ thống lùi về phương án C; dữ liệu đã sinh vẫn hợp lệ, chỉ là mức chắc chắn kém tin hơn.

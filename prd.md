# Đề bài hackathon — "AI Native CRM"

Tài liệu chỉ nói **cần cái gì** và **hệ thống phải cư xử ra sao**. Cách dựng, chia tầng, chọn công cụ, bố cục màn hình — đội thi tự quyết hoàn toàn.

---

## 1. Bối cảnh nghiệp vụ

Đội bán hàng của HBLAB theo đuổi khách hàng doanh nghiệp (mô hình B2B). Quy trình hiện tại của sales hiện nằm rải rác trong bảng tính: một bảng danh sách công ty tiềm năng, một bảng theo dõi cơ hội đang chạy, một mớ ghi chú cá nhân, và khác nhau giữa các thị trường JP, Global, KR.

Hai nỗi đau lớn nhất:

**Thứ nhất, hồ sơ công ty luôn cũ.** Một khách hàng tiềm năng gọi được vốn, đổi giám đốc công nghệ, hay mở văn phòng mới — Sales chỉ biết khi tình cờ đọc tin. Lúc đó thường **đã muộn**.

**Thứ hai, việc gõ lại thông tin ăn hết thời gian.** Sales dành phần lớn buổi sáng để cập nhật những thứ máy hoàn toàn đọc được từ nguồn công khai.

Sản phẩm cần làm được hai việc cùng lúc: là một CRM đầy đủ dùng tay được trọn vẹn, và có một lớp AI đọc nguồn công khai rồi chủ động đẩy thông tin vào đúng chỗ trong CRM đó. Hai nửa phải liền thành một sản phẩm, không phải hai bản demo đặt cạnh nhau.

---

## 2. Từ vựng dùng trong tài liệu này

| Từ                 | Nghĩa                                                                                                                                                                                                             |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Công ty**        | Một pháp nhân khách hàng tiềm năng hoặc đang giao dịch                                                                                                                                                            |
| **Loại công ty**   | Một trong năm loại khách hàng ITO ở tài liệu đọc trước: Traditional, IT Solution, IT Product, Tech-based/Startup, ITO khác                                                                                        |
| **Người liên hệ**  | Một cá nhân thuộc đúng một công ty                                                                                                                                                                                |
| **Cơ hội**         | Một thương vụ đang theo đuổi tại một công ty. Một công ty có thể có nhiều cơ hội                                                                                                                                  |
| **Giai đoạn**      | Vị trí của cơ hội trên đường đi tới ký hợp đồng                                                                                                                                                                   |
| **Hoạt động**      | Một việc đã xảy ra và được ghi lại: gặp mặt, gọi điện, gửi tài liệu, khách phản hồi                                                                                                                               |
| **Việc tiếp theo** | Một câu mô tả việc sắp làm cho cơ hội, kèm ngày hạn                                                                                                                                                               |
| **Bản lưu**        | Nội dung thô hệ thống đọc được từ một nguồn, giữ nguyên văn kèm thời điểm đọc                                                                                                                                     |
| **Phát hiện**      | Một nhận định ngắn hệ thống rút ra từ bản lưu, luôn kèm câu trích nguyên văn và vị trí trong bản lưu                                                                                                              |
| **Mức chắc chắn**  | Ba bậc gắn cho mỗi phát hiện: **Chắc** (trích thẳng, không suy luận), **Có thể** (suy một bước từ nguồn cụ thể), **Đoán** (không có bằng chứng trực tiếp)                                                         |
| **Gợi ý**          | Một thay đổi hệ thống muốn thực hiện, trình bày dạng "hiện tại → đề nghị", chờ người quyết                                                                                                                        |
| **Đang theo dõi**  | Nhãn bật/tắt trên công ty. Công ty mang nhãn này được hệ thống đọc lại nguồn theo chu kỳ                                                                                                                          |
| **Sales**          | Vai trò người dùng thông thường. Bán hàng hằng ngày                                                                                                                                                               |
| **Quản trị**       | Vai trò vận hành. Xem được phần đo lường chất lượng mà Sales không thấy                                                                                                                                           |
| **Người sở hữu**   | Tài khoản Sales chịu trách nhiệm về một công ty và các cơ hội của công ty đó. Dữ liệu mẫu chỉ có một tài khoản Sales, nên mọi công ty đều thuộc về tài khoản đó — đội không phải làm phân quyền theo người sở hữu |

**Đối chiếu với tài liệu đọc trước.** Sales Playbook gọi tên vài thứ khác đi. **Tín hiệu (Signal)** ở playbook chính là **phát hiện** ở đây — bốn loại kinh điển của playbook là gọi vốn, nhân sự cấp cao, mở rộng, tuyển dụng. **PIC** chính là **đầu mối chính** của công ty. **SQL** là giai đoạn **Đủ điều kiện** của cơ hội. **ICP** không thành một tính năng riêng — phần của nó còn lại trong sản phẩm là trường **loại công ty** và việc nhóm 2 đọc tín hiệu theo loại công ty. Những phần playbook dạy mà đề bài này **không** yêu cầu: soạn message tiếp cận, phân vai buyer persona, nỗi đau ba tầng — vì ranh giới ở mục 5 cấm sản phẩm gửi bất cứ thứ gì ra ngoài.

---

## 3. Dữ liệu

Ban tổ chức phát một bộ dữ liệu mẫu vào sáng 15/08/2026. Đội nào bắt đầu phát triển từ bây giờ thì tự chuẩn bị dữ liệu tương đương theo mô tả dưới đây.

- **12–15 công ty** với tên, ngành, **loại công ty**, quốc gia, quy mô, **địa chỉ trang web**. Cả năm loại công ty đều có mặt.
- **Khoảng 30 người liên hệ** rải trên các công ty đó.
- **8 cơ hội** đang ở các giai đoạn khác nhau.
- **Bản chụp nội dung trang web của từng công ty, mỗi công ty hai phiên bản**: phiên bản "trước" và phiên bản "sau" khi có tin mới. Tin mới thuộc bốn dạng: gọi vốn, bổ nhiệm lãnh đạo công nghệ, mở rộng văn phòng, tuyển dụng quy mô lớn, các mảng kinh doanh mới, khác.

Bản chụp là tệp nội dung tĩnh nằm trong bộ dữ liệu. **Nguồn web trong đề bài chính là các bản chụp này, không phải trang web thật của các công ty** — đội tự chọn cách cung cấp chúng cho sản phẩm. Gọi ra dịch vụ bên ngoài thì thoải mái, kể cả mô hình ngôn ngữ; ràng buộc duy nhất là nội dung công ty phải lấy từ bản chụp, để mọi đội chạy trên cùng một dữ liệu và kịch bản demo lặp lại được. Việc chuyển một công ty từ phiên bản "trước" sang phiên bản "sau" là cách kích hoạt mọi kịch bản AI, và phải làm được từ giao diện hoặc bằng một lệnh.

---

## 4. Các nhóm tính năng

### Nhóm 1 — CRM làm tay

**Người dùng cần gì.** Sales phải làm được toàn bộ công việc bán hàng của mình mà không nhờ tới bất kỳ tính năng thông minh nào: thêm khách, ghi lại những gì vừa xảy ra, đẩy cơ hội tiến lên, biết hôm nay phải làm gì, và tìm lại được thứ mình đã nhập.

**Hệ thống phải làm gì.**

- Tạo, sửa, xoá và xem chi tiết **công ty**. Khi tạo, người dùng bắt buộc điền tên, ngành và **loại công ty** (năm loại ở mục 2); những ô còn lại tuỳ chọn và bỏ trống được.
- Tạo, sửa, xoá **người liên hệ** dưới một công ty. Mỗi người liên hệ có tên, chức danh, thư điện tử. Mỗi công ty đánh dấu được đúng một người là **đầu mối chính** — chính là PIC ở tài liệu đọc trước: người sở hữu nỗi đau, không nhất thiết là người có chức danh cao nhất.
- Tạo và quản lý **cơ hội** thuộc một công ty, có tên, giá trị dự kiến, tháng dự kiến chốt và giai đoạn hiện tại.
- Bảy giai đoạn, thứ tự cố định, không cho đội tự đổi tên: **Tiếp cận → Đủ điều kiện → Soạn đề xuất → Thương lượng → Thắng → Thua → Tạm dừng**. Bốn giai đoạn đầu — Tiếp cận, Đủ điều kiện, Soạn đề xuất, Thương lượng — và Tạm dừng tính là _đang mở_; Thắng và Thua là _đã đóng_.
- **Đủ điều kiện** là chốt chặn quan trọng nhất của phễu (playbook gọi là qualify thành SQL): chỉ theo đuổi tiếp khi kiểm được **cả hai chiều** — khách _cần_ (requirement) và khách _chi được_ (budget). Khi kéo một cơ hội sang giai đoạn này, màn hình hỏi ngay hai ô: **dấu hiệu nhu cầu** và **dấu hiệu ngân sách**, mỗi ô một câu kèm chỗ ghi nguồn. Bỏ qua được — cơ hội vẫn sang Đủ điều kiện, mang cờ cảnh báo cho tới khi bổ sung. Không chặn thao tác kéo.
- Người dùng đổi giai đoạn bằng **kéo thả**, không phải mở biểu mẫu. Đi lùi và nhảy cóc đều được, hệ thống không chặn.
- Ghi **hoạt động** gắn vào công ty, có ngày, loại, mô tả và người liên hệ liên quan. Hoạt động, việc đổi giai đoạn và ghi chú hiện chung trên **một dòng thời gian của công ty**, mới nhất ở trên.
- Mỗi cơ hội có **Việc tiếp theo** và **ngày hạn**. Cơ hội đang mở mà thiếu một trong hai ô thì **vẫn lưu được**, nhưng mang một cờ cảnh báo nhìn thấy được và không xuất hiện trong danh sách việc phải làm cho tới khi điền đủ. Không chặn thao tác lưu.
- Chuyển một cơ hội sang **Thua** thì màn hình hỏi lý do thua ngay. Bỏ qua được — cơ hội vẫn sang Thua, mang cờ cảnh báo và đứng ngoài bảng thống kê lý do thua cho tới khi bổ sung.
- **Tìm kiếm** công ty theo tên. **Lọc** danh sách công ty theo ngành, loại công ty, quốc gia và nhãn Đang theo dõi. **Lọc** danh sách cơ hội theo giai đoạn và theo tình trạng quá hạn Việc tiếp theo.
- Một **màn hình tổng quan** hiện: số công ty theo ngành, số cơ hội và tổng giá trị theo từng giai đoạn, danh sách Việc tiếp theo quá hạn.

**Ràng buộc quan trọng của nhóm này:** không có bất kỳ thành phần AI nào tham gia. Tắt sạch phần AI thì nhóm 1 vẫn chạy đủ, không thiếu một chức năng nào.

---

### Nhóm 2 — Đọc nguồn và rút phát hiện

**Người dùng cần gì.** Không ai bấm gì ở nhóm này. Đây là phần nền để ba nhóm sau có nguyên liệu. Điều duy nhất người dùng quan tâm là: khi hệ thống nói một điều gì đó về công ty của họ, họ phải bấm được vào để thấy **chính xác câu chữ ở nguồn** đã dẫn tới điều đó, chứ không phải nghe máy khẳng định suông.

**Hệ thống phải làm gì.**

- Đọc được nội dung trang web của một công ty và lưu lại thành một **bản lưu**, giữ nguyên văn, kèm địa chỉ nguồn và thời điểm đọc. **Mỗi bản lưu thuộc về đúng một công ty**; một công ty có nhiều bản lưu, xếp theo thời điểm đọc.
- Từ bản lưu, rút ra các **phát hiện**. Mỗi phát hiện gồm: một câu nhận định ngắn, loại tin (gọi vốn, nhân sự cấp cao, mở rộng, tuyển dụng, mảng kinh doanh mới, khác), **câu trích nguyên văn** và **vị trí câu trích đó trong bản lưu**, cùng một mức chắc chắn. **Mỗi phát hiện thuộc về đúng một công ty**, thừa kế từ bản lưu sinh ra nó — không gắn thẳng vào cơ hội, người liên hệ hay hoạt động.
- Bản lưu và phát hiện hiện ở **một khu riêng trong màn hình công ty**. Sales xem được khu này. Đây là **vùng đọc**: nội dung ở đây không phải hồ sơ công ty và không phải dòng thời gian.
- **Cùng một loại tin mang nghĩa khác nhau tuỳ loại công ty** — ví dụ gọi vốn ở một startup là "sắp xây MVP", ở một công ty product là "sắp tăng tốc roadmap". Câu nhận định phải cho thấy tín hiệu đã được đọc dưới góc loại công ty nào.
- **Việc sinh ra các phát hiện không làm thay đổi bất cứ thứ gì trong hồ sơ công ty, dòng thời gian hay cơ hội.** Phát hiện chỉ là nguyên liệu. Việc chạm vào dữ liệu của Sales là phần việc của nhóm 3 (chờ duyệt), nhóm 4 (tự đặt Việc tiếp theo) và nhóm 5 (vòng quét). Cho phát hiện chạy thẳng lên dòng thời gian là làm nhóm 2 thành nhóm 5.
- **Không lưu được một phát hiện không có câu trích.**
- Bấm vào một phát hiện ở bất cứ đâu nó xuất hiện thì mở đúng đoạn văn gốc trong bản lưu, có đánh dấu, không phải mở cả trang rồi để người tự dò.
- Ba mức chắc chắn phân biệt được **mà không cần đọc chữ** — bằng ký hiệu hoặc màu, không chỉ bằng nhãn.
- Đọc lại cùng một nguồn không xoá phát hiện cũ. Phát hiện mới nằm cạnh phát hiện cũ, và mỗi cái mang thời điểm riêng.
- Nguồn không đọc được thì ghi lại là không đọc được. Hệ thống không đoán.

---

### Nhóm 3 — Hàng đợi gợi ý cập nhật hồ sơ

**Người dùng cần gì.** Sales muốn hồ sơ công ty luôn đúng mà không phải tự đi gõ. Nhưng họ không chấp nhận việc máy tự sửa dữ liệu của mình ở chỗ này: hồ sơ công ty là thứ họ mang đi họp và chịu trách nhiệm về từng dòng. Họ muốn máy chuẩn bị sẵn, còn mình là người bấm.

**Hệ thống phải làm gì.**

- Khi có phát hiện mới về một công ty, hệ thống sinh **gợi ý** vào một **hàng đợi chờ duyệt** của người sở hữu công ty đó. Hai loại gợi ý: **thêm một tin mới** vào dòng thời gian của công ty, và **điền hoặc sửa một ô còn trống hoặc đã cũ** trong hồ sơ công ty.
- Mỗi gợi ý hiện đủ bốn thứ tại chỗ, không phải bấm sang màn hình khác: nội dung dạng **hiện tại → đề nghị**, **câu trích** làm bằng chứng, **mức chắc chắn**, và **một dòng nói rõ hệ quả nếu thông tin này sai**.
- Ba nút: **Duyệt**, **Sửa rồi duyệt**, **Bỏ**. Bỏ là một thao tác, kèm chọn lý do từ một danh sách ngắn: thông tin sai, đúng nhưng không liên quan, đã cũ, hiểu sai ngữ cảnh, khác. Số thao tác để bỏ không được nhiều hơn số thao tác để duyệt.
- **Không duyệt thì không có gì xảy ra.** Hồ sơ công ty giữ nguyên vô thời hạn. Gợi ý không tự hết hạn thành hành động, không tự áp dụng sau một khoảng thời gian, không có chế độ tự duyệt.
- **Sửa rồi duyệt** được ghi lại là _sửa_, không ghi là _duyệt_. Hai con số này phải tách bạch.
- Mỗi gợi ý và mỗi lần người dùng quyết đều được lưu: nội dung gợi ý, ai quyết, lúc nào, quyết gì, lý do nếu bỏ, và mất bao nhiêu giây kể từ lúc mở gợi ý tới lúc bấm.
- Gợi ý đã bị bỏ không sinh lại với cùng nội dung, trừ khi có bản lưu mới.
- Màn hình danh sách cơ hội và màn hình công ty hiện dấu hiệu "đang có gợi ý chờ duyệt", để người dùng không phải nhớ đi kiểm tra hàng đợi.

---

### Nhóm 4 — Tự đặt Việc tiếp theo

**Người dùng cần gì.** Đây là chỗ mà việc chờ người bấm gây thiệt hại thật. Một công ty vừa gọi được vốn mà đang có cơ hội mở là tình huống phải liên hệ trong ngày, không phải chờ tới lúc Sales mở hàng đợi ra duyệt. Sales chấp nhận cho máy tự làm ở đúng chỗ này, với một điều kiện tuyệt đối: sai thì **sửa lại bằng một cú bấm**, không phải đi khôi phục thủ công.

**Hệ thống phải làm gì.**

- Khi xuất hiện một phát hiện đáng chú ý về một công ty **đang có ít nhất một cơ hội mở**, hệ thống **tự điền** Việc tiếp theo và ngày hạn cho cơ hội đó, ngay lập tức, không hỏi ai.
- Nội dung tự điền phải nhắc tới sự kiện đã kích hoạt nó và **kèm chính câu trích** làm bằng chứng.
- **Ngày hạn phải phản ánh độ gấp của loại tín hiệu**, không phải một con số cố định: tin gọi vốn có cửa sổ tính bằng ngày nên đặt hạn sát, tin mở rộng hay tuyển dụng đặt hạn dài hơn.
- Ô Việc tiếp theo do hệ thống đặt mang một dấu hiệu phân biệt được với ô do người gõ.
- Người sở hữu cơ hội **được báo** ngay: một thông báo trong sản phẩm nói rõ hệ thống vừa đặt gì, cho cơ hội nào, vì sao. Thông báo không tự biến mất trước khi được xem.
- Có nút **Hoàn tác**, **một cú bấm**, đưa ô Việc tiếp theo và ngày hạn về đúng giá trị trước đó. Nút này dùng được **trong 7 ngày** kể từ lúc hệ thống đặt. Cửa sổ 7 ngày phải hiện rõ trên màn hình. Hết 7 ngày thì nút biến mất và người dùng sửa tay như một ô bình thường.
- **Ghi lại mọi lần hệ thống tự đặt** — cơ hội nào, giá trị cũ, giá trị mới, phát hiện nào kích hoạt, lúc nào.
- **Ghi lại mọi lần hoàn tác** — ai bấm, lúc nào, đưa về giá trị gì. Số lần hoàn tác và tỉ lệ hoàn tác trên tổng số lần tự đặt phải xem được ở màn hình của Quản trị.
- Hệ thống không bao giờ tự đặt đè lên một Việc tiếp theo do người nhập tay và chưa tới hạn.

---

### Nhóm 5 — Vòng quét công ty Đang theo dõi

**Người dùng cần gì.** Với những công ty quan trọng, người dùng không muốn phải nhớ đi kiểm tra. Họ muốn giao hẳn: cứ theo dõi giúp tôi, có gì thì tự ghi vào, cuối kỳ báo lại tôi một lần. Đổi lại, người vận hành cần nhìn thấy cái vòng đó đang làm gì — mỗi vòng chạm bao nhiêu công ty, ghi thêm bao nhiêu thứ, hỏng ở đâu — mà không phải ngồi đọc từng mục nó thêm.

**Hệ thống phải làm gì.**

- Bật/tắt nhãn **Đang theo dõi** trên một công ty bằng một thao tác. Có một màn hình danh sách riêng cho nhóm này.
- Hệ thống **tự chạy một vòng lặp khép kín** trên toàn bộ công ty Đang theo dõi: đọc lại nguồn → so với bản lưu gần nhất → nếu có nội dung mới thì rút phát hiện → **tự thêm** một mục vào dòng thời gian của công ty, gắn nhãn "do hệ thống thêm", kèm câu trích → quay lại đầu vòng.
- **Vòng lặp không dừng lại chờ ai duyệt ở bất kỳ bước nào.** Nó tự quyết có ghi hay không dựa trên việc nội dung có mới so với lần trước hay không.
- **Chu kỳ vòng quét cấu hình được**, mặc định **60 giây**. Giá trị thấp này là để chấm được trong buổi demo, không phải giá trị dùng thật.
- **Báo cáo định kỳ.** Sau mỗi vòng, hệ thống ghi một dòng tổng kết vào màn hình **Nhật ký vòng quét**: chạy lúc nào, quét bao nhiêu công ty, phát hiện bao nhiêu nội dung mới, thêm bao nhiêu mục vào dòng thời gian, mất bao lâu, có lỗi gì. Ngoài ra cứ mỗi 10 vòng ghi thêm một dòng tổng hợp cộng dồn.
- Sales vẫn xoá được một mục do hệ thống thêm, như mọi mục khác trên dòng thời gian.

---

### Nhóm 6 — Bảng điều khiển của Quản trị

**Người dùng cần gì.** Người chịu trách nhiệm cần một chỗ duy nhất để nhìn thấy sức khoẻ của phần AI, chỉnh vài con số, và có một cái phanh khi mọi thứ đi sai.

**Hệ thống phải làm gì.**

- Một màn hình gom đủ các con số: số phát hiện đã sinh và phân bố ba mức chắc chắn; số gợi ý đã sinh cùng tỉ lệ duyệt, tỉ lệ sửa rồi duyệt, tỉ lệ bỏ, phân bố lý do bỏ; thời gian quyết trung bình; số lần hệ thống tự đặt Việc tiếp theo và tỉ lệ bị hoàn tác.
- Chỉnh được từ đây: **chu kỳ vòng quét**. Tham số này hiện đơn vị, giá trị mặc định và một câu giải thích đổi nó thì cái gì đổi theo. Đổi có hiệu lực ngay.
- **Một nút tắt toàn bộ phần AI.** Có hiệu lực ngay, không cần chạy lại sản phẩm. Khi tắt: vòng quét dừng, không sinh phát hiện mới, không sinh gợi ý mới, không tự đặt Việc tiếp theo nữa. Dữ liệu đã sinh **không bị xoá**.
- Khi phần AI đang tắt, **Sales nhìn thấy trạng thái đó** — một dòng thông báo nói rõ tính năng gợi ý đang tắt. Không im lặng biến mất.
- Mỗi lần bấm tắt hoặc bật lại đều được ghi vết kèm thời điểm.

---

## 5. Ranh giới — những việc hệ thống không bao giờ làm

Bốn điều này áp cho mọi tính năng, không có ngoại lệ, kể cả vòng quét ở nhóm 5:

1. **Không tự đổi giai đoạn của cơ hội.** Giai đoạn chỉ đổi khi người thao tác.
2. **Không tự đánh dấu Thắng hay Thua**, không tự sửa giá trị tiền của cơ hội.
3. **Không tự liên hệ với khách** — không gửi thư, không nhắn tin. Đây là ranh giới về việc chạm tới người thật, không phải lệnh cấm gọi mạng: gọi ra dịch vụ bên ngoài để chạy phần AI là bình thường.
4. **Không tự xoá dữ liệu do người tạo.**

Ba ranh giới đầu phải chặn được kể cả khi thao tác đến từ **ngoài giao diện người dùng**. Một lời dặn dò suông với phần AI không tính là đã chặn.

---

## 6. Bộ nghiệm thu

Đội phải nộp một bộ kiểm thử tự động chạy được bằng **một lệnh**, phủ đủ 10 điểm dưới đây. Ban giám khảo chạy chính bộ này, cộng với việc thử tay.

| #    | Nội dung                                                                                                                                                                                                                                                                                           |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-1  | Tắt toàn bộ phần AI. Tạo được công ty, người liên hệ, cơ hội; kéo cơ hội qua ba giai đoạn, trong đó có Đủ điều kiện; bỏ qua hai ô dấu hiệu vẫn kéo được và cơ hội mang cờ cảnh báo; ghi hoạt động; tìm kiếm và lọc; mở màn hình tổng quan. Không chức năng nào của nhóm 1 hỏng                     |
| T-2  | Không lưu được một phát hiện thiếu câu trích. Thử ghi thẳng, phải bị từ chối                                                                                                                                                                                                                       |
| T-3  | Bấm vào một phát hiện thì mở đúng đoạn văn gốc trong bản lưu, có đánh dấu vị trí                                                                                                                                                                                                                   |
| T-4  | Sinh một gợi ý rồi không làm gì. Sau ít nhất ba chu kỳ vòng quét, hồ sơ công ty vẫn y nguyên                                                                                                                                                                                                       |
| T-5  | Duyệt một gợi ý, sửa-rồi-duyệt một gợi ý, bỏ một gợi ý. Cả ba đều để lại bản ghi có ai, lúc nào, quyết gì; con số _sửa_ không bị cộng vào con số _duyệt_                                                                                                                                           |
| T-6  | Đổi một công ty đang có cơ hội mở sang phiên bản trang web "sau". Việc tiếp theo của cơ hội tự đổi, có thông báo, và ô mang dấu hiệu do hệ thống đặt                                                                                                                                               |
| T-7  | Bấm Hoàn tác ở T-6, một cú bấm, giá trị cũ trở lại đúng nguyên trạng. Có bản ghi cho cả lần tự đặt lẫn lần hoàn tác                                                                                                                                                                                |
| T-8  | Bật Đang theo dõi cho ba công ty, đổi nguồn của hai công ty. Trong vòng hai chu kỳ, hai mục mới xuất hiện trên dòng thời gian mà không ai bấm gì; Nhật ký vòng quét có dòng tổng kết cho từng vòng                                                                                                 |
| T-9  | Bấm nút tắt toàn bộ phần AI trong lúc vòng quét đang chạy. Hai chu kỳ kế tiếp không thêm mục nào vào dòng thời gian, không sinh gợi ý, không tự đặt Việc tiếp theo; dữ liệu đã sinh còn nguyên; Sales thấy dòng thông báo đang tắt. Bật lại thì vòng quét chạy tiếp, cả hai lần bấm đều có ghi vết |
| T-10 | Thử đổi giai đoạn, đổi giá trị tiền và xoá một công ty dưới danh nghĩa hệ thống, không đi qua giao diện người dùng. Cả ba đều bị từ chối                                                                                                                                                           |

---

.

## 7. Nộp bài

1. **Mã nguồn trên GitLab của HBLAB**.
2. **Log của Claude Code chảy về Grafana của công ty.** tới buổi demo phải mở được bảng theo dõi cho thấy đội đã dùng AI thế nào trong ngày.
3. **Sản phẩm chạy ở cấu hình production.** Chạy trên máy của đội cũng được — đề bài không đòi triển khai lên đám mây — nhưng phải là bản giả lập production on-premise, không phải môi trường phát triển:
   - Bản dựng production: không dev server, không hot reload, không bật chế độ gỡ lỗi.
   - Cấu hình nằm ở biến môi trường chứ không nằm trong mã: khoá dịch vụ ngoài, chuỗi kết nối cơ sở dữ liệu, chu kỳ vòng quét.
   - Dữ liệu nằm trong cơ sở dữ liệu thật và còn nguyên sau khi khởi động lại tiến trình.
   - Đăng nhập thật bằng hai tài khoản Sales và Quản trị để giám khảo tự vào.
   - Khởi động bằng một lệnh, và log chạy ra chỗ xem được.
4. **Bộ kiểm thử tự động** cho 10 điểm ở mục 6, chạy bằng một lệnh, có kết quả in ra rõ ràng.
5. **Nạp được bộ dữ liệu của ban tổ chức bằng một lệnh** — không gõ tay, không sửa mã. Chạy lệnh lần nữa thì về đúng trạng thái ban đầu, để giám khảo diễn lại kịch bản demo từ đầu.

---

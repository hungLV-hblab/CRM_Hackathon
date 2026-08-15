Bạn đọc bản chụp trang web của một công ty B2B và rút ra các phát hiện đáng chú ý cho đội Sales ITO (HBLAB bán dịch vụ phát triển phần mềm cho doanh nghiệp).

Câu hỏi đắt nhất của Sales là **"vì sao phải liên hệ công ty này TUẦN NÀY chứ không phải quý sau"**. Mọi phát hiện bạn rút ra chỉ có giá trị nếu nó góp phần trả lời câu đó. Một tin đúng nhưng đến muộn thì vô giá trị — khi tin gọi vốn đã lên báo thì ba đối thủ đã gửi email trước rồi.

QUY TẮC TUYỆT ĐỐI về câu trích:
- "quoteText" PHẢI là một đoạn COPY NGUYÊN VĂN, cắt trực tiếp từ nội dung được cung cấp.
- KHÔNG viết lại, KHÔNG rút gọn, KHÔNG sửa dấu câu, KHÔNG dịch, KHÔNG ghép hai đoạn rời nhau.
- Nếu không tìm được đoạn nguyên văn nào chứng minh được phát hiện thì BỎ phát hiện đó.
Một câu trích diễn giải sẽ bị hệ thống loại bỏ cùng toàn bộ phát hiện, nên viết lại là mất trắng.

Ý NGHĨA TỪNG LOẠI TÍN HIỆU — chọn "signalType" theo điều nó nói về NGÂN SÁCH và ĐỘ GẤP, không theo từ khoá bề mặt:

- **funding** — có tiền mới, sắp tiêu, thường vào sản phẩm và công nghệ. Cửa sổ tính bằng NGÀY.
- **leadership_hire** — sếp mới (nhất là CTO/CIO/VP Engineering) xem lại toàn bộ lựa chọn của người cũ trong vài tuần đầu, kể cả lựa chọn nhà cung cấp. Cửa sổ tính bằng TUẦN.
- **expansion** — mở văn phòng, vào thị trường mới. Vận hành phình ra, hệ thống hiện tại quá tải.
- **mass_hiring** — tuyển nhiều, nhất là kỹ sư. Họ đang xây thứ gì đó lớn hơn năng lực nội bộ hiện có.
- **new_business_line** — mảng kinh doanh mới, sản phẩm mới, dịch vụ mới.
- **other** — dữ kiện hồ sơ có thật và kiểm chứng được (quy mô, ngành, trụ sở, website) nhưng không phải chuyển động. Dùng cho phát hiện mang "fieldSuggestion".

ĐỌC DƯỚI LĂNG KÍNH LOẠI HÌNH CÔNG TY. Phần đầu nội dung gửi kèm có dòng "Loại hình công ty" — dùng nó, đừng bỏ qua. **Cùng một tin mang ý nghĩa khác nhau tuỳ loại**, và "statement" phải phản ánh đúng ý nghĩa cho loại đang xét:

- `tech_startup` vừa gọi vốn → sắp xây sản phẩm đầu, cần ra nhanh.
- `it_product` vừa gọi vốn → sắp tăng tốc lộ trình sản phẩm đang có.
- `traditional` (ngân hàng, bán lẻ, sản xuất) vừa gọi vốn hoặc mở rộng → hiện đại hoá hệ thống cũ, không phải xây MVP.
- `it_solution` tuyển nhiều → đang thiếu người cho dự án của khách họ.
- `other_ito` tuyển nhiều → có thể đang quá tải và cần thầu phụ.

Chỉ áp lăng kính khi bản chụp thật sự đỡ được. Lăng kính giúp chọn CÁCH DIỄN ĐẠT một dữ kiện có thật; nó không phải giấy phép để thêm điều bản chụp không nói.

NHỮNG THỨ TRÔNG NHƯ TÍN HIỆU MÀ KHÔNG PHẢI — không tạo phát hiện cho chúng:
- **Giải thưởng, chứng nhận, xếp hạng, tài trợ sự kiện, hoạt động xã hội.** Có tên công ty, đọc rất kêu, nhưng không nói gì về ngân sách hay độ gấp.
- **Kỷ niệm thành lập, đổi logo, khai trương lại website, thông điệp chúc mừng năm mới.**
- **Trang "Về chúng tôi" và khẩu hiệu tầm nhìn — sứ mệnh.** Đây là văn bản tiếp thị, luôn có, không bao giờ mới.
- **Tin cũ không có mốc thời gian nào trong bản chụp.** Không biết nó xảy ra khi nào thì không trả lời được "vì sao tuần này".
- **Tin về công ty khác** được nhắc trong cùng trang (đối tác, khách hàng, đối thủ). Phát hiện phải nói về công ty đang xét.

Không có gì đáng lấy thì trả `{"claims":[]}`. Rỗng là kết quả đúng và tốt hơn nhiều so với một trang tin tiếp thị được gắn nhãn tín hiệu.

HỆ QUẢ CỦA NHÃN BẠN GÁN — biết trước để khỏi phải đoán:
- Phát hiện **funding** hoặc **leadership_hire** ở mức **certain** hoặc **likely** làm hệ thống lập **Việc tiếp theo** cho mọi cơ hội đang mở của công ty — tự ghi thẳng hoặc đưa lên để duyệt, tuỳ nguồn. Dù đường nào thì "statement" của bạn cũng được ghép vào câu Sales đọc trên thẻ cơ hội. Viết "statement" như một dữ kiện Sales cầm đi gọi khách được.
- Bốn loại còn lại, và mọi phát hiện ở mức **speculative**, đi vào hàng đợi chờ người duyệt. Không ai bị đánh thức, không có gì tự ghi.
- Vậy nên: gán nhãn `funding` cho một tin không phải gọi vốn là làm phiền người thật. Ngược lại, hạ một tin gọi vốn thật xuống `speculative` là để lỡ cửa sổ tính bằng ngày. Gán đúng, đừng gán cho an toàn.

"statement" viết bằng TIẾNG VIỆT, kể cả khi nguồn bằng tiếng Anh hay tiếng Nhật — người đọc là Sales Việt Nam.
Câu trích thì giữ nguyên ngôn ngữ của nguồn, vì nó phải khớp từng ký tự với bản lưu.

"statement" chỉ chứa điều bản chụp NÓI, không chứa điều bạn suy ra từ đó. "Đăng 12 tin tuyển kỹ sư" là dữ kiện. "Họ đang thiếu người và cần thuê ngoài" là suy đoán của bạn — Sales mang câu đó đi nói với khách rồi phát hiện sai là mất mặt ngay trong cuộc họp, và niềm tin vào cả hệ thống sập theo. Tuyển nhiều kỹ sư cũng có thể nghĩa là họ đang tự xây năng lực để GIẢM thuê ngoài; bạn không biết là cái nào, nên đừng viết ra cái nào.

"confidence":
- certain: phát hiện gần như chép lại nguồn, mọi con số và tên riêng trong statement đều có trong câu trích
- likely: suy ra một bước từ nguồn
- speculative: phải đoán thêm

GỢI Ý SỬA Ô HỒ SƠ (không bắt buộc, thêm "fieldSuggestion" vào phát hiện):
- Chỉ khi bản chụp nói rõ một trong bốn ô: {{PROPOSAL_TARGET_FIELDS}}.
- CHỈ đề xuất khi ô đó đang TRỐNG hoặc giá trị hiện tại KHÁC với điều bản chụp ghi. Giá trị hiện tại được cung cấp bên dưới.
- **Mỗi đề xuất phải nằm trên một phát hiện RIÊNG, và "quoteText" của chính phát hiện đó phải là dòng dữ kiện chứa giá trị.** Đừng gắn đề xuất sửa ô vào một phát hiện về tin tức: câu trích của tin tức không chứa giá trị của ô, và hệ thống sẽ bỏ đề xuất đó.
- "proposedValue" PHẢI là một đoạn CẮT NGUYÊN VĂN từ chính "quoteText" của phát hiện đó. Viết lại là mất trắng: hệ thống bỏ phần đề xuất.

  ĐÚNG — hai phát hiện tách rời, đề xuất đi kèm đúng câu trích của nó:
  {"claims":[
    {"statement":"Công ty vừa gọi vốn vòng Series B 20 triệu USD","signalType":"funding","confidence":"certain","quoteText":"Sakura vừa hoàn tất vòng Series B huy động 20 triệu USD."},
    {"statement":"Trang nguồn ghi quy mô 1000+ nhân viên","signalType":"other","confidence":"certain","quoteText":"Quy mô: 1000+ nhân viên","fieldSuggestion":{"targetField":"size","proposedValue":"1000+"}}
  ]}

  SAI — đề xuất gắn vào phát hiện tin tức, "1000+" không có trong câu trích đó nên bị bỏ:
  {"claims":[
    {"statement":"Công ty vừa gọi vốn","signalType":"funding","confidence":"certain","quoteText":"Sakura vừa hoàn tất vòng Series B huy động 20 triệu USD.","fieldSuggestion":{"targetField":"size","proposedValue":"1000+"}}
  ]}

- Không đề xuất tên công ty và không đề xuất loại hình công ty — hệ thống từ chối cả hai.
- Tin mở rộng sang một thị trường KHÔNG phải là đổi quốc gia trụ sở. Chỉ đổi "country" khi bản chụp ghi trụ sở chính.

Chỉ trả JSON: {"claims":[{"statement","signalType","confidence","quoteText","fieldSuggestion":{"targetField","proposedValue"}}]}
signalType ∈ {{SIGNAL_TYPES}}
Không có phát hiện nào thì trả {"claims":[]} — trả về rỗng là câu trả lời hợp lệ và tốt hơn là bịa.

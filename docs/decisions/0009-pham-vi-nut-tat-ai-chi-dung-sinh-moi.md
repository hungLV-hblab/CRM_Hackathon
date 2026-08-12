# ADR-0009 — Nút tắt AI chỉ dừng việc sinh mới; hàng đợi tồn đọng vẫn duyệt được

| | |
| --- | --- |
| **Ngày** | 2026-08-12 18:20 |
| **Giai đoạn** | Requirement (diễn giải chỗ Specs im lặng) |
| **Trạng thái** | Chấp nhận |
| **Người quyết định** | HungLV |
| **Prompt log** | [ai-sessions/260812-1742-req-phan-bien-de-bai-ai-native-crm.md](../ai-sessions/260812-1742-req-phan-bien-de-bai-ai-native-crm.md) — chất vấn CT-31; mơ hồ M-12 |

## Bối cảnh

Specs nhóm 6 liệt kê đúng bốn thứ phải dừng khi bấm nút tắt: *"vòng quét dừng, không sinh phát hiện mới, không sinh gợi ý mới, không tự đặt Việc tiếp theo nữa"*, và chốt *"dữ liệu đã sinh **không bị xoá**"*.

Không nói gì về **những gợi ý đang nằm trong hàng đợi lúc bấm tắt**. Sales còn duyệt được không? T-9 không kiểm điểm này, nên nếu chọn sai thì test vẫn xanh mà hành vi vẫn sai.

Câu hỏi thật đằng sau: **nút này tắt cái gì — tắt AI, hay tắt cả tính năng có dính tới AI?**

## Phương án đã cân nhắc

Tiêu chí so: *(1)* có nhất quán với câu "dữ liệu đã sinh không bị xoá" không · *(2)* có chặn hành vi của **người** không · *(3)* Specs có đòi không.

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| **A.** Tắt = dừng đúng bốn thứ Specs liệt kê (vòng quét, sinh `Observation`/`Claim` mới, sinh `Proposal` mới, tự đặt Việc tiếp theo). **Hàng đợi tồn đọng vẫn duyệt / sửa rồi duyệt / bỏ bình thường**; nút Hoàn tác của các lần tự đặt trước đó vẫn dùng được | Nhất quán với "dữ liệu đã sinh không bị xoá" — giữ dữ liệu thì phải cho dùng. Duyệt là hành vi của **người**, không phải của AI, nên nó không nằm trong phạm vi nút tắt AI | Sales có thể thắc mắc vì sao báo "đang tắt" mà vẫn còn việc để làm — xử lý bằng câu chữ trên dòng thông báo | ✅ **Chọn** |
| B. Tắt = khoá luôn hàng đợi, không duyệt được | "Tắt là tắt hết", dễ giải thích một câu | Chặn hành vi của người mà Specs không hề đòi. Và mâu thuẫn nội tại: giữ dữ liệu lại nhưng cấm dùng thì giữ để làm gì. Nếu Admin tắt AI vì nghi AI sai, thứ Sales cần làm ngay là **vào hàng đợi bỏ những gợi ý sai** — B chặn đúng việc đó | ❌ Loại — chặn nhầm đối tượng, và phản tác dụng đúng lúc cần nhất |
| C. Tắt = huỷ mọi gợi ý đang chờ | Hàng đợi sạch, không còn thứ mồ côi | Vi phạm thẳng câu *"dữ liệu đã sinh không bị xoá"*, và xoá luôn số liệu để tính auto-accept rate | ❌ Loại — Specs cấm |
| D. Tắt chỉ dừng vòng quét; ingest thủ công vẫn sinh phát hiện | Giữ được đường thử tay khi gỡ lỗi | Specs liệt kê rõ *"không sinh phát hiện mới"* là một trong bốn thứ phải dừng. Đây là đọc hẹp có lợi cho đội, không phải diễn giải | ❌ Loại — trái văn bản |

## Quyết định

Chọn **A**. Tiêu chí quyết định là *(2)*: nút này nằm ở bảng **Quản trị** và mang nghĩa *"tôi không tin phần AI nữa, dừng nó lại"*. Dừng AI sinh thêm là đúng phạm vi; tước quyền quyết định của Sales trên dữ liệu đã có là vượt phạm vi.

Cách kiểm nhanh khi phân vân một hành vi có thuộc nút tắt hay không: **hành vi đó do AI khởi xướng hay do người khởi xướng?** AI khởi xướng thì tắt. Người khởi xướng thì không.

Theo luật đó: duyệt/bỏ gợi ý — người, **không tắt**. Hoàn tác — người, **không tắt**. Xoá mục do hệ thống thêm — người, **không tắt**. Bật/tắt nhãn Đang theo dõi — người, không tắt, nhưng nhãn không có tác dụng gì cho tới khi bật AI lại.

Ghi vào [ontology.md](../ontology.md) mục 5, phần "Nút tắt".

## Hệ quả

- Kéo theo: dòng thông báo Sales nhìn thấy phải nói đúng phạm vi — *"Hệ thống đang tạm dừng đọc nguồn và tạo gợi ý mới. Các gợi ý đang chờ vẫn duyệt được."* Nếu chỉ ghi "tính năng gợi ý đang tắt" thì Sales tưởng hàng đợi bị đóng băng.
- Kéo theo: cờ `ai_enabled` phải được kiểm ở **đúng bốn điểm sinh** (vòng quét, ingest, sinh gợi ý, tự đặt Việc tiếp theo), không kiểm bừa ở tầng giao diện hàng đợi. Kiểm sai chỗ là rơi vào phương án B mà không cố ý.
- Kéo theo: đội **tự thêm một test ngoài T-9** — tắt AI rồi duyệt một gợi ý tồn đọng, phải thành công và phải vào metric bình thường.
- Đánh đổi chấp nhận: trong lúc AI tắt, auto-accept rate vẫn nhúc nhích (do người vẫn duyệt hàng tồn). Đúng như vậy — chỉ số đo hành vi người, không đo hoạt động của AI.
- Sẽ phải xem lại nếu: BTC làm rõ nút tắt phải đóng băng toàn bộ mọi thứ dính AI. Khi đó chuyển sang B, chi phí thấp.

## AI đã tham gia thế nào

- Vai trò AI: persona Tester/BA nêu chỗ Specs im lặng (CT-31) và chỉ ra T-9 không phủ được nó.
- **AI sai ở đâu:** phiên index 17:28 tóm tắt nhóm 6 gọn thành *"nút tắt toàn bộ AI"* — cụm **"toàn bộ"** là chữ AI tự thêm vào, Specs không có. Nếu code theo bản tóm tắt đó thì rơi thẳng vào phương án B. Tóm tắt làm mạnh lên một từ cũng là làm sai yêu cầu.
- AI đề xuất gì mà đội không nghe: không có. Đội chọn đúng phương án AI đề xuất, nhưng bổ sung **luật phân biệt "ai khởi xướng"** để áp cho các trường hợp tương tự về sau, thay vì quyết lẻ từng cái.

## Đội đã verify bằng cách nào

**Đã làm:**

1. **Đối chiếu với câu "dữ liệu đã sinh không bị xoá" và tìm mâu thuẫn.** Specs cố ý giữ lại dữ liệu khi tắt. Phương án B giữ dữ liệu nhưng cấm thao tác trên đó — giữ mà không dùng được thì điều khoản kia mất mục đích. Cùng kiểu lập luận đã dùng ở [ADR-0003](0003-chi-tao-ban-luu-khi-noi-dung-thay-doi.md) và [ADR-0007](0007-ba-muc-chac-chan-do-bang-khoang-cach-suy-luan.md): cách đọc nào làm một điều khoản Specs vô nghĩa thì cách đọc đó sai.
2. **Dựng tình huống vận hành thật.** Admin bấm tắt vì phát hiện AI đang sinh gợi ý sai hàng loạt. Việc cần làm ngay sau đó là dọn hàng đợi — bỏ những gợi ý sai và ghi lý do `wrong_info`. Phương án B chặn đúng việc này, tức là nút phanh lại khoá luôn tay lái. Tình huống này rút từ chính mục đích nút tắt mà Specs nhóm 6 mô tả (*"một cái phanh khi mọi thứ đi sai"*).
3. **Liệt kê đủ các hành vi có dính AI và phân loại theo "ai khởi xướng"** (bảng ở mục Quyết định) để chắc luật này không đẻ ra trường hợp mơ hồ mới. Bốn hành vi, không cái nào rơi vào vùng xám.

**Chưa làm:** chưa hỏi BTC (câu hỏi này không nằm trong danh sách Q-1..Q-8 đã gửi vì phát sinh sau). Đánh giá: không đáng gửi thêm — chi phí đổi từ A sang B rất thấp, và cách đọc A có lập luận đứng được ở vòng 2.

## Rollback

Rẻ. Chuyển sang B là thêm một lần kiểm cờ ở tầng giao diện hàng đợi. Dữ liệu không cần dọn. Ngược lại từ B về A cũng vậy.

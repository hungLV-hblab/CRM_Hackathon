# ADR-0005 — Trần tự chủ của việc tự đặt Việc tiếp theo: điều kiện kích hoạt, phạm vi cơ hội, chính sách ghi đè

| | |
| --- | --- |
| **Ngày** | 2026-08-12 18:20 |
| **Giai đoạn** | Requirement (định nghĩa trần tự chủ AI cho nhóm 4) |
| **Trạng thái** | Chấp nhận |
| **Người quyết định** | HungLV |
| **Prompt log** | [ai-sessions/260812-1742-req-phan-bien-de-bai-ai-native-crm.md](../ai-sessions/260812-1742-req-phan-bien-de-bai-ai-native-crm.md) — chất vấn CT-4, CT-12, CT-13; mơ hồ M-1, M-2, M-6 |

## Bối cảnh

Nhóm 4 là vùng tự chủ cao nhất mà Specs cho phép AI chạm vào dữ liệu của Sales mà không hỏi ai. Ba chỗ Specs để hở, cả ba đều phải chốt trước khi viết dòng code đầu tiên của nhóm này:

1. **Điều kiện kích hoạt.** Specs viết *"khi xuất hiện một phát hiện **đáng chú ý**"* — không định nghĩa đáng chú ý là gì. Không định nghĩa được thì không test được, và mỗi lần chạy ra một kết quả.
2. **Phạm vi.** Điều kiện là công ty có *"ít nhất một cơ hội mở"* nhưng hành động lại là *"tự điền cho **cơ hội đó**"* — số ít. Với 8 cơ hội trên 12–15 công ty, gần như chắc có công ty hai cơ hội.
3. **Ghi đè.** Specs chỉ cấm đè lên Việc tiếp theo *"do người nhập tay **và chưa tới hạn**"*. Đọc ngược lại: ô người gõ **đã quá hạn** thì được đè.

Gộp ba câu này vào một ADR vì chúng cùng trả lời một câu hỏi: **AI được tự chủ tới đâu ở nhóm 4.** Tách ra thành ba thì mỗi cái đọc lên đều thiếu ngữ cảnh của hai cái kia.

## Phương án đã cân nhắc

### 1 · Điều kiện kích hoạt

Tiêu chí: *(1)* test lặp lại được · *(2)* chi phí nếu sai · *(3)* tính năng có kích hoạt được trong buổi demo không.

| Phương án | Kết luận |
| --- | --- |
| **A1.** `confidence ∈ {certain, likely}` **và** `signal_type ∈ {funding, leadership_hire}` | ✅ **Chọn** |
| A2. Mọi phát hiện mới | ❌ Loại — cho phép mức `speculative` ghi đè danh sách việc của Sales. Vỡ luật 4 ("một dòng sai tệ hơn một dòng trống") ở đúng chỗ đắt nhất: thứ Sales nhìn mỗi sáng |
| A3. Mọi loại tin, nhưng chỉ mức `certain` + `likely` | ❌ Loại — tin mở rộng và tuyển dụng có cửa sổ tính bằng **tuần** ([playbook mục 4](../sales-ito-crm-domain.md)). Tự ghi mà không gấp là tự chủ không có lý do biện minh; đẩy sang hàng đợi nhóm 3 là đủ |
| A4. Chỉ `certain` | ❌ Loại — thông cáo web hiếm khi nói thẳng "chúng tôi vừa gọi vốn xong" theo cách trích một câu là đủ kết luận, nên phần lớn tin gọi vốn sẽ rơi vào `likely`. Chặt tới mức tính năng gần như không kích hoạt trong demo. Chi phí sai ở đây thấp vì có Hoàn tác một cú bấm |

### 2 · Phạm vi cơ hội

Tiêu chí: *(1)* có phải bịa luật không có trong Specs không · *(2)* có bỏ sót deal đáng lẽ phải liên hệ không.

| Phương án | Kết luận |
| --- | --- |
| **B1.** Ghi cho **mọi** cơ hội đang mở của công ty; mỗi cơ hội một `AutoNextStepEvent` và một nút Hoàn tác riêng | ✅ **Chọn** |
| B2. Chọn một cơ hội theo giá trị lớn nhất | ❌ Loại — luật ưu tiên này không có trong Specs, đội phải tự bịa và tự bảo vệ ở vòng 2. Tin gọi vốn ảnh hưởng **mọi** deal tại công ty đó; chọn một là bỏ sót có chủ ý |
| B3. Chọn một cơ hội theo giai đoạn gần chốt nhất | ❌ Loại — cùng lý do B2, cộng thêm: deal gần chốt là deal **ít cần** tin mới nhất; ưu tiên ngược |
| B4. Một thông báo chung cho công ty, không ghi vào cơ hội nào | ❌ Loại — Specs nói rõ "tự điền Việc tiếp theo và ngày hạn **cho cơ hội đó**". Đây là né việc, không phải diễn giải |

### 3 · Chính sách ghi đè

Tiêu chí: *(1)* ai sở hữu dữ liệu · *(2)* sai thì mất gì · *(3)* nhóm 4 còn tồn tại không.

| Phương án | Kết luận |
| --- | --- |
| **C1.** Không đè ô có `next_step_source = human`, **kể cả đã quá hạn**. Trường hợp đó sinh `Proposal` thay vì tự ghi. Đè thoải mái ô trống và ô do máy đặt trước đó | ✅ **Chọn** |
| C2. Đè ô người gõ đã quá hạn (đúng chữ Specs) | ❌ Loại — ô người gõ quá hạn không phải ô rác, nó là **món nợ Sales đang giữ**. Xoá nó là xoá thứ Sales sẽ bị hỏi. Nguyên tắc vàng 3 ([domain doc mục 8](../sales-ito-crm-domain.md)): *Sales sở hữu dữ liệu của mình*. Hoàn tác chỉ cứu nếu họ kịp nhìn thấy thông báo |
| C3. Không bao giờ đè bất cứ gì, kể cả ô trống | ❌ Loại — nhóm 4 không còn tồn tại, mất T-6 và mất phần gây ấn tượng nhất của sản phẩm |

## Quyết định

**A1 + B1 + C1.** Tiêu chí xuyên suốt cả ba: *tự chủ chỉ được cấp ở chỗ nó mua được thời gian thật, và chỉ ở mức mà sai thì không mất dữ liệu của người.*

- A1 giới hạn tự chủ vào đúng hai loại tin có cửa sổ tính bằng ngày — chỗ duy nhất mà "chờ Sales mở hàng đợi" gây thiệt hại thật.
- B1 không bịa luật ưu tiên; Specs im lặng thì chọn cách phủ hết thay vì chọn hộ người dùng.
- C1 nhận một điều Specs cho phép nhưng đội **không nhận**: quyền đè lên ô người gõ đã quá hạn. Đây là chỗ đội chủ động chặt hơn Specs.

Chốt kèm: **Hoàn tác trả về giá trị người-gõ gần nhất** (rỗng nếu chưa từng có), không phải giá trị máy đặt lần trước — mục đích của nút này là bảo vệ dữ liệu người, không phải làm lịch sử phiên bản.

Ghi vào [ontology.md](../ontology.md) là bất biến **I-6**, **I-7**, **I-8** và mục 3.3.

## Hệ quả

- Kéo theo: `Opportunity.next_step_source` phải tồn tại từ nhóm 1, không phải thêm vào khi làm nhóm 4 — nhóm 1 ghi `human` cho mọi ô người gõ ngay từ đầu.
- Kéo theo: một phát hiện có thể sinh nhiều `AutoNextStepEvent` (một per cơ hội mở) và nhiều `Notification`. Màn thông báo phải gộp được, nếu không một tin gọi vốn ở công ty 3 deal sẽ bắn 3 thông báo.
- Kéo theo: có đường ngược từ nhóm 4 sang nhóm 3 (gặp ô người gõ → sinh `Proposal`). Hai nhóm không độc lập như Specs trình bày.
- Đánh đổi chấp nhận: A1 bỏ qua tin mở rộng/tuyển dụng ở vùng tự chủ. Chúng vẫn tới tay Sales qua hàng đợi, chỉ chậm hơn.
- **Sẽ phải xem lại nếu:** bộ dữ liệu BTC không có tin `funding` hoặc `leadership_hire` nào cho công ty đang có cơ hội mở → nhóm 4 không kích hoạt được và T-6 không chạy. Kiểm ngay sáng 15/08; nếu vậy thì nới A1 sang `expansion`, và ghi một ADR thay thế.

## AI đã tham gia thế nào

- Vai trò AI: persona **BD/Sales trực chiến** (CT-4) là nơi phát hiện vấn đề C — góc nhìn "đây là danh sách việc của tôi, không phải một trường dữ liệu" không xuất hiện khi đọc Specs bằng con mắt lập trình viên. Persona Tester tìm ra A và B.
- **AI sai ở đâu:** phiên index 17:28 đọc câu "không tự đặt đè lên Việc tiếp theo do người nhập tay và chưa tới hạn" và coi đó là một điều khoản bảo vệ đầy đủ, **không đọc ngược mệnh đề** để thấy nó cho phép đè ô quá hạn. Lỗi đọc xuôi lần thứ ba trong ngày, cùng kiểu với ADR-0002 và 0003.
- AI đề xuất gì mà đội không nghe: AI đề xuất C1 kèm gợi ý "vẫn đè nhưng cảnh báo to hơn" như phương án trung dung. Đội bỏ hẳn nhánh đó — cảnh báo là thứ người dùng học cách bỏ qua sau ba lần.

## Đội đã verify bằng cách nào

**Đã làm:**

1. **Đối chiếu điều kiện kích hoạt với bảng tín hiệu của playbook.** [domain doc mục 4](../sales-ito-crm-domain.md) xếp bốn tín hiệu kinh điển kèm ý nghĩa về độ gấp: gọi vốn *"cửa sổ hành động tính bằng ngày"*, lãnh đạo mới *"agenda mới → vendor mới"*, mở rộng và tuyển dụng thì chậm hơn. A1 không phải con số đội tự nghĩ ra — nó là bản dịch trực tiếp của bảng đó sang điều kiện code. Đây cũng là câu trả lời cho vòng 2 nếu bị hỏi "vì sao chỉ hai loại tin".
2. **Thử ngược C2 trên một tình huống cụ thể.** Sales gõ "gọi anh Tanaka chốt giá", hạn hôm qua, chưa làm vì bận. Máy đọc được tin mở văn phòng, ghi đè. Kết quả: món nợ biến mất, Sales chỉ biết nếu đọc thông báo. Tình huống này lấy từ mô tả một ngày của Sales ở [domain doc mục 7](../sales-ito-crm-domain.md), không phải tình huống bịa.
3. **Kiểm B1 có vi phạm ranh giới nào không:** ghi cho nhiều cơ hội vẫn chỉ chạm `next_step_text`/`next_step_due_date`, không chạm `stage` hay `expected_value` → không đụng vùng cấm của [ADR-0004](0004-chan-ranh-gioi-o-tang-domain-va-tang-csdl.md).

**Chưa làm — và đây là điểm yếu thật của ADR này:** chưa hỏi một Sales thật xem C1 có đúng thứ họ muốn không. Vòng 3 do Sales chấm nên đây là rủi ro có thật. Việc phải làm: hỏi ít nhất một người trong đội Sales trước 14/08, câu hỏi cụ thể — *"ô Việc tiếp theo anh gõ đã quá hạn mà chưa làm, máy có được thay bằng việc khác không?"* Người làm: HungLV.

## Rollback

- A1: rẻ, một bảng điều kiện, nới hoặc siết mất vài phút.
- B1: rẻ nếu siết lại thành B2/B3 (thêm bộ lọc); dữ liệu đã sinh không cần dọn.
- C1: rẻ về code nhưng **không nên rollback** — nó là chỗ đội chủ động chặt hơn Specs, đảo lại giữa ngày thi thì mất luôn lập luận đã chuẩn bị cho vòng 2.

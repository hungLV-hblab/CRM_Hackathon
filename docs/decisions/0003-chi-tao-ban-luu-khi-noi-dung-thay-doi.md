# ADR-0003 — "Nội dung mới" so bằng hash ở tầng bản lưu; chỉ tạo bản lưu khi hash khác

| | |
| --- | --- |
| **Ngày** | 2026-08-12 18:07 |
| **Giai đoạn** | Design (mô hình dữ liệu tầng ingest) |
| **Trạng thái** | Chấp nhận |
| **Người quyết định** | HungLV |
| **Prompt log** | [ai-sessions/260812-1742-req-phan-bien-de-bai-ai-native-crm.md](../ai-sessions/260812-1742-req-phan-bien-de-bai-ai-native-crm.md) — chất vấn CT-17, CT-18, CT-38; mơ hồ M-3, M-4 |

## Bối cảnh

Specs nhóm 5 bảo vòng quét *"đọc lại nguồn → so với bản lưu gần nhất → **nếu có nội dung mới** thì rút phát hiện → tự thêm một mục vào dòng thời gian"*, chu kỳ mặc định **60 giây**. Không định nghĩa "nội dung mới" so ở tầng nào, cũng không nói mỗi lượt đọc có tạo một bản lưu hay không.

Hai câu khác trong Specs biến chỗ mơ hồ này thành rủi ro thật:

- Nhóm 3: *"Gợi ý đã bị bỏ không sinh lại với cùng nội dung, **trừ khi có bản lưu mới**"* — nếu mỗi nhịp quét đều đẻ một bản lưu thì điều kiện này luôn đúng, gợi ý Sales vừa bỏ quay lại sau 60 giây, mãi mãi.
- Nhóm 2 rút phát hiện bằng LLM, mà LLM **không tất định** — cùng một nội dung đọc lại có thể ra câu chữ khác.

Bộ nghiệm thu không cứu được: T-4 chỉ kiểm *hồ sơ công ty* không đổi sau 3 chu kỳ, T-8 chỉ kiểm 2 chu kỳ đầu có đúng 2 mục mới. Cả hai đều xanh trong khi hệ thống đang đổ rác vào dòng thời gian ở vòng thứ 5 trở đi. Demo dài 15–20 phút = ~20 nhịp quét.

## Phương án đã cân nhắc

Tiêu chí so: *(1)* demo lặp lại được, không sinh dòng rác vào dữ liệu của Sales · *(2)* điều kiện "có bản lưu mới" của nhóm 3 còn nghĩa không · *(3)* số lần gọi LLM mỗi vòng · *(4)* có tham số ngưỡng phải giải trình không.

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| **A.** Mỗi nhịp: tải nguồn → chuẩn hoá → hash. Hash **trùng** bản gần nhất → không tạo bản lưu, **không gọi LLM**, chỉ ghi "đã đọc, không đổi" vào Nhật ký. Hash **khác** → tạo bản lưu, rút phát hiện, thêm mục timeline | Sạch cả bốn tiêu chí. Bản lưu trở thành đúng nghĩa "ảnh chụp một trạng thái", không phải "nhật ký lượt đọc". Nhóm 3 hết bị sinh lại. LLM chỉ chạy khi thật sự có tin mới | Không phát hiện được thay đổi ngữ nghĩa mà byte giống hệt (không tồn tại) và ngược lại (xem "sẽ phải xem lại nếu") | ✅ **Chọn** |
| **B.** Mỗi nhịp tạo một bản lưu; so "nội dung mới" ở **tầng phát hiện** (diff danh sách claim) | Bám sát chữ "so với bản lưu gần nhất" theo nghĩa đen nhất | LLM không tất định → hai lần đọc cùng nội dung ra hai câu khác nhau → **thêm một mục timeline mỗi 60 giây**. Cộng thêm: ~20 bản lưu/công ty trong một buổi demo (một đêm là ~1400), và điều kiện nhóm 3 luôn đúng nên gợi ý đã bỏ sinh lại liên tục. Tốn một lần gọi LLM mỗi công ty mỗi nhịp | ❌ Loại — hỏng cả 4 tiêu chí, và hỏng theo kiểu chỉ lộ ra sau vài phút demo |
| **C.** Mỗi nhịp vẫn tạo bản lưu, nhưng chỉ rút phát hiện khi nội dung khác | Chặn được spam timeline | Vẫn phình dữ liệu, và **vẫn làm điều kiện "có bản lưu mới" của nhóm 3 luôn đúng** → gợi ý Sales đã bỏ vẫn quay lại mỗi phút. Sửa được một nửa vấn đề nên dễ tưởng là đã xong | ❌ Loại — để lại đúng cái lỗi mà Sales chấm vòng 3 gặp trực tiếp |
| **D.** So sánh bằng embedding / độ tương đồng ngữ nghĩa | Bắt được thay đổi nội dung mà cấu trúc trang xáo trộn | Thêm một ngưỡng phải bào chữa trước BGK, thêm một lần gọi model mỗi nhịp. Và **không cần**: nguồn của đề bài là bản chụp tĩnh, chuyển "trước"→"sau" là thay đổi rõ ràng ở mức byte | ❌ Loại — trả giá cho một bài toán đề bài không có |

## Quyết định

Chọn **A**. Tiêu chí quyết định là *(1)* và *(2)*: chỉ A giữ được **bản lưu = một trạng thái của nguồn**, và đó chính là ý nghĩa mà nhóm 3 dựa vào khi nói "trừ khi có bản lưu mới". B và C biến bản lưu thành nhật ký lượt đọc, làm câu đó mất nghĩa. Tiêu chí *(3)* là phần thưởng kèm theo chứ không phải lý do chính: hash trước, LLM sau, cắt gần hết chi phí gọi model trong lúc demo.

Chốt kèm:

- Hash tính trên **chuỗi đã chuẩn hoá** theo [ADR-0002](0002-cau-trich-phai-la-chuoi-con-nguyen-van-cua-ban-luu.md) — cùng một bước chuẩn hoá, tính một lần, dùng cho cả hash lẫn offset câu trích.
- Nhật ký vòng quét ghi **cả nhịp không có gì đổi** (`companies_scanned` đếm mọi công ty, `new_content_count` chỉ đếm công ty hash khác). Không ghi thì Nhật ký trông như vòng quét đã chết.
- Nguồn tải lỗi → `fetch_status = failed`, **không** coi là "nội dung mới", không sinh phát hiện.

Ghi vào [ontology.md](../ontology.md) là bất biến **I-3**.

## Hệ quả

- Kéo theo: `Observation` có cột `content_hash` + chỉ mục theo `(company_id, captured_at)` để lấy bản gần nhất rẻ.
- Kéo theo: giải quyết luôn ba thứ tưởng là ba việc riêng — spam dòng thời gian (CT-17), gợi ý đã bỏ sinh lại (CT-18), phình bản lưu không có retention (CT-38). Một ràng buộc, ba lỗi.
- Đánh đổi chấp nhận: nếu nguồn đổi nội dung mà hash không đổi thì hệ thống mù. Về mặt kỹ thuật điều này không xảy ra (hash đổi khi byte đổi).
- **Sẽ phải xem lại nếu:** bản chụp BTC phát có phần **động** đổi mỗi lượt đọc — dấu thời gian, bộ đếm lượt xem, token quảng cáo. Khi đó hash luôn khác → vòng quét thêm mục mỗi nhịp, tức là rơi đúng vào hố của phương án B. Xử lý: thêm bước lược bỏ vùng động trước khi hash, và **kiểm tra điều này ngay khi nhận bộ dữ liệu sáng 15/08** trước khi chạy demo.

## AI đã tham gia thế nào

- Vai trò AI: persona **Tester/BA khó tính** phát hiện xung đột giữa ba câu nằm ở ba mục khác nhau của Specs (nhóm 3 "trừ khi có bản lưu mới" · nhóm 5 chu kỳ 60s · nhóm 2 dùng LLM). Đây là loại lỗi đọc xuôi từng mục không thấy.
- **AI sai ở đâu:** phiên index đề bài lúc 17:28 tóm tắt nhóm 5 là "đọc lại → so bản lưu → rút phát hiện → tự thêm timeline" và coi như đã hiểu đủ, **bỏ qua việc LLM không tất định làm bước "so" trở nên vô nghĩa**. Cùng một kiểu sót như ADR-0002: tóm tắt trung thành với văn bản nhưng không mô phỏng hệ thống chạy 20 vòng.
- AI đề xuất gì mà đội không nghe: AI nêu phương án D (so ngữ nghĩa) như một lựa chọn "chắc chắn hơn". Đội loại vì đề bài đã chốt nguồn là bản chụp tĩnh — thêm model vào đường ingest là trả giá cho bài toán không tồn tại.

## Đội đã verify bằng cách nào

**Đã làm:**

1. **Đếm số học trên kịch bản demo thật.** Chu kỳ 60s, demo 15–20 phút → ~20 nhịp. T-8 bật Đang theo dõi cho 3 công ty → 60 lượt đọc. Với phương án B/C đó là 60 bản lưu và (với B) tới 60 lần gọi LLM cho 2 tin mới thật sự. Con số này là thứ chứng minh vấn đề có thật trong khung giờ chấm, không phải lo xa.
2. **Kiểm bộ nghiệm thu có bắt được lỗi không — và nó không bắt được.** Đọc lại T-4 (kiểm hồ sơ công ty, không kiểm dòng thời gian) và T-8 (chỉ kiểm 2 chu kỳ đầu): cả hai đều xanh trong khi hệ thống đang hỏng từ vòng thứ 3. Kết luận: **không được dùng "pass 10 test" làm bằng chứng cho quyết định này** — đây là lý do phải chốt bằng ADR thay vì để test nói hộ.
3. **Đối chiếu ngược với nhóm 3.** Nếu bản lưu sinh mỗi nhịp thì câu "gợi ý đã bỏ không sinh lại trừ khi có bản lưu mới" trở thành câu vô nghĩa — một điều khoản Specs viết ra để bảo vệ người dùng mà lại tự vô hiệu. Cách đọc nào làm điều khoản Specs mất tác dụng thì cách đọc đó sai.

**Chưa làm — việc phải làm cùng lúc với ADR-0002:** chưa đo được LLM sinh phát hiện khác nhau bao nhiêu giữa hai lượt đọc **cùng một nội dung**. Kế hoạch: chạy 10 lượt trên cùng một bản chụp, so câu nhận định. Kết quả củng cố (hoặc bác) lý do loại phương án B bằng số liệu thay vì bằng tính chất đã biết của LLM. Người làm: HungLV, trước khi code nhóm 5.

**Phải kiểm ngay khi nhận dữ liệu BTC (15/08):** hash hai lượt đọc liên tiếp của cùng một bản chụp có bằng nhau không. Nếu không — xem "sẽ phải xem lại nếu" ở trên.

## Rollback

Rẻ, nhưng không đối xứng. Chuyển từ A sang B/C chỉ là bỏ một câu `if`. Chuyển ngược lại giữa ngày thi thì phải dọn bản lưu và mục timeline rác đã sinh — nên nếu phải đổi, đổi kèm một lệnh nạp lại seed (đằng nào cũng phải có, mục 7 Specs). Ước lượng ~20 phút kể cả dọn.

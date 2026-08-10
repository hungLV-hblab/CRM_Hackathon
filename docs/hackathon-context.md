# AI Hackathon #01 — DEV Edition · Context tổng hợp

> Nguồn: 5 tài liệu BTC (Drive), tổng hợp ngày 2026-08-11. Đây là **context gốc** cho mọi việc sắp tới:
> phân tích đề, thiết kế, build, demo. Chi tiết theo chủ đề nằm ở 3 doc con bên dưới.

## Tài liệu trong bộ này

| Doc | Nội dung | Dùng khi |
| --- | --- | --- |
| [hackathon-rules-and-scoring.md](./hackathon-rules-and-scoring.md) | Thể lệ, timeline, 3 vòng chấm, rubric, log gate | Lập kế hoạch ngày thi, quyết định cách làm việc với AI |
| [sales-ito-crm-domain.md](./sales-ito-crm-domain.md) | Nghiệp vụ Sales B2B/ITO, ICP, signals, nỗi đau CRM | Mọi quyết định sản phẩm: hiển thị gì, ưu tiên gì |
| [ai-native-design-principles.md](./ai-native-design-principles.md) | Ontology, Observation→Claim→Proposal, provenance, trần tự chủ AI | Thiết kế kiến trúc & data model |

Nguồn gốc (Drive):
- [Folder tài liệu chủ đề 01](https://drive.google.com/drive/folders/1S5PcEUzsk33u1pngkDmCG4AkH4Yv1UrR)
- [Thể lệ AI HACKATHON #01 – DEV EDITION](https://docs.google.com/document/d/1YjW_nDSiMmb0lR5B35o3jhQW9fs8LPRak6AMWf2oMIw/edit) *(nằm ngoài folder trên)*
- [1. Business Playbook](https://docs.google.com/document/d/1JQj2wgSKYX73-xoecmDsrNzJLF1fUMKPov8WWKNAqQ4/edit)
- [2. Thiết kế phần mềm thế hệ AI Native (PDF)](https://drive.google.com/file/d/1Zx8SMPBwWxw48k-pVRTJDzI4fD3e6QAI/view)
- [3. Checklist chấm điểm](https://docs.google.com/spreadsheets/d/1uY-VhETMbuBmOapI4C_f1Za_D2RlHXEGN1EP99cqDVE/edit)
- [4. Hỏi đáp thông tin cuộc thi](https://docs.google.com/spreadsheets/d/1T3A3BaUSEOL3iZf5dy_-bb2451-JcL4Zi0aNYHV7SVo/edit) *(hiện còn trống — kênh hỏi BTC)*

---

## 1. Bối cảnh 30 giây

- **Cuộc thi:** AI Hackathon #01 "REAL WORK, REAL IMPACT" — DEV Edition, nội bộ HBLAB.
- **Ngày thi:** Thứ 7, **15/08/2026**, 9:00–17:30. Offline tại VN/Đà Nẵng/Nhật, kết nối online giữa các đầu cầu.
- **Đội:** 02–03 người, khuyến khích đa phòng ban. Deadline đăng ký **12:00 thứ 4 12/08**.
- **Đề bài:** BTC cung cấp **Specs của một module thuộc hệ thống CRM nội bộ HBLAB**. Đội dùng AI để phân tích yêu cầu → thiết kế → build → test → deploy.
- **End user thật:** đội **Sales của các thị trường** — họ chấm vòng 3.
- **Giải:** 5tr / 3tr / 2tr VNĐ.

## 2. Vì sao BTC tổ chức cuộc thi này (quan trọng — định hình cách chấm)

Playbook nói thẳng: AI đang tự động hoá việc viết code cơ bản, ép trực tiếp vào phân khúc HBLAB đang đứng (custom build theo spec + staff augmentation, bán theo man-month). Hướng công ty chọn: leo lên **tư vấn/am hiểu nghiệp vụ** và **product engineering**, dùng AI làm đòn bẩy.

Hackathon là buổi tập dượt **2 tầng cùng lúc**:

- **Tầng 1 — sản phẩm phải là phần mềm thế hệ AIX**: AI nằm trong lõi luồng nghiệp vụ (tự đọc dữ liệu, tự rút nhận định, chủ động chuẩn bị sẵn), **không phải chatbot đính bên cạnh CRUD cũ**. Kèm theo các "bộ phận" mà phần mềm truyền thống không có: bằng chứng truy nguồn, độ tin cậy hiển thị rõ, người duyệt trước khi ghi, đo được tỉ lệ đúng, và phanh.
- **Tầng 2 — cách làm phần mềm cũng phải thay đổi**: đội nhỏ, thời gian ngắn, dùng AI xuyên suốt vòng đời (requirement → design → dev → test → deploy).

→ **Hệ quả:** rubric vòng 1 chấm **tầng 2** (quy trình làm việc với AI), vòng 3 chấm **tầng 1** (sản phẩm có dùng được không). Phải đầu tư cả hai, nhưng vòng 1 là cửa lọc.

## 3. Ba điều BTC yêu cầu nắm trước ngày thi

1. **Hiểu chúng ta bán gì** — không chỉ dịch vụ ITO, mà giá trị HBLAB cung cấp + áp lực AI lên mô hình man-month.
2. **Hiểu "phần mềm thế hệ mới" khác gì** — AI là thành phần làm việc thật trong hệ thống.
3. **Hiểu thế giới người dùng** — Sales B2B & CRM trong bối cảnh HBLAB. Nền tảng cho "hàng trăm quyết định nhỏ trong ngày thi: hiển thị gì, đặt tên thế nào, ưu tiên điều gì, tin vào dữ liệu nào, loại bỏ điều gì".

## 4. Bài toán cốt lõi — nỗi đau CRM trong sale ITO

Đặc trưng deal ITO: **giá trị lớn** (chục nghìn → hàng triệu USD), **chu kỳ dài** (vài tháng → hơn 1 năm), **nhiều người tham gia quyết định**. HBLAB thắng không bằng thương hiệu mà bằng **chọn đúng trận địa, đúng khách, đúng thời điểm** → dữ liệu khách hàng chính xác & kịp thời là tài sản.

**Hai nỗi đau kinh điển của người dùng CRM:**

1. **Hồ sơ luôn cũ.** Thế giới thay đổi liên tục, hồ sơ chỉ đổi khi có người gõ. Khách gọi được vốn mà hồ sơ không biết = mất "Right Timing" = mất deal.
2. **Nhập tay ăn hết thời gian.** Phần lớn thứ phải gõ là thông tin máy đọc được từ nguồn công khai. Thời gian gõ là thời gian không bán hàng. (Sáng nào BD cũng mất 1–2h rà tin tức/LinkedIn thủ công.)

**Nghịch lý phải tôn trọng:** chính vì CRM là nguồn dữ liệu chuẩn duy nhất, sales **cực kỳ khó tính** với việc ai/cái gì được ghi vào đó. Hồ sơ là thứ họ mang đi họp và chịu trách nhiệm từng dòng.
> **Một dòng dữ liệu sai trong CRM tệ hơn một dòng để trống** — dòng trống thì người ta biết là chưa có, dòng sai thì người ta *tin*.

→ AIX chạm vào CRM đúng ở chỗ: máy **đọc thay** và **chuẩn bị sẵn**, nhưng **người quyết định ghi**.

## 5. Chiến lược suy ra từ tài liệu

### 5.1. Vòng 1 là cửa tử — xử lý trước mọi thứ khác

Không có log Claude Code trên Grafana = **0 điểm, không qua vòng 1**. Việc setup log là điều kiện tham gia, không phải điểm cộng. Xem [chi tiết + rủi ro timeline](./hackathon-rules-and-scoring.md#2-vòng-1--chấm-tự-động-cửa-lọc).

### 5.2. Rubric thưởng *hành vi*, không thưởng *số lượng feature*

Cả 5 giai đoạn (Requirement 20 / Design 20 / Dev 25 / Test 20 / Deploy 15) đều lên mức 4 bằng cùng một công thức: **AI phản biện + lưu vết lý do + team giải thích được**. Nghĩa là:

- Cho AI đóng persona/virtual architect để **phản biện** yêu cầu và thiết kế, lưu cả phương án bị loại + lý do.
- Dùng **rule file dùng chung cả team** + agentic coding + custom tool/MCP.
- Test toàn diện (unit + integration + e2e) tự sinh, tự phát hiện edge case.
- Deploy có IaC + rollback/monitoring kiểu AIOps.
- **Lưu prompt log** → bonus minh bạch. **Không giải thích được output AI → penalty hộp đen.**

### 5.3. Sản phẩm: 5 nguyên tắc vàng là spec ẩn của vòng 3

Đội Sales chấm vòng 3 sẽ đo đúng 5 điều playbook dạy (chi tiết ở [domain doc](./sales-ito-crm-domain.md#7-năm-nguyên-tắc-vàng-khi-xây-công-cụ-cho-sales)):

1. Bằng chứng trước, khẳng định sau — truy nguồn được, đúng câu chữ.
2. Fact vs suy luận phân biệt được **ngay bằng mắt**.
3. Sales sở hữu dữ liệu — máy chuẩn bị sẵn, người quyết định ghi; chỗ nào máy tự làm phải sửa lại dễ hơn cả lúc máy làm.
4. Độ đúng phải đo được (auto-accept rate, error-detection rate).
5. **Next step là nhịp tim của deal** — trả lời được "sáng nay tôi phải làm gì, cho deal nào" thì được dùng hằng ngày; chỉ để báo cáo cho sếp thì bị bỏ hoang.

### 5.4. Kiến trúc nên theo Observation → Claim → Proposal + Provenance

Đây là mô hình BTC đã training nội bộ trong đúng bối cảnh "dự án AI-native CRM" — dùng nó là cách rẻ nhất để nói cùng ngôn ngữ với BGK. Thay tư duy CRUD bằng 4 đối tượng nguyên thuỷ, ràng buộc hệ thống: **không có provenance thì không hiển thị**. Chi tiết + mapping ra tính năng: [ai-native-design-principles.md](./ai-native-design-principles.md).

### 5.5. Cạm bẫy được nêu tên rõ trong tài liệu

- **"Cứ thêm AI là tốt" — sai.** Một tính năng AI *đúng 8/10 lần nhưng không chỉ ra được nguồn* **tệ hơn không có tính năng đó**, vì 2 lần sai phá niềm tin vào cả 8 lần đúng.
- **Bẫy AI-centric:** người review không hiểu output AI nhưng vẫn bấm approve. Vòng 2 của cuộc thi được thiết kế để bắt đúng lỗi này (BGK hỏi random 3–5 câu dựa trên log của đội).
- **CRM là công cụ báo cáo — sai.** Nếu chỉ thế, sales coi nhập liệu là thuế và sẽ trốn.
- **Chatbot đính bên cạnh** = không đạt tầng 1.

## 6. Checklist trước ngày thi

- [ ] Chốt đội 2–3 người, đăng ký trước **12:00 12/08**; cân nhắc rủ Manager đồng hành.
- [ ] **Setup log Claude Code → Grafana** và verify log thực sự lên được (điều kiện qua vòng 1).
- [ ] Hỏi BTC các câu ở mục 7 qua [sheet Hỏi đáp](https://docs.google.com/spreadsheets/d/1T3A3BaUSEOL3iZf5dy_-bb2451-JcL4Zi0aNYHV7SVo/edit) hoặc buổi họp 12/08.
- [ ] Chuẩn bị **rule file dùng chung** (CLAUDE.md + convention + ontology template) để cả team cùng một cách tiếp cận AI → bonus đồng bộ nhóm.
- [ ] Dựng sẵn skeleton: repo, CI/CD, Dockerfile, test harness, IaC — để ngày thi dồn sức vào nghiệp vụ (lưu ý ràng buộc log ở mục 7).
- [ ] Đọc [7 câu tự kiểm tra nghiệp vụ](./sales-ito-crm-domain.md#9-tự-kiểm-tra-trước-ngày-thi) — trả lời trơn tru là đủ context.
- [ ] Chuẩn bị format demo (PPT/HTML/Markdown đều được) + kịch bản 10 phút present, 5 phút Q&A, 1 người đại diện.

## 7. Câu hỏi cần BTC giải đáp

1. **Xung đột lớn nhất:** thể lệ cho phép "phát triển và chuẩn bị sản phẩm trước ngày thi (12–14/8)", nhưng tiêu chí vòng 1 ghi *"các đội làm trước thời điểm thu thập được log đều không được tính điểm"*. → Log bắt đầu thu từ mốc nào? Công việc 12–14/8 có được tính điểm nếu đã có log?
2. Bộ **Specs module CRM** phát khi nào? (thể lệ ghi công bố đề 07/8 nhưng chưa thấy Specs trong folder tài liệu)
3. Chấm tự động đọc log theo tiêu chí nào cụ thể — có scale điểm/mức 1–4 tự động được không, hay chỉ đếm sự hiện diện của hành vi?
4. Bắt buộc dùng Claude Code, hay công cụ AI khác cũng được (và có được tính điểm nếu không sinh log Grafana)?
5. Có ràng buộc tech stack, hạ tầng deploy, hoặc quyền truy cập dữ liệu CRM thật/sample data không?
6. Vòng 3 do Sales chấm — checklist riêng "công bố sau"; có được biết trước ngày thi?
7. Repo submit theo dạng nào (private GitHub/GitLab, quyền truy cập cho BGK)?

# Thể lệ & Tiêu chí chấm điểm — AI Hackathon #01 DEV Edition

> Trích & tổng hợp từ [Thể lệ AI HACKATHON #01](https://docs.google.com/document/d/1YjW_nDSiMmb0lR5B35o3jhQW9fs8LPRak6AMWf2oMIw/edit) và [Checklist chấm điểm](https://docs.google.com/spreadsheets/d/1uY-VhETMbuBmOapI4C_f1Za_D2RlHXEGN1EP99cqDVE/edit).
> Quay lại [context tổng hợp](./hackathon-context.md).

## 1. Thể lệ

### Đối tượng & đội

- Mở cho **toàn bộ thành viên HBLAB**, không giới hạn vị trí/phòng ban.
- Đội **02–03 thành viên**, khuyến khích đa phòng ban/chuyên môn.
- Mỗi người chỉ 1 đội/kỳ. Chốt danh sách rồi **không đổi thành viên** (trừ BTC chấp thuận).
- Khuyến khích có **Manager đồng hành** hỗ trợ phân tích bài toán thực tế.

### Timeline

| Mốc | Nội dung |
| --- | --- |
| 07/08 | BTC công bố chủ đề & đề bài |
| 06/08 – 12/08 | Đăng ký, BTC chốt danh sách |
| **12:00 12/08 (T4)** | **Deadline đăng ký** |
| 12/08 | Họp BTC & các đội — phổ biến thể lệ, giải đáp thắc mắc |
| 12/08 – 14/08 | Nghiên cứu đề, phân tích yêu cầu, **được phép phát triển & chuẩn bị sản phẩm trước ngày thi** |
| **15/08 (T7)** | **Ngày thi chính thức** — offline tại VN / Đà Nẵng / Nhật, kết nối online giữa các đầu cầu |

### Agenda ngày thi 15/08

| Thời gian | Nội dung |
| --- | --- |
| 9:00–9:30 | Khai mạc, check-in, BOD phát biểu |
| 9:30–12:00 | Hoàn thiện & kiểm thử sản phẩm — Phiên 1 |
| 12:00–13:00 | Nghỉ trưa (BTC lo đồ ăn) |
| 13:00–15:00 | Hoàn thiện & kiểm thử sản phẩm — Phiên 2 |
| **15:00–15:30** | **Vòng 1: Nộp bài — chấm điểm tự động**, chọn top 5 |
| 15:30–15:40 | Công bố Top 5, bốc thăm thứ tự trình bày |
| **15:40–17:10** | **Vòng 2: Trình bày & demo** — mỗi đội **10 phút present + 5 phút Q&A** |
| 17:10–17:20 | **Vòng 3: end user (Sales) chấm điểm lần cuối** |
| 17:20–17:30 | Công bố kết quả & trao giải |

### Nộp bài — 2 hạng mục bắt buộc

1. **Source code** — toàn bộ mã nguồn theo yêu cầu BTC.
2. **Tài liệu trình bày & Demo** — không bắt buộc PowerPoint; PPT / HTML / Markdown / format khác đều được, miễn trình bày rõ **giải pháp + quá trình thực hiện + demo**.

### Lưu ý thể lệ

- Phần trình bày **phải nêu rõ AI được ứng dụng thế nào**: các công đoạn, mức độ tham gia, giá trị mang lại.
- **01 thành viên đại diện trình bày**; các kỳ sau luân phiên người trình bày.
- Quyết định BTC là quyết định cuối cùng. Contact: **HienLT (SC), UyenBHT (SC)**.

### Giải thưởng

Nhất **5.000.000đ** · Nhì **3.000.000đ** · Ba **2.000.000đ**

### Đề bài

BTC cung cấp **đặc tả (Specs) của một module thuộc hệ thống CRM nội bộ HBLAB**. Nhiệm vụ:

1. Phân tích yêu cầu từ Specs
2. Xây dựng giải pháp
3. Phát triển hệ thống với sự hỗ trợ của AI
4. Thực hiện kiểm thử
5. Hoàn thành các tiêu chí theo Checklist AI của công ty

---

## 2. Vòng 1 — chấm tự động (cửa lọc)

| Tiêu chí | Nội dung |
| --- | --- |
| Áp dụng | Toàn bộ đội |
| Người chấm | **Hệ thống AI** |
| **Điều kiện** | **Tất cả đội phải cài đặt log của Claude Code lên Grafana thành công** |
| Cách chấm | Checklist chấm tự động qua **đọc log gửi lên**. **Không có log = không có điểm = không qua vòng 1.** Các đội làm **trước thời điểm thu thập được log đều không được tính điểm** |
| Thời điểm | Cập nhật leaderboard định kỳ **2–3h/lần** |
| Kết quả | Chọn **top 5** vào vòng 2 |

**Rủi ro số 1:** setup log Grafana thất bại → loại ngay bất kể sản phẩm tốt đến đâu. Verify sớm, verify thật (thấy dữ liệu trên dashboard), không giả định.

**Xung đột cần hỏi BTC:** thể lệ cho phép build trước 12–14/8, nhưng điều kiện chấm loại trừ công việc làm trước mốc thu log. → Cần biết mốc bắt đầu thu log.

## 3. Vòng 2 — bán tự động (BGK + AI)

| Tiêu chí | Nội dung |
| --- | --- |
| Áp dụng | 5 đội cao điểm nhất vòng 1 |
| Người chấm | **BGK kết hợp AI đặt câu hỏi**, có thể vấn đáp |
| Nội dung chấm | **Sự hiểu biết của team về các lựa chọn đã đưa ra trong lúc làm dự án, dựa vào log của từng đội**; chọn **random 3–5 câu hỏi** mỗi đội |
| Hình thức | Present sản phẩm với BGK, trả lời qua form; BGK chấm + Q&A |

→ Vòng này bắt đúng **"penalty hộp đen"**. Ai trong đội cũng phải giải thích được vì sao chọn phương án X, vì sao AI output đúng/sai. Log là bằng chứng — và cũng là đề thi.

## 4. Vòng 3 — end user chấm

| Tiêu chí | Nội dung |
| --- | --- |
| Áp dụng | 3 đội điểm cao nhất từ 2 vòng trên |
| Người chấm | **Đội Sales từ các thị trường**, chấm từ góc nhìn end-user |
| Đối tượng chấm | Các tính năng hệ thống (Sales có **checklist riêng, công bố sau**) |
| Thời điểm | *Xem xét tính khả thi về thời gian; có thể công bố kết quả sau (việc sử dụng cần thời gian đủ lâu)* |

→ Đây là vòng chấm **sản phẩm có dùng được thật không**. Dùng [5 nguyên tắc vàng](./sales-ito-crm-domain.md#7-năm-nguyên-tắc-vàng-khi-xây-công-cụ-cho-sales) làm spec ẩn.

---

## 5. Rubric chi tiết — 5 giai đoạn × 4 mức

Tổng trọng số 100. Mức 1 = 25%, Mức 2 = 50%, Mức 3 = 75%, Mức 4 = 100%.

### Requirement Analysis — trọng số 20

| Mức | Hành vi |
| --- | --- |
| 1 | Tóm tắt/diễn giải lại yêu cầu thô, chấp nhận nguyên bản |
| 2 | Dùng AI đặt câu hỏi làm rõ, phát hiện điểm mơ hồ |
| 3 | Phân rã thành user stories/epics có acceptance criteria, có review & bổ sung domain knowledge |
| **4** | **Đóng vai persona người dùng để phản biện yêu cầu, tự phát hiện edge case/rủi ro, có prompt log lý giải** |

### System Design — trọng số 20

| Mức | Hành vi |
| --- | --- |
| 1 | AI vẽ 1 sơ đồ kiến trúc đơn giản |
| 2 | AI đề xuất 1 phương án kiến trúc kèm giải thích cơ bản |
| 3 | AI generate nhiều phương án kèm phân tích trade-off, team hiểu rõ lý do chọn |
| **4** | **AI đóng vai 'virtual architect' phản biện thiết kế, đề xuất decision matrix, lưu phương án bị loại + lý do** |

### Development — trọng số 25 (cao nhất)

| Mức | Hành vi |
| --- | --- |
| 1 | Auto-complete code cơ bản |
| 2 | Sinh function/class/component theo yêu cầu cụ thể |
| 3 | AI hỗ trợ refactor, code review, sinh kèm unit test, convention nhất quán |
| **4** | **Agentic coding — AI tự chạy nhiều bước, tự sửa lỗi, tích hợp custom tool/MCP, cả team dùng chung rule file** |

### Testing — trọng số 20

| Mức | Hành vi |
| --- | --- |
| 1 | AI viết vài test case cơ bản |
| 2 | AI sinh test case theo Equivalence Partitioning / Boundary Value Analysis |
| 3 | AI tự động hoá chạy test + generate report, review coverage thực chất |
| **4** | **AI tự sinh test toàn diện (unit + integration + e2e), tự phát hiện edge case, self-healing** |

### Deployment — trọng số 15

| Mức | Hành vi |
| --- | --- |
| 1 | AI viết Dockerfile/script deploy cơ bản |
| 2 | AI hỗ trợ cấu hình CI/CD pipeline |
| 3 | AI generate Infrastructure-as-Code, tối ưu resource, review bảo mật |
| **4** | **AI-in-the-loop: tự động rollback khi lỗi, giám sát & cảnh báo kiểu AIOps** |

## 6. Quality Gates (bonus & penalty)

| Gate | Cơ chế |
| --- | --- |
| **Bằng chứng** | Có lưu prompt log / lịch sử tương tác AI → **bonus minh bạch** |
| **Hiểu & kiểm soát** | Team **không giải thích được** tại sao AI output đúng/sai → **penalty hộp đen** |
| **Tích hợp nhóm** | Cả team dùng thống nhất **1 cách tiếp cận AI** → **bonus đồng bộ nhóm** |

**Đọc rubric ngược lại:** cả 5 giai đoạn lên mức 4 bằng cùng một công thức — *cho AI phản biện chính mình, lưu vết lý do quyết định (kể cả phương án bị loại), và team hiểu đủ để bảo vệ*. Cộng thêm 3 gate: **prompt log + giải thích được + rule file dùng chung cả team**.

# ADR-0045 — Đăng nhập demo tái dùng luồng mật khẩu; dashboard scope theo vai, sở hữu đi qua công ty

| | |
| --- | --- |
| **Ngày** | 2026-08-15 11:15 |
| **Giai đoạn** | Design / Development |
| **Trạng thái** | Chấp nhận — **phương án E bị lật 15/08** bởi [ADR-0046](0046-phan-quyen-theo-nguoi-phu-trach-toan-he-thong.md), xem hộp dưới |

> ### Phương án E bị lật — 2026-08-15 (cùng ngày)
>
> ADR này loại phương án E (*"Sales cũng có filter xem người khác / làm RBAC per-owner"*) và chốt **"scope của sales là mặc định của view, không phải quyền"**. Câu đó **không còn đúng**: [ADR-0046](0046-phan-quyen-theo-nguoi-phu-trach-toan-he-thong.md) dựng phân quyền thật theo `companies.owner_id` cho cả đường đọc lẫn đường ghi.
>
> Vì sao lật: yêu cầu lọc theo **quyền** (không phải theo view) đến từ người dùng **sau khi** ADR này ký lúc 11:15, và người quyết định chấp nhận vượt mốc 15:00 vòng 1 để làm. ADR này không sai — nó đúng với thông tin có lúc 11:15.
>
> **Vẫn giữ nguyên hiệu lực:** toàn bộ phần đăng nhập demo (phương án A), `DEMO_ACCOUNTS` là nguồn sự thật chung của seed và màn đăng nhập, và nguyên tắc **"logic vai nằm ở controller"** — ADR-0046 giữ đúng nguyên tắc đó.

> ### Thế chia 2/2/1 không còn — 2026-08-15, khi nhánh này rebase lên dữ liệu thật
>
> Đúng điều kiện xem lại mà ADR này tự nêu ở cuối (*"BTC phát danh sách tài khoản thật → chỉ sửa `demo-accounts.ts`"*). Danh sách đó không đến bằng email mà **nằm sẵn trong dữ liệu BTC**: cột `sales_owner` của `Account.csv` có đúng **5 người** (Thảo · Vân · Phúc · Linh · Huệ), mỗi người **5 công ty**.
>
> Vậy nên `DEMO_ACCOUNTS` thành **5 Sales + 1 Admin**, và quyền sở hữu được **nhập từ cột đó** chứ không chia tay. Thế 2/2/1 tự nghĩ ra đã hết chỗ đứng vì chính 5 công ty nó chia cũng không còn — mọi công ty/liên hệ/cơ hội nay parse từ zip. Gán tay quyền sở hữu lên dữ liệu thật là bịa ra một sự thật mà nguồn đã nói rõ, đúng thứ luật 4 cấm.
>
> `sales@hblab.vn` giữ nguyên vị trí đầu và ứng với Thảo, nên mọi spec đăng nhập "một Sales bất kỳ" không phải đổi. Tên hiển thị của tài khoản Sales **chính là** khoá nối vào `sales_owner`, khai báo rõ trong `demo-accounts.ts`; tên không khớp thì công ty để trống người phụ trách kèm một dòng cảnh báo, không đoán bừa.
>
> Kéo theo bởi ADR-0046: `t5-proposal-queue-decisions.spec.ts` tự tạo công ty của chính nó (người tạo là người phụ trách) nên một tài khoản Sales là đủ; `t9-ai-kill-switch.spec.ts` đăng nhập `sales3@hblab.vn`, vì `San-e` mà bộ đồ gá của nó dựa vào thuộc Phúc.
| **Người quyết định** | Thang Nguyen |
| **Prompt log** | [plans/2026-08-15-demo-login-dashboard-sales-view/brainstorm-report.md](../../plans/2026-08-15-demo-login-dashboard-sales-view/brainstorm-report.md) |

## Bối cảnh

BTC bổ sung sau feature freeze: (3.2) màn đăng nhập phải vào thẳng được bằng từng tài khoản đã phát, không gõ mật khẩu, mật khẩu mặc định `hackathon#1`; (3.3) dashboard trong ngày phải lọc được theo từng Sales. Hệ thống đang có đúng 1 user sales, toàn bộ công ty seed thuộc người đó, và ontology mục 1 đã chốt **không làm per-owner authorization**. Deadline vòng 1: 15:00 hôm nay.

## Phương án đã cân nhắc

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| A. Nút demo = tab thứ hai gọi đúng `POST /auth/login` với mật khẩu đã công bố; danh sách tài khoản là shared constant trong `contracts`; dashboard: sales bị server ép về chính mình, admin có `?ownerId=` + bảng per-sales; sở hữu = `companies.ownerId`, opportunity thừa kế qua company | 0 surface auth mới; cookie/JWT/middleware nguyên vẹn; không migration; một nguồn sự thật cho seed + UI | Mật khẩu nằm trong bundle client; 14 file e2e phải đổi chuỗi mật khẩu | ✅ **Chọn** |
| B. Endpoint `POST /auth/demo-login {userId}` bỏ qua mật khẩu | UI gọn, không nhúng mật khẩu vào client | Là auth-bypass thật trong code, phải gate env, phải test riêng; đúng loại lỗ hổng vòng 2 xoáy "vì sao an toàn" | ❌ Loại — chi phí + rủi ro cao hơn mà kết quả người dùng thấy y hệt A |
| C. Endpoint public `GET /demo-users` đọc DB cho danh sách nút | DB là nguồn sự thật duy nhất | Tự phá tính chất anti-oracle của màn login (`auth-service` cố tình trả cùng một lỗi cho email-không-tồn-tại và sai-mật-khẩu) | ❌ Loại — constant trong contracts đạt cùng mục đích mà không mở endpoint |
| D. Thêm cột owner cho `opportunities` để lọc theo Sales ở mức deal | Lọc "chính xác" hơn nếu deal đổi chủ độc lập công ty | Cần migration ngày chốt; tạo trạng thái mâu thuẫn "deal của A trong company của B"; `auto-next-step` đã route thông báo theo owner của company | ❌ Loại — YAGNI, một chiều sở hữu đọc lên thành câu là đủ |
| E. Sales cũng có filter xem người khác / làm RBAC per-owner | "Đầy đủ" hơn | Sai tinh thần "sáng nay TÔI phải làm gì"; RBAC mâu thuẫn ontology mục 1 đã chốt và là scope creep sau freeze | ❌ Loại — scope của sales là **mặc định của view, không phải quyền** |

## Quyết định

Chọn **A**. Tiêu chí so: (1) không thêm surface xác thực mới ngày chốt, (2) không migration, (3) mọi hành vi mới phải giải thích được ở vòng 2 bằng một câu. Cụ thể: logic vai nằm ở **controller** (`OverviewController` đọc actor rồi truyền tham số tường minh xuống service — đúng ADR-0004, service không đọc ambient actor); sales truyền `?ownerId=` của người khác vẫn nhận data của chính mình; `perSales` chỉ trả cho admin; view lọc nói rõ "Không gồm N công ty chưa gán người phụ trách" (luật 4).

Kéo theo có chủ đích: seed từ 1 sales → nhiều sales + 1 admin, mật khẩu seed đổi thành `hackathon#1`. *(Con số cụ thể và cách gán quyền sở hữu đã bị hộp cập nhật ở đầu file thay — nay là 5 Sales, nhập từ `sales_owner`.)*

## Hệ quả

- Kéo theo: bước "Màn tổng quan" của `t1-crm-without-ai.spec.ts` đổi — sales1 giờ thấy số của riêng mình, còn phần đối chiếu cả-đội chuyển sang `dashboard-role-view.spec.ts` bằng admin. *(Dữ liệu BTC không có cơ hội "Thua" nào, nên khối lý-do-thua nay được assert ở trạng thái rỗng trung thực thay vì bằng deal của sales khác.)*
- Đánh đổi chấp nhận: mật khẩu demo trong bundle client (đã công bố công khai, không phải secret); `unassignedCompanies` trả cả khi không lọc (đơn giản hơn một nhánh điều kiện).
- Sẽ phải xem lại nếu: BTC phát danh sách tài khoản thật (chỉ sửa `packages/contracts/src/demo-accounts.ts`); hoặc sản phẩm cần deal đổi chủ độc lập công ty (khi đó mở lại phương án D bằng ADR mới).

## AI đã tham gia thế nào

- Vai trò AI: phản biện yêu cầu (2 vòng trước brainstorm), sinh và so phương án, chỉ ra xung đột với tính chất anti-oracle của `auth-service` và với I-14 của seed, implement theo plan đã duyệt.
- AI đề xuất gì mà đội **không** nghe: AI đề xuất cân nhắc giữ sales thấy-tất-cả (phương án ít thay đổi hành vi nhất); đội chọn sales tự scope vì đúng câu hỏi "take care sát sao công việc của mình".
- AI sai ở đâu — **ba lỗi, hai cái do vòng review đối kháng bắt được**:
  1. Bản plan đầu chưa lường việc t1 e2e assert khối lý-do-thua bằng dữ liệu thuộc sales khác — phát hiện khi rà e2e trước khi đổi seed.
  2. `unassignedCompanies` ban đầu đếm `owner_id IS NULL`. Nhưng tạo công ty đóng dấu người tạo làm owner, và **admin cũng tạo được công ty** (route chỉ có `JwtGuard`) — công ty đó không nằm trong dòng per-sales nào, không nằm trong view sales nào, mà con số vẫn đọc 0. Đúng cái khoảng lặng luật 4 cấm. Sửa: đếm công ty **không sales nào sở hữu**.
  3. `next_step_text` và `next_step_due_date` null độc lập (không có CHECK), nên một cơ hội có hạn cũ mà trống việc lọt vào **cả hai** khối "quá hạn" và "thiếu Việc tiếp theo" — một deal đọc thành hai vấn đề, trong khi ba chỗ trong code (kể cả empty state người dùng đọc) khẳng định điều ngược lại. Sửa: thêm `next_step_text IS NOT NULL` vào truy vấn quá hạn/đến hạn và vào cột đếm của bảng per-sales.
  Bắt được cả 2 và 3 mà bộ test đang xanh **không** phát hiện — vì seed không có dữ liệu ở hai hình dạng đó. Đã bổ sung test khoá cả hai.

## Đội đã verify bằng cách nào

- `overview-owner-scoping.test.ts` (10 test, chạy qua HTTP vì luật ép-scope nằm ở controller): sales truyền `ownerId` người khác nhận đúng data mình (so sánh deep-equal hai response); `perSales` vắng với sales, đủ 3 dòng với admin; cửa sổ đến-hạn nhận hôm-nay+2, loại hôm-nay+5, loại quá hạn; deal `on_hold` im lặng không bị đếm là "thiếu việc tiếp theo"; **công ty do admin tự tạo qua API làm `unassignedCompanies` tăng đúng 1** (mô phỏng đúng thao tác giám khảo bấm nút demo admin rồi tạo công ty); **cơ hội có hạn cũ mà trống việc chỉ nằm ở khối "thiếu", và `overdueCount`/`missingNextStepCount` của bảng per-sales bằng đúng độ dài hai danh sách tương ứng** — số và danh sách là hai cách vẽ của một định nghĩa, không được lệch.
- Một vòng **review đối kháng** đọc lại toàn bộ diff với yêu cầu tìm rò rỉ dữ liệu chéo và lỗi aggregate; ba phát hiện mức cao đều được kiểm chứng lại bằng tay trước khi sửa (đọc route công ty để xác nhận admin tạo được công ty; đọc schema để xác nhận hai cột next-step null độc lập).
- `login.test.ts` (7 test) chạy lại nguyên vẹn với seed mới — luồng mật khẩu không đổi hành vi.
- E2E `demo-login.spec.ts` + `dashboard-role-view.spec.ts` trên stack production `:8080`.
- 5 test overview cũ xanh **không sửa assertion nào** — hành vi không-lọc giữ nguyên.

## Rollback

Revert commit (thuần additive trừ seed + hành vi `/overview` của sales); `pnpm reset && pnpm seed` đưa CSDL demo về trạng thái cũ. Không có migration nên không có rollback schema. Ước tính < 10 phút.

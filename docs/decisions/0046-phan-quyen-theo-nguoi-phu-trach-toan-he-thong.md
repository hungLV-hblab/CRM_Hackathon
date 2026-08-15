# ADR-0046 — Phân quyền theo người phụ trách, áp cho toàn hệ thống chứ không riêng hàng đợi

| | |
| --- | --- |
| **Ngày** | 2026-08-15 |
| **Giai đoạn** | Requirement / Design |
| **Trạng thái** | Chấp nhận |
| **Người quyết định** | Thang Nguyen |
| **Thay thế** | [ADR-0033](0033-vong-1-admin-co-quyen-crm-nhu-sales-ma-tran-quyen-chi-tiet-ngoai-pham-vi.md) — **phần** "ma trận quyền theo người sở hữu chưa có" · [ADR-0045](0045-dang-nhap-demo-tai-dung-luong-mat-khau-va-dashboard-scope-theo-vai.md) — **phương án E** bị lật |
| **Prompt log** | [brainstorm-report.md](../../plans/2026-08-15-queue-authz-notification-redesign-pagination/brainstorm-report.md) · [báo cáo red team 4 lăng kính](../../plans/2026-08-15-queue-authz-notification-redesign-pagination/reports/from-code-reviewer-to-planner-red-team-four-lens-plan-review-report.md) |

## Đây không phải quyết định mới — nó lật hai quyết định đã ký

Phải nói trước, vì bỏ qua đoạn này thì vòng 2 sẽ tìm ra ba câu mâu thuẫn trong tài liệu của chính đội.

**ADR-0033 tự nêu điều kiện xem lại của nó, và điều kiện đó đã xảy ra.** Nguyên văn mục Hệ quả: *"Sẽ phải xem lại nếu: BTC trả lời Q-6, **hoặc seed có từ hai người sở hữu trở lên**. Điều kiện thứ hai quan trọng hơn: ngay khi hai Sales cùng tồn tại, 'Admin sửa dữ liệu của ai' đổi từ câu hỏi lý thuyết thành lỗ thật."* ADR-0045 (cùng ngày 15/08, 11:15) đổi seed từ 1 sales thành **nhiều sales + 1 admin**. Kể từ giây đó, ADR-0033 đã tự hết hiệu lực ở phần ma trận quyền — không ai ghi nhận, và ADR này ghi nhận.

Phần **vẫn giữ** của ADR-0033: hai vai khác nhau ở chỗ Admin nhìn thấy được (`GET /settings`, bảng điều khiển, nhật ký vòng quét). Admin vẫn có quyền CRM đầy đủ. Chỉ có mệnh đề "chưa có ma trận theo người sở hữu" là bị thay.

**ADR-0045 loại phương án E ("RBAC per-owner") là scope creep — nay bị lật.** Lý do lật, ghi cho minh bạch: yêu cầu lọc theo **quyền** (không phải theo view) đến từ người dùng **sau khi** ADR-0045 đã ký, và người quyết định chấp nhận vượt mốc 15:00 vòng 1 để làm. Không phải ADR-0045 sai; nó đúng với thông tin có lúc 11:15.

**`ontology.md` mục 1 cũng thành sai** — câu "một tài khoản, sở hữu mọi công ty — không làm phân quyền theo người sở hữu" đã sai một nửa từ ADR-0045 (không còn một tài khoản) và sai nốt nửa còn lại từ ADR này. Đã sửa cùng commit.

## Bối cảnh

Sau ADR-0045, hệ thống có nhiều Sales cùng tồn tại thay vì một — nay là **5 Sales phụ trách 25 công ty**, quyền sở hữu nhập từ cột `sales_owner` của `Account.csv` (xem hộp cập nhật trong ADR-0045), và một Admin. `/tong-quan` đã ghim Sales vào view của chính mình. Nhưng **mọi màn còn lại vẫn phát dữ liệu của tất cả cho tất cả**, và quan trọng hơn: có một đường **ghi chéo chủ sở hữu** đang mở.

Rà soát đối kháng 4 lăng kính ngày 15/08 tìm ra: `AutoNextStepService.undo()` chỉ chặn `actor.kind === 'system'` và hạn 7 ngày, `loadUndoable` select theo `eventId` đơn thuần, còn `listActive()` phát ra mọi `eventId` trong hệ thống kèm câu trích. Nghĩa là Sales B đọc được id sự kiện của Sales A rồi bấm Hoàn tác, **ghi đè `next_step_text` / `next_step_due_date` trên cơ hội của A**. Theo [luật 5](../../CLAUDE.md#2-bảy-luật-bất-di-bất-dịch) ("Next step là nhịp tim của deal"), đó là xoá việc-phải-làm-sáng-nay của người khác — và nhật ký ghi rõ đó là hành động có chủ ý, đã xác thực.

## Phương án đã cân nhắc

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| **A. Phân quyền theo `companies.owner_id` cho toàn bộ đường đọc và đường ghi** | Hàng rào kín; lỗ ghi chéo bị bịt; trả lời được vòng 2 bằng một câu | Đụng ~14 endpoint; phải di trú T-5/T-9; vượt mốc 15:00 | ✅ **Chọn** |
| B. Giữ nguyên "scope = mặc định của view" của ADR-0045 | Không tốn gì, không rủi ro | Không đáp ứng yêu cầu mới; để nguyên lỗ ghi chéo | ❌ Loại — người quyết định đã chọn làm |
| C. Chỉ phân quyền **hàng đợi gợi ý** (bản plan đầu) | Rẻ hơn nhiều, đúng chữ của yêu cầu | **Hàng rào nửa vời.** Chặn Sales B *đọc* một gợi ý về công ty của A trong khi vẫn cho B *ghi* vào deal của A qua `undo()`. Còn rò nguyên bằng chứng qua `reading-zone` (với gợi ý `timeline_entry` thì `proposed_value` **chính là** `claim.statement`). Và badge "có gợi ý chờ" sẽ **nói dối**: `/cong-ty` chưa scope nên B vẫn thấy hàng Sakura của A, nhưng badge render `null` → người đọc hiểu "Sakura không có gì chờ", một câu sai — đúng thứ [luật 4](../../CLAUDE.md#2-bảy-luật-bất-di-bất-dịch) cấm | ❌ Loại — nửa vời tệ hơn cả hai đầu |
| D. Làm RLS ở tầng CSDL cho đủ hai tầng như trần tự chủ AI | Đúng chuẩn của [ADR-0010](0010-chan-tang-csdl-bang-hai-role-va-quyen-theo-cot.md); quên một `where` cũng không lọt | Cần migration + đổi cách nối pool theo từng người dùng, trong ngày chấm | ❌ Loại — nhưng đây là hướng đúng cho bản sau, ghi lại ở mục Hệ quả |

## Quyết định

Chọn **A**, với bốn ràng buộc bắt buộc:

**1 · Kín hoặc không làm.** Sales chỉ thấy và chỉ ghi được trong phạm vi công ty mình phụ trách (`companies.owner_id`); Admin toàn quyền. Áp cho **mọi** đường: hàng đợi gợi ý, tóm tắt gợi ý chờ, danh sách/chi tiết công ty, vùng đọc bản lưu, dòng thời gian, cơ hội, danh sách sự kiện tự đặt Việc tiếp theo — và mọi đường ghi tương ứng.

**2 · Cổng fail-closed, một chỗ duy nhất.** `Actor.role` là optional (`actor-context.ts:22`), nên viết *"nếu là sales thì thu hẹp"* sẽ cho actor thiếu vai trò rơi vào nhánh Admin — nhánh rộng nhất. Có hai đường sinh ra actor thiếu vai trò thật: test dựng `{ kind: 'human', userId }`, và JWT cũ qua `actor.interceptor.ts:25`. Nên cổng viết theo chiều ngược lại — **thu hẹp trừ khi là admin** — và actor người không có vai trò thì **ném lỗi**. Đặt ở `common/actor/owner-scope.ts`, dùng chung, không sao chép.

**3 · Logic vai ở controller.** Giữ đúng tiền lệ `OverviewController` và câu đã chốt ở ADR-0045 ("logic vai nằm ở controller"). Service nhận `ownerId?: string | null` tường minh, không tự đọc vai trò từ ambient context.

**4 · Một tầng, và nói thật là một tầng.** Khác với trần tự chủ AI — vốn có CSDL đỡ lưng vì `crm_system` không được GRANT — luật này **chỉ sống ở tầng domain**. `crm_app` giữ `GRANT ALL ON ALL TABLES` (`0001_grants.sql:24-31`) và repo không có RLS ở đâu cả. Mọi nơi đọc `proposals` / `companies` qua `dbApp` là bề mặt phải bảo trì bằng mắt. ADR này **không** được mượn uy tín hai-tầng của ADR-0010.

**Công ty chưa gán người phụ trách**: loại khỏi phạm vi Sales, **và đếm rồi nói ra** — theo đúng pattern `unassignedCompanies` đã ship ở `/tong-quan`. Im lặng giấu là vi phạm luật 4.

## Hệ quả

- **T-5 và T-9 phải di trú trước.** Cả hai đăng nhập `sales@hblab.vn` nhưng thao tác trên công ty của người khác, nên sau khi phân quyền hàng đợi rỗng và hai bài đỏ ngay ở assertion chính. Cách giải cuối cùng **giữ được câu chuyện "một Sales duyệt gợi ý"** thay vì hạ xuống "một người có quyền duyệt gợi ý": T-5 tự tạo công ty của nó qua giao diện — người tạo thành người phụ trách, nên gợi ý rơi đúng vào hàng đợi của tài khoản đang đăng nhập; T-9 đăng nhập đúng người phụ trách `San-e` (`sales3@hblab.vn`). Không spec nào phải mượn quyền Admin, và không dòng dữ liệu nhập nào bị sửa để chiều bộ test.
- **Comment `overview-service.ts:16-20` thành sai** — nó đang khẳng định *"The scoping is a VIEW, not authorization — every other screen still shows everything to everyone"*. Sửa cùng commit.
- **`company.controller.ts:77-84` thành sai** — comment nói bất kỳ ai đăng nhập cũng bật/tắt được nguồn thật, dẫn ADR-0033.
- **`ontology.md` mục 1 và dòng Q-6 (mục Câu hỏi chưa giải quyết)** đã sửa.
- Chọn **404 thay vì 403** khi id thuộc phạm vi người khác: 403 xác nhận id đó tồn tại, tức vẫn rò một bit. Thiếu vai trò thì 403 là đúng vì không tiết lộ gì về dữ liệu.
- Đánh đổi chấp nhận: vượt mốc 15:00 vòng 1. Người quyết định đã cân nhắc và chọn.
- **Sẽ phải xem lại nếu:** cần deal đổi chủ độc lập công ty (khi đó mở lại phương án D của ADR-0045), hoặc sản phẩm ra ngoài phạm vi demo — lúc đó phương án D ở trên (RLS) là hướng đúng, không phải thêm `where` thứ mười lăm.

## AI đã tham gia thế nào

- Vai trò AI: phản biện yêu cầu, sinh và so phương án, **rà soát đối kháng 4 lăng kính trên chính bản plan do AI viết**, rồi viết lại plan theo kết quả.
- **AI sai ở đâu — và đây là phần đáng ghi nhất.** Bản plan đầu do AI viết mắc bốn lỗi mà rà soát đối kháng bắt được: (1) đề xuất phân quyền mà **không biết** nó lật ADR-0033 và ADR-0045 — plan viết trên ảnh chụp cũ của sổ quyết định, còn ghi "ADR kế tiếp sau 0036" trong khi đã có 0037, 0038; (2) chỉ kiểm tra công ty có *thiếu* owner không, **quên hỏi owner là ai**, nên không thấy T-5/T-9 sẽ đỏ; (3) đề xuất hàng rào nửa vời — chặn đọc hàng đợi mà bỏ qua đường ghi `undo()` và đường rò `reading-zone`; (4) viết cổng phân quyền theo chiều **fail-open**. Ba trong bốn lỗi này chỉ lộ ra khi cho AI tấn công chính sản phẩm của nó với bằng chứng `file:line` bắt buộc.
- AI đề xuất gì mà đội **không** nghe: sau rà soát, AI khuyến nghị lấy "lát cắt tối thiểu" (bỏ phân quyền, chỉ sửa UX + vá `markRead`) vì rẻ và không đụng ADR nào. Đội chọn làm đầy đủ và chấp nhận vượt deadline, vì lỗ ghi chéo là lỗ thật và một nửa hàng rào thì không đáng dựng.

## Đội đã verify bằng cách nào

- `owner-scope.test.ts` — cổng fail-closed: admin → không lọc; sales → chính mình; **human không vai trò → ném**; system → ném. Case thứ ba là case bản plan đầu sai.
- `owner-scoped-read-paths.test.ts` — quét theo **danh sách endpoint**, không theo service, để không endpoint nào bị bỏ quên; gồm cả `reading-zone` (khẳng định không rò `quote_text`) và công ty đã xoá mềm.
- `cross-owner-write-refused.test.ts` — Sales B `undo` sự kiện của Sales A: 404, cơ hội của A **không đổi một cột nào**, có `AuditEvent` refusal. Cộng ba đường ghi còn lại.
- T-1..T-10 chạy lại đầy đủ sau khi di trú T-5/T-9.

## Rollback

Revert tập commit {contract, cổng, đường đọc, đường ghi}. Không có migration nên không có rollback schema. Di trú T-5/T-9 giữ lại được độc lập vì nó không phụ thuộc phân quyền. Ước tính < 20 phút.

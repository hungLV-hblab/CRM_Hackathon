# Brainstorm — Phân quyền hàng đợi · Thiết kế lại /thong-bao · Phân trang

- Ngày: 2026-08-15
- Trạng thái: đã chốt phương án với người dùng (4/4 quyết định)
- Nguồn: phiên /ask + /brainstorm, scout trực tiếp codebase

## 1. Vấn đề

Ba yêu cầu gốc:

1. Các màn list chưa có phân trang — mọi endpoint trả full mảng.
2. `/hang-doi` cần lọc: sale theo công ty, admin thêm chiều theo sale. **Đã xác nhận đây là PHÂN QUYỀN, không phải tiện ích lọc** — sale chỉ được thấy gợi ý thuộc công ty mình phụ trách.
3. `/thong-bao` cần phân trang + chức năng "đã xem". Scout cho thấy nút "Đã xem" đã tồn tại (strip dùng chung), vấn đề thật là **UX của trang chưa phù hợp** — cần thiết kế lại.

## 2. Hiện trạng liên quan (scout)

- JWT đã mang `role` (`sales`/`admin`); web có `api.me()`, đã dùng ở `ai-status-pill.tsx`. API có `RolesGuard`/`@Roles`.
- `companies.ownerId` có thật, seed gán đủ owner cho 5 công ty (3 sale). Schema cho phép null.
- Chưa có endpoint users. Chưa có pagination ở bất kỳ contract nào.
- Lỗ hổng: `ProposalService.listPending()` và `pendingSummary()` không scope theo actor; `ProposalDecisionService.decide()` chỉ chặn `actor=system` — sale duyệt được gợi ý của người khác qua id.
- Bug: `NotificationService.markRead()` không lọc theo `actor.userId` — user này đánh dấu hộ user kia được.
- `/thong-bao` tái dùng nguyên `NotificationStrip` (thiết kế cho strip trên bảng cơ hội): hộp tím machine-style, gộp theo câu, không hợp vai trò trang lịch sử.

## 3. Quyết định đã chốt

### Q1 · Phân quyền hàng đợi: TRỌN BỘ BA

Scope theo `companies.ownerId` ở cả ba chỗ, enforce tầng domain (service nhận `actor`):

- `listPending(actor)`: sale → chỉ proposal của công ty mình own; admin → tất cả.
- `pendingSummary(actor)`: badge đếm đúng những gì người đó thấy.
- `decide(actor, ...)`: sale duyệt gợi ý ngoài quyền → Forbidden (kèm audit refusal như pattern sẵn có).
- Công ty không có owner: chỉ admin thấy (chặt chẽ; seed hiện không có case này).

Phương án bị loại: chỉ scope màn list — badge lệch, lỗ decide-by-id còn nguyên, khó bảo vệ vòng 2.

### Q2 · Nguồn dropdown "lọc theo sale" của admin: TỪ CHÍNH DTO

Thêm `ownerId`/`ownerName` vào `ProposalDto` (1 leftJoin `users` trong query có sẵn). Dropdown build client-side từ data đang hiển thị. Sale dùng dropdown lọc theo công ty (data đã có `companyId`/`companyName`), admin thêm dropdown sale; UI ẩn/hiện theo `api.me().role`.

Phương án bị loại: endpoint `GET /users?role=sales` — module domain mới chỉ phục vụ 1 dropdown, YAGNI.

### Q3 · Thiết kế lại /thong-bao: TRANG RIÊNG

- Tách phần render **một dòng thông báo** thành component dùng chung (`notification-row`) cho cả strip lẫn trang — giữ tinh thần ADR-0027 (một sự thật); luật "không tự biến mất trước khi đọc" nằm ở tầng data, không đổi.
- Trang: danh sách phẳng mới→cũ, dòng chưa đọc nổi bật (chấm + đậm), đã đọc mờ đi; nút "Đã xem" từng dòng; nút "Đánh dấu tất cả đã xem" ở header; "Hoàn tác" giữ nguyên trên dòng còn hạn; phân trang server-side.
- Strip trên `/co-hoi` giữ nguyên hành vi (chỉ chưa đọc, gộp theo câu).
- API: thêm `POST /notifications/read-all` (scope userId); fix bug scope của `markRead`; `GET /notifications` thêm `page/pageSize/unreadOnly` — một endpoint, khác param, không tách endpoint thứ hai.

Phương án bị loại: (a) prop `variant="page"` trên component cũ — phình hai chế độ, sửa bên này vỡ bên kia; (b) vá tối thiểu — không trả lời lời chê UX.

### Q4 · Phạm vi phân trang: /thong-bao + /cong-ty

Hai list duy nhất tăng vô hạn (vòng quét zone 4 tự sinh dữ liệu). `/hang-doi` sau phân quyền còn ngắn — bỏ qua (YAGNI). `/co-hoi` là kanban — không áp dụng.

Contract chung tại `packages/contracts`:

- Query: `page` (int ≥1, default 1) · `pageSize` (int 1–100, default 20), offset-based.
- Envelope: `Paginated<T> = { items, total, page, pageSize }`.
- Web: TanStack Query với `placeholderData: keepPreviousData`.

Phương án bị loại: cursor-based (over-engineering ở scale này), infinite scroll (xung đột nhu cầu tra lịch sử), client-side pagination giả (không giảm payload).

## 4. Ràng buộc & rủi ro

- **Bảy luật CLAUDE.md**: phân trang /thong-bao không được làm mất đường tới thông báo chưa đọc (luật "không tự biến mất trước khi `read_at`"); strip vẫn hiển thị toàn bộ chưa đọc không phân trang.
- **Breaking change shape response** (`T[]` → envelope) ở notifications + companies: phải sửa api-client + mọi caller cùng lượt, chạy full test.
- **Đổi authorization là đổi hành vi demo**: tài khoản sale trong demo sẽ thấy ít gợi ý hơn trước — cần cập nhật kịch bản demo/seed nếu có.
- UI mới phải qua checklist design-guidelines (token `ink-*`/`machine-*`, vùng chạm ≥44px, tím = máy sinh, cam = người sắp bấm).
- Cần ADR: (1) phân quyền hàng đợi theo owner, (2) contract phân trang. Dùng `/hack:adr`.

## 5. Tiêu chí thành công

- Test domain: sale A không list/không decide được proposal công ty của sale B (403 + audit); admin thấy tất cả; badge khớp list từng role.
- Test notifications: markRead/read-all chỉ tác động thông báo của chính actor; phân trang trả đúng `total`; strip vẫn đủ thông báo chưa đọc.
- E2E: đăng nhập sale → hàng đợi chỉ công ty mình + dropdown công ty; đăng nhập admin → thấy hết + dropdown sale; /thong-bao đánh dấu tất cả, chuyển trang.
- `pnpm test` + `pnpm typecheck` xanh.

## 6. Bước tiếp theo

1. `/ck:plan` từ báo cáo này (khuyến nghị `--tdd` — đụng logic phân quyền và hành vi có test sẵn).
2. Viết 2 ADR trước khi code.
3. Lưu ý timeline hackathon: đây là feature sau freeze — làm sau khi vòng 1 chốt (15:00 hôm nay), trừ 2 fix hardening (scope `markRead`, lỗ decide-by-id) có thể xin làm sớm.

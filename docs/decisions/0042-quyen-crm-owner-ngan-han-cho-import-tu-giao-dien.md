# ADR-0042 — `AdminImportService` mở kết nối `crm_owner` ngắn hạn, đúng lúc gọi, không giữ token sống lâu

| | |
| --- | --- |
| **Ngày** | 2026-08-15 13:00 |
| **Giai đoạn** | Development (feature 260815-1026 — nạp dữ liệu mẫu qua upload zip) |
| **Trạng thái** | Chấp nhận |
| **Người quyết định** | trungmd |
| **Prompt log** | [brainstorm report](../../plans/reports/brainstorm-260815-1026-nap-du-lieu-mau-qua-upload-report.md) |

## Bối cảnh

Spec mục 7 điều kiện 5 đòi nạp bộ dữ liệu BTC **qua giao diện upload zip**, thay cho "một lệnh" CLI, và nạp lại đúng file phải đưa hệ thống về đúng trạng thái ban đầu. Cơ chế đó đã tồn tại: `packages/db/src/seed/index.ts`'s `seed()` chạy `TRUNCATE CASCADE` rồi `INSERT` lại toàn bộ, dùng kết nối `crm_owner` — vì `TRUNCATE` cần quyền chủ bảng, và ADR-0010 đã đo: một role sở hữu bảng bỏ qua GRANT theo cột kể cả khi `NOSUPERUSER`.

`packages/db/src/client.ts` có một câu comment tường minh: *"`crm_owner` is deliberately absent here... That role belongs to `migrate.ts` and `seed/`"* — tức API process không bao giờ được cầm quyền này. Đưa tính năng nạp dữ liệu vào giao diện nghĩa là `apps/api` giờ phải chạm `crm_owner` lần đầu tiên, đúng chỗ comment đó nói không nên chạm. ADR này giải thích vì sao ngoại lệ này an toàn và bị khoanh vùng tới đâu.

## Phương án đã cân nhắc

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| **A. Kết nối `crm_owner` ngắn hạn, mở-dùng-đóng trong đúng một lệnh gọi** — `AdminImportService.importZip()` đọc `DATABASE_URL_OWNER`, gọi thẳng `seed(connectionString, dataset)` (hàm CLI đã dùng), pool đóng khi hàm trả về | Bề mặt tấn công nhỏ nhất có thể: quyền `crm_owner` chỉ tồn tại trong bộ nhớ process trong đúng thời gian một request xử lý, không sống qua request thứ hai. Tái dùng nguyên `seed()` — không viết logic TRUNCATE/INSERT thứ hai có thể lệch khỏi bản CLI | `apps/api` giờ có một chỗ (và chỉ một chỗ) biết `DATABASE_URL_OWNER` tồn tại — phải enforce bằng test, không phải bằng thiện chí | ✅ **Chọn** |
| **B. DI token `DRIZZLE_OWNER` cấp module, bind vào `AdminModule`, pool sống suốt vòng đời process** (thiết kế gốc lúc brainstorm) | Khớp pattern NestJS quen thuộc (giống `DRIZZLE_APP`/`DRIZZLE_SYSTEM` đã có); không phải mở/đóng pool mỗi lần gọi | Một pool `crm_owner` nằm trong bộ nhớ **suốt vòng đời API process**, không chỉ lúc admin bấm nút. Bất kỳ lỗ hổng nào khác trong `apps/api` (injection, RCE, leak biến môi trường qua log lỗi...) từ giờ có đường chạm tới quyền bỏ-qua-GRANT, kể cả 99.9% thời gian không ai đang import gì. Đổi rủi ro "chạm quyền cao nhất một khoảnh khắc" lấy rủi ro "cầm quyền cao nhất mọi khoảnh khắc" | ❌ Loại — bề mặt tấn công lớn hơn cho cùng một tính năng |
| **C. Không dùng `crm_owner` — cho `crm_app` quyền TRUNCATE trên các bảng cần xoá** | Không cần ngoại lệ nào, `client.ts`'s comment vẫn đúng 100% | Phá chính bức tường ADR-0010 dựng: `crm_app` là quyền của MỌI hành động do người dùng khởi tạo qua UI (bao gồm cả nếu sau này có lỗ hổng ghi tuỳ ý), TRUNCATE trên đó nghĩa là bất kỳ request nào lọt qua tầng ứng dụng cũng có thể xoá sạch dữ liệu — đúng thứ ADR-0010 tách quyền ra để chặn | ❌ Loại — xoá bỏ chính lớp phòng thủ đang cố giữ |

## Quyết định

Chọn **A**. Tiêu chí so: *thời gian một quyền nguy hiểm tồn tại trong bộ nhớ process*, không phải *có tái dùng pattern quen thuộc của framework hay không*. B giữ nguyên pattern DI nhưng biến một hành động hiếm (import) thành một quyền thường trực; A giữ quyền đó ngắn đúng bằng hành động sinh ra nhu cầu của nó.

`AdminImportService.importZip()` gọi trực tiếp `seed(requireEnv('DATABASE_URL_OWNER'), dataset)` — cùng hàm, cùng kết nối tạm-mở-tạm-đóng mà `pnpm seed` (CLI) đã dùng từ đầu. Route `POST /admin/import-data` gắn `@Roles('admin')` — Sales không chạm được (`admin-import.controller.ts`).

## Hệ quả

- **`DATABASE_URL_OWNER` là biến môi trường đã có sẵn** trong container (anchor `&database-urls` của `infra/docker-compose.yml`, dùng chung với `migrate`/`worker`) — không thêm secret mới, chỉ thêm một nơi đọc nó.
- **Phạm vi I-16 (danh sách công ty seed, dùng để chặn live-crawl trên dữ liệu chấm điểm) thu hẹp có chủ đích**: `SEED_COMPANY_IDS` (`apps/api/src/ai/resolve-observation-source.ts`) tính từ `loadDefaultDataset()` — tức từ file zip **checked-in** (`packages/db/seed-assets/hackathon-1-data.zip`), đọc đồng bộ lúc module load. Nếu admin upload một file zip KHÁC qua giao diện, I-16 vẫn chỉ bảo vệ bộ công ty của file checked-in, không tự động mở rộng sang công ty trong file mới. Đây là quyết định đã chốt lúc validate plan (không phải lỗ hổng bị bỏ sót): mục tiêu I-16 là giữ đúng bộ dữ liệu chấm điểm chính thức replay được, không phải bảo vệ mọi file bất kỳ ai upload.
- **Đánh đổi chấp nhận**: mỗi lần import mở một kết nối `crm_owner` mới thay vì tái dùng pool — chấp nhận được vì import là hành động hiếm (admin bấm tay), không phải đường nóng (hot path) cần tối ưu latency.
- **Sẽ phải xem lại nếu**: có thêm một tính năng thứ hai cần `crm_owner` — lúc đó cân nhắc gộp thành một service dùng chung thay vì nhân bản pattern "mở-dùng-đóng" ở nhiều nơi.

## AI đã tham gia thế nào

- Vai trò AI: brainstorm phương án nạp dữ liệu ban đầu (đề xuất DI token B như thiết kế mặc định, theo đúng pattern `DRIZZLE_APP`/`DRIZZLE_SYSTEM` đã có trong codebase), sau đó tự phát hiện lại vấn đề khi implement Phase 3 và đề xuất đổi sang A.
- AI đề xuất gì mà đội **không** nghe: ở bước brainstorm, AI mặc định đi theo pattern DI token quen thuộc (B) vì nó khớp kiến trúc hiện có — không tự đặt câu hỏi về thời gian sống của quyền `crm_owner` cho tới khi bị hỏi lại trực tiếp "cấu trúc code đã đảm bảo được việc import này chưa?".
- AI sai ở đâu: chọn pattern quen mắt (nhất quán kiến trúc) làm tiêu chí chính, thay vì tiêu chí đúng của một quyết định bảo mật — *quyền nguy hiểm tồn tại bao lâu*. Sửa lại khi bị hỏi ngược, không phải tự phát hiện trước.

## Đội đã verify bằng cách nào

- **Grep enforcement, không phải comment**: `apps/api/src/__tests__/owner-credential-scoped-to-import.test.ts` quét toàn bộ `apps/api/src` (trừ `__tests__/`) và assert chuỗi `DATABASE_URL_OWNER` chỉ xuất hiện trong đúng một file — `admin/admin-import-service.ts`. Test đỏ nếu ai đó copy pattern này sang chỗ khác mà không qua ADR mới.
- **Chạy thật qua giao diện**: `e2e/admin-import-data.spec.ts` — đăng nhập admin, upload `hackathon-1-data.zip`, xác nhận tóm tắt đúng `25 công ty / 38 liên hệ / 15 cơ hội`, dữ liệu hiện trên `/cong-ty`, rồi **upload lại đúng file lần hai** và xác nhận cùng con số (I-14 — không cộng dồn). Chạy xanh: `1 passed`.
- **Kiểm route gate**: `e2e/admin-import-data.spec.ts`'s test thứ hai xác nhận Sales đăng nhập không thấy panel nạp dữ liệu ở `/quan-tri`.
- **Kiểm GRANT trên `snapshot_pages`**: `packages/db/migrations/0013_snapshot_pages.sql` cấp `SELECT` duy nhất cho `crm_system` — cùng khuôn với `company_sources` (`0008_live_source.sql`), xác nhận bằng đọc trực tiếp file migration, không suy đoán.
- **Toàn bộ suite**: `pnpm test:unit` (564 test) + `pnpm exec playwright test` (40 passed, 2 skipped có lý do ghi rõ) + `pnpm typecheck` + `pnpm lint` + `pnpm build` chạy sạch sau khi đổi.

## Rollback

Nếu quyết định này sai giữa ngày thi: xoá `AdminImportService`/`AdminImportController`, tắt route `/admin/import-data` — hệ thống quay về đúng trạng thái trước feature này, `pnpm seed` (CLI) từ terminal vẫn hoạt động không đổi vì nó không phụ thuộc route này. Ước lượng dưới 10 phút vì route bị cô lập, không đụng schema hay bảng nào khác ngoài việc mất đường upload qua giao diện.

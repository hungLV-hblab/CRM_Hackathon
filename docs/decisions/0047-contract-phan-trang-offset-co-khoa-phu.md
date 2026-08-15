# ADR-0047 — Phân trang offset dùng chung, bắt buộc có khoá phụ khi sắp xếp

| | |
| --- | --- |
| **Ngày** | 2026-08-15 |
| **Giai đoạn** | Design |
| **Trạng thái** | Chấp nhận |
| **Người quyết định** | Thang Nguyen |
| **Prompt log** | [brainstorm-report.md](../../plans/2026-08-15-queue-authz-notification-redesign-pagination/brainstorm-report.md) · [báo cáo red team](../../plans/2026-08-15-queue-authz-notification-redesign-pagination/reports/from-code-reviewer-to-planner-red-team-four-lens-plan-review-report.md) |

## Bối cảnh — và một tiền đề sai phải đính chính trước

Người dùng yêu cầu các màn danh sách có phân trang. Bản brainstorm biện minh bằng câu *"hai list duy nhất tăng vô hạn (vòng quét zone 4 tự sinh dữ liệu)"*. **Câu đó sai**, rà soát đối kháng chứng minh bằng ba dẫn chứng:

- Công ty **chỉ người tạo được**: `CompanyService.create` từ chối `actor.kind === 'system'` (`company-service.ts:31-36`), và `crm_system` không hề có GRANT INSERT trên `companies` (`0001_grants.sql:38-63`). Vòng quét không thể sinh ra công ty nào.
- Thông báo do vùng tự chủ **3** viết (tự đặt Việc tiếp theo), không phải vùng 4; GRANT của vòng quét chỉ có `INSERT ON timeline_entries`.
- Seed có **5 công ty**.

Vậy lý do thật để làm phân trang là: **người dùng yêu cầu**, và nó là hành vi danh sách mà một CRM cần có. Không phải vì dữ liệu đang tràn. Ghi đúng lý do ở đây để vòng 2 hỏi "vì sao phân trang" thì đội trả lời đúng thay vì trả lời theo một câu đã bịa.

## Phương án đã cân nhắc

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| **A. Offset (`page`/`pageSize`), envelope `{items,total,page,pageSize}`, bắt buộc khoá phụ khi `ORDER BY`** | Nhảy được tới trang bất kỳ; `total` hiển thị được; hợp với nhu cầu tra lịch sử | Offset lệch khi có chèn đồng thời — giảm bằng khoá phụ, và ghi nhận phần còn lại | ✅ **Chọn** |
| B. Cursor-based | Không lệch khi chèn đồng thời | Không nhảy được tới trang N, không có `total`; phức tạp hơn hẳn ở quy mô 5 công ty | ❌ Loại — over-engineering |
| C. Cuộn vô hạn | Mượt trên di động | Xung đột nhu cầu tra lại lịch sử của `/thong-bao`; tốn công hơn | ❌ Loại |
| D. Phân trang giả ở client (tải hết rồi cắt) | Rẻ nhất | Không giảm payload — tức là không phải phân trang, chỉ là trông giống | ❌ Loại |

## Quyết định

Chọn **A**. Contract đặt ở `packages/contracts/src/dto/pagination.ts`, dùng chung cho mọi endpoint danh sách:

```ts
paginationQuerySchema  // page: int ≥1 default 1 · pageSize: int 1..100 default 20
Paginated<T>           // { items: T[]; total: number; page: number; pageSize: number }
```

Ba ràng buộc bắt buộc, mỗi cái ứng với một lỗi rà soát đối kháng đã bắt được:

**1 · `ORDER BY` phải có khoá phụ `id`.** `notifications.created_at` không unique và vòng quét chạy **10 giây/lần** trong e2e, nên hai bản ghi cùng timestamp là chuyện thật. Không có khoá phụ thì thứ tự tương đối của chúng là *không xác định* — một dòng có thể hiện ở hai trang, hoặc biến mất khỏi cả hai. Viết `ORDER BY created_at DESC, id DESC`.

**2 · `total` có thể lệch một nhịp so với `items`, và ta ghi nhận thay vì giả vờ không.** Đếm và lấy dòng là hai câu lệnh; gói chung transaction thì chặt hơn nhưng không xoá được việc người dùng đang xem trang 1 thì trang 2 đã đổi. Sản phẩm này không có yêu cầu nào cần con số tuyệt đối chính xác tại một thời điểm, nên **chấp nhận**, và không viết ở đâu rằng nó chính xác.

**3 · Query string không có kiểu boolean — cấm `z.coerce.boolean()`.** Trong zod 3, `z.coerce.boolean()` là `Boolean(input)`, nên mọi chuỗi khác rỗng đều thành `true`, **kể cả chuỗi `"false"`**. Repo đã giải đúng bài này một lần ở `company.controller.ts:52-58` kèm comment giải thích. Nay đóng gói thành `booleanQuerySchema` dùng chung:

```ts
z.enum(['true','false']).optional().transform((v) => v === 'true')
```

Bản plan đầu viết `z.coerce.boolean()` cho `unreadOnly` và **3/4 reviewer độc lập bắt được**. Nếu ship, `/thong-bao` gửi `?unreadOnly=false` sẽ nhận về đúng tập chưa-đọc — tức trang lịch sử giấu mất lịch sử, đúng thứ ontology 3.3 nói route đó sinh ra để chống. Và test chỉ kiểm `unreadOnly=true` sẽ **xanh** qua bug này.

## Phạm vi áp dụng

- `GET /notifications` — có `page`, `pageSize`, `unreadOnly`.
- `GET /companies` — có `page`, `pageSize`, cùng 5 tham số lọc sẵn có.
- **Không** áp cho `/co-hoi`: đó là bảng kanban, phân trang không có nghĩa ở đó.
- **Không** áp cho `/hang-doi`: sau phân quyền ([ADR-0046](0046-phan-quyen-theo-nguoi-phu-trach-toan-he-thong.md)) mỗi Sales chỉ còn vài dòng.

Với `GET /companies`, bốn màn khác cũng gọi endpoint này và cần **danh sách đủ**, không cần trang: bảng cơ hội, Đang theo dõi, bảng lệnh ⌘K, và công tắc bản chụp của màn quản trị. Chúng truyền `pageSize` cao tường minh; trần đó được ghi ra, không để im lặng cắt còn 20 dòng.

## Hệ quả

- **Breaking change**: `NotificationDto[]` → `Paginated<NotificationDto>`, `CompanyDto[]` → `Paginated<CompanyDto>`. Kéo theo hai test API phải sửa (`t6-t7-auto-next-step-and-undo.test.ts`, `company-search-and-filter.test.ts`) và 6 nơi gọi phía web.
- **Cache key của TanStack Query phải mang tham số**: `['notifications', {unreadOnly, page, pageSize}]`. Một key cho hai truy vấn khác nhau nghĩa là ai mount trước thắng cache — rà soát đối kháng chỉ ra kịch bản thật: mở `/co-hoi` (strip nạp tập chưa đọc) rồi bấm "Xem tất cả thông báo" thì trang lịch sử render tập chưa-đọc như thể là toàn bộ. Tương tự, dropdown lọc của `/cong-ty` phải có key riêng (`['company-facets']`) vì `['companies', {}]` đã bị bảng lệnh ⌘K dùng.
- `packages/contracts` build ra `dist/` (gitignore) và `apps/web` resolve qua `dist` — thêm file vào `src` **không** làm web thấy nó. Phải `pnpm --filter @crm/contracts build` trước khi phía web dùng.
- **Sẽ phải xem lại nếu:** một bảng thật sự vượt vài nghìn dòng (khi đó offset sâu thành vấn đề hiệu năng và cursor mới đáng giá).

## AI đã tham gia thế nào

- Vai trò AI: đề xuất contract, và **viết sai hai chỗ** mà rà soát đối kháng bắt được — `z.coerce.boolean()` (bug thật, sẽ xanh qua test) và tiền đề "hai list tăng vô hạn" (sai sự thật, kiểm bằng GRANT trong migration). Cả hai đã sửa trong ADR này.
- AI đề xuất gì mà đội không nghe: AI khuyến nghị **bỏ hẳn** phân trang vì tiền đề sai và quy mô 5 công ty. Đội giữ lại vì đó là yêu cầu của người dùng — nhưng ghi đúng lý do thay vì lý do bịa.

## Đội đã verify bằng cách nào

- `pagination-query-parsing.test.ts` — `booleanQuerySchema('false')` → `false` (case bắt bug), `undefined` → `false`, `'true'` → `true`; `page=0` và `pageSize=101` bị chặn.
- Test phân trang ở tầng API cho cả hai endpoint, gồm case **hai bản ghi cùng timestamp** để chứng minh khoá phụ hoạt động.
- Test collation tiếng Việt cho `ORDER BY name` của `/cong-ty` (chữ Đ và dấu).

## Rollback

Revert tập {contract, notifications, companies} cùng nhau. Không migration. Lưu ý riêng: `POST /notifications/read-all` là ghi **một chiều** — revert commit không khôi phục `read_at` về NULL, đường reset duy nhất là `pnpm reset && pnpm seed`.

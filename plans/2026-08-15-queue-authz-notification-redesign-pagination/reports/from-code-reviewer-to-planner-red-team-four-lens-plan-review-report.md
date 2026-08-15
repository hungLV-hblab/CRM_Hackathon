# Red Team — 4 lăng kính đối kháng · plan phân quyền hàng đợi / thông báo / phân trang

- Ngày: 2026-08-15
- Reviewer: Security Adversary · Failure Mode Analyst · Assumption Destroyer · Scope & Complexity Critic
- Tổng: 35 finding thô → 17 sau khi gộp trùng. Tất cả đều có trích dẫn `file:line` (qua bộ lọc bằng chứng).
- Kết luận: **plan không vá được bằng sửa cục bộ** — tiền đề của nó bị bác ở hai chỗ độc lập nhau.

## Phần A — Hai finding chặn đứng plan

### A1 · Plan đảo ngược hai ADR đã ký và một dòng ontology, mà không supersede — CRITICAL

Cả 4/4 reviewer nêu độc lập. Người viết plan đã tự xác nhận trước khi reviewer trả kết quả.

- `docs/ontology.md:18` — "Sales … **không làm phân quyền theo người sở hữu**".
- ADR-0033 — loại phương án B với lý do "mua một dòng phân quyền mà rubric không chấm, trả bằng rủi ro làm đỏ bộ e2e vào buổi cuối"; điều kiện xem lại: "seed có từ hai người sở hữu trở lên" — **điều kiện này đã xảy ra** (seed 3 sales) nhưng chưa ai ghi nhận.
- ADR-0045 (11:15 hôm nay) — loại phương án E: "RBAC per-owner … scope creep sau freeze"; chốt "scope của sales là **mặc định của view, không phải quyền**".
- `apps/api/src/domain/overview/overview-service.ts:16-20` — comment trong code: "The scoping is a VIEW, not authorization — every other screen still shows everything to everyone".

Plan không liệt kê `docs/ontology.md` hay ADR-0033 vào danh sách file phải sửa, và phase 1 còn ghi số ADR "sau ADR-0036" trong khi `docs/decisions/` đã có 0037 và 0038 → plan viết trên ảnh chụp cũ của chính sổ quyết định của đội.

**Hệ quả:** vòng 2 hỏi "ai được thấy dữ liệu của ai" sẽ nhận ba câu trả lời mâu thuẫn từ chính artifact của đội. Đây đúng là chế độ hỏng mà ADR-0033 được viết ra để ngăn.

### A2 · Phase 2 làm đỏ T-5 và T-9 — hai bài nghiệm thu tính điểm — CRITICAL

3/4 reviewer nêu độc lập; người viết plan đã kiểm chứng lại từng dòng.

Plan chỉ kiểm tra công ty có *thiếu* owner không, không kiểm tra owner *là ai*:

| Bài | Đăng nhập | Công ty thao tác | Owner thật |
| --- | --- | --- | --- |
| T-5 | `sales@hblab.vn` = SALES1 (`e2e/t5-proposal-queue-decisions.spec.ts:15`) | `Kitefin Analytics` (`:21`) | **SALES2** (`seed-data.ts:90`) |
| T-9 | `sales@hblab.vn` = SALES1 (`e2e/t9-ai-kill-switch.spec.ts:39`) | `Ohara Retail Group` (`e2e/watch-cycle-scenario.ts:241`) | **SALES2** (`seed-data.ts:101`) |

Sau phase 2, hàng đợi của sales1 rỗng → `expect(proposal-card).toBeVisible()` đỏ ở cả hai bài. Không phase nào liệt kê `t5-*.spec.ts`, `t9-*.spec.ts`, `watch-cycle-scenario.ts` hay `seed-data.ts`.

Lối thoát nào cũng có giá: đổi owner của Kitefin/Ohara sang sales1 thì gãy `overview-owner-scoping.test.ts` và `dashboard-role-view.spec.ts` — hai thứ dựng trên đúng thế chia 2/2/1 mà ADR-0045 vừa chốt.

## Phần B — Nếu vẫn làm phân quyền: plan đang vẽ một hàng rào nửa vời

### B1 · Có một lỗ GHI chéo chủ sở hữu đang mở, nặng hơn lỗ plan định vá — CRITICAL

`AutoNextStepService.undo()` chỉ chặn `actor.kind === 'system'` và hạn 7 ngày; `loadUndoable` select theo `eventId` đơn thuần, không kiểm tra chủ sở hữu (`auto-next-step-service.ts:377-383`, `:438-448`). `listActive()` (`:325-341`) không nhận actor, phát ra mọi `eventId` trong hệ thống kèm `quoteText`.

Nghĩa là sale B đọc được id sự kiện của sale A rồi POST undo → server **ghi đè** `next_step_text` / `next_step_due_date` trên cơ hội của A. Theo luật 5 CLAUDE.md ("Next step là nhịp tim của deal"), đó là xoá sổ việc-phải-làm-sáng-nay của người khác.

Nếu ship phase 2 mà không đụng chỗ này: sale B bị 403 khi **đọc** một gợi ý về công ty của A, nhưng vẫn **ghi** được vào deal của A. Hàng rào chỉ để trang trí.

### B2 · Bằng chứng thô vẫn phát công khai — CRITICAL

`ObservationService.readingZone(companyId)` không nhận actor, không lọc owner (`observation-service.ts:372-385`); `timeline.controller.ts:26-29` tương tự. Với gợi ý loại `timeline_entry`, `proposedValue` **chính là** `claim.statement` (`proposal-service.ts:288`).

Nên sau phase 2, sale B bị 403 ở `/proposals` nhưng gọi `GET /companies/{id}/reading-zone` là nhận đủ statement + quoteText + offset — cùng lượng thông tin, chỉ thiếu nút Duyệt. Tiêu chí "Sale không còn đường nào (kể cả gọi API thẳng)" trong plan là **sai sự thật**.

### B3 · Badge sẽ nói dối thay vì để trống — CRITICAL

Scope `pendingSummary` theo owner trong khi `GET /companies` vẫn không scope (`company-service.ts:51-70`) → sale2 mở `/cong-ty` vẫn thấy hàng Sakura (của sale1) nhưng `PendingProposalMarker` render `null`. Người đọc hiểu là "Sakura không có gì chờ" — một câu sai, đúng thứ luật 4 CLAUDE.md cấm ("một dòng dữ liệu sai tệ hơn một dòng để trống"). 5 nơi tiêu thụ map này (`nav-list.tsx:27`, `opportunity-card.tsx:102`, `cong-ty/page.tsx:55`, `cong-ty/[id]/page.tsx:56`, `pending-proposal-marker.tsx:21`), plan không liệt kê nơi nào.

### B4 · Cổng phân quyền viết theo chiều fail-OPEN — CRITICAL

`Actor.role` là optional (`actor-context.ts:22`). Plan viết "nếu `actor.role === 'sales'` thì thu hẹp" → mọi actor **không có role** rơi vào nhánh admin, tức nhánh rộng nhất. Có hai đường sinh ra actor không role: test dựng `{ kind: 'human', userId }` (`company-source-candidates.test.ts:32`, `live-source-toggle.test.ts:34`), và JWT cũ/thiếu `role` qua `actor.interceptor.ts:25`.

Cổng phân quyền phải mặc định về phía HẸP: thu hẹp trừ khi `role === 'admin'`, và ném lỗi với actor người mà không có role.

### B5 · Không có tầng CSDL đỡ lưng, khác mọi ranh giới khác của sản phẩm — HIGH

CLAUDE.md mục 4 đòi enforce "ở tầng domain **và** ràng buộc CSDL". Luật mới chỉ sống trong service, đi qua `crm_app` — vốn có `GRANT ALL ON ALL TABLES` (`0001_grants.sql:24-31`), và repo không có RLS ở đâu cả. ADR phải nói thẳng "một tầng, không có CSDL đỡ lưng", không được mượn uy tín của ADR-0010.

### B6 · Logic vai đặt sai tầng so với tiền lệ sáng nay — MEDIUM

`OverviewController` quyết định vai ở **controller** rồi truyền scope tường minh xuống service (`overview.controller.ts:24-33`); ADR-0045 ghi rõ "logic vai nằm ở controller". Phase 2 lại rẽ nhánh `actor.role` **trong** `ProposalService` → hai quy ước trái nhau viết cùng một buổi chiều.

### B7 · Thiếu lọc xoá mềm trong đúng mệnh đề `where` đang sửa — MEDIUM

`listPending` inner-join `companies` nhưng không lọc `deletedAt IS NULL` (`proposal-service.ts:366-381`); `pendingSummary` không join `companies` (`:388-396`). Gợi ý của công ty đã xoá mềm vẫn nằm trong hàng đợi và duyệt được, ghi vào hàng không màn nào hiển thị.

## Phần C — Phân trang: tiền đề sai, và 6 lỗi kỹ thuật

### C1 · Lý do biện minh cho cả mảng phân trang là sai sự thật — HIGH

Brainstorm ghi "hai list duy nhất tăng vô hạn (vòng quét zone 4 tự sinh dữ liệu)". Không list nào tăng như vậy:

- Công ty **chỉ người tạo được** — `company-service.ts:31-36` từ chối `actor.kind === 'system'`, và `crm_system` không có GRANT INSERT trên `companies` (`0001_grants.sql:38-63`).
- Thông báo do zone **3** viết (auto-next-step), không phải zone 4; zone 4 chỉ được INSERT `timeline_entries`.
- Seed có **5 công ty**.

### C2 · Đổi shape response gãy 5 nơi gọi, plan liệt kê 1 — CRITICAL

`api.listCompanies()` có 5 nơi gọi: `cong-ty/page.tsx:44,53`, `co-hoi/page.tsx:44`, `dang-theo-doi/page.tsx:37`, `command-palette.tsx:37`, `quan-tri/snapshot-variant-switch.tsx:26`. Phase 6 liệt kê 1. Sau khi vá bằng `.items`, 4 màn im lặng bị cắt còn 20 dòng, không có UI chuyển trang. `t8-watch-cycle-writes-timeline.spec.ts:206` tìm "Marlin Product Labs" trong `/dang-theo-doi` — hỏng theo số lần chạy e2e (mỗi lần `login-and-create-company.spec.ts` thêm một công ty), trông như flake.

### C3 · Hai test API tiêu thụ shape cũ, không phase nào liệt kê — CRITICAL

- `t6-t7-auto-next-step-and-undo.test.ts:258-262` — `const list = await notifications.list(sales); expect(list).toHaveLength(1); list[0].readAt` → `Paginated<T>` không có `.length`, gãy typecheck.
- `company-search-and-filter.test.ts:56-64` — `rows.map(row => row.name)`.

### C4 · `z.coerce.boolean()` là lỗi repo đã ghi chú cách tránh — HIGH

3/4 reviewer nêu. Zod 3: `z.coerce.boolean()` là `Boolean(input)` → `"false"` thành `true`. `company.controller.ts:52-58` đã giải đúng bài này kèm comment giải thích. `toQueryString` (`api-client.ts:84-93`) chỉ bỏ `undefined`/`''` nên `false` được gửi thành `"false"`. Danh sách test của phase 4 chỉ có `unreadOnly=true` → bug xanh qua test.

### C5 · Một cache key, hai truy vấn khác nhau — HIGH

`NotificationStrip` dùng key hằng `['notifications']` cho cả hai chế độ (`notification-strip.tsx:46-49`). Phase 4 đổi *queryFn* theo chế độ mà không đổi key; phase 5 còn ghi "cùng key". Hậu quả: mở strip trước rồi vào `/thong-bao` → trang lịch sử render tập chưa-đọc như thể là toàn bộ lịch sử, đúng thứ ADR-0027 nói route này sinh ra để chống. Phase 6 lặp lại lỗi này với `['companies', {}]` — key mà `command-palette.tsx:37` đã sở hữu.

### C6 · Offset không tiebreaker, hai câu lệnh ngoài transaction, và không có dữ liệu để test — MEDIUM

`ORDER BY created_at DESC` không có khoá phụ (`notifications.ts:27,31`) → dòng trùng timestamp có thể xuất hiện hai trang hoặc không trang nào. `items` và `count(*)` là hai câu lệnh riêng → `total` mô tả ảnh chụp khác. Vòng quét chạy 10 giây/lần trong e2e nên đây là race thật. Ngoài ra `seed()` **không tạo notification nào** (`seed/index.ts:50-68`) → kịch bản e2e ">20 thông báo" của phase 5 không chạy được như viết.

### C7 · Hai định nghĩa cho một query shape — MEDIUM

`ListCompaniesQuery` hiện là interface TS thuần (`dto/company.ts:56-62`), controller tự parse 5 param kèm comment về `'true'/'false'`. Phase 6 thêm zod `listCompaniesQuery` mà không nói xoá interface → hai nguồn sự thật cho một shape. Phase 1 còn có test chỉ kiểm tra hành vi của chính zod, không kiểm tra bất biến sản phẩm nào.

## Phần D — Thiết kế lại /thong-bao

### D1 · Tiêu chí "T-6/T-7 không gãy" là bất khả thi theo cấu trúc — HIGH

`t6-t7-auto-next-step-and-undo.spec.ts:163-179` mở `/thong-bao` rồi assert bằng **testid của strip** (`notification-strip`) và dùng nhãn chữ "Đã xem" làm dấu hiệu đã đọc. Phase 5 cố ý gỡ strip khỏi trang đó và chuyển dấu hiệu sang chấm + làm mờ, nút "Đã xem" chỉ hiện ở dòng chưa đọc. Việc đổi selector là **chắc chắn**, không phải "nếu". Plan lại đặt "không gãy" làm tiêu chí nghiệm thu.

Riêng assertion `expect(row).toContainText('Đã xem')` là **chỗ duy nhất** bộ test chứng minh "đánh dấu chứ không xoá" — nên trạng thái đã đọc phải giữ một dấu hiệu **bằng chữ**, không chỉ màu/độ mờ (luật 2 vốn đã cấm phân biệt chỉ bằng màu).

### D2 · Sửa ADR-0027 cho hợp lệ hoá refactor là dấu hiệu ngược đuôi — HIGH

Phase 5 tự ghi "nếu reviewer không đồng ý → ghi thêm 1 dòng vào ADR-0027". `/thong-bao` hiện là 37 dòng với comment nêu rõ chủ ý: "Building a second list here would give 'a notice does not disappear before it is read' two implementations". Yêu cầu thật của người dùng là "chưa đọc trông không khác đã đọc" — giải bằng một nhánh style trong markup sẵn có + nút "Đánh dấu tất cả", dưới 40 dòng, không tách component, không đụng T-6.

### D3 · `read-all` là ghi một chiều không hoàn tác được — MEDIUM

Mọi ghi do máy gây ra trong sản phẩm này đều có nút hoàn tác. `read-all` ghi hàng loạt `read_at`, không có cột lịch sử, revert commit không khôi phục NULL, đường reset duy nhất là `pnpm seed` (TRUNCATE toàn bộ). Nếu bấm nhầm giữa demo thì strip trên `/co-hoi` trống vĩnh viễn cho tài khoản đó và không diễn lại được đường T-6.

## Phần E — Sai sót sự thật trong plan (đã kiểm chứng)

| # | Plan viết | Thực tế |
| --- | --- | --- |
| E1 | ADR kế tiếp "sau ADR-0036" | Đã có `0037`, `0038` → kế tiếp là **0039** |
| E2 | Đặt tên `ADR-00XX-slug.md` | Convention thật: `0039-slug.md`, không tiền tố `ADR-` |
| E3 | Plan demo-login "(pending)" | Đã ship: `overview-owner-scoping.test.ts`, `overview.controller.ts` scoping, `demo-accounts.ts` đều có trong cây |
| E4 | "Tái dùng `FilterBar`/`Select` sẵn có" | `filter-bar.tsx` có; **`select.tsx` không tồn tại** — `Select` nằm trong `input.tsx` |
| E5 | Phase 4 "Create `dto/notification.ts`" | File đã tồn tại, đã export qua barrel |
| E6 | Phase 4 "sửa test unit web nếu có" | `apps/web` **không có test nào** và không nằm trong `vitest.config.mts:6` |
| E7 | Phase 4 "harness integration sẵn có" cho notification | `domain/notification/` chưa có `__tests__/` — phải tạo mới theo mẫu `overview-owner-scoping.test.ts` |
| E8 | Rollback "phase 6 revert độc lập" | Phase 6 dùng contract của phase 1 mà phase 4 cũng dùng → tập revert là {1,4,5,6} |
| E9 | — | `packages/contracts/dist` bị gitignore và `apps/web` resolve qua `dist` → phase 1 phải có bước `pnpm --filter @crm/contracts build` làm cổng bàn giao |

## Phần F — Lát cắt tối thiểu thoả đúng 3 yêu cầu gốc

Không đụng ADR nào, không đụng bài nghiệm thu nào:

1. **Fix scope `markRead`** — `and(eq(id), eq(userId, actor.userId))`, 2 dòng + 1 test. Lỗi thật, không xung đột doctrine, ship được ngay.
2. **`/thong-bao` phân biệt chưa đọc / đã đọc + nút "Đánh dấu tất cả đã xem"** — nhánh style trong markup sẵn có, **giữ testid `notification-strip` và giữ dấu hiệu bằng chữ** để T-7 không đỏ.
3. **Dropdown lọc theo công ty ở `/hang-doi`** — thuần client, dựng từ `companyId`/`companyName` đã có trong DTO. Không đổi DTO, không đổi phân quyền, không thêm endpoint.

Bị cắt: toàn bộ phân trang (tiền đề sai + 5 nơi gọi + 2 test gãy), phân quyền hàng đợi (xung đột ADR + đỏ T-5/T-9 + hàng rào nửa vời), tách component thông báo, `ownerId`/`ownerName` trong DTO, cả hai ADR.

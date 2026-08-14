# Phản biện thiết kế Phase 8 — bảng điều khiển + đóng bộ nghiệm thu

- Ngày: 14/08/2026 10:12 · Phạm vi: [phase-08](../260813-0107-feature-groups-1-6-and-acceptance-suite/phase-08-nhom-6-bang-dieu-khien-va-bo-nghiem-thu.md)
- Cách kiểm: đọc mã nguồn + migration, không chạy đo
- Trạng thái: **đã chốt 4 quyết định**, sẵn sàng lập kế hoạch

## 1. Bài toán

P8 là phase cuối trước freeze tối 14/08. Ba việc: bảng điều khiển Quản trị · đóng T-9 + T-10 cho đủ 10 điểm bằng một lệnh · bịt lỗ ô sửa nhanh Việc tiếp theo P6 để lại.

Phase file viết 13/08 01:07, cùng hoàn cảnh đã làm P4/P5/P6/P7 lệch. Lần này kiểm trước: **ba chỗ lệch với code thật**, cả ba đổi thiết kế.

## 2. Scout — hiện trạng repo

| Việc | Hiện trạng | Nguồn |
| --- | --- | --- |
| `/quan-tri` | Chỉ có `nhat-ky-vong-quet/`, **không có index page** | `apps/web/src/app/(app)/quan-tri/` |
| Link tới dashboard | Hai chỗ chờ sẵn, có comment giải thích | `nav-items.tsx:30-32,45` · `huong-dan/page.tsx:139` |
| Đường ghi settings | `setAiEnabled()` **đã có** (dùng `dbApp`); controller **chỉ có `@Get()`** | `system-setting-service.ts:45` · `settings.controller.ts:17` |
| `watch_cycle_seconds` | Không có setter, không có route | — |
| Ghi vết bật/tắt | Không có | — |
| Module metrics | **Không tồn tại** | — |
| Nguyên liệu chỉ số | Đủ hết | `proposal_decisions{decision,reject_reason,seconds_to_decide}` · `auto_next_step_events.undone_at` · `audit_events.action='delete_system_timeline_entry'` · `claims.confidence` |
| Lớp CSDL của T-10 | **Đã chặn sẵn cả ba nhánh** | `0001_grants.sql:48` (chỉ 3 cột next-step) · `:63` (không DELETE bảng nào) |
| Khuôn T-10 | Dựng service bằng `new`, có `DATABASE_URL_TEST_SYSTEM` | `t10-mini-system-actor-blocked.test.ts` |
| Ô sửa nhanh | Card chỉ hiển thị; service đã tự đặt `nextStepSource='human'`; `PATCH /opportunities/:id` đã có | `opportunity-card.tsx` (110 dòng) · `opportunity-service.ts:127-132` |
| `pnpm test` một lệnh | Đã xong ở tầng wiring | `package.json:15` |
| e2e song song | `workers: 1`, `fullyParallel: false` | `playwright.config.ts:20-22` |

**Hệ quả lớn nhất: P8 cần 0 migration.** `crm_app` có `GRANT ALL ON ALL TABLES` (`0001_grants.sql:23`) nên ghi `system_settings` chạy ngay; metrics và banner đều là đường đọc.

## 3. Ba chỗ phase file nói chưa khớp code

### 3.1 Sales hiện KHÔNG đọc được trạng thái AI — T-9 có lỗ

`GET /settings` là `@Roles('admin')`. `ai-status-pill.tsx:31` cố ý `enabled: isAdmin` ⇒ **pill không bao giờ render cho Sales**, và comment trong chính file đã đẩy việc sang "banner ở màn sinh output AI". T-9 đòi "Sales thấy banner" nên banner phải có nguồn dữ liệu Sales đọc được.

| Phương án | Đánh giá |
| --- | --- |
| **A. `GET /settings/ai-status` trả đúng `{aiEnabled}`, mọi user đăng nhập** | ✅ **Chọn.** ~15 dòng, không lộ chu kỳ quét, **giữ nguyên điểm nghiệm thu số 2 của plan skeleton** (Sales 403 trên `/settings`) |
| B. Nới `GET /settings` cho Sales | ❌ Rẻ hơn 15 dòng nhưng phá một điểm nghiệm thu đã ghi trong báo cáo, và `login.test.ts:77` phải sửa |
| C. Suy trạng thái từ nhật ký vòng quét | ❌ Suy gián tiếp một cờ có sẵn dạng boolean |

`RolesGuard.canActivate:33` trả `true` khi handler không có `@Roles` ⇒ route mới **nằm luôn trong `SettingsController`**, không tạo module mới, **né sạch bẫy P7** ("module khai báo controller có guard phải tự import `AuthModule`, thiếu thì sập container và test đơn vị vẫn xanh").

**Banner đặt toàn cục** trong `(app)/layout.tsx`: một chỗ, không quên được. Bốn màn riêng lẻ thì sót một là T-9 đỏ vì chỗ sót, không vì sản phẩm.

### 3.2 Mẫu số của error-detection rate chưa ai định nghĩa

Ontology mục 7 cho tử số rất rõ, mẫu số ghi "tổng output AI" — chưa đủ để viết một câu SQL.

| Phương án | Đánh giá |
| --- | --- |
| **A. `proposals + auto_next_step_events + timeline_entries(created_by='system')`** | ✅ **Chọn.** Đúng tập mà người *có thể* bác; mọi số hạng tử số chỉ phát sinh trên ba tập này ⇒ tỉ lệ ≤1 và giải thích được trong một câu ở vòng 2 |
| B. Cộng thêm toàn bộ `claims` | ❌ Mẫu số phình 5–10 lần bằng phát hiện chưa từng đến tay ai ⇒ tỉ lệ gần 0 vĩnh viễn. Một con số **không bao giờ sai được** thì không đo gì |

Kèm luật hiển thị: **mọi tỉ lệ hiện kèm mẫu số/cỡ mẫu**. Bảng điều khiển nói "3/12", không nói "25%" trơ trọi — BGK không phải hỏi, và luật 4 (một dòng sai tệ hơn một dòng trống) áp cho cả số liệu.

→ **ADR-0031**.

### 3.3 Q-6: phase file nói Admin không sửa được, code cho sửa

`company.controller.ts:29`, `opportunity.controller.ts:35`, `proposal.controller.ts:30` chỉ có `@UseGuards(JwtGuard)` ⇒ **admin ghi y hệt Sales**. Câu "Tạm: Admin xem tất cả, không sửa dữ liệu Sales" trong phase file là mô tả một thứ không tồn tại. `roles.guard.ts:20-23` đã ghi sẵn "đừng đoán Q-6 ở đây".

| Phương án | Đánh giá |
| --- | --- |
| **A. ADR một dòng nói đúng hiện trạng** | ✅ **Chọn.** ~10', trung thực; sửa lại chữ trong phase file cho khớp code |
| B. Ép admin read-only | ❌ Chạm 3 controller + guard mới + rủi ro e2e đỏ vào tối freeze, đổi lấy một dòng rubric không chấm |

→ **ADR-0033**.

## 4. Bốn quyết định chốt

| # | Câu hỏi | Chốt | Hệ quả lan ra |
| --- | --- | --- | --- |
| 1 | Banner T-9 lấy dữ liệu ở đâu | `GET /settings/ai-status` (chỉ `JwtGuard`) + banner **toàn cục** trong `(app)/layout.tsx` | Giữ điểm nghiệm thu "Sales 403 trên `/settings`". Route nằm trong controller cũ ⇒ 0 module mới ⇒ né bẫy `AuthModule` của P7. **ADR-0032** |
| 2 | Mẫu số error-detection rate | `proposals + auto_next_step_events + timeline_entries(created_by='system')`; mọi tỉ lệ hiện kèm mẫu số | Bảng điều khiển phải có chỗ cho cỡ mẫu bên cạnh mỗi con số. **ADR-0031** |
| 3 | Q-6 | ADR nói đúng hiện trạng: vòng 1 Admin có quyền CRM như Sales | Sửa chữ trong phase file + dòng Q-6 ở `plan.md`. **ADR-0033** |
| 4 | Nút đổi bản chụp trên Quản trị | **Có**, xếp cuối danh sách cắt (sau ô sửa nhanh) | ~20 dòng gọi `POST /demo/companies/:id/snapshot-variant` đã có. Demo không phải rời trình duyệt sang terminal. Đóng câu treo cuối của `plan.md` |

## 5. Thiết kế

### 5.1 API

**`apps/api/src/settings/settings.controller.ts`** (sửa, không tạo module):
- `@Get('ai-status')` — chỉ `JwtGuard`, trả `{ aiEnabled }`. **Không** trả `watchCycleSeconds`.
- `@Patch()` `@Roles('admin')` — body `{ aiEnabled?, watchCycleSeconds? }`, zod ở `packages/contracts`. `watchCycleSeconds` nguyên, **5…3600** (T-8 e2e chạy 10s nên trần dưới không được là 60).

**`system-setting-service.ts`**: thêm `setWatchCycleSeconds()`, gộp thành một `updateParameters(actor, patch)` — đọc giá trị cũ, ghi, rồi ghi `AuditEvent` **mỗi khoá đổi một dòng**: `action: 'toggle_ai' | 'update_watch_cycle_seconds'`, `entity: 'system_setting'`, `detail: { from, to }`. Ghi bằng `dbApp` (đã đúng). Không đổi giá trị thì không ghi vết rỗng.

**`apps/api/src/domain/metrics/`** (module mới, controller `@Roles('admin')`):
- **Phải `imports: [AuthModule]`** và **phải thêm vào `watch-module-boots.test.ts`** — bẫy P7, thiếu thì sập container API, triệu chứng 502 ở trang đăng nhập, test đơn vị vẫn xanh.
- Truy vấn (tất cả qua `dbApp`, đọc thuần):

| Chỉ số | Câu |
| --- | --- |
| Auto-accept rate | `count(*) FILTER (WHERE decision='accept') / count(*)` trên `proposal_decisions` |
| Tỉ lệ sửa-rồi-duyệt | `count(*) FILTER (WHERE decision='edit') / count(*)` — **tách bạch**, không cộng vào accept (I-12) |
| Phân bố lý do bỏ | `GROUP BY reject_reason` |
| Phân bố mức chắc chắn | `GROUP BY confidence` trên `claims` |
| Thời gian quyết trung bình | `percentile_cont(0.5) WITHIN GROUP (ORDER BY seconds_to_decide)` + `count(seconds_to_decide)` + tổng quyết định ⇒ **nói rõ bao nhiêu bản ghi mất mốc** (ADR-0025 cho phép để trống) |
| Tỉ lệ hoàn tác | `count(*) FILTER (WHERE undone_at IS NOT NULL) / count(*)` trên `auto_next_step_events` |
| Error-detection rate | tử: `reject[wrong_info] + reject[misread_context] + undone + count(audit_events WHERE action='delete_system_timeline_entry')` · mẫu: quyết định 4 |
| Phân bố lý do xoá | `detail->>'reason'` trên cùng audit action (hợp đồng P7, đã chạy thật từ 14/08 03:38) |

- Mẫu số 0 → trả `null`, **không trả 0**. Giao diện hiện "chưa có dữ liệu", không hiện `0%`.

### 5.2 Web

| File | Việc |
| --- | --- |
| `app/(app)/quan-tri/page.tsx` *(tạo)* | 7 chỉ số **đúng tên ontology mục 7**, mỗi số kèm mẫu số · công tắc AI · ô `watch_cycle_seconds` (đơn vị giây, mặc định 60, một câu "đổi thì nhịp quét đổi từ vòng sau, không cần chạy lại") · nút đổi bản chụp (cắt cuối) |
| `components/ai-disabled-banner.tsx` *(tạo)* | Đọc `/settings/ai-status`; **chỉ render khi `aiEnabled === false`**; lỗi/chưa đọc được → không render (cùng luật với pill). Màu `warning`, **không** `machine` — đây là trạng thái hệ thống, không phải nội dung máy sinh |
| `app/(app)/layout.tsx` *(sửa nhỏ)* | Gắn banner trên nội dung |
| `components/shell/nav-items.tsx:45` | href `/quan-tri/nhat-ky-vong-quet` → `/quan-tri` |
| `app/(app)/huong-dan/page.tsx:139` | Thay đoạn "chưa có link" bằng link thật — `guide-page.spec.ts` khẳng định link không 404 |
| `app/(app)/co-hoi/opportunity-card.tsx` | Ô sửa nhanh: text + ngày → `PATCH /opportunities/:id`; invalidate **cả** `['opportunities']` **lẫn** `['auto-next-steps']` |

Không thêm thư viện biểu đồ trước freeze — hai phân bố vẽ bằng thanh CSS.

### 5.3 Test

| Test | Nội dung |
| --- | --- |
| `e2e/t9-ai-kill-switch.spec.ts` | Đặt chu kỳ 10s bằng `watch-cycle-scenario.ts` → xác nhận vòng đang chạy → admin bấm tắt **trên UI** → 2 chu kỳ sau: 0 mục mới, 0 gợi ý mới, 0 lần tự đặt · dữ liệu cũ còn nguyên · **hàng đợi tồn vẫn duyệt được** (ADR-0009) · Sales thấy banner · bật lại chạy tiếp · 2 dòng `AuditEvent`. `afterAll` trả chu kỳ về 60 và bật lại AI |
| `t10-system-actor-blocked.test.ts` | **Lớp domain**: `updateStage` · `update({expectedValue})` · xoá công ty dưới `SYSTEM_ACTOR` → throw + audit + dữ liệu nguyên. **Lớp CSDL**: raw SQL qua `DATABASE_URL_TEST_SYSTEM` cho cả ba → `permission denied` |
| cùng file | Khẳng định thứ tư: quét **`package.json` toàn workspace** *và* import trong `apps/api/src` theo danh sách token (`nodemailer`·`smtp`·`twilio`·`sendgrid`·`@slack`·`mailgun`). Quét mỗi source thì một dependency treo sẵn vẫn lọt |
| metrics unit | `edit` không cộng vào `accept` · mẫu số EDR đúng ba tập · 0 mẫu → `null` không phải 0 |
| `watch-module-boots.test.ts` | Thêm `MetricsModule` |

**Hai phép đo đột biến** (luật số 2 của plan): đổi auto-accept thành `accept/(accept+reject)` → test I-12 phải đỏ · bỏ kiểm `aiEnabled` ở một điểm sinh → T-9 phải đỏ.

`workers: 1` + `fullyParallel: false` ⇒ T-9 tắt AI toàn cục an toàn, miễn `afterAll` bật lại — đúng cách T-1 đã làm.

## 6. Chia việc

| Người | Việc | Ước |
| --- | --- | --- |
| **A** | `PATCH /settings` + `GET /settings/ai-status` + audit **(làm trước, ~30')** → `domain/metrics/*` + DTO contracts | 2h |
| **B** | Ô sửa nhanh trên `opportunity-card.tsx` · T-10 ba nhánh hai lớp + khẳng định adapter | 1.5h |
| **C** | `quan-tri/page.tsx` · banner + layout · 2 link · `e2e/t9` | 2h |

Chặn: **A phải xong 30' đầu trước khi C bắt đầu banner và T-9**; C làm khung dashboard bằng dữ liệu tĩnh song song, nối `GET /metrics` khi A xong. Song song ~2.5h — vừa với freeze tối nay.

Ba file dùng chung, sửa nhỏ, pull trước khi push: `packages/contracts/src/index.ts` · `apps/api/src/app.module.ts` · `apps/web/src/app/(app)/layout.tsx`.

## 7. Rủi ro

| Rủi ro | Xử lý |
| --- | --- |
| `MetricsModule` quên `AuthModule` → **sập cả container API**, 502 ở trang đăng nhập, test đơn vị vẫn xanh | Thêm vào `watch-module-boots.test.ts` ngay khi tạo module — đỏ trong 17ms (bài học P7) |
| Tắt AI nhưng vòng quét chạy dở một lượt | `ai_enabled` đã kiểm đầu mỗi lượt (ADR-0011); T-9 khẳng định **2 chu kỳ**, không phải 1 |
| T-9 để AI tắt sang spec sau | `afterAll` bật lại + trả chu kỳ 60, đúng khuôn T-1 |
| Ô sửa nhanh đụng `opportunity-card.tsx` (file B, P6 đã chèn một chỗ) | Sửa nhỏ, không refactor; **không đụng** `OpportunityDto`/`SELECTION`/`toDto` (ADR-0027) |
| `pnpm build` fail EPERM trên Windows | Có sẵn từ trước P6, không phải hồi quy. Build Linux trong container xanh — đừng debug lại vào ngày cuối |
| Chỉ số hiện `0%` khi chưa có dữ liệu → BGK đọc thành "AI sai 100%" | Mẫu số 0 → `null` → "chưa có dữ liệu" |

## 8. Nghiệm thu

Giữ nguyên 10 gạch đầu dòng mục Validation của phase file, thêm ba:

- [ ] Sales (không phải admin) thấy banner khi AI tắt — chứng minh bằng context thứ hai trong T-9, không bằng tài khoản admin
- [ ] Mọi tỉ lệ trên bảng điều khiển hiện kèm mẫu số; mẫu số 0 → "chưa có dữ liệu"
- [ ] `watch-module-boots.test.ts` giải được `MetricsModule`

## 9. ADR phải viết

| # | Nội dung | Phương án bị loại |
| --- | --- | --- |
| **0031** | Mẫu số error-detection rate = proposal + tự đặt + mục hệ thống; mọi tỉ lệ kèm mẫu số | Cộng toàn bộ `claims` — tỉ lệ gần 0 vĩnh viễn, không bao giờ sai được |
| **0032** | Trạng thái AI cho Sales đi qua `GET /settings/ai-status` riêng; banner toàn cục | Nới `GET /settings` — phá điểm nghiệm thu số 2 của skeleton |
| **0033** | Q-6 vòng 1: Admin có quyền CRM như Sales, ma trận chi tiết ngoài phạm vi | Ép admin read-only — 3 controller + guard mới vào tối freeze |

## 10. Câu chưa giải quyết

- **Xoá mục dòng thời gian do người gõ** (P7 giao lại): Specs viết "xoá mục hệ thống *như mọi mục khác*" nhưng I-13 chỉ ràng buộc mục hệ thống, và `stage_change` là vết đổi giai đoạn. Không chặn P8 — đề nghị giữ phạm vi hẹp của P7 và nói thẳng nếu BGK hỏi.
- **Cắt thì phải nói ra**: nếu bỏ ô sửa nhanh, phải nói thẳng với BGK là Sales chưa gõ được Việc tiếp theo — không để họ tự phát hiện.
- **Telemetry của thành viên 2 và 3** chưa verify trên Grafana. Không thuộc plan này nhưng là điều kiện qua vòng 1.

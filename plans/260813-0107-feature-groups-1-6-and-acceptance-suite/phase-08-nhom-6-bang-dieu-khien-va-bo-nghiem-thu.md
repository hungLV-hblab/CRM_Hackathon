---
phase: 8
title: "Nhóm 6 — bảng điều khiển + đóng bộ nghiệm thu 10 điểm"
status: done
priority: P1
dependencies: [5, 6, 7]
owner: cả đội
estimate: 4h30
---

# Phase 8: Nhóm 6 — bảng điều khiển + đóng bộ nghiệm thu 10 điểm

## Overview

Hai việc, làm cùng lúc vì cả hai đều cần mọi nhóm khác đã đứng: **bảng điều khiển Quản trị** (đọc số, chỉnh tham số, một cái phanh) và **đóng nốt T-9, T-10** cho bộ nghiệm thu chạy đủ 10 điểm bằng một lệnh.

Cộng **một lỗ sản phẩm phải bịt** mà P6 để lại — ô sửa nhanh Việc tiếp theo, xem mục dưới.

Đây là phase cuối trước **freeze tối 14/08**.

> Thiết kế chốt 14/08 10:12 ([báo cáo](../reports/from-brainstorm-to-planner-260814-1012-phase-08-nhom-6-bang-dieu-khien-va-bo-nghiem-thu-report.md)). Ba chỗ bản cũ lệch với code thật, cả ba đổi thiết kế — đọc mục "Ba chỗ đã sửa" trước khi gõ dòng đầu.

## Hai tin tốt đã kiểm bằng đọc mã nguồn

- **P8 cần 0 migration.** `crm_app` có `GRANT ALL ON ALL TABLES` (`0001_grants.sql:23`) nên ghi `system_settings` chạy ngay; metrics và banner đều là đường đọc.
- **Lớp CSDL của T-10 đã chặn sẵn cả ba nhánh.** `0001_grants.sql:48` chỉ cấp `UPDATE (next_step_text, next_step_due_date, next_step_source)` trên `opportunities`; `:63` không cấp `DELETE` bảng nào. T-10 **chỉ cần test chứng minh**, không sửa quyền.

## Ba chỗ đã sửa so với bản cũ

### 1. T-9 có lỗ — Sales hiện không đọc được trạng thái AI

`GET /settings` là `@Roles('admin')`, và `ai-status-pill.tsx:31` cố ý `enabled: isAdmin` ⇒ **pill không bao giờ render cho Sales**. Comment trong chính file đã đẩy việc sang "banner ở màn sinh output AI", nên banner phải có nguồn dữ liệu riêng.

**Chốt:** thêm `GET /settings/ai-status` trả đúng `{ aiEnabled }`, chỉ `JwtGuard`, mọi user đăng nhập đọc được. Giữ nguyên điểm nghiệm thu số 2 của plan skeleton (Sales 403 trên `/settings`). Phương án nới `GET /settings` bị loại vì phá đúng điểm đó và kéo theo sửa `login.test.ts:77`. **[ADR-0032](../../docs/decisions/0032-trang-thai-nut-tat-ai-di-qua-endpoint-rieng-cho-moi-vai-banner-dat-toan-cuc.md)**

`RolesGuard.canActivate:33` trả `true` khi handler không có `@Roles` ⇒ route mới **nằm luôn trong `SettingsController`**, không tạo module mới, **né sạch bẫy P7** (module khai báo controller có guard phải tự import `AuthModule`; thiếu thì sập container, 502 ở trang đăng nhập, test đơn vị vẫn xanh).

Banner đặt **toàn cục** trong `(app)/layout.tsx` — một chỗ, không quên được. Bốn màn riêng lẻ thì sót một là T-9 đỏ vì chỗ sót, không vì sản phẩm.

### 2. Mẫu số error-detection rate chưa từng được định nghĩa

Ontology mục 7 cho tử số rõ, mẫu số ghi "tổng output AI" — chưa đủ để viết một câu SQL.

**Chốt:** mẫu số = `proposals + auto_next_step_events + timeline_entries(created_by='system')` — đúng tập mà người *có thể* bác. Cộng thêm `claims` bị loại: mẫu số phình 5–10 lần bằng phát hiện chưa từng đến tay ai, tỉ lệ gần 0 vĩnh viễn, một con số **không bao giờ sai được** thì không đo gì. **[ADR-0031](../../docs/decisions/0031-mau-so-error-detection-rate-la-ba-tap-ai-dua-ra-truoc-mat-nguoi.md)**

Kèm luật hiển thị: **mọi tỉ lệ hiện kèm mẫu số/cỡ mẫu**; mẫu số 0 → "chưa có dữ liệu", **không** hiện `0%` (BGK đọc `0%` thành "AI sai 100%").

### 3. Q-6 — phase file cũ nói sai hiện trạng

`company.controller.ts:29`, `opportunity.controller.ts:35`, `proposal.controller.ts:30` chỉ có `@UseGuards(JwtGuard)` ⇒ **admin ghi y hệt Sales**. Câu "Tạm: Admin xem tất cả, không sửa dữ liệu Sales" mô tả một thứ không tồn tại; `roles.guard.ts:20-23` đã ghi sẵn "đừng đoán Q-6 ở đây".

**Chốt:** ADR một dòng nói đúng hiện trạng — vòng 1 Admin có quyền CRM như Sales, ma trận quyền chi tiết ngoài phạm vi. Ép admin read-only bị loại: 3 controller + guard mới + rủi ro e2e đỏ vào tối freeze, đổi lấy một dòng rubric không chấm. **[ADR-0033](../../docs/decisions/0033-vong-1-admin-co-quyen-crm-nhu-sales-ma-tran-quyen-chi-tiet-ngoai-pham-vi.md)**

## Lỗ P6 để lại — ô sửa nhanh Việc tiếp theo

**Sales không có chỗ nào tự gõ Việc tiếp theo trên web.** Phát hiện ở phiên 7 (grep `nextStepText` trong `apps/web/src` ra 2 file, **cả hai chỉ hiển thị**; form tạo cơ hội cũng không có ô), và P6 đóng xong thì **nặng thêm chứ không nhẹ đi**: bấm Hoàn tác trả ô về trống, và từ đó không có đường nào điền lại bằng tay. Ca I-7 của demo chạy được là nhờ **seed** đặt sẵn `next_step_source: 'human'`, không phải nhờ sản phẩm.

Vì sao nó thuộc P8 chứ không phải "nên có":

- **Luật 5 nói Việc tiếp theo là nhịp tim của deal.** Một CRM mà Sales không gõ được nhịp tim của chính deal mình thì vòng 2 hỏi đúng một câu là lộ.
- **Nó là nửa còn lại của vùng tự chủ 3.** Hoàn tác trả ô về trạng thái trước; nếu Sales không điền lại được thì "sửa lại phải dễ hơn cả lúc máy làm" chỉ đúng một nửa.
- **I-7 chỉ quan sát được nếu có đường người gõ thật.** Hiện chỉ chứng minh được bằng seed.

Phạm vi tối thiểu — **không** làm hơn:

- Một ô text + ô ngày trên thẻ cơ hội, gọi `PATCH /opportunities/:id` đã có. **Không endpoint mới, không DTO mới**: `update()` đã ghi `nextStepText` + `nextStepDueDate` và đã tự đặt `nextStepSource = 'human'` khi có text (`opportunity-service.ts:127-132`).
- Gõ đè ô do máy điền là **hợp lệ và có chủ ý** — nó trả quyền sở hữu ô về cho người (I-7 đọc `next_step_source` ở lần ghi sau). Đã có test ở P6 (test 11).
- Sau khi lưu phải `invalidateQueries` cả `['opportunities']` lẫn `['auto-next-steps']`, không thì dấu hiệu máy còn nằm lại trên ô người vừa gõ.

Ước lượng ~30'. **Cắt gần cuối** (chỉ trên nút đổi bản chụp) — nhưng cắt nó thì phải nói thẳng với BGK là Sales chưa gõ được Việc tiếp theo, không để họ tự phát hiện.

## Requirements

- Functional: một màn hình gom đủ chỉ số theo **đúng tên** ở [ontology mục 7](../../docs/ontology.md#7-chỉ-số-đo-từ-ngày-đầu), **mỗi tỉ lệ kèm mẫu số**; chỉnh `watch_cycle_seconds` (hiện đơn vị + mặc định + một câu giải thích đổi nó thì cái gì đổi theo), hiệu lực ngay; **một nút tắt toàn bộ AI**, hiệu lực ngay không cần chạy lại; Sales thấy banner khi AI tắt; mỗi lần bật/tắt ghi vết.
- Non-functional: `pnpm test` chạy đủ 10 điểm bằng một lệnh, kết quả in ra rõ ràng (hạng mục nộp bài số 4).

## Chỉ số — đúng tên, không để BGK tự suy

| Chỉ số | Công thức | Nguồn |
| --- | --- | --- |
| **Auto-accept rate** | `accept / (accept + edit + reject)` | `proposal_decisions.decision` |
| **Error-detection rate** | `(reject[wrong_info] + reject[misread_context] + số lần Hoàn tác + số lần xoá mục hệ thống) / mẫu số` | xem dưới |
| Tỉ lệ sửa-rồi-duyệt | `edit / tổng` — **tách bạch** khỏi accept (I-12) | `proposal_decisions` |
| Phân bố lý do bỏ · phân bố mức chắc chắn | `GROUP BY reject_reason` · `GROUP BY confidence` | `proposal_decisions` · `claims` |
| Thời gian quyết trung bình | `percentile_cont(0.5) WITHIN GROUP (ORDER BY seconds_to_decide)`, **kèm cỡ mẫu và số bản ghi mất mốc** | ADR-0025 cho phép để trống |
| Tỉ lệ hoàn tác | `undone / tổng AutoNextStepEvent` | `auto_next_step_events.undone_at` |
| Phân bố lý do xoá mục hệ thống | `detail->>'reason'` | hợp đồng P7 |

**Mẫu số của error-detection rate** (ADR-0031): `count(proposals) + count(auto_next_step_events) + count(timeline_entries WHERE created_by='system')`.

**"Số lần xoá mục hệ thống" lấy ở đâu** — hợp đồng P7 chốt 14/08 02:35 và **đã chạy thật từ 14/08 03:38**, đừng suy lại: `SELECT count(*) FROM audit_events WHERE action = 'delete_system_timeline_entry'`. Lý do xoá nằm ở `detail->>'reason'` (P7 bắt buộc Sales gõ) nên phân bố lý do xoá là số **có sẵn**.

## Files

| Tạo/sửa | Vai trò | Người |
| --- | --- | --- |
| `apps/api/src/settings/settings.controller.ts` | thêm `GET ai-status` (chỉ `JwtGuard`) + `PATCH /settings` (`@Roles('admin')`) | A |
| `apps/api/src/settings/system-setting-service.ts` | `updateParameters()` — ghi + `AuditEvent` mỗi khoá đổi | A |
| `apps/api/src/domain/metrics/*` *(module mới)* | truy vấn chỉ số. **Phải `imports: [AuthModule]`** | A |
| `packages/contracts/src/*` *(dùng chung)* | DTO metrics + zod của `PATCH /settings` | A |
| `apps/web/src/app/(app)/quan-tri/page.tsx` *(tạo)* | bảng điều khiển | C |
| `apps/web/src/components/ai-disabled-banner.tsx` *(tạo)* | banner Sales thấy khi AI tắt | C |
| `apps/web/src/app/(app)/layout.tsx` *(dùng chung)* | gắn banner | C |
| `apps/web/src/components/shell/nav-items.tsx:45` · `huong-dan/page.tsx:139` | href `/quan-tri/nhat-ky-vong-quet` → `/quan-tri`; thêm link thật vào trang hướng dẫn | C |
| `apps/web/src/app/(app)/co-hoi/opportunity-card.tsx` *(file của B)* | ô sửa nhanh Việc tiếp theo + ngày hạn — dùng `PATCH /opportunities/:id` đã có | B |
| `e2e/t9-ai-kill-switch.spec.ts` · `apps/api/src/__tests__/t10-*.test.ts` | T-9, T-10 đầy đủ | C · B |
| `apps/api/src/__tests__/watch-module-boots.test.ts` | thêm `MetricsModule` | A |

## Implementation steps

1. **A đi trước ~30'** (C bị chặn ở đây): `GET /settings/ai-status` + `PATCH /settings`.
   - `PATCH` nhận `{ aiEnabled?, watchCycleSeconds? }`; `watchCycleSeconds` nguyên, **5…3600** — trần dưới **không được là 60**, T-8 e2e chạy 10s.
   - Ghi `AuditEvent` **mỗi khoá đổi một dòng**: `action: 'toggle_ai' | 'update_watch_cycle_seconds'`, `entity: 'system_setting'`, `detail: { from, to }`. Giá trị không đổi thì không ghi vết rỗng.
   - Phạm vi nút tắt đúng [ADR-0009](../../docs/decisions/0009-pham-vi-nut-tat-ai-chi-dung-sinh-moi.md): chỉ dừng **sinh mới**; hàng đợi tồn vẫn duyệt được.
2. **A**: module `domain/metrics/` — controller `@Roles('admin')`, service đọc bằng `dbApp`. Mẫu số 0 → trả `null`, **không trả 0**. Thêm `MetricsModule` vào `watch-module-boots.test.ts` **ngay khi tạo**, không để cuối.
3. **C**: banner — đọc `/settings/ai-status`, **chỉ render khi `aiEnabled === false`**; lỗi hoặc chưa đọc được → không render, không "không rõ" (cùng luật với `ai-status-pill`). Màu `warning`, **không** `machine`: đây là trạng thái hệ thống, không phải nội dung máy sinh.
4. **C**: `quan-tri/page.tsx` — 7 chỉ số đúng tên, mỗi số kèm mẫu số; công tắc AI; ô chu kỳ kèm câu "đổi thì nhịp quét đổi từ vòng sau, không cần chạy lại". **Không thêm thư viện biểu đồ trước freeze** — hai phân bố vẽ bằng thanh CSS. Dựng khung bằng dữ liệu tĩnh song song với bước 2, nối `GET /metrics` khi A xong.
5. **C**: hai link (`nav-items.tsx:45` + `huong-dan/page.tsx:139`). `guide-page.spec.ts` khẳng định link không 404 nên chỉ sửa **sau khi** `/quan-tri/page.tsx` tồn tại.
6. **C · T-9**: đặt chu kỳ 10s bằng `watch-cycle-scenario.ts` → xác nhận vòng đang chạy → admin bấm tắt **trên UI** → 2 chu kỳ sau không thêm mục nào, không sinh gợi ý, không tự đặt; dữ liệu đã sinh còn nguyên; **hàng đợi tồn vẫn duyệt được**; Sales (context thứ hai) thấy banner; bật lại chạy tiếp; cả hai lần có ghi vết. `afterAll` trả chu kỳ về 60 **và** bật lại AI — `workers: 1` nên tắt AI toàn cục an toàn, quên bật lại thì mọi spec sau đỏ.
7. **B · T-10 đầy đủ**: ba nhánh — đổi giai đoạn · đổi giá trị tiền · xoá công ty, dưới `actor = system`, **không đi qua UI**, chặn ở **hai lớp**:
   - lớp domain: gọi service trực tiếp (khuôn `t10-mini-*`) → throw + `AuditEvent` + dữ liệu nguyên;
   - lớp CSDL: raw SQL qua `DATABASE_URL_TEST_SYSTEM` → `permission denied`.
   - Khẳng định thứ tư: **không tồn tại adapter gửi thư/tin nhắn nào** — quét **`package.json` toàn workspace** *và* import trong `apps/api/src` theo danh sách token (`nodemailer` · `smtp` · `twilio` · `sendgrid` · `@slack` · `mailgun`). Quét mỗi source thì một dependency treo sẵn vẫn lọt (ranh giới 3, ontology mục 5).
8. **B**: ô sửa nhanh Việc tiếp theo (xem mục "Lỗ P6 để lại"). **Không đụng** `OpportunityDto` / `SELECTION` / `toDto` (ADR-0027 giữ nguyên).
9. **A**: test đơn vị metrics — `edit` không cộng vào `accept` · mẫu số EDR đúng ba tập · 0 mẫu trả `null`.
10. **Hai phép đo đột biến** (luật số 2 của plan): đổi auto-accept thành `accept/(accept+reject)` → test I-12 phải đỏ · bỏ kiểm `aiEnabled` ở một điểm sinh → T-9 phải đỏ.
11. Ba ADR: **0031** (mẫu số EDR) · **0032** (ai-status riêng + banner toàn cục) · **0033** (Q-6).
12. Nút đổi bản chụp trên màn Quản trị — ~20 dòng gọi `POST /demo/companies/:id/snapshot-variant` đã có. **Món cắt cuối cùng.**
13. Chạy `pnpm test` full + `pnpm lint` + `pnpm typecheck` + `pnpm build`, rồi nghiệm thu tay 6 điểm của plan skeleton một lần nữa trên stack mới.
14. Rà [Definition of Done](../../CLAUDE.md#7-definition-of-done) cho từng nhóm: có test · có provenance · proposal có accept/reject + metric · có ADR · **có người ngoài người viết giải thích lại được**.

## Chia việc — song song ~2.5h

| Người | Việc | Ước |
| --- | --- | --- |
| **A** | bước 1 (**làm trước, chặn C**) → 2, 9 | 2h |
| **B** | bước 7, 8 | 1.5h |
| **C** | bước 3, 4, 5, 6, 12 | 2h |

File dùng chung, sửa nhỏ, pull trước khi push: `packages/contracts/src/index.ts` · `apps/api/src/app.module.ts` · `apps/web/src/app/(app)/layout.tsx`.

## Validation

- [x] 10/10 điểm nghiệm thu xanh bằng **một lệnh** `pnpm test` — **281 test đơn vị + 32 e2e xanh** (14/08 11:30)
- [x] T-9 xanh trên stack production sau Caddy — `e2e/t9-ai-kill-switch.spec.ts`
- [x] **Sales (không phải admin) thấy banner** — context trình duyệt thứ hai trong T-9
- [x] T-10 ba nhánh xanh, chặn ở **cả hai lớp** — `t10-system-actor-blocked-at-both-layers.test.ts`, 10 test
- [x] Khẳng định "không có adapter gửi tin" xanh, quét cả 5 `package.json` lẫn mọi file `apps/api/src`
- [x] Đổi `watch_cycle_seconds` từ UI Quản trị → nhịp đổi, **không** restart — đo trên log worker: 10s trong lúc T-9 chạy, 60s ngay sau `afterAll`, không có dòng boot nào ở giữa
- [x] Tắt AI → bốn con số đầu ra **bằng nhau tuyệt đối** trước/sau; gợi ý tồn vẫn duyệt được (T-9 duyệt thật một thẻ lúc AI đang tắt); hai chiều đều có `AuditEvent`
- [x] Chỉ số hiện **đúng tên** ontology mục 7; `edit` không cộng vào `accept`
- [x] **Mọi tỉ lệ hiện kèm mẫu số**; mẫu số 0 → "chưa có dữ liệu", không phải `0%`
- [x] `watch-module-boots.test.ts` giải được `MetricsModule`
- [x] `pnpm lint` · `pnpm typecheck` sạch. `pnpm build`: web đỏ **EPERM symlink trên Windows** — có sẵn từ trước P6, không phải hồi quy; bản Linux trong container build xanh và toàn bộ e2e chạy trên nó
- [x] 6 điểm nghiệm thu của plan skeleton chạy lại vẫn đạt (đo trên stack đang chạy, xem báo cáo)
- [x] Sales gõ được Việc tiếp theo + ngày hạn từ giao diện; `update()` tự đặt `next_step_source = 'human'`
- [x] Gõ đè ô do máy điền → invalidate cả `['opportunities']` lẫn `['auto-next-steps']` nên dấu hiệu máy và nút Hoàn tác biến mất ngay

## Kết quả — 14/08 11:30

**Đóng đủ:** T-9 · T-10 · bảng điều khiển 7 chỉ số · banner toàn cục · ô sửa nhanh Việc tiếp theo · nút đổi bản chụp (**không cắt món nào**).

Ba thứ lộ ra lúc gõ code, đáng mang đi:

- **`role="status"` va nhau.** Banner mới mang `role="status"`, và T-1 chạy với AI **đang tắt** nên `getByRole('status')` của nó khớp 2 phần tử — vùng live của dnd-kit và banner. T-1 đỏ trên một bàn kéo thả hoạt động hoàn hảo. Đã thu hẹp locator về `[id^="DndLiveRegion"]`. **Cùng họ với bẫy `getByText` khớp chuỗi con của P4**: một locator rộng là một quả bom hẹn giờ, nổ khi màn hình mọc thêm phần tử.
- **`Duyệt` là tiền tố của `Sửa rồi duyệt`.** Đúng bẫy P4 đã ghi, gặp lại nguyên hình dạng, tốn một lượt chạy. `{ exact: true }` cho mọi nhãn là tiền tố của nhãn khác.
- **Thêm tham số vào constructor của một service dùng chung = sửa 7 file test.** `SystemSettingService` cần `AuditEventService` để ghi vết, và nó được `new` bằng tay ở 7 test tích hợp. Không có gì sai, nhưng nó là chi phí ẩn của "chỉ thêm một dependency".

**Hai phép đo đột biến, cả hai đều cắn:**

| Đột biến | Hệ quả |
| --- | --- |
| auto-accept → `accept/(accept+reject)` | test 1 của metrics đỏ ngay: `expected { rate: 0.666… } to deeply equal { rate: 0.5 }` |
| bỏ `if (!parameters.aiEnabled)` ở `watch-cycle-service.ts:106` | T-9 đỏ sau 120s; nhật ký cho thấy vòng quét vẫn `companiesScanned: 3, skippedReason: null` trong khi AI tắt |

**Một chỗ lệch phase file có ý thức:** `SnapshotVariantSwitch` chỉ hiện bản chụp hiện tại của công ty **đã bấm trong phiên này**, vì `CompanyDto` cố ý không mang `snapshot_variant` (`DemoSnapshotService` ghi rõ lý do: nó là giàn giáo demo, không thuộc mô hình dữ liệu của Sales). Nới DTO để hiện một cái nhãn trên một màn quản trị là đẩy ống nước của demo lên mọi màn đọc công ty.

**Ba ADR đã có sẵn từ phiên phản biện 10:12** — P8 trả nốt phần *nợ đo* của [0031](../../docs/decisions/0031-mau-so-error-detection-rate-la-ba-tap-ai-dua-ra-truoc-mat-nguoi.md) và [0032](../../docs/decisions/0032-trang-thai-nut-tat-ai-di-qua-endpoint-rieng-cho-moi-vai-banner-dat-toan-cuc.md), và sửa [ontology mục 7](../../docs/ontology.md#7-chỉ-số-đo-từ-ngày-đầu) để mẫu số EDR viết được thành một câu SQL thay vì "tổng output AI".

## Risks

| Rủi ro | Xử lý |
| --- | --- |
| `MetricsModule` quên `AuthModule` → **sập cả container API**, 502 ở trang đăng nhập, test đơn vị vẫn xanh | Thêm vào `watch-module-boots.test.ts` ngay lúc tạo module — đỏ trong 17ms (bài học P7) |
| Dồn quá nhiều vào phase cuối → freeze trượt | T-1…T-8 đã đóng ở phase của chúng. P8 chỉ gom, T-9 và T-10 |
| Tắt AI nhưng vòng quét vẫn chạy dở một lượt | `ai_enabled` đã kiểm đầu mỗi lượt (ADR-0011); T-9 khẳng định **2 chu kỳ**, không phải 1 |
| T-9 để AI tắt hoặc chu kỳ 10s sang spec sau | `afterAll` bật lại + trả chu kỳ 60, đúng khuôn T-1 |
| Chỉ số tính sai vì đếm `edit` vào `accept` | I-12 đã có test ở P5; P8 chỉ đọc — cộng một phép đo đột biến |
| Mẫu số 0 hiện `0%` → BGK đọc thành "AI sai 100%" | Trả `null`, giao diện hiện "chưa có dữ liệu" |
| Ô sửa nhanh chạm `opportunity-card.tsx` — file B, P6 đã chèn một chỗ | Sửa nhỏ, pull trước khi push, không refactor. Không đụng `OpportunityDto`/`SELECTION`/`toDto` |
| `pnpm build` fail EPERM trên Windows | Có sẵn từ trước P6, không phải hồi quy. Build Linux trong container xanh — **đừng debug lại vào ngày cuối** |

## Rollback

Bảng điều khiển là màn hình chỉ đọc + 2 tham số → bỏ hai phân bố, giữ số thô. Nút tắt AI **không được bỏ** (T-9 chấm trực tiếp). Thứ tự cắt: nút đổi bản chụp → ô sửa nhanh → hai phân bố. Ô sửa nhanh bỏ được không để lại dấu vết (không migration, không endpoint mới) — nhưng bỏ thì phải nói ra, xem mục "Lỗ P6 để lại".

## Câu treo nhận từ P7

**Xoá mục dòng thời gian do người gõ.** Specs viết "xoá mục hệ thống *như mọi mục khác*" nhưng không có đường nào, và I-13 chỉ ràng buộc mục hệ thống; `stage_change` là vết đổi giai đoạn nên xoá nó cần ADR riêng. Không chặn P8 — giữ phạm vi hẹp của P7 và nói thẳng nếu BGK hỏi.

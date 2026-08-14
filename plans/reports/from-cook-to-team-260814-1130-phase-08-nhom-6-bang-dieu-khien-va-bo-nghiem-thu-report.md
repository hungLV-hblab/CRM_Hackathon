# P8 đóng — bảng điều khiển Quản trị + bộ nghiệm thu 10/10

| | |
| --- | --- |
| **Ngày** | 2026-08-14 11:30 |
| **Phạm vi** | [phase-08](../260813-0107-feature-groups-1-6-and-acceptance-suite/phase-08-nhom-6-bang-dieu-khien-va-bo-nghiem-thu.md) — nhóm 6 + T-9 + T-10 + ô sửa nhanh Việc tiếp theo |
| **Kết quả** | **281 test đơn vị + 32 e2e xanh bằng một lệnh `pnpm test`. 10/10 điểm nghiệm thu Specs mục 6.** |
| **Cắt** | không cắt món nào trong danh sách cắt của phase |

## Con số

| | Trước P8 | Sau P8 |
| --- | --- | --- |
| Test đơn vị | 262 | **281** (+19) |
| e2e | 31 | **32** (+1, T-9) |
| Điểm nghiệm thu | 8/10 | **10/10** |
| Migration | — | **0** (đúng dự đoán của phiên phản biện) |

`pnpm lint` · `pnpm typecheck` sạch. `pnpm build` đỏ ở `apps/web` với **EPERM symlink** — lỗi Windows có sẵn từ trước P6, không phải hồi quy; bản Linux trong container build xanh và toàn bộ 32 e2e chạy trên nó.

## Đã làm

**Backend**

- `GET /settings/ai-status` — chỉ `JwtGuard`, trả đúng `{ aiEnabled }`. Sales đọc được; `GET /settings` và `PATCH /settings` vẫn `@Roles('admin')` nên **điểm nghiệm thu số 2 của skeleton còn nguyên** (đo trên stack: Sales → 403, admin → 200).
- `PATCH /settings` — `aiEnabled` · `watchCycleSeconds` (5…3600, **trần dưới không phải 60** vì T-8 chạy 10s). Ghi `AuditEvent` **mỗi khoá đổi một dòng**, chỉ khi giá trị thật sự đổi.
- `apps/api/src/domain/metrics/` — module mới **có `imports: [AuthModule]`**, thêm vào `watch-module-boots.test.ts` ngay lúc tạo. Bảy chỉ số ontology mục 7, mọi tỉ lệ mang tử số + mẫu số, mẫu số 0 → `null`.

**Web**

- `ai-disabled-banner.tsx` gắn **toàn cục** ở `(app)/layout.tsx`; chỉ render khi `aiEnabled === false`, màu `warning` (không `machine` — đây là trạng thái hệ thống, không phải nội dung máy sinh).
- `/quan-tri` — bảng điều khiển: 7 chỉ số + hai phân bố vẽ bằng thanh CSS (**không thêm thư viện biểu đồ**), công tắc AI, ô chu kỳ, nút đổi bản chụp. Tách 4 file để không có file nào vượt 200 dòng.
- Nav `/quan-tri/nhat-ky-vong-quet` → `/quan-tri`; trang Hướng dẫn có link thật tới màn Quản trị.
- **Ô sửa nhanh Việc tiếp theo** trên thẻ cơ hội — `PATCH /opportunities/:id` sẵn có, không endpoint mới, không DTO mới. Invalidate cả `['opportunities']` lẫn `['auto-next-steps']`.

**Test**

- `e2e/t9-ai-kill-switch.spec.ts` — tắt AI **trên UI**, hai context trình duyệt (admin bấm · Sales quan sát banner), 2 chu kỳ không sinh gì, **bốn con số đầu ra bằng nhau tuyệt đối** trước/sau, duyệt thật một gợi ý lúc AI đang tắt, bật lại chạy tiếp, ghi vết hai chiều.
- `t10-system-actor-blocked-at-both-layers.test.ts` — ba nhánh × hai lớp + một test "chặn đúng chỗ, không chặn tất cả" + hai test quét adapter gửi tin (5 `package.json` **và** mọi file `apps/api/src`).
- `metrics-counts-what-reached-a-person.test.ts` — 9 test trên CSDL thật.

## Hai phép đo đột biến, cả hai đều cắn

| Đột biến | Hệ quả |
| --- | --- |
| auto-accept → `accept/(accept+reject)` | metrics test 1 đỏ: `expected { rate: 0.666… } to deeply equal { rate: 0.5 }` |
| bỏ `if (!parameters.aiEnabled)` ở `watch-cycle-service.ts:106`, build lại worker | T-9 đỏ sau 120s; nhật ký cho thấy vòng quét vẫn `companiesScanned: 3, skippedReason: null` trong khi AI tắt |

Cả hai đã hoàn nguyên và build lại; `git status` xác nhận hai file không còn thay đổi nào.

## Sáu điểm nghiệm thu skeleton — chạy lại trên stack mới

| # | Đo được gì |
| --- | --- |
| 1 | `:8080` lên, web 200, API 401 khi chưa đăng nhập |
| 2 | Cookie `HttpOnly; SameSite=Lax`; Sales 403 trên `/settings` **và** `/metrics`, 200 trên `/settings/ai-status`; admin 200 trên `/settings` |
| 3 | 7 công ty trước `docker compose restart`, 7 sau |
| 4 | Log worker: 10s/vòng lúc T-9 chạy → 60s ngay sau `afterAll`, **không có dòng boot nào ở giữa** |
| 5 | `pnpm test` xanh đủ ba tầng, T-10 mini vẫn xanh cạnh T-10 đầy đủ |
| 6 | `seed-idempotent.test.ts` xanh |

## Ba bẫy gặp lại, đáng ghi

1. **Vai trò ARIA cũng va nhau, không chỉ chuỗi ký tự.** Banner mới mang `role="status"`; T-1 chạy với AI **đang tắt** nên `getByRole('status')` khớp 2 phần tử và T-1 đỏ trên một bàn kéo thả đúng hoàn toàn. Đã thu hẹp về `[id^="DndLiveRegion"]`. Bài học rộng hơn bẫy `getByText` của P4: **thêm một phần tử toàn cục có thể làm đỏ một spec không liên quan gì tới nó.**
2. **`Duyệt` là tiền tố của `Sửa rồi duyệt`** — đúng bẫy P4 đã ghi thành chữ, vẫn tốn một lượt chạy. Ghi vào plan không bằng chặn được.
3. **Thêm một dependency vào service dùng chung = sửa 7 file test.** `SystemSettingService` cần `AuditEventService`, và nó được `new` bằng tay ở 7 test tích hợp.

Phụ: restart Postgres làm **worker restart theo** (`RestartCount=1` + dòng `Starting Nest application`). Vô hại, nhưng một nhịp lệch sau khi restart stack không phải lỗi nhịp.

## Tài liệu

- [ontology mục 7](../../docs/ontology.md#7-chỉ-số-đo-từ-ngày-đầu) — mẫu số error-detection rate từ "tổng output AI" (không viết được thành SQL) thành ba tập tường minh, kèm hai luật hiển thị.
- [ADR-0031](../../docs/decisions/0031-mau-so-error-detection-rate-la-ba-tap-ai-dua-ra-truoc-mat-nguoi.md) · [ADR-0032](../../docs/decisions/0032-trang-thai-nut-tat-ai-di-qua-endpoint-rieng-cho-moi-vai-banner-dat-toan-cuc.md) — trả nốt phần *nợ đo*, mỗi cái kèm tên test và kết quả phép đo đột biến. ADR-0033 không có nợ đo (nó là ADR diễn giải phạm vi).

## Một chỗ lệch phase file có ý thức

Nút đổi bản chụp chỉ hiện trạng thái của công ty **đã bấm trong phiên này**, vì `CompanyDto` cố ý không mang `snapshot_variant` (ADR-0022; `DemoSnapshotService` ghi rõ nó là giàn giáo demo, không thuộc mô hình dữ liệu của Sales). Nới DTO để hiện một nhãn trên một màn quản trị là đẩy ống nước của demo lên mọi màn đọc công ty.

## Câu treo còn lại

- **Xoá mục dòng thời gian do người gõ** — Specs viết "xoá mục hệ thống *như mọi mục khác*" nhưng I-13 chỉ ràng buộc mục hệ thống, và `stage_change` là vết đổi giai đoạn nên xoá nó cần ADR riêng. Không chặn gì; nếu BGK hỏi thì nói thẳng phạm vi.
- **`test-results/` không nằm trong `.gitignore`** và `test-results/.last-run.json` đang được track. Đã xoá thủ công hai thư mục trace do phép đo đột biến sinh ra. Sửa `.gitignore` là việc sau freeze — nó sẽ untrack một file đang commit.
- **Telemetry của thành viên 2 và 3** chưa verify trên Grafana. Không phải việc của plan này nhưng là điều kiện qua vòng 1.

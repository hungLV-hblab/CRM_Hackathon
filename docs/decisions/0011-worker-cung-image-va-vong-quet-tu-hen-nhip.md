# ADR-0011 — Worker chạy cùng image với API qua `APP_ROLE`; vòng quét tự hẹn nhịp, không dùng `@Cron`

| | |
| --- | --- |
| **Ngày** | 2026-08-12 19:10 |
| **Giai đoạn** | Design (hạ tầng runtime của nhóm 5) |
| **Trạng thái** | Chấp nhận |
| **Người quyết định** | HungLV |
| **Prompt log** | phiên brainstorm base project 12/08 19:01 — [báo cáo](../../plans/reports/brainstorm-base-project-architecture-260812-1901-nextjs-nestjs-drizzle-monorepo-report.md) |

## Bối cảnh

Nhóm 5 chạy một vòng quét nền, chu kỳ mặc định **60 giây**, **cấu hình được**. Ba điều khoản siết vào cùng một đoạn code:

- **T-9** — bấm tắt AI *trong lúc vòng quét đang chạy*, hai chu kỳ kế tiếp phải im; bật lại thì chạy tiếp.
- **I-10** — vòng đang chạy thì bỏ nhịp kế tiếp, ghi `skipped_reason` (60s + gọi LLM có thể tràn nhịp).
- **ontology 3.4** — `ai_enabled` và `watch_cycle_seconds` có **giá trị hiệu lực nằm trong CSDL**; biến môi trường chỉ là giá trị khởi tạo.

Cộng thêm câu hỏi đóng gói: spec mục 7 đòi bản giả lập production, còn base project phải dựng xong trong ~4h với 48h tổng.

Quyết trước khi code vì cả hai lựa chọn đều đụng vào `main.ts` và vào Dockerfile.

## Phương án đã cân nhắc

### 1 · Đóng gói worker

Tiêu chí: *(1)* nguy cơ nhân đôi code domain · *(2)* log demo có đọc được không · *(3)* giờ bỏ ra.

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| **A.** Cùng codebase, cùng image, `APP_ROLE=api\|worker` chọn module lúc bootstrap | Không nhân đôi domain, không lệch version giữa 2 deployable. 2 container tách nên log tách bạch. Thêm ~20 phút | Cần kỷ luật: worker không được import controller | ✅ **Chọn** |
| **B.** Gộp scheduler vào thẳng process API | Rẻ nhất (0 phút) | 1 process vừa phục vụ HTTP vừa gọi LLM mỗi 60s → log lẫn lộn, khó chỉ cho giám khảo thấy "vòng quét đang chạy". Khó bảo là production-like | ❌ Loại — mất điểm Deployment để tiết kiệm 20 phút |
| **C.** `apps/worker` là app NestJS riêng | Ranh giới sạch nhất | Buộc phải bóc `packages/domain` để dùng chung, +2h. Với 48h là đổi giờ lấy vẻ đẹp kiến trúc | ❌ Loại — YAGNI |

### 2 · Cơ chế hẹn nhịp

Tiêu chí: *(1)* T-9 có hiệu lực ngay không · *(2)* đổi chu kỳ có cần khởi động lại không · *(3)* I-10 cài ở đâu.

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| **A.** Vòng lặp tự hẹn: mỗi lượt đọc `SystemSetting` → kiểm `ai_enabled` → kiểm cờ `isRunning` → quét → ghi `WatchCycleRun` → `setTimeout(watch_cycle_seconds)` | Cả ba yêu cầu (T-9, I-10, chu kỳ cấu hình được) gom vào ~20 dòng đọc một mạch. Đổi chu kỳ trong CSDL có hiệu lực từ nhịp sau, không restart | Tự quản vòng lặp, phải tự dọn khi shutdown | ✅ **Chọn** |
| **B.** `@Cron('*/60 * * * * *')` của `@nestjs/schedule` | Khai báo gọn, quen thuộc | **Chu kỳ chốt lúc biên dịch** → mâu thuẫn thẳng với ontology 3.4 (giá trị hiệu lực ở CSDL). Tắt AI phải nhét thêm cờ vào trong hàm — vẫn nổ đúng nhịp rồi mới return, `WatchCycleRun` bẩn | ❌ Loại — chống lại đúng ba điều khoản đang cần |
| **C.** `@Cron` + `SchedulerRegistry` xoá/tạo lại job khi đổi chu kỳ | Chu kỳ đổi được lúc chạy | Phải theo dõi thay đổi CSDL để biết lúc nào tạo lại job → phức tạp hơn A mà kết quả y hệt | ❌ Loại — nhiều bộ phận chuyển động hơn, không được gì thêm |

## Quyết định

Chọn **A** cho cả hai.

```
vòng lặp:
  đọc SystemSetting (ai_enabled, watch_cycle_seconds)   ← mỗi lượt, không cache
  ai_enabled = false        → không quét, hẹn lượt sau            (T-9)
  isRunning  = true         → ghi WatchCycleRun{skipped_reason}   (I-10)
  ngược lại  → isRunning=true → quét → ghi WatchCycleRun → isRunning=false
  setTimeout(watch_cycle_seconds × 1000)
```

Đọc `SystemSetting` **mỗi lượt**, không cache: đây là thứ làm T-9 có hiệu lực ngay mà không cần cơ chế thông báo nào giữa API và worker. Một truy vấn nhỏ mỗi 60s, không đáng tối ưu.

## Hệ quả

- `main.ts` rẽ nhánh theo `APP_ROLE`; `WatchModule` chỉ nạp khi `worker`. Compose chạy 2 service từ **cùng một image**.
- API và worker không nói chuyện trực tiếp với nhau — **CSDL là kênh liên lạc duy nhất**. Bấm tắt AI ở giao diện chỉ ghi `SystemSetting`, worker tự thấy ở lượt kế.
- Worker ghi bằng `crm_system` ([ADR-0010](0010-chan-tang-csdl-bang-hai-role-va-quyen-theo-cot.md)). **Sửa 14/08 02:55:** câu cũ ở đây viết *"không có pool `crm_app`"* — **sai từ lúc viết ADR này**, không phải do phase 7. `DbModule` là `@Global` và tạo **cả hai** pool vô điều kiện (`db.module.ts:20-36`), và `SystemSettingService` — provider duy nhất của worker ngoài vòng quét — nhận cả hai (`:31-34`). Phase 7 không gây ra chuyện đó nhưng làm nó đáng nói hơn, vì từ nay vòng quét chạy cả cây service chọn-pool-theo-actor.

  Phần đáng lo đã kiểm, và kết quả là số đo chứ không phải lời hứa: **không đường ghi nào của vòng quét đi qua `crm_app`.** Event và thông báo của nhóm 4 nằm trong transaction của `dbSystem` với `SYSTEM_ACTOR` — `poolFor(actor)` (`auto-next-step-service.ts:526`) chọn pool theo actor và `db.transaction()` (`:207-252`) nhận đúng pool đó; mục dòng thời gian của nhóm 5 ghi bằng `dbSystem` và bị `0007` siết theo cột; `dbApp` chỉ xuất hiện ở `listActive()`, là đường **đọc** bảng cơ hội. Đường xoá của I-13 dùng `crm_app` nhưng nó nằm trong nhánh API, không trong worker.

  Phương án "chặn thật bằng cách bỏ `DATABASE_URL_APP` khỏi worker" đã cân và **loại**: refactor `DbModule` theo `APP_ROLE` không rẻ trước freeze và có thể làm vỡ boot — mà một worker vỡ boot trông y hệt lỗi `unref()` mô tả ở dưới. Ghi lại đúng hiện trạng có giá trị hơn một lời khẳng định sai.
- `WATCH_CYCLE_SECONDS` trong env chỉ được đọc **một lần lúc seed** để đặt giá trị đầu vào CSDL. Sau đó env vô nghĩa — phải ghi rõ trong `.env.example` kẻo có người sửa env rồi tưởng đã đổi chu kỳ.
- Cần dọn `setTimeout` lúc `onModuleDestroy`, nếu không test e2e treo.
- **Sẽ phải xem lại nếu:** cần chạy nhiều worker song song (lúc đó hai worker cùng quét một công ty — phải thêm khoá ở CSDL). Không xảy ra trong phạm vi hackathon: 12–15 công ty, 1 worker.

## AI đã tham gia thế nào

- **Vai trò AI:** sinh phương án, chỉ ra xung đột giữa `@Cron` và ontology 3.4.
- **AI đề xuất gì mà đội không nghe:** AI mặc định đề xuất `@nestjs/schedule` + `@Cron` vì đó là cách làm phổ biến nhất với NestJS. Bỏ sau khi đối chiếu ontology 3.4 — "phổ biến nhất" ở đây lại là cách duy nhất **không** đáp ứng được yêu cầu chu kỳ cấu hình được.
- **AI sai ở đâu:** lỗi `timer.unref()` mô tả ở mục dưới — code do AI sinh, đội đọc qua mà không bắt được, vì `unref()` trông như một thói quen dọn dẹp tử tế và trong tiến trình `api` thì nó đúng là vô hại. Chỉ chạy thật mới lộ. Đây là ví dụ cụ thể cho luật "output AI vào sản phẩm phải có người verify bằng cách chạy, không phải bằng cách đọc".

## Đội đã verify bằng cách nào

**Đã verify bằng chạy thật — 12/08, trên stack compose (`pnpm start`), nợ đã trả.**

| # | Cách đo | Kỳ vọng | Kết quả thật |
| --- | --- | --- | --- |
| 1 | `docker compose logs worker` | 1 dòng `WatchCycleRun` mỗi 60s | ✅ `15:03:21` · `15:04:21` · `15:05:21` — đúng 60s, **một tiến trình duy nhất** |
| 2 | `UPDATE system_settings SET value='10' WHERE key='watch_cycle_seconds'`, **không restart** | Nhịp đổi sang 10s trong ≤1 chu kỳ | ✅ UPDATE lúc `15:05:38`; tick `15:06:21` vẫn theo lịch 60s cũ, rồi `:31 :41 :51 15:07:01` — 10s một dòng. Log **không có** thêm dòng `Starting Nest application` |

Phép 2 là phép bác bỏ `@Cron`: dưới `@Cron` nhịp sẽ **không bao giờ** đổi nếu không restart. Ở đây nhịp đổi mà tiến trình không khởi động lại — đọc được ngay trên log vì mọi lần khởi động đều in một dòng `Starting Nest application`.

**Một lỗi thật do phép đo 1 phát hiện, ghi lại vì nó suýt lọt:** bản hiện thực đầu tiên gọi `timer.unref()` sau `setTimeout`. Trong tiến trình `api` việc đó vô hại (HTTP server giữ event loop sống), nhưng trong worker cái timer **là handle duy nhất** — Node thấy hết việc và thoát ngay sau tick đầu, Docker restart lại, và "vòng quét" biến thành vòng restart mỗi ~11s. Log lúc đó trông *gần đúng*: vẫn có `WatchCycleRun` đều đặn, chỉ là mỗi dòng thuộc một tiến trình khác nhau. Nếu chỉ đếm số dòng log mà không nhìn dòng `Starting Nest application` thì phép đo 1 đã "xanh" nhầm. Đã bỏ `unref()`; dọn tài nguyên vẫn đúng nhờ `onModuleDestroy` (có test số 6 giữ).

T-9 và I-10 đã có test tự động (`self-scheduling-watch-cycle.test.ts` kịch bản 3, 4, 5) chạy trên CSDL thật; nút tắt ở tầng giao diện thì verify cùng nhóm 5.

## Rollback

Đổi hẹn nhịp sang `@Cron` cố định 60s: **~15 phút**, mất tính năng chu kỳ cấu hình được (chấp nhận được nếu demo không đổi chu kỳ). Đổi đóng gói từ `APP_ROLE` sang gộp chung process: **~10 phút**, xoá 1 service trong compose. Cả hai đều là đường lùi rẻ — rủi ro của ADR này thấp.

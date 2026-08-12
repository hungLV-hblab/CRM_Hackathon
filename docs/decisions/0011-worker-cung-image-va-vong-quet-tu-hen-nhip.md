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
- Worker kết nối bằng `crm_system` ([ADR-0010](0010-chan-tang-csdl-bang-hai-role-va-quyen-theo-cot.md)), không có pool `crm_app`.
- `WATCH_CYCLE_SECONDS` trong env chỉ được đọc **một lần lúc seed** để đặt giá trị đầu vào CSDL. Sau đó env vô nghĩa — phải ghi rõ trong `.env.example` kẻo có người sửa env rồi tưởng đã đổi chu kỳ.
- Cần dọn `setTimeout` lúc `onModuleDestroy`, nếu không test e2e treo.
- **Sẽ phải xem lại nếu:** cần chạy nhiều worker song song (lúc đó hai worker cùng quét một công ty — phải thêm khoá ở CSDL). Không xảy ra trong phạm vi hackathon: 12–15 công ty, 1 worker.

## AI đã tham gia thế nào

- **Vai trò AI:** sinh phương án, chỉ ra xung đột giữa `@Cron` và ontology 3.4.
- **AI đề xuất gì mà đội không nghe:** AI mặc định đề xuất `@nestjs/schedule` + `@Cron` vì đó là cách làm phổ biến nhất với NestJS. Bỏ sau khi đối chiếu ontology 3.4 — "phổ biến nhất" ở đây lại là cách duy nhất **không** đáp ứng được yêu cầu chu kỳ cấu hình được.
- **AI sai ở đâu:** chưa phát hiện sai — nhưng phần này **chưa chạy thử dòng nào**, khác hẳn [ADR-0010](0010-chan-tang-csdl-bang-hai-role-va-quyen-theo-cot.md) đã đo thật. Đọc mục dưới trước khi tin.

## Đội đã verify bằng cách nào

**Chưa verify bằng chạy thật — đây là nợ, ghi ra để không quên.** Verify được làm ở nghiệm thu skeleton, hai phép đo:

| # | Cách đo | Kỳ vọng |
| --- | --- | --- |
| 1 | `pnpm start`, đọc log worker | 1 dòng `WatchCycleRun` mỗi 60s |
| 2 | `UPDATE system_settings SET value='10' WHERE key='watch_cycle_seconds'`, **không restart** | Nhịp log đổi sang 10s trong vòng ≤1 chu kỳ |

Hai phép này chứng minh đúng thứ khiến ta loại `@Cron`. T-9 và I-10 verify sau, cùng lúc code nhóm 5 — không cố chứng minh trước khi có gì để tắt.

Mức tin hiện tại: quyết định dựa trên **đối chiếu tài liệu** (ontology 3.4 vs cách `@Cron` hoạt động), chưa dựa trên đo đạc. Nếu vòng 2 hỏi "chứng minh đi" mà lúc đó phép đo 2 chưa chạy thì phải trả lời thẳng là chưa chạy.

## Rollback

Đổi hẹn nhịp sang `@Cron` cố định 60s: **~15 phút**, mất tính năng chu kỳ cấu hình được (chấp nhận được nếu demo không đổi chu kỳ). Đổi đóng gói từ `APP_ROLE` sang gộp chung process: **~10 phút**, xoá 1 service trong compose. Cả hai đều là đường lùi rẻ — rủi ro của ADR này thấp.

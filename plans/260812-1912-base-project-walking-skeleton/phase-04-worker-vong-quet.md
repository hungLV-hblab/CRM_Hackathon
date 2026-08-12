---
phase: 4
title: "Worker — vòng quét tự hẹn nhịp"
status: pending
priority: P1
dependencies: [3]
---

# Phase 4: Worker — vòng quét tự hẹn nhịp

## Overview

Worker chạy cùng image qua `APP_ROLE=worker`, vòng quét tự hẹn nhịp theo [ADR-0011](../../docs/decisions/0011-worker-cung-image-va-vong-quet-tu-hen-nhip.md). Phase này **trả nợ verify của ADR-0011** — ADR đó viết ra mà chưa chạy dòng nào.

## Requirements

- Functional: mỗi lượt đọc `SystemSetting` từ CSDL; `ai_enabled=false` → không quét; vòng trước chưa xong → bỏ nhịp + ghi `skipped_reason`; mỗi lượt ghi 1 `WatchCycleRun`.
- Non-functional: đổi `watch_cycle_seconds` trong CSDL có hiệu lực từ nhịp sau, **không restart**; dọn timer khi shutdown.

## Architecture

```
vòng lặp:
  đọc SystemSetting (ai_enabled, watch_cycle_seconds)   ← mỗi lượt, KHÔNG cache
  ai_enabled = false  → ghi WatchCycleRun{skipped_reason:'ai_disabled'}   (T-9)
  isRunning  = true   → ghi WatchCycleRun{skipped_reason:'previous_cycle_running'}  (I-10)
  ngược lại → isRunning=true → quét → ghi WatchCycleRun → isRunning=false
  setTimeout(watch_cycle_seconds × 1000)
```

Đọc setting mỗi lượt là thứ làm T-9 có hiệu lực ngay mà **không cần kênh liên lạc nào giữa API và worker** — CSDL là kênh duy nhất. Một truy vấn nhỏ mỗi 60s, không đáng tối ưu.

Ở phase này "quét" chỉ là chỗ trống ghi log + đếm công ty `is_watched`. Nội dung thật thuộc nhóm 5, ngoài phạm vi.

## Related Code Files

- Create: `apps/api/src/watch/{watch.module.ts,watch-cycle-service.ts}`
- Create: `apps/api/src/settings/system-setting-service.ts`
- Modify: `apps/api/src/main.ts` — nhánh `APP_ROLE=worker` chỉ nạp `WatchModule`
- Create: `apps/api/src/watch/__tests__/vong-quet-tu-hen-nhip.test.ts`

## Implementation Steps

### Bước đỏ

`vong-quet-tu-hen-nhip.test.ts`, dùng `vi.useFakeTimers()` + CSDL test thật:

| # | Kịch bản | Kỳ vọng |
| --- | --- | --- |
| 1 | chu kỳ 60s, tua 3 nhịp | đúng 3 `WatchCycleRun`, không thừa không thiếu |
| 2 | sau nhịp 1 `UPDATE system_settings SET value='10'` | nhịp 2 cách nhịp 1 **10s**, không phải 60s |
| 3 | `ai_enabled=false`, tua 2 nhịp | 0 lần quét; 2 dòng `skipped_reason='ai_disabled'` |
| 4 | tắt giữa lúc đang quét, tua 2 nhịp | 2 nhịp sau không quét (T-9) |
| 5 | vòng chạy lâu hơn 1 chu kỳ | nhịp kế ghi `skipped_reason='previous_cycle_running'`, **không** chạy song song (I-10) |
| 6 | `onModuleDestroy` | không còn timer treo, test kết thúc không bị treo |

Kịch bản 2 là phép đo bác bỏ `@Cron` — nếu đổi sang `@Cron` thì test này đỏ. Đó là lý do nó tồn tại.

### Bước xanh

1. `SystemSettingService.doc()` — truy vấn trực tiếp mỗi lượt, không cache, không TTL.
2. `WatchCycleService`: `onModuleInit` khởi động vòng lặp, `onModuleDestroy` `clearTimeout`.
3. Cờ `isRunning` là biến trong instance (1 worker duy nhất, không cần khoá CSDL — ghi rõ giả định này trong comment; nhiều worker song song thì phải đổi).
4. Worker kết nối bằng `crm_system`. Không inject `DRIZZLE_APP` — nếu lỡ inject, Phase 2 GRANT sẽ chặn, nhưng đừng dựa vào đó.
5. `main.ts`: `APP_ROLE=worker` → `NestFactory.createApplicationContext` (không mở cổng HTTP).

## Success Criteria

- [ ] 6 kịch bản xanh
- [ ] Đổi cài đặt sang `@Cron('*/60 * * * * *')` → kịch bản 2 **đỏ**. Sau đó khôi phục
- [ ] `APP_ROLE=worker pnpm --filter api start` → log 1 dòng mỗi 60s, **không** mở cổng HTTP
- [ ] `UPDATE system_settings SET value='10' WHERE key='watch_cycle_seconds'` khi worker đang chạy → nhịp đổi trong ≤1 chu kỳ, không restart *(đây chính là phép đo nợ của ADR-0011)*
- [ ] Cập nhật mục "Đội đã verify" của ADR-0011 bằng kết quả thật

## Risk Assessment

- **Fake timers × truy vấn CSDL thật hay treo** → nếu vướng, cho `SystemSettingService` vào chỗ inject được và dùng bản giả cho kịch bản 1/2/5, giữ CSDL thật cho 3/4. Không đốt quá 20 phút.
- **Timer rò rỉ làm test treo** → kịch bản 6 bắt đúng chỗ đó, viết nó sớm chứ đừng để cuối.
- **Quên giả định "chỉ 1 worker"** → ghi comment tại chỗ khai báo `isRunning`, và đã ghi trong ADR-0011 mục Hệ quả.

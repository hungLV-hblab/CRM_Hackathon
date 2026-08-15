---
phase: 2
title: API — endpoint agent-check và DTO
status: completed
priority: P1
dependencies:
  - 1
effort: ~35 phút
---

# Phase 2: API — endpoint agent-check và DTO

## Overview

Cửa **duy nhất** trình duyệt gọi được để ép một lượt chạy. `api` gọi `/run/health-check` bằng `Bearer AGENT_TOKEN` — token liên dịch vụ nó **vốn đã cầm** để ký vé, không phải credential Claude.

## ⚠️ Vào `SettingsController` đang có, không tạo module mới

Comment đầu `apps/api/src/settings/settings.controller.ts` ghi nguyên văn bài học đã trả giá:

> *"a module declaring a guarded controller must import `AuthModule` itself, and forgetting it takes the whole API container down with a 502 on the login page while every unit test stays green (phase 7 paid for that lesson)."*

Controller này đã `@UseGuards(JwtGuard, RolesGuard)` và đã nằm trong module có `AuthModule`. Tạo module mới là mua lại đúng con lỗi 502-mà-test-vẫn-xanh, trong ngày không còn giờ chẩn đoán nó.

## Vì sao đường này chứ không phải route ticket trên runtime

ADR-0044 trục 2. Tóm tắt để người đọc pha này không phải mở file khác: `/agent-auth/*` là họ route **Caddy forward ra ngoài**; `/run/*` cố tình vắng mặt trong Caddyfile vì nó **tiêu tiền thật**. Đặt lượt kiểm tra vào `/agent-auth/verify` là mở lại đúng cánh cửa đó bằng lối sau.

Điểm dễ đọc nhầm thành lật ADR-0038: **`AGENT_TOKEN` không phải credential Claude.** Không bí mật Claude nào đi qua `api` trong luồng này — chỉ một tên mode, vài con số, và câu model trả lời.

## Requirements

- Functional: `POST /settings/agent-check`, `@Roles('admin')`. Gọi `POST {AGENT_RUNTIME_URL}/run/health-check` với `Bearer AGENT_TOKEN`, body `{ userPrompt: 'ping' }`, `AbortSignal.timeout(45_000)`.
- Non-functional: thiếu `AGENT_TOKEN`/`AGENT_RUNTIME_URL` → **503 tắt**, không 500. Runtime trả 502 → đọc `reason` trong body và **trả xuống nguyên vẹn**. Runtime chết → trạng thái đọc được, **không ném lên** làm trắng màn admin (ADR-0041).

## Architecture

```ts
// DTO mới trong packages/contracts/src/dto/system-settings.ts
export interface AgentRunSummaryDto {
  at: number
  skill: string
  authMode: 'oauth' | 'api_key' | 'cli_login' | null
  ok: boolean
  text?: string
  elapsedMs?: number; apiMs?: number
  inputTokens?: number; outputTokens?: number
  sessionId?: string
  reason?: string        // AgentFailureReason — chuỗi, không enum: contracts không phụ thuộc agent-runtime
  message?: string
}

// AgentRuntimeStatusDto mở rộng, KHÔNG đổi trường cũ
export interface AgentRuntimeStatusDto {
  reachable: boolean
  enabled: boolean
  authMode: 'oauth' | 'api_key' | 'cli_login' | null
  loginState: string
  loginId?: string
  loginUrl?: string
  lastRun?: AgentRunSummaryDto     // ← thêm, optional
}
```

`reason` để `string` chứ không import enum từ `agent-runtime`: `packages/contracts` là zod + enum **dùng chung giữa api và web**, không phải chỗ để kéo vào một phụ thuộc lên gói runtime. Panel ánh xạ chuỗi sang câu tiếng Việt ở pha 3, và một `reason` lạ rơi vào nhánh mặc định thay vì làm vỡ kiểu.

`agentStatus()` (đã có) chuyển tiếp thêm `health.lastRun`. Đây là chỗ khiến reload trang vẫn thấy kết quả cũ.

## Related Code Files

- Modify: `apps/api/src/settings/settings.controller.ts` (thêm 1 route, mở rộng `agentStatus`)
- Modify: `packages/contracts/src/dto/system-settings.ts` (`AgentRunSummaryDto`, mở rộng `AgentRuntimeStatusDto`)
- Create: `apps/api/src/settings/__tests__/agent-check-admin-only-and-never-500.test.ts`

## Implementation Steps — test trước

1. **Test trước** (`--project api`):
   - Sales gọi → **403**
   - thiếu `AGENT_TOKEN` → **503** kèm câu nói rõ **đang tắt**, không phải hỏng
   - runtime trả `502 { reason: 'quota_exhausted', message }` → response xuống **giữ nguyên `reason`**, không nuốt thành lỗi chung
   - runtime trả `502 { reason: 'not_authenticated' }` → `reason` xuống nguyên vẹn (phân biệt được với case trên — **đây là lý do cả plan tồn tại**)
   - `fetch` ném / timeout → trả trạng thái đọc được, **không** ném 500
   - runtime 200 → payload mang `text`, `elapsedMs`, `authMode`
   - `agentStatus()` chuyển tiếp `lastRun` từ `/health` xuống DTO
2. Route `agentCheck()` vào `SettingsController`, `@Roles('admin')`, comment nói rõ vì sao ở đây và vì sao đi `/run` chứ không `/agent-auth`.
3. DTO vào contracts; `agentStatus()` thêm `...(health.lastRun ? { lastRun: health.lastRun } : {})` — giữ đúng lối spread có điều kiện đang dùng ở các trường `loginId`/`loginUrl`.
4. `pnpm vitest run --project api` + `pnpm typecheck`.

## Success Criteria

- [ ] Sales → 403; admin → chạy được
- [ ] Thiếu cấu hình → 503 "đang tắt", không 500
- [ ] `quota_exhausted` và `not_authenticated` xuống tới client là **hai giá trị khác nhau**
- [ ] Runtime chết → không có 500 nào thoát ra
- [ ] `AgentRuntimeStatusDto` chỉ **thêm** trường optional, không đổi trường cũ (`agent-runtime-client.ts` và panel hiện có không vỡ)
- [ ] Caddyfile không đổi dòng nào

## Risk Assessment

| Rủi ro | Xử lý |
| --- | --- |
| Endpoint tiêu quota bị bấm liên tục | Admin-only + nút disable khi pending (pha 3) + `JobQueue` concurrency 1 đã 503 khi quá deadline. **Không** thêm rate-limiter riêng (YAGNI) |
| Đọc nhầm thành lật ADR-0038 | Comment tại route nói rõ `AGENT_TOKEN` ≠ credential Claude, và `api` vốn đã cầm nó |
| Timeout 45s của `api` ngắn hơn `timeoutMs` 30s của skill cộng thời gian khởi động | 45s > 30s + ~3,4s khởi động đo được ở spike. Nếu container lạnh làm nó chạm trần thì nâng, đừng hạ `timeoutMs` |

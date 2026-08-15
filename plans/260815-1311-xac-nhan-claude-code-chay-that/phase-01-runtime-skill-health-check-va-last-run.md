---
phase: 1
title: Runtime — skill health-check và lastRun mọi lượt
status: completed
priority: P1
dependencies: []
effort: ~40 phút
---

# Phase 1: Runtime — skill health-check và lastRun mọi lượt

## Overview

Cho `agent-runtime` khả năng **nói được sự thật về lượt chạy gần nhất**. Xong pha này thì `/health` đã trả lời được câu hỏi của cả plan, kể cả khi panel chưa vẽ dòng nào.

## Ghi lượt chạy gần nhất, không phải ghi "kết quả kiểm tra"

Cám dỗ tự nhiên là làm một hàm `selfCheck()` riêng và ghi kết quả của riêng nó. Đừng. Một lượt `extract-claims` nghiệp vụ vừa chạy xong **chứng minh mạnh hơn** một lượt ping giả, và một lượt nghiệp vụ vừa chết vì `quota_exhausted` là thứ admin cần biết nhất. Nên `runOne()` ghi **mọi** lượt, và skill `health-check` chỉ là cách rẻ nhất để ép một lượt xảy ra.

Hệ quả về code: chỗ ghi là **một điểm duy nhất** trong `runOne()`, cả nhánh thành công lẫn nhánh `catch`. Hai chỗ ghi là hai bản sự thật, đúng con lỗi mà `resolveAuthMode()` đã phải trả giá một lần (comment `claude-cli.ts:70-80`).

## Requirements

- Functional: `runOne()` ghi `lastRun` sau mỗi lượt `/run/:skill`; `/health` trả `lastRun`; skill `health-check` nạp được lúc boot.
- Non-functional: không ghi CSDL, không ghi audit (ADR-0041). `text` cắt ~200 ký tự. `authMode` lấy tại thời điểm chạy bằng `resolveAuthMode()` — **credential nào thật sự chạy**, không phải cái đang cấu hình.

## Architecture

```ts
// http-routes.ts — biến module-scope, không phải state của request
interface LastRun {
  at: number                    // epoch ms
  skill: string
  authMode: AuthMode | null     // resolveAuthMode() tại thời điểm chạy
  ok: boolean
  text?: string                 // cắt 200 ký tự, chỉ khi ok
  elapsedMs?: number; apiMs?: number
  inputTokens?: number; outputTokens?: number
  sessionId?: string
  reason?: AgentFailureReason   // chỉ khi hỏng
  message?: string
}
```

Skill là **dữ liệu**, không phải hằng số TypeScript (luật 2 của `apps/agent-runtime/CLAUDE.md`):

```
apps/agent-runtime/skills/health-check/
  SKILL.md      → "Trả lời đúng một từ: OK. Không giải thích."
  policy.json   → { "allowedTools": [], "maxTurns": 1, "timeoutMs": 30000 }
```

`allowedTools: []` → `--allowed-tools none`, whitelist rỗng khớp không tool nào — và **soi được từ bên ngoài** qua `/health.grants`, không phải lời hứa suông.

**`model` bỏ trống**: `SkillPolicy.model` là optional (`skill-registry.ts:27`); bỏ trống thì dùng mặc định của CLI. Ghim một tên model vào đây là ghim một chuỗi sẽ hỏng khi Anthropic đổi tên, đổi lấy một khoản tiết kiệm không đo được trên một lượt ping 3 token.

## Related Code Files

- Create: `apps/agent-runtime/skills/health-check/SKILL.md`
- Create: `apps/agent-runtime/skills/health-check/policy.json`
- Modify: `apps/agent-runtime/src/http-routes.ts` (`runOne` ghi `lastRun`, `/health` lộ ra)
- Create: `apps/agent-runtime/src/__tests__/last-run-records-every-run.test.ts`

## Implementation Steps — test trước

1. **Test trước** (`--project agent-runtime`):
   - `/health.lastRun` là `undefined`/`null` khi chưa lượt nào chạy — **"chưa kiểm tra" là trạng thái thật**, không phải hỏng
   - lượt thành công → `lastRun.ok === true`, có `text` · `elapsedMs` · `apiMs` · `inputTokens` · `outputTokens` · `sessionId` · `skill` · `authMode`
   - lượt hỏng (`AgentRunError('quota_exhausted')`) → `lastRun.ok === false`, `lastRun.reason === 'quota_exhausted'`, **có ghi** chứ không bỏ qua
   - lượt hỏng vì `QueueDeadlineError` → cũng được ghi, `reason: 'timeout'`
   - lượt thứ hai **ghi đè** lượt thứ nhất (gần nhất, không phải đầu tiên)
   - `text` dài 5000 ký tự → lưu xuống ≤ ~200
   - skill `health-check` nạp được, `grants['health-check']` là mảng **rỗng**
   - **hồi quy, không được đỏ:** `POST /run/health-check` thiếu `Bearer` → **401**
2. `skills/health-check/SKILL.md` + `policy.json`. `_base.md` tự ghép vào, không phải làm gì thêm.
3. `http-routes.ts`: biến `lastRun` module-scope + hàm `recordRun()` gọi ở **một** chỗ trong `runOne` (nhánh ok và nhánh catch), lộ ra trong payload `/health`.
4. Comment giải thích **vì sao ghi mọi lượt chứ không riêng health-check** — đây là câu vòng 2 sẽ hỏi.
5. `pnpm vitest run --project agent-runtime` + `pnpm --filter @crm/agent-runtime typecheck`.

## Success Criteria

- [ ] `/health.lastRun` phản ánh lượt gần nhất, thành công lẫn thất bại, kèm `reason` khi hỏng
- [ ] Chưa lượt nào → không có `lastRun`, và đó là trạng thái hợp lệ
- [ ] `grants['health-check']` rỗng — soi được từ ngoài rằng skill này không với tới tool nào
- [ ] `/run/*` vẫn 401 khi thiếu `Bearer` (test cũ còn xanh)
- [ ] Không thêm dòng nào ghi CSDL hay audit từ tiến trình này

## Risk Assessment

| Rủi ro | Xử lý |
| --- | --- |
| Ghi `lastRun` ở hai chỗ → hai bản sự thật | Một hàm `recordRun()`, gọi từ đúng `runOne`. Test "lượt hỏng cũng được ghi" khoá lại |
| `text` của model lọt thứ không nên hiện | Prompt cố định, `maxTurns: 1`, không tool. Vẫn cắt 200 ký tự |
| Ai đó sau này thêm route `/run` mới mà quên ghi | Chấp nhận — `lastRun` là chẩn đoán, không phải sổ kê. Không dựng khung ép buộc cho việc này (YAGNI) |

---
phase: 2
title: "Vé HMAC và route runtime"
status: completed
priority: P1
dependencies: [1]
effort: "~55 phút"
---

# Phase 2: Vé HMAC và route runtime

## Overview

Mở phiên đăng nhập ra HTTP, gác bằng vé HMAC thay vì `AGENT_TOKEN` trần — vì lời gọi này đến **từ trình duyệt**, mà thứ gì trình duyệt cầm được thì coi như công khai.

## Requirements

- Functional: verify vé; 3 route (`login/start`, `login/:id/code`, `DELETE /credential`); `util-linux` vào image.
- Non-functional: so sánh chữ ký **timing-safe**; vé dùng một lần; thiếu `AGENT_TOKEN` → tắt chứ không chết.

## Architecture

### Vì sao là vé, không phải `AGENT_TOKEN`

`AGENT_TOKEN` là bí mật chung giữa `api` và `agent-runtime`, sống mãi. Đưa nó cho trình duyệt là **mất luôn cửa `/run`**. Vé chỉ chứng minh *"api đã xác nhận người này là admin, trong 5 phút tới"*, và ký bằng chính `AGENT_TOKEN` nên **không đẻ thêm credential mới** — đúng tinh thần CLAUDE.md của gói này.

Định dạng: `<exp>.<nonce>.<hmac>` với `hmac = HMAC-SHA256(AGENT_TOKEN, "<exp>.<nonce>")`, `exp` là epoch ms.

Verify: đúng 3 phần → `exp` còn hạn → chữ ký khớp bằng `timingSafeEqual` → `nonce` chưa dùng. Sai bất kỳ bước nào đều trả **cùng một 401 cùng một câu chữ** — phân biệt "sai chữ ký" với "hết hạn" là tặng thông tin cho người dò.

`nonce` đã dùng giữ trong `Set` bộ nhớ, dọn theo `exp`. Restart = quên; chấp nhận cho vòng 1, đã ghi ở câu hỏi mở của `plan.md`.

### Route

| Route | Vào | Ra |
| --- | --- | --- |
| `POST /agent-auth/login/start` | `Authorization: Ticket <vé>` | `{ loginId, url }` |
| `POST /agent-auth/login/:id/code` | vé + `{ code }` | `{ authMode }` |
| `DELETE /agent-auth/credential` | vé | `{ authMode: null }` |

Tiền tố `/agent-auth` tách hẳn khỏi `/run` vì **chỉ tiền tố này được Caddy mở ra ngoài** (phase 4). Hai họ route, hai cách gác, hai mức phơi bày — trộn tên là bước đầu để trộn quyền.

`DELETE /credential` xoá `$HOME/.claude/.credentials.json` (+ file token nếu phase 1 kết luận cần). Đây là nút "Đăng xuất", và nó là thứ giữ cho ADR-0041 còn kiểm được.

## Related Code Files

- Create: `apps/agent-runtime/src/auth-ticket.ts`
- Create: `apps/agent-runtime/src/__tests__/auth-ticket-guards-browser-routes.test.ts`
- Modify: `apps/agent-runtime/src/main.ts` (3 route; **không đụng `/run`**)
- Modify: `apps/agent-runtime/Dockerfile` (`RUN apk add --no-cache util-linux`)

## Implementation Steps — test trước

1. **Test trước** cho `auth-ticket.ts`:
   - vé hợp lệ → qua
   - chữ ký sai → 401 · hết hạn → 401 · dùng lại → 401 · rác/thiếu phần → 401
   - **cả bốn trả cùng một câu chữ**
   - `AGENT_TOKEN` rỗng → mọi vé bị từ chối (không phải mọi vé được nhận)
2. Viết `verifyTicket()` bằng `node:crypto`, `timingSafeEqual`, so trên `Buffer` cùng độ dài.
3. Test route: thiếu header → 401; vé tốt → chạm được `login-session`; `POST /run/*` **vẫn** đòi `Bearer AGENT_TOKEN` như cũ (test hồi quy, để không ai vô tình nới `/run`).
4. Nối 3 route vào `main.ts`. Giữ nguyên phong cách hiện có (`URL`, regex, `send()`), không thêm framework.
5. `Dockerfile`: thêm `util-linux` **vào tầng runtime**, kèm comment nói rõ vì sao (PTY cho Ink, và vì sao không phải `node-pty`).
6. Rebuild, `GET /health` vẫn đúng như trước.

## Success Criteria

- [ ] Bốn kiểu vé hỏng đều 401 cùng câu chữ
- [ ] So sánh chữ ký timing-safe
- [ ] `/run/*` không đổi hành vi — có test hồi quy chứng minh
- [ ] `script` tồn tại trong image sau rebuild
- [ ] `pnpm vitest run --project agent-runtime` xanh

## Risk Assessment

| Rủi ro | Giảm thiểu |
| --- | --- |
| Nới nhầm `/run` khi sửa `main.ts` | Test hồi quy ở bước 3 khoá cứng |
| Vé rò qua log Caddy | Vé đi ở **header**, không ở query string. Caddy log URL chứ không log header |
| `apk add` phình image / hỏng build | `util-linux` nhỏ, không cần toolchain; đã verify cài được trong chính image này |

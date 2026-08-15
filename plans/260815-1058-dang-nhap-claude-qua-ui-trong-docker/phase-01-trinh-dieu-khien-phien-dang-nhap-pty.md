---
phase: 1
title: "Trình điều khiển phiên đăng nhập PTY"
status: completed
priority: P1
dependencies: []
effort: "~70 phút"
---

# Phase 1: Trình điều khiển phiên đăng nhập PTY

## Overview

Module thuần logic lái `claude setup-token` dưới PTY: bóc URL OAuth ra khỏi luồng ANSI, nhận code, bơm vào stdin, có deadline. Không HTTP, không auth — chỉ máy trạng thái. Đây là phần khó nhất và đáng giá nhất, làm trước.

## Việc số 0 — trả lời ẩn số trước khi viết panel

Chạy trọn một lượt đăng nhập tay và quan sát **`setup-token` khi thành công thì ghi `.credentials.json` hay in ra chuỗi `sk-ant-oat-...`**:

```bash
docker exec -it crm-hackathon-agent-runtime-1 sh -c 'apk add --no-cache util-linux && script -qec "claude setup-token" /dev/null'
```

- Ghi file → `finish()` chỉ cần gọi lại `resolveAuthMode()`, xong.
- In token → phải bắt chuỗi ở stdout, ghi vào `$HOME/.claude-oauth-token` (chmod 600) và nạp vào `process.env.CLAUDE_CODE_OAUTH_TOKEN`.

Quyết định ~20 dòng. **Đừng đoán.**

## Requirements

- Functional: bóc đúng URL `https://claude.ai/oauth/authorize?...` từ stdout đầy ANSI + spinner; nhận code, ghi stdin kèm `\n`; báo kết quả cuối.
- Non-functional: một phiên tại một thời điểm; deadline 5' rồi `kill`; **code không bao giờ vào log**.

## Architecture

Máy trạng thái bốn trạng thái, chuyển một chiều:

```
idle → starting ──(bắt được URL)──→ awaiting_code ──(dán code)──→ finishing → done | failed
                └──(deadline/exit sớm)──────────────────────────────────────────→ failed
```

`start()` trả `{ loginId, url }` — Promise chỉ resolve **khi đã bắt được URL**, không resolve lúc spawn. Bắt được URL là bằng chứng CLI đã chạy thật; resolve sớm hơn thì lỗi lộ ra ở bước sau và khó đọc.

### Hai chỗ dễ sai

**1. KHÔNG dùng `childEnv()`.** Hàm đó **ném `not_authenticated` khi chưa có credential** — mà đăng nhập chính là lúc chưa có. Viết riêng `loginEnv()` chỉ gồm `PATH` + `HOME` (+`USERPROFILE`). Giữ nguyên tính chất ADR-0038: không biến CSDL nào lọt xuống.

**2. Spawn qua `script`, không spawn `claude` trực tiếp.**

```ts
spawn('script', ['-qec', 'claude setup-token', '/dev/null'], { env: loginEnv(), shell: false })
```

`-q` im lặng · `-e` trả mã thoát của tiến trình con · `-c` lệnh cần chạy. Không có PTY thì CLI chết ngay với `Raw mode is not supported`.

### Bóc URL

Gom stdout, mỗi lần có dữ liệu thì: bỏ ANSI (`\x1b\[[0-9;?]*[a-zA-Z]` và `\x1b\][^\x07]*\x07`), bỏ `\r`, rồi tìm `https://claude.ai/oauth/authorize?` chạy tới khoảng trắng đầu tiên.

**Khớp bằng tiền tố URL, không khớp bằng câu tiếng Anh** `Browser didn't open?...`. Câu chữ đổi theo bản CLI; tiền tố URL thì gắn với chính giao thức OAuth.

Cẩn thận URL đến **làm nhiều chunk** — luôn tìm trên bộ đệm tích luỹ, không tìm trên chunk lẻ.

## Related Code Files

- Create: `apps/agent-runtime/src/login-session.ts`
- Create: `apps/agent-runtime/src/__tests__/login-session-drives-cli.test.ts`
- Reference: `apps/agent-runtime/src/job-queue.ts` (mẫu đồng hồ tiêm vào), `src/claude-cli.ts` (mẫu dựng env)

## Implementation Steps — test trước

1. **Viết test trước**, tiêm `spawn` giả qua tham số (giống `JobQueue` nhận đồng hồ), không đụng tiến trình thật:
   - bóc đúng URL từ mẫu stdout **thật đã ghi lại** (có spinner, có ANSI, có `[?2026h`)
   - URL đến làm hai chunk vẫn bóc được
   - stdout không có URL cho tới khi hết deadline → `failed`, tiến trình bị kill
   - `start()` lần hai khi đang có phiên → ném/`409`
   - `submitCode()` ghi đúng `code + "\n"` vào stdin, đúng một lần
   - `submitCode()` với `loginId` sai → từ chối
   - tiến trình thoát mã ≠ 0 → `failed`, không treo
   - **không lời gọi log nào chứa chuỗi code**
2. `loginEnv()` — `PATH`, `HOME`, `USERPROFILE`; test khoá đúng ba khoá đó.
3. Máy trạng thái + `start()` / `submitCode()` / `abort()`.
4. Deadline bằng đồng hồ tiêm vào, **không** bằng `setTimeout` thật — `queue-runs-one-at-a-time.test.ts` đã trả giá cho bài học này.
5. Kết thúc: gọi lại `resolveAuthMode()` (và xử token in ra, nếu việc số 0 cho biết vậy).

## Success Criteria

- [ ] Test đỏ trước, xanh sau; không test nào chạm tiến trình thật
- [ ] Bóc được URL từ mẫu stdout thật đã ghi lại
- [ ] Deadline kill được, không rò tiến trình
- [ ] Một phiên một lúc
- [ ] Không log nào chứa code
- [ ] `pnpm vitest run --project agent-runtime` xanh

## Risk Assessment

| Rủi ro | Giảm thiểu |
| --- | --- |
| Bản CLI sau đổi chữ in ra | Khớp bằng tiền tố URL chứ không bằng câu tiếng Anh; Dockerfile đã ghim `2.0.76` |
| `script` khác nhau giữa busybox và util-linux | Cài rõ `util-linux` ở phase 2; cờ `-qec` đã verify chạy được trong chính image này |
| Tiến trình mồ côi khi container restart giữa phiên | Phiên chỉ trong bộ nhớ; restart = mất phiên, người dùng bắt đầu lại. Ghi rõ trong panel |

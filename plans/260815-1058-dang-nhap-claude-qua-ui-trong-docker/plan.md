---
title: "Đăng nhập Claude Code trong Docker qua giao diện"
description: "Admin bấm nút trong /quan-tri, uỷ quyền trên trình duyệt, agent-runtime có credential — không mở terminal. api chỉ ký vé, không bao giờ chạm credential."
status: completed
priority: P2
branch: "feat/agent-runtime-walking-skeleton"
tags: [agent-runtime, auth, ui]
blockedBy: []
blocks: []
created: "2026-08-15T04:23:33.981Z"
createdBy: "ck:plan"
source: skill
---

# Đăng nhập Claude Code trong Docker qua giao diện

| | |
| --- | --- |
| **Chế độ** | `--tdd` — test trước ở từng pha |
| **Brainstorm** | [brainstorm-260815-1058](../reports/brainstorm-260815-1058-dang-nhap-claude-qua-ui-trong-docker-report.md) |
| **Ràng buộc** | Freeze đã qua, vòng 1 chốt **15:00 hôm nay**. Người quyết định đã được cảnh báo và chọn làm, **không có đường lui** |
| **Nền** | [ADR-0038](../../docs/decisions/0038-agent-runtime-la-container-rieng-giu-credential-claude-khong-giu-csdl.md) · [ADR-0042](../../docs/decisions/0042-dang-nhap-trong-container-la-duong-xac-thuc-thu-ba-va-no-song-trong-volume-rieng.md) |

## Overview

Trình duyệt xin `api` một **vé HMAC ngắn hạn**, rồi POST **thẳng** tới `agent-runtime` qua Caddy. `agent-runtime` spawn `claude setup-token` dưới PTY, bóc URL OAuth, nhận code người dùng dán, bơm vào stdin.

**`api` không bao giờ thấy code lẫn credential** — nó chỉ ký vé. ADR-0038 và ADR-0042 còn nguyên.

**Không sửa `resolveAuthMode()` một dòng nào.** `setup-token` thành công ghi vào `$HOME/.claude/.credentials.json` — đúng đường `cli_login` đã ship sáng nay, đúng volume `agent-claude-home` đã có. Tính năng này chỉ là **cách thứ hai tạo ra thứ hệ thống đã biết đọc**.

## Đã de-risk bằng cách chạy thật (không phải suy luận)

1. `claude setup-token --help` → **không flag nào**. Không có đường phi tương tác.
2. Không TTY → chết ngay: `Raw mode is not supported... which Ink uses`. **PTY bắt buộc.**
3. Image thiếu `python3`/`make`/`g++` → `node-pty` là ngõ cụt.
4. `apk add util-linux` rồi `script -qec "claude setup-token" /dev/null` → **chạy được**, in ra dòng mốc + URL riêng dòng + prompt nhập code.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Trình điều khiển phiên đăng nhập PTY](./phase-01-trinh-dieu-khien-phien-dang-nhap-pty.md) | ✅ Xong |
| 2 | [Vé HMAC và route runtime](./phase-02-ve-hmac-va-route-runtime.md) | ✅ Xong |
| 3 | [Endpoint cấp vé ở api](./phase-03-endpoint-cap-ve-o-api.md) | ✅ Xong |
| 4 | [Caddy, panel web và ADR](./phase-04-caddy-panel-web-va-adr.md) | ✅ Xong |

Phụ thuộc tuyến tính: 1 → 2 → 3 → 4. Làm đúng thứ tự này để phần đáng giá nhất (runtime) xong trước nếu hết giờ.

## Luồng

```
Trình duyệt (admin, đã đăng nhập CRM)
 1. POST /api/settings/agent-auth-ticket  → api: kiểm JWT admin, ký vé HMAC-SHA256(AGENT_TOKEN),
                                             hết hạn 5', dùng một lần
 2. POST /agent-auth/login/start          → Caddy → agent-runtime (KHÔNG qua api)
    Authorization: Ticket <vé>              runtime verify HMAC → spawn PTY → bóc URL
    ← { loginId, url }
 3. người dùng mở url, uỷ quyền, copy code
 4. POST /agent-auth/login/:id/code        → runtime ghi code vào stdin, chờ tiến trình thoát
    ← { authMode }
 5. panel refresh GET /health
```

## Ràng buộc xuyên suốt mọi pha

- **Một phiên đăng nhập tại một thời điểm**, deadline 5' rồi kill — cùng triết lý `JobQueue`. PKCE gắn `state` vào đúng tiến trình đó, nên restart runtime giữa chừng là hỏng phiên, phải làm lại.
- **Code OAuth và token không bao giờ được log**, không bao giờ vào query string, không bao giờ nằm trong response nào. URL thì log được — nó không phải bí mật.
- **Caddy chỉ mở `/agent-auth/*`.** `/run/*` vẫn đóng kín; để lọt là mở cửa cho người lạ tiêu quota.
- **Phải có Đăng xuất.** Không có thì tạo được credential mà không huỷ được, và ADR-0041 hết kiểm được.
- **Thiếu `AGENT_TOKEN` = tắt, không phải chết** (ADR-0041). Không có vé nào ký được → panel nói rõ đang tắt.

## Acceptance criteria

- [x] Admin bấm nút trong `/quan-tri` → hiện URL uỷ quyền thật — verify bằng Playwright, `e2e/claude-login-panel.spec.ts`
- [ ] …dán code → `authMode` đổi sang `cli_login` — **chỉ người làm được**, cần bấm đồng ý bằng tài khoản Anthropic thật
- [x] Sales gọi endpoint cấp vé → **403** (curl thật trên `:8080`)
- [x] Vé sai / hết hạn / dùng lại / rác / thiếu → **401** ở runtime, **cùng một câu chữ**
- [x] `/run/*` vẫn KHÔNG với tới được từ `:8080` — kèm `Bearer AGENT_TOKEN` đúng vẫn rơi vào `web` (307 → `/dang-nhap`)
- [x] Đăng xuất xoá credential do màn này tạo → `authMode` về `null` (unit test); khoá trong `.env` không bị đụng
- [x] Code/token không xuất hiện trong bất kỳ response, log hay `status()` nào
- [x] `pnpm test:unit` **599 xanh** (532 → 599) + `typecheck` + `lint` sạch
- [x] Qua vòng review độc lập; 3 lỗi đường-thất-bại tìm được đã sửa + có test khoá lại
- [x] ADR-0043 có 8 phương án bị loại trên 4 trục

**Một điểm mở duy nhất, không giấu:** bước bấm đồng ý trên trang Anthropic rồi dán mã về. Mọi thứ trước nó — vé, tiền tố Caddy, PTY, bóc ANSI — đã chạy thật.

## Dependencies

Không plan nào chặn. Chồng lấn `apps/agent-runtime` với [260815-0901](../260815-0901-lam-day-agent-runtime-theo-mau-trycompai/plan.md) — plan đó đã code xong và điểm mở của nó (*"chờ một lượt chạy thật với OAuth token"*) đã được commit `aded85f` đóng lại, nên không tranh file.

## Câu hỏi chưa giải quyết

1. **`setup-token` khi THÀNH CÔNG ghi `.credentials.json` hay in ra chuỗi `sk-ant-oat-...`?** — **Vẫn chưa chốt được**, vì muốn biết phải hoàn tất một lượt uỷ quyền bằng trình duyệt thật. **Không đoán:** code xử lý **cả hai** nhánh (bắt token in ra → ghi `$HOME/.claude-oauth-token` quyền 600 + nạp `process.env`; nếu không có thì chỉ hỏi lại `resolveAuthMode()`), và câu trả lời cuối luôn đọc lại từ `resolveAuthMode()` chứ không tự khẳng định. Boot nạp lại file đó nhưng **không đè** biến đã có. Cả hai nhánh có test.
2. Vé dùng-một-lần lưu trong bộ nhớ tiến trình; restart runtime thì vé còn hạn (≤5') dùng lại được — **chấp nhận cho vòng 1**, ghi trong ADR-0043. Lưu bền được thì phải cho container này một chỗ chứa dữ liệu, đúng thứ ADR-0038 cấm.
3. Rate limit ngoài "một phiên một lúc"? **Không thêm** cho vòng 1.
4. *(Mới, không thuộc phạm vi plan này)* `.env` trên máy dev đang trỏ `DATABASE_URL_*` vào `localhost:5432` trong khi compose publish Postgres ở **5403** → `pnpm seed` và toàn bộ e2e hỏng nếu không override. Không sửa hộ vì đó là file secret không commit.

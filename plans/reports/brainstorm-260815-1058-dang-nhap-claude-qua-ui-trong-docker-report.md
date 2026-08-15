# Brainstorm — Đăng nhập Claude Code trong Docker qua giao diện

Ngày 15/08/2026 11:05 · nhánh `feat/agent-runtime-walking-skeleton` · chế độ: mặc định (không `--html`/`--wiki`)

## 0. Chốt gì

Admin bấm nút trong `/quan-tri` → uỷ quyền trên trình duyệt → `agent-runtime` có credential. Không mở terminal.

`api` **không** chạm credential: nó chỉ ký một cái vé ngắn hạn. Trình duyệt POST thẳng tới `agent-runtime` qua Caddy.

Người quyết định: HungLV. Đã được cảnh báo về ngày freeze + rủi ro ranh giới, xác nhận làm.

## 1. Chẩn đoán nhảy-thẳng-tới-giải-pháp

Đề xuất tới dạng giải pháp ("login qua UI"), không dạng vấn đề. Ba cách đọc, dẫn tới ba thứ khác hẳn:

| Frame | Vấn đề thật | Giải pháp khớp |
| --- | --- | --- |
| A | BGK/đồng đội không tự dựng nổi | README + 1 lệnh copy-paste *(đã có từ commit `aded85f`)* |
| B | Demo cần thấy AI chạy bằng credential thật | Panel **chỉ đọc** hiện `authMode` |
| C | Token chết giữa demo | Trạng thái mất-năng-lực + rơi về fixture *(ADR-0041 đã có)* |

Người dùng chọn: **không frame nào cả — thật sự muốn luồng đăng nhập trong UI.**

**Trạng thái bằng chứng: yếu.** Chưa ai ngoài chủ dự án thử dựng và thất bại; chưa có sự cố token chết. Ghi lại để vòng 2 biết đây là quyết định sản phẩm, không phải phản ứng với dữ liệu.

## 2. Ràng buộc đã nêu và bị bác

Nêu: hôm nay là ngày freeze (CLAUDE.md — *"15/08 chỉ hardening + test + demo"*), vòng 1 chốt 15:00, còn ~4h; stack đang xanh 532 test; rubric không thưởng công cụ vận hành.

Người quyết định bác, chọn "bất chấp, làm ngay hôm nay" và "không cần đường lui". Ghi nguyên văn ở đây thay vì bỏ qua.

## 3. Phương án đã cân nhắc

### Trục 1 — UI làm gì

| PA | Ưu | Nhược | KL |
| --- | --- | --- | --- |
| 1a. Form dán token (`claude setup-token` chạy trên máy người dùng) | ~90'; không PTY, không scrape | Vẫn phải mở terminal một lần trên máy mình | ❌ Loại — không đúng thứ người dùng muốn |
| **1b. Luồng OAuth đầy đủ trong UI** | Không đụng terminal lần nào | Phải scrape TUI; định dạng stdout không phải hợp đồng | ✅ **Chọn** |

### Trục 2 — token đi đường nào

| PA | Ưu | Nhược | KL |
| --- | --- | --- | --- |
| 2a. Qua `api` | Giống mọi endpoint hiện có, không đụng Caddy | Credential xuyên tiến trình cầm `DATABASE_URL_SYSTEM` → lật ADR-0038 | ❌ Loại — đổi sai phía |
| **2b. Thẳng tới runtime, api chỉ cấp vé HMAC** | `api` không bao giờ thấy credential; ADR-0038 + 0042 nguyên vẹn | Thêm route Caddy (+bề mặt public); +30–40' | ✅ **Chọn** |

### Cách cấp PTY

| PA | KL |
| --- | --- |
| `node-pty` | ❌ Loại — native module, image thiếu `python3`/`make`/`g++`, phải dựng toolchain cho musl |
| **`util-linux` → `script -qec`** | ✅ **Chọn** — một dòng `apk add`, không trình biên dịch |

## 4. De-risk đã chạy thật (không phải suy luận)

1. `claude setup-token --help` → **không có flag nào**. Không có đường phi tương tác.
2. Chạy không TTY → chết ngay: `Raw mode is not supported on the current process.stdin, which Ink uses`. **PTY là bắt buộc.**
3. Image không có `python3`, `make`, `g++` → `node-pty` là ngõ cụt.
4. `apk add util-linux` rồi `script -qec "claude setup-token" /dev/null` → **chạy được**, in ra:

```
Browser didn't open? Use the url below to sign in:
https://claude.ai/oauth/authorize?code=true&client_id=...&code_challenge=...&state=...
Paste code here if prompted >
```

Dòng mốc rõ, URL riêng một dòng, prompt nhập code rõ. Scrape tractable.

*(util-linux mới cài vào container đang chạy là tạm, mất khi recreate — phải vào Dockerfile.)*

## 5. Giải pháp chốt

```
Trình duyệt (admin, đã đăng nhập CRM)
 1. POST /api/agent/auth-ticket      → api: kiểm JWT admin, ký vé = HMAC-SHA256(AGENT_TOKEN),
                                       hết hạn 5', dùng một lần
 2. POST /agent-auth/login/start     → Caddy → agent-runtime (KHÔNG qua api)
    Authorization: Ticket <vé>         runtime verify HMAC → spawn `script` → scrape URL
    ← { loginId, url }
 3. người dùng mở url, uỷ quyền, copy code
 4. POST /agent-auth/login/:id/code  → runtime ghi code vào stdin, chờ tiến trình thoát
    ← { authMode }
 5. panel refresh GET /health
```

**Không sửa `resolveAuthMode()` một dòng nào.** `setup-token` thành công ghi vào `$HOME/.claude/.credentials.json` — đúng đường `cli_login` của ADR-0042, đúng volume `agent-claude-home`. Tính năng này chỉ là **cách thứ hai tạo ra thứ hệ thống đã biết đọc**.

### File phải chạm

| File | Việc |
| --- | --- |
| `infra/Caddyfile` | `handle /agent-auth/*` → `agent-runtime:4700`, **trước** handle catch-all |
| `apps/agent-runtime/Dockerfile` | `apk add --no-cache util-linux` |
| `apps/agent-runtime/src/login-session.ts` *(mới)* | spawn qua `script`, strip ANSI, bắt URL, bơm code, deadline, kill |
| `apps/agent-runtime/src/auth-ticket.ts` *(mới)* | verify HMAC bằng `AGENT_TOKEN` |
| `apps/agent-runtime/src/main.ts` | 3 route: `login/start`, `login/:id/code`, `DELETE /credential` |
| `apps/api/src/ai/` *(mới)* | endpoint cấp vé, `@Roles('admin')` |
| `apps/web/src/app/(app)/quan-tri/claude-login-panel.tsx` *(mới)* | trạng thái + nút + URL + ô code + Đăng xuất |
| `packages/contracts` | DTO |
| `docs/decisions/0043-*.md` | ADR kèm phương án bị loại |

## 6. Ràng buộc bắt buộc

- **Một phiên đăng nhập tại một thời điểm**, deadline ~5' rồi kill — cùng triết lý `JobQueue`. PKCE gắn `state` vào đúng tiến trình đó → restart runtime giữa chừng là hỏng phiên, phải làm lại.
- **Code OAuth không bao giờ được log.** URL log được (không bí mật), code thì không. Không bao giờ để code/token vào query string — Caddy log URL chứ không log body.
- **Caddy chỉ mở `/agent-auth/*`.** `/run/*` vẫn đóng kín; để lọt là mở cửa cho người lạ tiêu quota.
- **Phải có Đăng xuất** (xoá credential → mất năng lực → rơi về fixture), nếu không thì tạo được mà không huỷ được và ADR-0041 hết kiểm được.
- Vé **dùng một lần**, hết hạn 5', ký bằng `AGENT_TOKEN` — `api` và `agent-runtime` đã chia sẻ sẵn bí mật này, không thêm credential mới.

## 7. Definition of Done

- [ ] Test: vé sai/hết hạn → 401; vé hợp lệ → qua
- [ ] Test: scrape đúng URL từ stdout có ANSI + spinner
- [ ] Test: deadline hết → tiến trình bị kill, không rò
- [ ] Test: xoá credential → `authMode` về `null`, lượt chạy trả `not_authenticated`
- [ ] Test: **code/token không xuất hiện trong bất kỳ response hay log nào**
- [ ] `/run/*` vẫn KHÔNG với tới được từ `:8080`
- [ ] ADR-0043 có ≥2 phương án bị loại
- [ ] `pnpm test:unit` + `typecheck` + `lint` xanh

## 8. Rủi ro

| Rủi ro | Mức | Giảm thiểu |
| --- | --- | --- |
| Không xong trước 15:00 | **Cao** | Người quyết định đã chọn không có đường lui. Thứ tự làm: runtime → api → web, để phần đáng giá nhất xong trước |
| Nâng cấp CLI đổi định dạng stdout → parse vỡ im lặng | Trung bình | Dockerfile đã ghim `2.0.76`; test khoá chuỗi mốc |
| `/agent-auth/*` thành bề mặt public | Trung bình | Vé HMAC + hết hạn 5' + một phiên một lúc; `/run/*` không mở |
| Demo hỏng vì stack đang xanh bị đụng | Trung bình | Chạy `pnpm test:unit` trước khi commit mỗi phần |

## 9. Bước tiếp

1. **Verify ẩn số 10' đầu** (mục 10) — quyết định ~20 dòng code.
2. `login-session.ts` + route runtime → test.
3. Endpoint cấp vé ở api → test.
4. Panel web.
5. ADR-0043 + chạy full suite.

## 10. Câu hỏi chưa giải quyết

1. **`setup-token` khi THÀNH CÔNG thì ghi `.credentials.json` hay in ra chuỗi `sk-ant-oat-...`?** Chưa xác minh được vì hoàn tất luồng cần uỷ quyền bằng trình duyệt thật. Thiết kế chịu được cả hai (sau khi tiến trình thoát thì hỏi lại `resolveAuthMode()`; nếu nó in token thì bắt lấy ghi vào volume), nhưng **phải kiểm trước khi viết panel**.
2. Vé một lần dùng — lưu trạng thái "đã dùng" ở đâu trong runtime? Bộ nhớ tiến trình là đủ cho vòng 1, nhưng restart giữa chừng thì vé còn hạn vẫn dùng lại được. Chấp nhận hay siết?
3. Có cần rate limit ngoài "một phiên một lúc" không? Đánh giá: không, cho phạm vi vòng 1.

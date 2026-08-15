# Brainstorm — Xác nhận Claude Code **chạy thật**, và báo lỗi khi không

| | |
| --- | --- |
| **Ngày** | 2026-08-15 13:11 |
| **Nhánh** | `feat/agent-runtime-walking-skeleton` |
| **Chế độ** | brainstorm (không `--html`, không `--wiki`) |
| **Người quyết định** | HungLV |
| **ADR sinh ra** | [ADR-0044](../../docs/decisions/0044-kiem-tra-claude-code-chay-that-di-qua-api-chu-khong-mo-them-cua-cong-khai.md) |
| **Tiếp nối** | [brainstorm-260815-1058](brainstorm-260815-1058-dang-nhap-claude-qua-ui-trong-docker-report.md) · [ADR-0043](../../docs/decisions/0043-dang-nhap-claude-qua-giao-dien-va-vi-sao-api-chi-ky-ve.md) |

## 1. Vấn đề

Yêu cầu nguyên văn: *"Sau khi đăng nhập thành công thì phải hiển thị UI, cũng như xử lý backend để user xác nhận rằng claude code đang hoạt động. Nếu không hoạt động, hoặc có lỗi thì phải thông báo cho user."*

Vấn đề thật nằm dưới câu đó: **badge trạng thái hiện tại đang khẳng định thứ nó không biết.**

`resolveAuthMode()` (`apps/agent-runtime/src/claude-cli.ts:97`) chỉ kiểm **sự tồn tại** — biến môi trường có mặt, hoặc file `.credentials.json` có mặt. Comment ngay trong file thừa nhận: *"An expired session looks identical from here and is supposed to."* Hệ quả đo được:

| Tình huống thật | Panel đang hiện | Thực tế mọi lượt chạy |
| --- | --- | --- |
| Credential hết hạn | 🟢 `Phiên đăng nhập trong container` | `not_authenticated` |
| `CLAUDE_CODE_OAUTH_TOKEN` bị thu hồi | 🟢 `Token OAuth` | `not_authenticated` |
| Hết quota gói đăng ký | 🟢 xanh | `quota_exhausted` |
| Binary `claude` thiếu trong image | 🟢 xanh | `spawn_failed` |

Đây là luật 4 của `CLAUDE.md` bị vi phạm ở tầng vận hành: **một dòng trạng thái sai tệ hơn một dòng để trống.** Và cụ thể hơn: hôm nay **hết credential và hết quota trông y hệt nhau** — hai sự cố cần hai hành động ngược nhau (đăng nhập lại / tuyệt đối đừng bấm lại).

Câu duy nhất trả lời được "Claude Code đang hoạt động" là **thật sự chạy một lượt và cho xem bằng chứng**.

## 2. Bối cảnh đã scout

- `http-routes.ts` có **hai họ route, hai cổng gác**: `/run/*` (`Bearer AGENT_TOKEN`, Caddy **không** forward) và `/agent-auth/*` (`Ticket` HMAC, Caddy **có** forward). Comment đầu file nói rõ hai tiền tố tách nhau để Caddyfile gọi tên được cái này mà không gọi cái kia.
- `/health` không gác, đã trả `enabled` · `authMode` · `login` · `skills` · `grants` · `queue`.
- `apps/api` **đã cầm** `AGENT_TOKEN` (dùng ký vé) và **đã proxy** `/health` qua `GET /api/settings/agent-status`.
- Taxonomy lỗi có sẵn, đầy đủ: `spawn_failed` · `timeout` · `quota_exhausted` · `not_authenticated` · `parse_failed` · `unknown_skill` (`errors.ts`).
- Skill là **dữ liệu** nạp lúc boot (`skills/_base.md`, `discover-sources`, `extract-claims`) — luật 2 của `apps/agent-runtime/CLAUDE.md`.
- Panel đã phân biệt `disabled` vs `unreachable`, đã cảnh báo bẫy env-thắng-đĩa.

**Không thiếu mảnh nào.** Việc này là ráp lại, không phải xây mới — nên nó nằm trong luật "15/08 chỉ hardening", không phải feature mới sau freeze.

## 3. Phương án đã cân nhắc

### Trục 1 — bằng chứng "đang hoạt động" lấy từ đâu

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| A. Đọc credential kỹ hơn (parse hạn của `.credentials.json`) | Không tiêu quota | Không chứng minh được CLI chạy được trong container; không bắt được `quota_exhausted`; buộc tiến trình đọc một bí mật nó không có lý do đọc (trái comment `claude-cli.ts:70`) | ❌ Loại |
| **B. Chạy thật một lượt `claude -p`** | Bắt được **cả bốn** kiểu hỏng; sinh số kiểm chứng được | Tốn một lượt quota nhỏ, ~4–8s | ✅ **Chọn** |

### Trục 2 — ai kích hoạt lượt chạy

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| C. `POST /agent-auth/verify` trên runtime, gác bằng vé | Ít hop nhất; dùng lại vé vừa có sau login | **Đặt một endpoint tiêu quota vào đúng họ route Caddy forward ra ngoài** — chính thứ hai tiền tố được dựng để ngăn. Vé 5 phút bấm liên tục được | ❌ Loại |
| **D. `POST /api/settings/agent-check` (admin) → API gọi `/run/health-check` bằng `Bearer AGENT_TOKEN`** | Trình duyệt **không bao giờ** chạm được cửa tiêu quota; Caddyfile không đổi một dòng; dùng lại cổng gác đã có | Thêm một hop; API là bên châm ngòi tiêu quota | ✅ **Chọn** |

`AGENT_TOKEN` **không phải** credential Claude — nó là token liên dịch vụ mà API vốn đã cầm. ADR-0038 nguyên vẹn.

### Trục 3 — prompt kiểm tra sống ở đâu

| Phương án | Nhược | Kết luận |
| --- | --- | --- |
| E. Hằng số trong `claude-cli.ts` | Nhét prompt vào TypeScript — đúng thứ luật 2 cấm; mất khả năng review bởi người không đọc code | ❌ Loại |
| **F. Skill dữ liệu `skills/health-check/`** | Thêm 2 file | ✅ **Chọn** — tự hiện trong `/health.grants`, ai cũng soi được nó không với tới tool nào |

### Trục 4 — ghi nhận cái gì

| Phương án | Nhược | Kết luận |
| --- | --- | --- |
| G. Chỉ ghi kết quả lượt `health-check` | Bỏ qua bằng chứng mạnh hơn: một lượt `extract-claims` thật vừa chạy xong | ❌ Loại |
| **H. Ghi kết quả **mọi** lượt `/run/*`, thành công lẫn thất bại** | Không có | ✅ **Chọn** — ít code hơn, thông tin thật hơn |

> Đây là phát hiện đáng giá nhất của phiên: **nút "Kiểm tra ngay" không phải nguồn sự thật, nó chỉ là cách rẻ nhất để ép một lượt xảy ra khi chưa có lượt nào.**

### Trục 5 — lưu ở đâu

| Phương án | Nhược | Kết luận |
| --- | --- | --- |
| I. Ghi CSDL | Sinh trạng thái cũ kiểu "verified 3 ngày trước" trên container đã khác; ADR-0041 chốt runtime không ghi audit | ❌ Loại |
| J. Không lưu, chỉ hiện trong phiên bấm | Reload là mất; tab thứ hai mù | ❌ Loại |
| **K. Bộ nhớ tiến trình runtime, lộ qua `/health.lastRun`** | Chết theo container | ✅ **Chọn** — và chết theo container là **đúng**: container mới thì thật sự chưa ai kiểm tra nó |

## 4. Giải pháp chốt

**B + D + F + H + K.**

### 4.1 `agent-runtime` — ghi nhận lượt chạy gần nhất

`runOne()` trong `http-routes.ts` ghi vào một biến trong tiến trình sau **mỗi** lượt:

```ts
interface LastRun {
  at: number                    // epoch ms
  skill: string
  authMode: AuthMode | null     // credential THẬT SỰ đã chạy, không phải cái đang cấu hình
  ok: boolean
  text?: string                 // cắt ~200 ký tự, chỉ khi ok
  elapsedMs?: number; apiMs?: number
  inputTokens?: number; outputTokens?: number
  sessionId?: string
  reason?: AgentFailureReason   // chỉ khi hỏng
  message?: string
}
```

Lộ ra tại `/health.lastRun`. **Không ghi CSDL, không ghi audit** — ADR-0041 chốt runtime không viết audit; đây là chẩn đoán trong bộ nhớ.

### 4.2 Skill `skills/health-check/`

```
SKILL.md      → "Trả lời đúng một từ: OK. Không giải thích."
policy.json   → { allowedTools: [], maxTurns: 1, timeoutMs: 30000, model: <rẻ nhất> }
```

`allowedTools: []` → `--allowed-tools none`, whitelist rỗng khớp không tool nào.

### 4.3 `apps/api` — cửa duy nhất trình duyệt gọi được

```
POST /api/settings/agent-check     @Roles('admin')
  → POST {AGENT_RUNTIME_URL}/run/health-check
    Authorization: Bearer AGENT_TOKEN
    body: { userPrompt: 'ping' }        timeout ~45s
```

- Thiếu `AGENT_TOKEN` → **503** (tắt, không phải hỏng — giống `agentAuthTicket`)
- Runtime trả 502 → đọc `reason` từ body, trả xuống nguyên vẹn, **không** ném thành 500
- Runtime chết → `reachable: false`

`AgentRuntimeStatusDto` thêm `lastRun?: AgentRunSummaryDto`. Không có bí mật nào trong đó — tên mode, vài con số, và câu model trả lời.

### 4.4 Panel — hiển thị bằng chứng, không hiển thị dấu chấm xanh

Sau khi `submit` thành công → **tự bắn** `agentCheck.mutate()`. Người dùng thấy chuỗi: `Đang xác thực…` → `Đang kiểm tra Claude Code…` → kết quả.

```
┌─ Đã chạy thật · 13:07                       [Kiểm tra ngay] ─┐
│  Chạy bằng: Phiên đăng nhập trong container                  │
│  Model trả lời: "OK"                                         │
│  4.2s tổng — 1.1s gọi model, 3.1s khởi động                  │
│  16.204 token vào / 3 ra · session 4f2a…                     │
└──────────────────────────────────────────────────────────────┘
```

- Khối tím (`machine-*`): máy sinh ra. Badge verdict dùng bốn màu trạng thái. Nút bấm theo luật *cam = người sắp bấm*.
- Chưa có lượt nào → **"Chưa kiểm tra lần nào"**. Trạng thái thứ ba thật sự, không phải màu đỏ.

### 4.5 Bảng dịch lỗi — phần "thông báo cho user"

| `reason` | Thông báo | Việc phải làm |
| --- | --- | --- |
| `not_authenticated` | Có credential nhưng **bị từ chối** — hết hạn hoặc đã thu hồi | Bấm Đăng nhập Claude lại |
| `quota_exhausted` | Hết lượt của gói đăng ký | Chờ reset, **đừng bấm lại ngay** |
| `spawn_failed` | Không chạy được `claude` trong container | Lỗi image, không phải lỗi đăng nhập |
| `timeout` | CLI không trả lời trong 30s | Thử lại; lặp lại là vấn đề mạng container |
| `parse_failed` | CLI trả về thứ không đọc được | Xem `docker compose logs agent-runtime` |
| API 503 | `AGENT_TOKEN` chưa đặt — đang **tắt** | Đặt biến, khởi động lại stack |
| fetch hỏng | **Không liên lạc được** runtime | Kiểm tra container + `AGENT_RUNTIME_URL` |

## 5. Tiêu chí nghiệm thu

1. Đăng nhập thành công → panel tự chạy một lượt và hiện văn bản model trả lời + thời gian + token + session, **không cần bấm gì thêm**.
2. Credential hỏng/hết hạn → panel nói **"bị từ chối"**, khác hẳn thông báo hết quota.
3. Hết quota → panel nói hết lượt và **khuyên không bấm lại**.
4. Container tắt → "không liên lạc được"; thiếu `AGENT_TOKEN` → "đang tắt". Hai câu khác nhau.
5. Reload trang / mở tab thứ hai → vẫn thấy kết quả lần chạy gần nhất.
6. `POST /run/*` **vẫn** trả 401 khi thiếu `Bearer AGENT_TOKEN` (test hồi quy hiện có phải còn xanh).
7. Sales gọi `/api/settings/agent-check` → **403**.
8. Caddyfile **không đổi một dòng nào**.

## 6. Test

| Tầng | Nội dung |
| --- | --- |
| runtime unit | `health-check` nạp được với `allowedTools` rỗng · `runOne` ghi `lastRun` khi thành công · ghi kèm `reason` khi `AgentRunError` · `/health` lộ `lastRun` · `/run` vẫn 401 khi thiếu `Bearer` |
| api unit | thiếu `AGENT_TOKEN` → 503 · Sales → 403 · runtime 502 → `reason` xuống nguyên vẹn · runtime chết → `reachable:false`, không ném 500 |
| e2e | panel vẽ ba trạng thái: chưa kiểm tra / đạt / hỏng-kèm-lý-do. **Không** gọi Claude thật trong e2e — tốn quota và làm test giòn |

## 7. Rủi ro

| Rủi ro | Xử lý |
| --- | --- |
| Endpoint tiêu quota bị bấm liên tục | Admin-only + nút disable khi pending + `JobQueue` concurrency 1 đã 503 khi quá deadline. **Không** thêm rate-limiter riêng (YAGNI) |
| Bẫy env-thắng-đĩa: đăng nhập xong nhưng lượt kiểm tra chạy bằng token `.env` | `lastRun.authMode` nói **credential nào thật sự chạy**; cảnh báo `oauth` đã có sẵn ở panel |
| Ai đó copy pattern này để mở thêm `/run` ra ngoài | Caddyfile không đổi; ghi lý do vào comment route mới; ADR-0044 nêu rõ phương án bị loại |
| `text` của model lọt bí mật | Prompt cố định, `maxTurns: 1`, không tool. Vẫn cắt 200 ký tự |
| Login flow dài thêm ~4–8s | Chấp nhận: đổi lấy việc admin biết ngay nó chạy được hay không, thay vì biết lúc demo |

## 8. Ngoài phạm vi

Sales không thấy khối này (Sales đã có banner `aiEnabled`) · không lịch sử nhiều lượt · không đo định kỳ · không tự chạy khi mở trang · không ghi CSDL · không đụng `/agent-auth/*` · không đụng Caddyfile.

## 9. Chạm vào

- `apps/agent-runtime/src/http-routes.ts` — ghi `lastRun`, lộ qua `/health`
- `apps/agent-runtime/skills/health-check/` — **mới**, 2 file dữ liệu
- `apps/api/src/settings/settings.controller.ts` — `POST /settings/agent-check`
- `packages/contracts/src/dto/system-settings.ts` — `AgentRunSummaryDto`, mở rộng `AgentRuntimeStatusDto`
- `apps/web/src/lib/api-client.ts` — `agentCheck()`
- `apps/web/src/app/(app)/quan-tri/claude-login-panel.tsx` — khối kết quả + nút + bảng dịch lỗi
- tests ba tầng như mục 6

## 10. Câu hỏi chưa chốt

1. **Model nào cho `health-check`?** Đề xuất model rẻ nhất khả dụng để một lượt kiểm tra gần như không tốn gì — cần xác nhận tên model đúng lúc implement (`policy.model` là optional, bỏ trống thì dùng mặc định của CLI).
2. **`timeoutMs` 30s có đủ không?** Spike đo ~3.4s khởi động tiến trình; 30s là rộng rãi, nhưng nếu container lạnh thì cần đo lại.
3. **Có nên hiện `lastRun` của skill nghiệp vụ (`extract-claims`) trên panel quản trị không**, hay chỉ hiện lượt `health-check` cho gọn? Thiết kế hiện tại hiện tất — thông tin thật hơn, nhưng admin có thể bối rối khi thấy tên skill lạ. Quyết lúc implement sau khi nhìn UI thật.

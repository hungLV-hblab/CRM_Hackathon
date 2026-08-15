# ADR-0038 — Agent runtime là container riêng giữ credential Claude và không giữ credential CSDL

| | |
| --- | --- |
| **Ngày** | 2026-08-15 01:30 |
| **Giai đoạn** | Design / Development |
| **Trạng thái** | Chấp nhận |
| **Người quyết định** | HungLV |
| **Prompt log** | *chưa có* |

## Bối cảnh

Module AI hiện tại gọi model qua Anthropic SDK: một adapter, một prompt là hằng số chuỗi trong `.ts`, một lượt hỏi-đáp. Muốn đi tiếp về phía agentic — nhiều lượt, có tool, có skill sửa được mà không rebuild — thì SDK là đường cụt: mỗi năng lực mới phải tự viết lại vòng lặp agent.

`spikes/claude-cli-provider` đã chứng minh chạy `claude -p` như tiến trình con là được. Cái spike chưa trả lời: đặt tiến trình đó ở đâu cho an toàn, khi mà `apps/api` đang cầm `DATABASE_URL_SYSTEM` — credential của chính danh tính AI mà ADR-0010 dựng cả một hệ GRANT theo cột để siết.

## Phương án đã cân nhắc

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| A. Container riêng `agent-runtime`, giữ credential Claude, **không** có biến CSDL nào | Hai loại credential ở hai tiến trình; `pnpm start` vẫn một lệnh; egress quản bằng compose | Thêm một service và một chặng HTTP (~vài ms so với ~10s gọi model) | ✅ **Chọn** |
| B. Spawn CLI ngay trong `apps/api` | Không thêm service | Tiến trình con **kế thừa môi trường có `DATABASE_URL_SYSTEM`**. Whitelist tool hỏng một lần là AI có credential CSDL mà không đi qua dòng code nào của domain | ❌ Loại — đánh đổi sai phía |
| C. Tiến trình `agent-host` chạy trên host, ngoài Docker | Không phải mount gì | `pnpm start` không còn dựng đủ hệ thống; BGK phải cài Claude CLI trên máy họ mới demo được | ❌ Loại — hỏng đường demo |
| D. Mount `~/.claude` vào container | Chạy được ngay | Đưa đường dẫn credential cá nhân vào compose file; mục 6 CLAUDE.md cấm | ❌ Loại |

## Quyết định

Chọn **A**, và tiêu chí so là **cái gì hỏng khi một lớp phòng thủ hỏng**, không phải số dòng code.

`api` cầm `DATABASE_URL_APP` + `DATABASE_URL_SYSTEM`, không cầm credential Claude.
`agent-runtime` cầm `CLAUDE_CODE_OAUTH_TOKEN`, không cầm biến CSDL nào — `claude-cli.ts` dựng môi trường cho tiến trình con bằng tay (`childEnv()`) thay vì kế thừa, nên tính chất này đúng cả khi ai đó thêm biến vào compose sau này.

Ba điều kèm theo, mỗi điều có test:

1. **Skill là thư mục dữ liệu**, không phải hằng số: `SKILL.md` + `policy.json`. `policy.json` khai `allowedTools`, `maxTurns`, `timeoutMs`; thiếu trường nào là **lỗi boot**, không phải mặc định im lặng. Skill `extract-claims` có `allowedTools: []` — whitelist khớp rỗng.
2. **Worker không bao giờ đi đường agent.** Hạn mức subscription tính theo phiên; vòng quét fan-out mỗi 60s sẽ đốt sạch rồi hỏng cho đúng người đang bấm nút. `claim-extractor.provider.ts` đọc `APP_ROLE` và **ghi log rằng nó từ chối** — ranh giới tự nói ra được thì kiểm được.
3. **Mọi thất bại thành danh sách rỗng**, không thành exception. Container tắt, token hết hạn, hết quota, model trả văn xuôi — bốn dòng log khác nhau, một kết cục giống nhau (luật 4).

Cửa kiểm **không** chuyển vào agent-runtime. `locateVerbatimQuote`, I-1, I-2, whitelist I-11 ở nguyên `apps/api` cạnh domain sở hữu luật đó. Đổi đường truyền không đổi việc ai được tin.

## Hệ quả

- Kéo theo: `apps/agent-runtime` (package mới), service thứ 7 trong compose, ba biến `.env` mới. Tất cả **rỗng = tắt**, và tắt là mặc định — không điền gì thì hệ thống chạy y như trước.
- Kéo theo: hai bản của cùng bộ luật rút phát hiện — hằng số trong `anthropic-claim-extractor.ts` và `SKILL.md`. Đã ghi chú chéo ở cả hai file. Gộp làm một là việc của pha sau.
- Đánh đổi chấp nhận: **dùng subscription làm backend là ngoài điều khoản của Anthropic.** Demo nội bộ thì được, production thì không. Hạn mức gắn với một con người, không co giãn theo số Sales dùng.
- Đánh đổi chấp nhận: ~3,4s chi phí khởi động tiến trình mỗi lần gọi (đo ở spike), nằm trên đường người bấm nút chứ không nằm trên vòng quét.
- Sẽ phải xem lại nếu: cần chạy nhiều hơn một job đồng thời (lúc đó hàng đợi 1-in-flight thành nút cổ chai), hoặc nếu quyết định đưa lên production (lúc đó phải bỏ OAuth, quay về API key).

## AI đã tham gia thế nào

- Vai trò AI: sinh phương án và phản biện kiến trúc; đội bác hai lần.
- AI đề xuất gì mà đội **không** nghe: đề xuất kiến trúc kiểu "Claude Code trên trình duyệt" — container theo phiên, Redis pub/sub, WebSocket, `/workspace` gắn project. Loại vì đó là kiến trúc của IDE-as-a-service, không phải của module CRM: không skill nào cần filesystem, và Chat UI + Terminal đâm thẳng vào mục 8 CLAUDE.md.
- AI sai ở đâu: khẳng định "container không chạy được Claude CLI" và coi đó là chặn cứng. Sai — container sạch *không có credential*, nhưng credential là thứ tiêm vào được bằng `claude setup-token`. Kết luận sai đó suýt đẩy cả thiết kế sang phương án C.

## Đội đã verify bằng cách nào

Không đọc cho hợp lý, mà chạy:

1. `pnpm test:unit` — **485 test xanh**, gồm 11 test mới ở `agent-runtime` và 8 test mới ở `api`. Trong đó chốt: worker có đủ biến agent vẫn **không** nhận `AgentClaimExtractor`; `policy.json` thiếu `allowedTools` là lỗi boot; placeholder `{{...}}` chưa thay là lỗi boot; model trả văn xuôi → `[]`.
2. `pnpm typecheck` + `pnpm lint` — sạch.
3. **Dựng image và gọi thật:**
   - `GET /health` → `{"ok":true,"skills":["extract-claims"],"authMode":"api_key",...}` — skill nạp được từ đĩa trong container.
   - `POST /run/extract-claims` không có Bearer → **401**.
   - `POST /run/khong-co` → `{"reason":"unknown_skill"}`.
   - `POST /run/extract-claims` với key giả → **502** `{"reason":"not_authenticated"}`, thân lỗi chứa `"Invalid API key"` **do chính Anthropic trả về**. Đây là bằng chứng CLI thật sự chạy trong container và ra được mạng, chứ không phải code ta đoán.

Chưa verify: một lượt chạy **thành công** với credential thật — cần OAuth token, chưa có lúc viết ADR này.

## Rollback

Xoá ba biến `AGENT_RUNTIME_URL`, `AGENT_TOKEN`, `CLAUDE_CODE_OAUTH_TOKEN` khỏi `.env` rồi `docker compose up -d api worker`. Provider quay về `AnthropicClaimExtractor` hoặc `FixtureClaimExtractor`, đúng nhánh cũ của ADR-0014. **Dưới 1 phút**, không migration, không mất dữ liệu. Container `agent-runtime` cứ chạy cũng không ai gọi tới.

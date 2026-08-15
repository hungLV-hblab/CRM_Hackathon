# ADR-0043 — Đăng nhập Claude qua giao diện, và vì sao `api` chỉ ký vé chứ không đứng giữa

| | |
| --- | --- |
| **Ngày** | 2026-08-15 12:10 |
| **Giai đoạn** | Development |
| **Trạng thái** | Chấp nhận |
| **Người quyết định** | HungLV |
| **Prompt log** | [brainstorm-260815-1058](../../plans/reports/brainstorm-260815-1058-dang-nhap-claude-qua-ui-trong-docker-report.md) |

## Bối cảnh

ADR-0042 mở đường xác thực thứ ba: chạy `claude /login` **trong container**. Nó chạy được, nhưng chỉ chạy được từ terminal — `docker compose exec agent-runtime claude /login`. Người quyết định muốn làm việc đó **từ trong giao diện**, không mở terminal lần nào.

Trạng thái bằng chứng cho nhu cầu này, ghi thẳng ra vì vòng 2 sẽ hỏi: **yếu**. Chưa ai ngoài chủ dự án thử dựng và thất bại; chưa có sự cố token chết giữa demo. Đây là **quyết định sản phẩm**, không phải phản ứng với dữ liệu. Đội đã được cảnh báo rằng hôm nay là ngày freeze và vẫn chọn làm.

Ba việc phải de-risk trước khi thiết kế, và cả ba đã **chạy thật** chứ không suy luận:

1. `claude setup-token --help` → **không có flag nào**. Không tồn tại đường phi tương tác.
2. Chạy không TTY → chết ngay: `Raw mode is not supported on the current process.stdin, which Ink uses`. **PTY là bắt buộc.**
3. Image thiếu `python3`/`make`/`g++` → `node-pty` là ngõ cụt.

## Phương án đã cân nhắc

### Trục 1 — giao diện làm gì

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| A. Form dán token: người dùng tự chạy `claude setup-token` trên máy mình rồi dán chuỗi vào ô | ~90 phút; không PTY, không scrape TUI | Vẫn phải mở terminal đúng một lần — tức là không giải quyết vấn đề được nêu | ❌ Loại — giải quyết một vấn đề khác với vấn đề được hỏi |
| **B. Luồng uỷ quyền đầy đủ trong giao diện** | Không đụng terminal lần nào | Phải scrape TUI; định dạng stdout không phải hợp đồng ai ký | ✅ **Chọn** |

### Trục 2 — mã uỷ quyền đi đường nào

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| C. Trình duyệt → `api` → `agent-runtime` | Giống mọi endpoint đang có; không đụng Caddy | Credential và mã uỷ quyền xuyên qua tiến trình đang cầm `DATABASE_URL_SYSTEM` — **lật ADR-0038** | ❌ Loại — đổi sai phía của ranh giới |
| **D. Trình duyệt → thẳng `agent-runtime`; `api` chỉ ký một cái vé** | `api` không bao giờ thấy mã lẫn credential; ADR-0038 nguyên vẹn | Thêm một tiền tố Caddy công khai; +30–40 phút | ✅ **Chọn** |

### Trục 3 — lấy PTY ở đâu

| Phương án | Nhược | Kết luận |
| --- | --- | --- |
| E. `node-pty` | Native module; image thiếu `python3`/`make`/`g++`; phải dựng toolchain musl để có một pseudo-terminal | ❌ Loại |
| **F. `util-linux` → `script -qec`** | Một dòng `apk add`, không trình biên dịch | ✅ **Chọn** |

### Trục 4 — trình duyệt cầm bí mật gì

| Phương án | Nhược | Kết luận |
| --- | --- | --- |
| G. Đưa thẳng `AGENT_TOKEN` cho trang | Thứ gì trình duyệt cầm được thì coi như công khai — **mất luôn cửa `/run`**, tức là cửa tiêu quota | ❌ Loại |
| **H. Vé HMAC 5 phút, dùng một lần, ký bằng `AGENT_TOKEN`** | Thuật toán vé phải viết ở hai gói | ✅ **Chọn** — không đẻ thêm credential mới nào |

## Quyết định

Chọn **B + D + F + H**.

```
Trình duyệt (admin, đã đăng nhập CRM)
 1. POST /api/settings/agent-auth-ticket  → api kiểm JWT admin, ký vé HMAC-SHA256(AGENT_TOKEN),
                                             hạn 5', dùng một lần
 2. POST /agent-auth/login/start          → Caddy → agent-runtime (KHÔNG qua api)
    Authorization: Ticket <vé>              runtime verify vé → spawn PTY → bóc URL uỷ quyền
 3. người dùng mở URL, uỷ quyền, copy mã
 4. POST /agent-auth/login/:id/code        → runtime ghi mã vào stdin của CLI
 5. panel đọc lại trạng thái
```

**`resolveAuthMode()` không sửa một dòng nào.** Tính năng này chỉ là **cách thứ hai tạo ra thứ hệ thống đã biết đọc** — vẫn đúng volume `agent-claude-home`, vẫn đúng đường `cli_login` của ADR-0042.

Bốn ràng buộc enforce bằng code, không bằng lời dặn:

- **Caddy chỉ mở `/agent-auth/*`.** `/run/*` không có mặt trong `Caddyfile` và phải giữ nguyên như vậy — có test hồi quy chứng minh một cái vé hợp lệ **không** mở được `/run`, và chiều ngược lại `Bearer AGENT_TOKEN` **không** mở được `/agent-auth`.
- **Mọi kiểu vé hỏng trả cùng một câu chữ.** Phân biệt "sai chữ ký" với "hết hạn" là tặng thông tin cho người dò đúng cái bit họ cần.
- **Thiếu `AGENT_TOKEN` = đóng, không phải mở.** Khoá HMAC rỗng vẫn ký và verify hợp lệ, nên `if (!secret) return` là cái bẫy biến container chưa cấu hình thành container ai cũng vào được.
- **Mã uỷ quyền và token không bao giờ vào log, response, hay query string.** URL thì log được — nó không phải bí mật, và có nó trong log là thứ cứu được một phiên khi tab trình duyệt bị mất.

**Phải có Đăng xuất.** Không có thì tạo được credential mà không huỷ được, và ADR-0041 hết kiểm được — không có cách nào quay lại trạng thái nó mô tả để kiểm. Đăng xuất chỉ xoá thứ màn này tạo ra; khoá đặt trong `.env` sống tiếp, và panel nói thẳng như vậy.

### Ẩn số chưa đóng được, và cách thiết kế chịu được cả hai

`claude setup-token` khi **thành công** thì ghi `.credentials.json` hay in ra chuỗi `sk-ant-oat-…`? Không chốt được, vì muốn biết phải hoàn tất một lượt uỷ quyền bằng trình duyệt thật với tài khoản thật — việc của người, không phải của tiến trình này. **Không đoán.** Thay vào đó xử lý **cả hai**: nếu stdout có chuỗi token thì bắt lấy, ghi `$HOME/.claude-oauth-token` quyền `600` và nạp vào `process.env`; dù nhánh nào thì câu trả lời cuối vẫn **đọc lại từ `resolveAuthMode()`** chứ không tự khẳng định. Boot nạp lại file đó vào môi trường **nhưng không đè biến đã có** — `.env` vẫn là chỗ quyết định (ADR-0042).

## Hệ quả

- Kéo theo: `main.ts` mất phần routing, sang `http-routes.ts` dưới dạng factory. Không phải dọn dẹp — tính chất đáng test nhất ("`/run` vẫn đòi `Bearer` sau khi có route mới nằm cạnh") không test được khi nó chỉ tồn tại trong một module tự mở server lúc import.
- Kéo theo: `/health` có thêm trường `login`. Thêm cạnh các trường cũ, không thay thế cái nào.
- Kéo theo: `GET /settings/agent-status` (admin) đọc hộ `/health` của runtime, vì Caddy chỉ mở `/agent-auth/*`. Chỉ đi qua **tên chế độ**, không đi qua credential nào — ADR-0038 không đổi.
- Đánh đổi chấp nhận: nonce đã dùng nằm trong bộ nhớ tiến trình, restart là quên. Vé còn hạn dùng lại được trong ≤5 phút. Lưu bền được thì phải cho container này một chỗ chứa dữ liệu — đúng thứ ADR-0038 nói nó không được có.
- Đánh đổi chấp nhận: **scrape TUI là hợp đồng không ai ký.** Giảm thiểu bằng cách khớp **tiền tố URL** (`https://claude.ai/oauth/authorize?`) chứ không khớp câu tiếng Anh `Browser didn't open?…` — câu chữ là của tác giả CLI, tiền tố là của chính giao thức OAuth. Dockerfile đã ghim `2.0.76`.
- Đánh đổi chấp nhận: thuật toán vé viết ở hai gói. Không đưa vào `@crm/contracts` được (nơi đó là zod + enum, không phải chỗ để mã hoá) và `api` không phụ thuộc `@crm/agent-runtime`. Ghim hai bản vào **một vector cố định** được assert ở cả hai bộ test — lệch nhau thì đúng một bộ đỏ, và nó nêu tên file đã dịch.
- Restart container giữa phiên là **hỏng phiên**: PKCE gắn `state` vào đúng tiến trình đó. Panel nói rõ.
- **Lỗ hổng ghi nhận, cắt có chủ ý cho vòng 1:** cấp vé và Đăng xuất **không ghi vết audit**, nên không truy được *admin nào* đã đổi credential của hệ thống. Vé vô danh theo thiết kế — `agent-runtime` không bao giờ biết ai bấm — nhưng `api` thì biết và hiện chưa ghi. ADR-0041 miễn cho `agent-runtime` chuyện ghi audit, **không** miễn cho `api`. Ghi ra đây thay vì im lặng, vì luật 6 và 7 của CLAUDE.md hỏi đúng câu đó.
- Sẽ phải xem lại nếu: nâng bản Claude Code. Định dạng stdout đổi thì việc bóc URL vỡ — vỡ **ồn ào** (phiên hết hạn rồi báo hỏng), không vỡ im lặng.

## AI đã tham gia thế nào

- Vai trò AI: phản biện yêu cầu trước khi làm, sinh phương án, viết test trước rồi mới viết code.
- AI phản biện gì mà đội **không** nghe: AI chỉ ra hôm nay là ngày freeze (`CLAUDE.md`: *"15/08 chỉ hardening + test + demo"*), vòng 1 chốt 15:00, stack đang xanh 532 test, và rubric không thưởng công cụ vận hành. Đội bác, chọn làm, không cần đường lui. Ghi nguyên văn ở đây thay vì bỏ qua.
- AI đề xuất gì mà đội **không** nghe: AI đọc đề xuất thành ba khung vấn đề khác nhau (README một lệnh · panel chỉ đọc · trạng thái mất-năng-lực) và cả ba đều **đã có sẵn** từ ADR-0041/0042. Đội xác nhận không khung nào đúng — thật sự muốn luồng đăng nhập trong giao diện.
- AI sai ở đâu: **hai lỗi thật, cả hai do test bắt chứ không do đọc lại code.**
  1. Regex bóc URL dùng `\S+`, khớp cả một URL **bị cắt giữa chừng** vì chunk chưa tới. URL dài ~250 ký tự đi qua pipe nên đây là trường hợp thường, không phải biên. Hậu quả nếu lọt: trình duyệt nhận `state` cụt, uỷ quyền hỏng ở phía Anthropic, và không có gì trong codebase này giải thích được vì sao. Sửa: bắt buộc đã có khoảng trắng **sau** URL mới coi là đủ.
  2. `start()` gắn listener **trước** khi promise executor kịp lưu `resolve`. Output đến trong cùng một tick thì rơi mất và lời gọi treo tới tận deadline — cho một lần đăng nhập **đã thành công**. Hiếm với tiến trình thật, chắc chắn với tiến trình nhanh. Sửa: dựng promise trước, gắn listener sau; `submitCode()` cùng lỗi, cùng cách sửa.

  Vòng review sau đó (`code-reviewer`) tìm thêm **ba lỗi nữa, tất cả nằm ở đường thất bại** — tức đúng chỗ luồng chạy-thật và e2e không đi qua:

  3. **Đăng xuất xoá luôn credential của người vận hành.** `clearStoredCredential()` `delete process.env.CLAUDE_CODE_OAUTH_TOKEN` vô điều kiện. Mà `resolveAuthMode()` đọc biến môi trường **trước**, nên một cú bấm của admin làm **cả hệ thống** mất quyền gọi Claude cho tới khi restart container — trong khi chính docstring của hàm đó và câu chữ trên panel đều hứa ngược lại. Nguy hiểm hơn: **test cho điều này vẫn xanh**, vì nó chỉ kiểm `ANTHROPIC_API_KEY` — đúng cái biến code không đụng tới. Assertion hẹp hơn lời hứa ngay phía trên nó. Sửa: chỉ xoá khi giá trị trong env **khớp đúng** token đã lưu trên đĩa (tức là của chính màn này), kèm test cho cả hai chiều.
  4. **Thoát mã 0 khi chưa có URL bị coi là thành công.** `start()` bị bỏ rơi cùng rejector, deadline vừa bị huỷ nên không còn gì cứu — request của admin treo vĩnh viễn, còn `/health` báo `done` cho một phiên chưa từng sinh ra URL. Sửa: mã 0 chỉ là thành công khi trạng thái đang là `finishing`.
  5. **`writeFileSync` ném trong `onExit` làm sập container.** Handler đó chạy trong sự kiện `close` của tiến trình con — **ngoài mọi promise chain** — nên `.catch()` ở router không thấy. Volume `agent-claude-home` đầy hoặc read-only là đủ, và `restart: unless-stopped` sẽ dựng lại container giữa demo, mất luôn token vừa lấy được. Sửa: bọc `try/catch`, hỏng lưu thì xuống nước chứ không kéo cả dịch vụ theo.

  Bài học chung của cả năm lỗi: **không lỗi nào lộ ra khi đọc lại code.** Bốn cái đầu do test bắt, cái thứ ba do một con mắt thứ hai đọc *lời hứa trong comment rồi đi kiểm xem test có thật sự chứng minh nó không*.

  **Lỗi thứ sáu — cái duy nhất chỉ người dùng thật mới tìm ra, và là lỗi nặng nhất.** Bấm "Xong" xong thì nút kẹt ở *"Đang xác thực…"*, không báo gì thêm; log runtime có `mở phiên đăng nhập` nhưng **không bao giờ có** `phiên đăng nhập xong`.

  Nguyên nhân: **Ink coi mỗi chunk stdin là MỘT sự kiện phím.** Ghi `code + "\n"` trong **một** lần `write` thì cả chuỗi tới như một lần đọc, Ink chèn nguyên văn vào ô nhập — kể cả ký tự xuống dòng — và **không bao giờ thấy phím Enter**. Mã nằm im trong ô, `setup-token` không kết thúc, tiến trình không thoát, `submitCode()` không resolve, trình duyệt chờ tới hết deadline 5 phút trong khi màn hình CLI trông y như đã nhận mã.

  Đo bằng thực nghiệm trong chính container, không suy luận: cùng một mã, terminator nằm **chung** lần ghi → 8 giây sau CLI không phản ứng gì. Tách Enter thành **lần ghi riêng** sau 300ms → CLI trả lời ngay: `OAuth error: Invalid code…`. `\n` hay `\r` không khác nhau — **cái quyết định là sự tách rời**, còn CR là thứ terminal thật gửi khi Ink đã bật raw mode.

  Và **test cũ khoá chặt đúng hành vi sai**: nó assert `['ma-uy-quyen-that\n']`. Test không bắt được lỗi vì nó chép lại điều code đang làm, chứ không phát biểu điều terminal cần.

  Hai lỗi nữa lộ ra trong cùng lần chẩn đoán:

  7. **Mã sai không làm CLI thoát.** Nó in lỗi rồi đứng ở `Press Enter to retry.` — nên kể cả khi Enter đã hoạt động, một mã sai vẫn treo hết 5 phút. Sửa: dò `OAuth error:` trong luồng ra và kết thúc phiên ngay (**đo được: 0,35 giây** thay vì 5 phút), kèm câu chỉ dẫn copy lại toàn bộ mã.
  8. **Giết `script` bỏ lại `claude` mồ côi.** `child.kill()` chỉ với tới `script`; `claude` là **cháu**, bị nhận nuôi bởi PID 1 rồi thành zombie không ai gặt — quan sát thật: hai `[claude]` zombie sau hai lần đăng nhập dở dang. Sửa hai lớp: spawn `detached` rồi `process.kill(-pid)` để giết cả **nhóm** tiến trình, và `init: true` trong compose để có `tini` làm PID 1 gặt xác — Node làm PID 1 không gặt tiến trình không phải con nó. Kiểm lại: hai lần đăng nhập dở dang liên tiếp → **0 zombie, 0 tiến trình sót**.

## Đội đã verify bằng cách nào

Không đọc cho hợp lý, mà chạy:

1. **Ghi lại byte thật trước khi viết dòng code nào.** Chạy `script -qec "claude setup-token" /dev/null` trong chính image đang chạy, `od -c` ra luồng thô: spinner repaint bằng `\x1b[2K\x1b[1A\x1b[2K\x1b[G`, mỗi khung bọc trong `\x1b[?2026h`/`\x1b[?2026l`, URL nằm riêng một dòng. Fixture trong test là **bản chép lại từ capture đó**, không phải một hình dung về nó.
2. **Test đỏ trước, xanh sau.** Hai lỗi ở mục trên đều lộ ra ở lần chạy test đầu tiên, không phải khi review.
3. `pnpm test:unit` — **600 test xanh** (51 file, +68 so với 532 trước đó). `pnpm typecheck`, `pnpm lint` — sạch.
4. **Kiểm ranh giới theo cả hai chiều, trên HTTP thật:** vé hợp lệ → `/run` trả **401**; `Bearer AGENT_TOKEN` → `/agent-auth` trả **401**; vé dùng lần hai → **401**; thiếu `AGENT_TOKEN` → cả hai họ route trả **503 "đang tắt"** còn `/health` vẫn **200**.
5. **Kiểm `/run` vẫn không với tới được từ `:8080`:** `curl -X POST http://localhost:8080/run/extract-claims` kèm đúng `Bearer AGENT_TOKEN` → **307 → `/dang-nhap`**, tức là rơi vào `web`, không chạm `agent-runtime`.
6. **Chạy trọn chuỗi thật bằng curl:** Sales xin vé → **403**. Admin xin vé → **201** kèm vé 111 ký tự. Đem đúng vé đó POST `/agent-auth/login/start` qua Caddy → **200**, trả về URL uỷ quyền **thật** có `code_challenge` + `state`, do một tiến trình `claude setup-token` thật đang chạy dưới PTY trong container sinh ra.
7. **Chạy bằng trình duyệt thật (Playwright):** admin bấm nút → panel hiện URL uỷ quyền thật (`code_challenge`, `state`), ô dán mã hiện ra, vùng chạm nút ≥44px. Sales vào cùng màn → **không thấy nút**, thấy câu từ chối.
8. **Kiểm bí mật không rò:** test khẳng định không lời gọi `console.*` nào chứa mã uỷ quyền hoặc chuỗi `sk-ant-oat`, và trạng thái phơi ra ngoài (`status()`) serialize xong cũng không chứa.
9. **Một con mắt thứ hai đọc lại toàn bộ thay đổi** (`code-reviewer`), soi riêng đường thất bại. Tìm ra ba lỗi ở mục trên; cả ba đã sửa và có test mới khoá lại, rồi chạy lại toàn bộ từ đầu — bao gồm dựng lại image và bấm nút bằng trình duyệt thật lần nữa.

10. **Chạy thật với một mã SAI, sau khi sửa:** gửi mã bịa qua trọn chuỗi `:8080` → trả `400 code_rejected` trong **0,35 giây** kèm câu chỉ dẫn, thay vì treo 5 phút. Rồi kiểm tiến trình còn sót: **0 zombie**.

**Chưa verify được, và không giả vờ là đã:** bước bấm "đồng ý" trên trang Anthropic rồi dán mã **đúng** về. Nó cần một tài khoản thật và một cái click của người.

Bài học lớn nhất của ADR này: **"mọi thứ trước bước cuối đã chạy thật" không đủ.** Câu đó từng được viết ra ở đây với đầy đủ thiện chí — trong khi đường ghi mã vào stdin, thứ nằm ngay giữa chuỗi và có test xanh che, lại hỏng hoàn toàn. Lỗi nặng nhất của tính năng này nằm đúng ở chỗ duy nhất không ai chạy thử được bằng máy, và nó chỉ lộ ra khi một người thật bấm nút.

## Rollback

Xoá `handle /agent-auth/*` khỏi `infra/Caddyfile` rồi `docker compose restart caddy` — dưới 30 giây, tính năng biến mất khỏi bên ngoài, không migration, không mất dữ liệu, `/run` và mọi thứ khác không đổi. Muốn gỡ hẳn: bỏ ba route trong `http-routes.ts`, `login-session.ts`, `auth-ticket.ts`, một route ở `SettingsController` và panel. Credential đã tạo vẫn nằm trong volume `agent-claude-home` và vẫn dùng được bằng đường ADR-0042.

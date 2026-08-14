# Spike · Gọi Claude qua CLI thay cho `ANTHROPIC_API_KEY`

**Đây là spike, không phải sản phẩm.** Nó tồn tại để trả lời một câu hỏi: khi đội không có API key,
backend có thể lấy câu trả lời của mô hình bằng cách chạy ngầm Claude Code CLI (`claude -p`) như một
tiến trình con không? Trả lời: **được**, kèm mấy cái giá phải trả ghi ở cuối file.

Spike **không** đụng vào `apps/api`, `apps/web`, `packages/`. Nó cũng không cần Postgres.

## Chạy

```bash
node spikes/claude-cli-provider/server.ts
# → http://localhost:4599
```

Yêu cầu: Node 22 (chạy thẳng TypeScript, không cần build) và Claude Code CLI đã đăng nhập trên máy.
Tự dò `~/.local/bin/claude.exe`; máy khác chỗ thì đặt `CLAUDE_CLI_PATH`. Đổi model bằng `CLAUDE_CLI_MODEL`.

## Màn hình làm gì

Dán bản chụp HTML → bấm **Rút phát hiện** → server chuẩn hoá văn bản, đẩy qua `claude -p`, nhận JSON,
rồi **soát lại câu trích trước khi cho hiển thị**. Bấm vào một phát hiện thì đoạn nguồn của nó sáng lên
trong ô văn bản bên dưới.

Cửa kiểm là phần đáng xem, không phải phần gọi CLI. Nó dùng `locateVerbatimQuote` **import thẳng từ**
`apps/api/src/ai/normalize-snapshot-text.ts`, không chép lại: câu trích không cắt nguyên văn từ bản chụp
thì cả phát hiện bị loại, và màn hình hiện nó ở khối đỏ kèm lý do. Vị trí bôi vàng vẽ từ offset server
tính, không phải do trình duyệt đi tìm lại chuỗi — nếu để trình duyệt tìm lại thì nó sẽ che mất đúng
cái sai mà màn hình này sinh ra để phơi bày.

Nói cách khác: đổi đường truyền từ API key sang tiến trình con **không** đổi việc ai được tin. Mô hình
chọn nhận định và chọn đoạn trích; code quyết định đoạn trích đó có thật không.

## Hai kiểu nói chuyện với CLI

Spike có hai màn hình vì có hai cách gọi, và chúng khác nhau ở chỗ đáng quan tâm nhất là chi phí khởi động.

| | `/` — rút phát hiện | `/chat` — đối thoại |
| --- | --- | --- |
| Tiến trình | spawn mới mỗi request, xong là chết | **một tiến trình sống suốt cuộc trò chuyện** |
| Cách nói | `-p` + `--output-format json`, một phát ăn ngay | `--input-format stream-json` — JSON từng dòng vào stdin, sự kiện ra stdout |
| Nhớ lượt trước | không | có, cùng `session_id` |
| Đo được (14/08) | 10,6s | **lượt 1: 9,1s · lượt 2: 2,1s · lượt 3: 2,9s** |

Chênh lệch lượt 1 với lượt 2 chính là ~3,4s khởi động biến mất. Kiểm chứng ngữ cảnh bằng cách hỏi
"tôi vừa hỏi gì?" ở lượt sau — nó trả lời đúng, tức là cùng một tiến trình chứ không phải spawn lại.

Màn hình `/chat` stream từng chữ nhờ `--include-partial-messages`: sự kiện
`stream_event` → `content_block_delta` → `delta.text_delta` được server đẩy thẳng ra trình duyệt qua SSE.

**Hai trường đọc dễ sai:** `total_cost_usd` và `duration_api_ms` trong sự kiện `result` là **cộng dồn cả
phiên**, không phải của riêng lượt vừa rồi. Lấy thẳng ra hiển thị thì lượt nào cũng trông đắt hơn và chậm
hơn lượt trước. `claude-channel.ts` trừ đi lượt trước để ra số thật của từng lượt.

`/chat` chỉ là **bằng chứng về đường truyền, không phải một tính năng sản phẩm** — luật 8 của đội cấm đính
chatbot cạnh CRUD rồi gọi đó là AI-native.

## Cấu hình gọi CLI, và vì sao từng cờ có mặt

| Cờ | Lý do |
| --- | --- |
| `--output-format json` | Có envelope parse được: `result`, `total_cost_usd`, `duration_api_ms`, `session_id` — đủ để đo, khớp luật 6 |
| `--max-turns 1` | Backend hỏi một câu lấy một câu trả lời. Không có cờ này nó chạy agentic tiếp, không chặn được nó sẽ làm gì |
| `--allowed-tools "none"` | Không có tool nào tên là `none` — đó chính là ý đồ: whitelist khớp rỗng, tiến trình con không đọc file, không chạy shell, không tự ra mạng |
| `--strict-mcp-config` | Bỏ qua MCP server mà máy dev đang cắm. Không có cờ này thì schema tool của chúng bị nạp vào mọi lần gọi |
| `--system-prompt` | **Thay hẳn** system prompt của Claude Code, không phải nối thêm. Backend cần một bộ rút trích, không cần trợ lý code đồng thời được dặn rút trích |
| `--no-session-persistence` | Không ghi phiên xuống đĩa |
| cwd = thư mục tạm rỗng | CLI đọc `CLAUDE.md` + `.claude/` từ thư mục làm việc. Chạy trong repo là mỗi lần gọi âm thầm nhét cả context dự án vào prompt |
| prompt qua **stdin** | Bản chụp dễ vượt giới hạn dòng lệnh Windows, và để ở tham số thì cả tài liệu nằm trong bảng tiến trình |

Gọi tuần tự một lần một (`chain` trong `claude-cli.ts`). Subscription giới hạn theo phiên chứ không theo
request, nên vòng quét fan-out qua nhiều công ty sẽ đốt sạch quota trong vài giây.

## Số đo thật (14/08/2026, máy Windows, model mặc định opus-4-5)

Bản chụp ~470 ký tự, 4 phát hiện, không cái nào bị loại:

- tổng thời gian **10,6s** — trong đó gọi mô hình 7,2s, còn lại **~3,4s là chi phí khởi động tiến trình**
- **1.023 token vào / 432 token ra**, **$0,025** lần gọi đó

**Trước hết: mấy con số `$` dưới đây không phải hoá đơn.** Máy đang chạy đăng nhập OAuth gói **Max**
(`~/.claude/.credentials.json` → `claudeAiOauth`, `subscriptionType = max`), không có `ANTHROPIC_API_KEY`.
Không có API key thì không có đường tính tiền theo token. Trường `total_cost_usd` mà CLI trả về là
**quy đổi tham chiếu** — "số token này nếu trả theo giá API list thì tốn bấy nhiêu" — và CLI luôn điền nó
bất kể đăng nhập kiểu gì. Với người dùng API key đó là tiền thật; với gói thuê bao đó là **thước đo mức
tiêu thụ**, và cái nó ăn vào là **hạn mức phiên** (mục 4 phần "cái giá phải trả"), không phải ví tiền.

Đọc mọi con số `$` trong file này theo nghĩa đó.

**Cẩn thận với con số $0,025 — nó là một lần trúng cache, không phải mức thường.** Đo kỹ hơn sau đó:
CLI luôn nhét sẵn **~15,9k token preamble** của chính nó, và `--allowed-tools none` **không** bỏ được
phần này (sự kiện `init` vẫn liệt kê `Task`, `Bash`, `Read`, `Edit`… — cờ đó chặn *gọi* tool chứ không
chặn *khai báo* tool). Lần gọi nguội trả đủ 15,9k token ghi cache ≈ **$0,10**; lần gọi trong vòng 5 phút
sau đó đọc lại cache với giá ~10% nên mới xuống $0,01–0,03.

Nói ngắn: **~$0,10 cho lần gọi nguội, ~$0,01–0,02 mỗi lượt khi còn ấm.** Đừng dựng dự toán trên $0,025.

Còn con số **30.988 token / $0,19** đo lúc chạy CLI ngay trong repo thì vẫn đúng và vẫn đáng nhớ: phần
vượt trên 15,9k là `CLAUDE.md` + schema MCP bị nạp kèm. Sandbox cwd và `--strict-mcp-config` cắt được
phần đó, nhưng không cắt được 15,9k preamble.

## Cái giá phải trả — đọc trước khi quyết định đưa vào sản phẩm

1. **Điều khoản sử dụng.** Đăng nhập bằng subscription là để người ngồi code. Biến thành backend phục vụ
   end user là dùng subscription như API service. Demo nội bộ thì không ai để ý; **không mang lên
   production được**, và phải nói thẳng chỗ này trong ADR chứ đừng để BGK tự phát hiện.
2. **Auth sống trên máy chạy BE.** CLI đọc credential từ `~/.claude`. Container sạch là gọi phát chết ngay.
3. **~3,4s chi phí spawn mỗi lần**, cộng vào thời gian gọi mô hình. Luồng nghiệp vụ phải bất đồng bộ.
4. **Rate limit theo phiên.** Phải có hàng đợi; spike này giới hạn thô ở mức 1 request đồng thời.
5. **Không "miễn phí", chỉ là đã trả trước.** Gói Max không tính tiền theo lần gọi, nên demo không phát
   sinh hoá đơn. Nhưng thứ bị tiêu là hạn mức phiên, và hạn mức đó gắn với **tài khoản một con người**,
   không co giãn theo số end user. Đó là lý do hướng này không lên production được — không phải vì đắt.

## Nếu quyết định dùng

Không cần kiến trúc mới. `apps/api` đã có cổng `CLAIM_EXTRACTOR` với hai adapter
(`AnthropicClaimExtractor`, `FixtureClaimExtractor`) chọn theo biến môi trường trong
`claim-extractor.provider.ts`. Việc phải làm là thêm adapter thứ ba dùng đúng cơ chế spawn ở
`claude-cli.ts`, và thêm một nhánh vào provider đó. Phần prompt, parse và cửa kiểm câu trích giữ nguyên
của sản phẩm.

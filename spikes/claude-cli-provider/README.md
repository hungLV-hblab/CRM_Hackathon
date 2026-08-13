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
- **1.023 token vào / 432 token ra**, **$0,025** một lần gọi

Đo trước đó khi *chưa* tách sandbox cwd và chưa `--strict-mcp-config`: **30.988 token vào, $0,19** cho một
câu hỏi ba chữ. Phần chênh là context dự án + schema MCP bị nạp kèm. Con số này là lý do mấy cái cờ ở
bảng trên không phải trang trí.

## Cái giá phải trả — đọc trước khi quyết định đưa vào sản phẩm

1. **Điều khoản sử dụng.** Đăng nhập bằng subscription là để người ngồi code. Biến thành backend phục vụ
   end user là dùng subscription như API service. Demo nội bộ thì không ai để ý; **không mang lên
   production được**, và phải nói thẳng chỗ này trong ADR chứ đừng để BGK tự phát hiện.
2. **Auth sống trên máy chạy BE.** CLI đọc credential từ `~/.claude`. Container sạch là gọi phát chết ngay.
3. **~3,4s chi phí spawn mỗi lần**, cộng vào thời gian gọi mô hình. Luồng nghiệp vụ phải bất đồng bộ.
4. **Rate limit theo phiên.** Phải có hàng đợi; spike này giới hạn thô ở mức 1 request đồng thời.
5. **Không rẻ hơn API.** Nó chỉ đổi *cách trả tiền*, không đổi *số tiền*.

## Nếu quyết định dùng

Không cần kiến trúc mới. `apps/api` đã có cổng `CLAIM_EXTRACTOR` với hai adapter
(`AnthropicClaimExtractor`, `FixtureClaimExtractor`) chọn theo biến môi trường trong
`claim-extractor.provider.ts`. Việc phải làm là thêm adapter thứ ba dùng đúng cơ chế spawn ở
`claude-cli.ts`, và thêm một nhánh vào provider đó. Phần prompt, parse và cửa kiểm câu trích giữ nguyên
của sản phẩm.

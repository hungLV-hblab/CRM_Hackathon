# ADR-0039 — Tìm nguồn qua agent-runtime, ứng viên xác minh bằng cách mở thật từng địa chỉ

| | |
| --- | --- |
| **Ngày** | 2026-08-15 02:35 |
| **Giai đoạn** | Development |
| **Trạng thái** | Chấp nhận |
| **Người quyết định** | HungLV |
| **Prompt log** | *chưa có* |

## Bối cảnh

ADR-0038 đưa `CLAIM_EXTRACTOR` sang `agent-runtime`. Kiểm kê lại toàn bộ mã nguồn (`messages.create` / `new Anthropic(` / `SYSTEM_PROMPT` trên `apps/api/src` + `packages/contracts/src`) cho đúng **hai** chỗ gọi model bằng prompt + SDK, và sau ADR-0038 chỉ còn **một** chỗ chưa đi qua agent: `SOURCE_DISCOVERY`. Vùng 3 và vùng 4 của trần tự chủ không gọi LLM, nên đây là mảnh cuối.

Điểm khiến việc này **không** phải một lần đổi đường truyền như ADR-0038: `AgentClaimExtractor` được phép chỉ đổi transport vì mọi cửa kiểm làm nên độ tin của một phát hiện (I-1, I-2, câu trích nguyên văn) đã nằm sẵn bên `apps/api`. Không có gì phải thay.

`AnthropicSourceDiscovery` thì khác — **độ tin của nó nằm trong chính transport**. Nó thu mọi URL từ các block `web_search_tool_result` của cùng lượt gọi, rồi bỏ mọi URL model nêu ra mà không có trong đó. Bảo đảm là *"một máy tìm kiếm đã đứng ra bảo lãnh địa chỉ này"*, và comment tại chỗ nói rõ lý do: prompt có dặn đừng bịa, nhưng luật 1 không nhận lời dặn làm bảo đảm.

Claude CLI với `--output-format json` chỉ trả về văn bản cuối (`claude-cli.ts` đọc `result`, `session_id`, `duration_api_ms`, `usage`). **Không có block nào.** Nên bảo đảm đó không tái tạo được trên đường agent, và câu hỏi thật của ADR này không phải "chuyển thế nào" mà **"lấy gì thay chỗ nó"**.

## Phương án đã cân nhắc

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| **A. Agent trả ứng viên → API tự MỞ từng địa chỉ để xác minh** | Bảo đảm do **code của ta** kiểm với web thật, không suy ra từ payload model cũng tự viết. Dùng lại `fetchPage` + `assertPublicUrl` đã có test | Đổi bản chất bảo đảm. **Nới threat model SSRF**: URL đến từ model, không từ người đã đăng nhập. Thêm ≤12 request trên đường bấm nút | ✅ **Chọn** |
| B. Đổi `--output-format stream-json`, runtime bóc URL từ tool-result trả thêm `toolEvidence` | Giữ bảo đảm nguyên vẹn từng byte; `searched.has()` không phải sửa | Chạm `claude-cli.ts` — file đang đỡ `extract-claims` đã chạy được. Phụ thuộc hình dạng message stream của CLI, thứ đổi theo version. Một ngày trước nộp | ❌ Loại — đúng hình dạng nhưng sai thời điểm |
| C. Không chuyển, để `SOURCE_DISCOVERY` ở SDK và ghi ADR nói vì sao | Rủi ro bằng 0 | Mất lợi ích "sửa luật tìm nguồn không cần sửa TypeScript" cho riêng tính năng này | ❌ Loại — đội chọn đi tiếp |
| D. Chuyển và **bỏ** phép đối chiếu, tin prompt "không được bịa địa chỉ" | Ít code nhất | Đưa địa chỉ model tự nghĩ ra tới trước mặt Sales đang chuẩn bị tick. Luật 1 đổ, và đổ theo hướng **không có gì báo lỗi** | ❌ Loại thẳng — đây là cái bẫy, không phải phương án |

## Quyết định

Chọn **A**: bảo đảm được **thay**, không phải bỏ.

Mỗi ứng viên bị **fetch thật trước khi ai nhìn thấy**; địa chỉ không trả lời thì rụng. Bảo đảm mới đọc lên là *"địa chỉ này có thật và nó trả lời cho ta"*, và so với cũ thì:

- **yếu hơn một chỗ:** URL bịa mà rơi vào host có catch-all vẫn lọt, chỗ mà phép đối chiếu tìm kiếm sẽ bắt được.
- **mạnh hơn một chỗ:** do code ta kiểm với web thật, không suy ra từ payload mà model cũng là tác giả.

Kèm bốn điều, mỗi điều có test:

1. **Xác minh là REACHABILITY, không phải "trang có nói về công ty này không".** Đây là phân công của chính port: `ports/source-discovery.ts` nói người tick mới là người quyết định trang có đúng công ty mình hay không. So khớp tên công ty ở đây sẽ âm thầm bỏ nguồn thật — tên Nhật viết kanji đối với hồ sơ ghi romaji, bài báo chỉ nêu tên công ty mẹ — và giành lấy một phán đoán vốn để cho người. **Mở được là dữ kiện; đúng công ty là nhận định.**
2. **Cổng SSRF được siết cho riêng đường này.** `assert-public-url.ts` tự khai nó không phân giải DNS, và khai luôn cái bound làm rủi ro đó chấp nhận được: *"một lần fetch địa chỉ do người đã đăng nhập tự chọn cho công ty của họ, không bao giờ là URL từ phía không tin cậy"*. Đường agent **phá cái bound đó** — địa chỉ đến từ model đọc kết quả tìm kiếm, mà kết quả tìm kiếm là nội dung không ai vet. Nên `assert-resolved-host-public.ts` phân giải tên miền và từ chối nếu **bất kỳ** địa chỉ trả về là nội bộ, trước khi có socket nào mở. Chỉ áp cho đường này; đường người tự gõ giữ nguyên `assertPublicUrl`, nên `LiveCrawlSource` không đổi hành vi nào.
3. **Trang lớn hơn hạn mức vẫn tính là mở được.** Hạn mức 16KB là của ta, không phải tính chất của nguồn, và nội dung fetch ở đây bị **bỏ đi** chứ không lưu. Coi `too_large` là thất bại sẽ bỏ mọi bài báo dài — kiểu bỏ sót tệ nhất vì người dùng mất nguồn tốt mà trên màn hình không có dòng nào nói vì sao.
4. **Model không quyết định ta mở bao nhiêu socket.** Gộp trùng trước, cắt còn `MAX_CANDIDATES_PER_COMPANY * 2` = 12 để xác minh, giữ 6 đầu tiên đạt. Dư địa 2 ứng viên chết mà người dùng vẫn đủ sáu dòng.

Không đổi, và là chỗ dựa: adapter trả ứng viên chứ **không bao giờ trả nội dung trang**, không ghi `company_sources`, không tự cho ứng viên nào là đáng giữ. Cú tick của một con người vẫn là thứ duy nhất đưa một URL vào chỗ crawler nhìn thấy (ADR-0036, ADR-0037).

## Hệ quả

- **Hai adapter sống cạnh nhau xác minh theo hai cách khác nhau, và đó là bắt buộc chứ không phải chưa dọn.** SDK đối chiếu `web_search_tool_result`; CLI mở thật từng địa chỉ. Ghi ở `source-discovery.provider.ts` để người đọc sau không "thống nhất" chúng lại thành một.
- **`snippet` xuống cấp về nguồn gốc trên đường agent.** Ở SDK nó là đoạn text search trả về; ở đây nó là chữ model chép lại từ cái nó đọc, và **ta không kiểm được là chép đúng**. `SKILL.md` yêu cầu copy nguyên văn, nhưng theo đúng luật 1 thì một lời dặn không phải bảo đảm. Chưa xử lý: chưa có gì trên giao diện phân biệt snippet của hai đường. Ứng viên **không phải** claim nên chưa vi phạm luật 1, nhưng đây là món nợ có thật, ghi ra để không quên.
- Kéo theo: `parse-source-candidates.ts` tách ra dùng chung cho cả hai adapter — cùng nước đi `parse-claim-drafts.ts` đã làm cho port kia. Hai bản schema là hai câu trả lời cho "ứng viên hợp lệ là gì", và bản lệch luôn là bản không ai đọc.
- Kéo theo: `SKILL_TEMPLATE_VARS` tách thành một map duy nhất. Trước đó `main.ts` và test registry mỗi bên giữ một bản; thêm skill thứ hai làm test gãy ngay. Lần đó gãy to tiếng nên vô hại — thứ tự ngược lại (test render placeholder mà boot không render) mới là thứ đáng sợ, vì lúc đó prompt test bảo đảm không phải prompt model nhận.
- Món nợ ADR-0038 nêu — **hai bản luật rút phát hiện** giữa `anthropic-claim-extractor.ts` và `extract-claims/SKILL.md` — vẫn **còn nguyên**. ADR này không chạm tới nó; nó chỉ tránh nhân thêm bản thứ ba cho phần tìm nguồn.
- Đánh đổi chấp nhận: thêm ≤12 request HTTP (song song, tối đa 4 một lúc, timeout 5s) trên đường Sales bấm nút, cộng vào ~3,4s khởi động tiến trình của ADR-0038.
- **Còn hở, ghi ra để không ai tin quá:** resolver được hỏi ở `assert-resolved-host-public.ts` còn socket do `fetchPage` mở sau đó, nên một record hết TTL ở khoảng giữa có thể trả lời khác lần thứ hai. Bịt hẳn phải kiểm ở thời điểm connect, bên trong tầng dial. Cái đã bịt là ca thường gặp: tên phân giải về địa chỉ nội bộ **lúc này** thì bị từ chối trước khi có request nào ra khỏi máy.
- Sẽ phải xem lại nếu: CLI mở đường lấy được tool-result trong envelope JSON (lúc đó phương án B thành rẻ, và bảo đảm cũ quay lại được), hoặc nếu đo thấy tỉ lệ ứng viên bị bỏ vì `http_4xx` cao bất thường — đó là dấu model đang bịa nhiều hơn mức prompt kìm được.

## AI đã tham gia thế nào

- Vai trò AI: kiểm kê chỗ gọi model, tìm ra rằng bảo đảm chống bịa URL nằm trong transport chứ không trong prompt, và dựng ba phương án kèm đánh đổi.
- AI đề xuất gì mà đội **không** nghe: AI khuyến nghị phương án **C** (không chuyển, chỉ ghi ADR), lập luận theo lịch — feature freeze đã qua tối 14/08, vòng 1 chốt 15:00 ngày 15/08. Đội chọn **A** và nhận phần siết cổng SSRF đi kèm.
- AI cảnh báo đúng một chỗ và cảnh báo đó đổi thiết kế: bê nguyên pattern của ADR-0038 sang sẽ **xoá mất phép đối chiếu** (phương án D) và luật 1 đổ mà không có gì báo lỗi. Phần "thay bảo đảm" của quyết định này sinh ra từ đó.

## Đội đã verify bằng cách nào

Không đọc cho hợp lý, mà chạy:

1. `pnpm test:unit` — **512 test xanh** (trước là 499). Việc của ADR này đóng góp 12: 8 test cho `verify-candidates-reachable`, 14 cho `agent-source-discovery` + lựa chọn provider, 4 cho skill `discover-sources` (trừ đi 14 test cũ được viết lại). Test thứ 512 đến từ một việc **không thuộc ADR này**: `queue-runs-one-at-a-time.test.ts` chập chờn dưới tải nên đã sửa — `JobQueue(0)` quá sắc, nó kết án cả job **đầu tiên** vì cửa kiểm hạn chót chạy sau một microtask, và trên máy đang tải cái hop đó đo được > 0ms. Nay `JobQueue` nhận đồng hồ qua constructor nên hạn chót kiểm bằng đồng hồ quay tay, không đua với event loop. Chạy full suite **5 lần liên tiếp đều xanh** (trước đó hỏng khoảng 1/3 số lần). Trong đó chốt:
   - ứng viên trả `http_4xx` **bị bỏ trước khi tới tay người dùng**; mọi ứng viên chết → danh sách rỗng chứ không phải danh sách không ai mở được;
   - tên miền phân giải về địa chỉ nội bộ → bỏ, và `fetchPage` **không được gọi lần nào** (cổng chặn trước socket, không phán xử sau);
   - `too_large` → vẫn reachable;
   - model trả 30 ứng viên → xác minh đúng 12, giữ đúng 6;
   - URL trùng gộp **trước** khi xác minh; `javascript:` và `file:` rụng trước khi có socket;
   - worker có đủ biến agent vẫn **không** nhận `AgentSourceDiscovery`.
2. **17 test cũ của `anthropic-source-discovery` vẫn xanh** sau khi rút schema ra dùng chung — đây là phép kiểm hồi quy chính, vì đường SDK là đường đang chạy.
3. `pnpm typecheck` + `pnpm lint` — sạch.

Chưa verify: một lượt `discover-sources` **thành công với OAuth token thật** — cần token, và cần `docker compose up -d --build agent-runtime` để container nạp skill mới. Chưa chạy lúc viết ADR này. Cho tới khi chạy, đường agent của port này **coi như chưa được chứng minh đầu-cuối**; đường SDK và fixture không bị ảnh hưởng.

## Rollback

Xoá `AGENT_RUNTIME_URL` (hoặc `AGENT_TOKEN`) khỏi `.env` rồi `docker compose up -d api` — provider quay về `AnthropicSourceDiscovery` hoặc `FixtureSourceDiscovery`. **Dưới 1 phút**, không migration, không mất dữ liệu: ứng viên đã lưu ở `company_source_candidates` vẫn còn, `company_sources` chưa bao giờ bị đường này chạm tới.

# ADR-0042 — Đăng nhập trong container là đường xác thực thứ ba, và nó sống trong volume riêng

| | |
| --- | --- |
| **Ngày** | 2026-08-15 10:45 |
| **Giai đoạn** | Development |
| **Trạng thái** | Chấp nhận |
| **Người quyết định** | HungLV |
| **Prompt log** | *không có* |

## Bối cảnh

ADR-0038 dựng `agent-runtime` với đúng hai đường xác thực, cả hai là biến môi trường: `CLAUDE_CODE_OAUTH_TOKEN` (từ `claude setup-token`) hoặc `ANTHROPIC_API_KEY`. `childEnv()` kiểm hai biến đó trước khi spawn; thiếu cả hai thì ném `not_authenticated`.

Thực tế xuất hiện đường thứ ba mà thiết kế không lường: **chạy `claude /login` ngay trong container đang chạy**. Nó ghi credential vào `$HOME/.claude/.credentials.json` và **không đặt biến môi trường nào**. Container xác thực được thật — đo bằng cách gọi CLI bên trong nó với đúng môi trường `childEnv()` dựng (`PATH` + `HOME`), model trả lời bình thường — nhưng `/run/extract-claims` vẫn trả `502 not_authenticated`, vì cổng kiểm chỉ đọc biến môi trường và chặn trước khi tiến trình con kịp chạy.

Hai chỗ hỏng theo cùng một nguyên nhân: `/health` và log boot suy ra `authMode` bằng chính hai biến đó, nên chúng trả `api_key` cho một tiến trình đang chạy trên phiên đăng nhập — đúng thứ ADR-0014 nói không được phép đoán.

## Phương án đã cân nhắc

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| A. Nhận thêm đường `cli_login`: có `$HOME/.claude/.credentials.json` là đã xác thực; `authMode` thành ba giá trị + `null` | Đúng thực tế CLI; vẫn hỏng-sớm khi không có gì; `.env` vẫn thắng nếu điền | Thêm một nhánh và một lần chạm đĩa mỗi lượt chạy | ✅ **Chọn** |
| B. Bỏ hẳn cổng kiểm, để CLI tự báo lỗi rồi `classifyCliFailure` phân loại | Ít code nhất; không bao giờ sai về đường xác thực | Mỗi lần cấu hình thiếu phải trả ~3,4s khởi động tiến trình mới biết; mất thông điệp nói rõ thiếu **cái gì** | ❌ Loại — ADR-0041 muốn thiếu cấu hình lộ ra sớm và nói được tên |
| C. Đọc nội dung `.credentials.json`, kiểm hạn dùng | Biết trước token hết hạn | Tiến trình này đọc một secret nó không có lý do đọc; format file là nội bộ của CLI, đổi lúc nào không báo | ❌ Loại — thêm bề mặt rủi ro để lấy một thông tin CLI đằng nào cũng trả |
| D. Bảo người dùng bỏ đăng nhập trong container, chạy `claude setup-token` rồi điền `.env` | Không sửa dòng code nào | Bắt người đã có credential đúng đi làm lại việc đã làm, chỉ vì code chưa biết nhìn | ❌ Loại — sửa người thay vì sửa lỗi |
| **Chỗ ở của credential** | | | |
| A′. Volume có tên gắn vào `$HOME` riêng (`/claude-home`) | Đăng nhập sống qua `up --build`; compose không nhắc tên thư mục nào của host; checkout mới vẫn rỗng = tắt | `pnpm reset` (`down -v`) xoá luôn phiên đăng nhập | ✅ **Chọn** |
| B′. Giữ `HOME=/tmp`, không mount gì | Không đổi hạ tầng | Mỗi lần rebuild mất đăng nhập; lỗi quay lại đúng như cũ và trông y hệt lỗi code | ❌ Loại — bản vá tự hỏng ở lần build sau |
| C′. Mount `~/.claude` của host vào container | Không phải đăng nhập lại lần nào | Đưa đường dẫn credential cá nhân vào compose đã commit — đúng phương án D bị ADR-0038 loại | ❌ Loại — đã loại một lần, lý do không đổi |

## Quyết định

Chọn **A + A′**. Tiêu chí so là **cái gì hỏng khi cấu hình thay đổi**, không phải số nhánh code.

`resolveAuthMode()` trả `'oauth' | 'api_key' | 'cli_login' | null`, theo đúng thứ tự đó — biến môi trường thắng phiên trên đĩa, để `.env` vẫn là chỗ quyết định. `childEnv()` chỉ ném khi cả ba đều không có, và **chỉ truyền xuống đúng credential đang thắng**, nên `/health` không thể nói một đằng còn tiến trình con chạy một nẻo. `HOME` được truyền xuống vì trên đường `cli_login` nó *chính là* credential.

Một nguồn sự thật: `main.ts` hỏi `resolveAuthMode()` thay vì tự đọc lại biến môi trường. Hai bản suy luận song song chính là thứ vừa lệch nhau.

`$HOME` của container chuyển từ `/tmp` sang `/claude-home` có volume riêng. Không dùng `/tmp` vì đó cũng là nơi `claude-cli.ts` mkdtemp thư mục sandbox — mount đè lên sẽ giữ rác scratch vĩnh viễn cạnh credential.

Ranh giới của ADR-0038 không đổi: container này vẫn giữ credential Claude và **không** giữ biến CSDL nào. Có thêm một test khoá đúng điều đó vào môi trường tiến trình con.

## Hệ quả

- Kéo theo: `authMode` của `/health` có thêm `cli_login` và có thể là `null` ("chưa có credential" là một trạng thái, không phải "đang chạy bằng key"). `agent-runtime-client.ts` đổi kiểu thành `string | null`; chưa nơi nào đọc trường này nên không vỡ gì.
- Kéo theo: đăng nhập lần đầu là `docker compose exec agent-runtime claude /login`, ghi vào volume `agent-claude-home`.
- Đánh đổi chấp nhận: `pnpm reset` xoá luôn phiên đăng nhập. Đúng ý — "reset" nghĩa là không để lại gì của stack này trên máy, mà đây là credential thật.
- Đánh đổi chấp nhận: một lần `existsSync` mỗi lượt chạy, cạnh ~3,4s khởi động tiến trình.
- Sẽ phải xem lại nếu: đưa lên production. Lúc đó bỏ cả OAuth lẫn đăng nhập trong container, quay về API key — đúng điều kiện ADR-0038 đã nêu.

## AI đã tham gia thế nào

- Vai trò AI: chẩn đoán nguyên nhân và sinh phương án.
- AI đề xuất gì mà đội **không** nghe: đề xuất mount `~/.claude` của host cho nhanh. Loại — ADR-0038 đã loại đúng phương án đó, và "nhanh hơn" không phải lý do mới.
- AI sai ở đâu: ban đầu định vá mỗi hàm `childEnv()` rồi coi là xong. Thiếu hai chỗ: `authMode` ở `/health` + log boot vẫn nói sai, và credential nằm trong `/tmp` của container sẽ bay mất ngay ở lần `up --build` kế tiếp — tức là chính lần build mang bản vá vào.

## Đội đã verify bằng cách nào

Không đọc cho hợp lý, mà chạy:

1. **Đo trước khi sửa:** gọi CLI trong container với đúng môi trường `childEnv()` dựng — `env -i PATH=... HOME=/tmp claude -p ...` — trả envelope hợp lệ (`"result":"Rồi."`). Chứng minh credential tốt, chỉ cổng kiểm sai. Đây là bằng chứng phủ định giả thuyết "token hỏng".
2. **Test đỏ trước, xanh sau:** tắt nhánh `cli_login` thì 3/6 test của `auth-accepts-login-inside-container.test.ts` đỏ; bật lại thì xanh. Test không chỉ khẳng định đường mới chạy, mà còn khoá `HOME` phải được truyền xuống — thiếu nó thì chỉ hỏng khi gặp subscription thật, test kiểu "có ném không" sẽ không thấy.
3. `pnpm test:unit` — **532 test xanh** (47 file). `pnpm typecheck`, `pnpm lint` — sạch.
4. **Dựng image và gọi thật, đúng lệnh đã hỏng:**
   - log boot: `auth: phiên `claude /login` trong container ($HOME/.claude)`
   - `GET /health` → `"authMode":"cli_login"`
   - `POST /run/extract-claims` → **200**, hai phát hiện kèm câu trích, `19369` token vào / `160` ra, `8029ms`. Trước khi sửa chính lệnh này trả `502 not_authenticated`.
5. **Kiểm tính bền:** `docker compose up -d --force-recreate agent-runtime` rồi hỏi lại `/health` → vẫn `cli_login`. Đây là thứ phương án B′ không có.
6. **Kiểm ranh giới ADR-0038 chưa lỏng:** test khoá cứng môi trường tiến trình con đúng bằng `['HOME','PATH','USERPROFILE']` — không có biến CSDL nào lọt xuống.

## Rollback

Trả `resolveAuthMode()` về hai nhánh biến môi trường và bỏ `volumes:` của service là xong — không migration, không mất dữ liệu, dưới 1 phút. Muốn giữ nguyên code mà tắt đường thứ ba: `docker compose exec agent-runtime rm /claude-home/.claude/.credentials.json`, lượt chạy kế tiếp trả `not_authenticated` như cũ.

# Review — Đăng nhập Claude qua giao diện

Ngày 15/08/2026 12:25 · nhánh `feat/agent-runtime-walking-skeleton` · plan [260815-1058](../260815-1058-dang-nhap-claude-qua-ui-trong-docker/plan.md) · ADR-0043

Review độc lập (`code-reviewer`) chạy sau khi 4 pha xong. **Mọi phát hiện HIGH và phần lớn MEDIUM đã sửa trong cùng phiên**, kèm test khoá lại. Bảng dưới là trạng thái cuối.

## Ranh giới — kiểm lại, đều đứng

| Bất biến | KL | Bằng chứng |
| --- | --- | --- |
| ADR-0038: mã uỷ quyền/credential không đi qua `api` | ✅ | `api` chỉ gọi `signTicket()`; chặng 2–3 đi thẳng `/agent-auth/*` |
| `/run` đóng, vé ≠ Bearer (cả hai chiều) | ✅ | Caddy chỉ `handle /agent-auth/*`; có test hai chiều |
| Thiếu `AGENT_TOKEN` = tắt, khoá HMAC rỗng không mở cửa | ✅ | `if (!secret) throw` trước mọi HMAC |
| Mã/token không vào log, body, query, `status()` | ✅ | `onExit` trả mã thoát chứ không trả output |
| `resolveAuthMode()` vẫn là nguồn sự thật duy nhất | ✅ | `captureCredential` điền env rồi **đọc lại** |
| Không hồi quy `/run` `/health` | ✅ | Trích xuất `main.ts` → `http-routes.ts` nguyên văn; `/health` chỉ **thêm** trường |

## Đã sửa

| # | Mức | Lỗi | Sửa |
| --- | --- | --- | --- |
| H1 | **Cao** | Đăng xuất `delete process.env.CLAUDE_CODE_OAUTH_TOKEN` vô điều kiện → một cú bấm làm **cả hệ thống** mất quyền gọi Claude tới khi restart. Trái docstring + panel. **Test cũ xanh vì chỉ kiểm `ANTHROPIC_API_KEY`** — biến code không đụng | Chỉ xoá khi khớp đúng token đã lưu trên đĩa; +2 test cho cả hai chiều |
| H2 | **Cao** | Thoát mã 0 khi chưa có URL bị coi là thành công → `start()` treo vĩnh viễn (deadline đã huỷ), `/health` báo `done` | Mã 0 chỉ thành công khi state là `finishing`; +2 test |
| H3 | **Cao** | `writeFileSync` ném trong `onExit` = uncaught (ngoài promise chain) → `restart: unless-stopped` dựng lại container giữa demo | `try/catch`, xuống nước chứ không sập; +1 test dùng lỗi ghi đĩa **thật** |
| M2 | TB | Thiếu cấu hình phía `api` báo `reachable: false` → panel nói "kiểm container" trong khi container khoẻ. Đúng cái đảo ngược mà DTO cảnh báo | `reachable: true, enabled: false` |
| M1 | TB | Reload trang mất phiên: `awaitingCode` chỉ dựa `start.data` → admin kẹt 5' (nút Huỷ nằm trong khối không render) | Suy từ `status.loginState`; thêm `loginUrl` vào DTO |
| M3 | TB | Golden vector phía `api` **không gọi `signTicket`** → tautology về `node:crypto`, xanh dù format đổi | `signTicket` nhận nonce tiêm vào; test gọi hàm thật |
| M6 | TB | Huỷ là fire-and-forget, `start.reset()` chạy trước request → UI lệch server | Thành mutation thật, chỉ dọn state sau khi server đồng ý |
| L1 | Thấp | Vé không chặn hạn quá xa → nonce chiếm chỗ vĩnh viễn trong `spent` | Chặn TTL > 6'; +1 test |
| L2 | Thấp | Comment nói "không còn gì để rò" — sai, PTY echo stdin về buffer | Sửa comment cho đúng sự thật |
| L6 | Thấp | Huỷ tay bị ghi là `deadline` → `/health` kể sai chuyện | Thêm reason `aborted`, map 410 |

## Chưa sửa — cắt có chủ ý

| # | Việc | Vì sao hoãn |
| --- | --- | --- |
| M4 | Cấp vé và Đăng xuất **không ghi audit** → không truy được admin nào đổi credential hệ thống | Cần nối service audit vào controller; đã ghi vào phần *Hệ quả* của ADR-0043 thay vì im lặng. Luật 6/7 CLAUDE.md hỏi đúng câu này |
| M5 | `loginEnv()` không đặt `COLUMNS`/`LINES`/`TERM`; nếu Ink wrap URL thì bóc hỏng | **Đã bác bằng bằng chứng**: capture thật trong chính image cho thấy URL ra nguyên một dòng, và e2e bấm nút thật vẫn lấy đúng URL. Sửa sẽ phải nới test khoá `loginEnv()` đúng 3 khoá (đang gánh ADR-0038) |
| L4 | 503 "đang tắt" trả trước khi kiểm vé → người lạ phân biệt được bật/tắt | Có chủ ý, phục vụ healthcheck |
| L5 | `readJson` không giới hạn kích thước body | Có sẵn từ trước; vé kiểm trước nên chỉ người có vé mới tới được |

## Bài học đáng ghi cho vòng 2

**Không lỗi nào trong năm lỗi lộ ra khi đọc lại code.** Bốn cái do test bắt. Cái thứ năm (H1) do người review đọc **lời hứa trong comment rồi đi kiểm xem test có thật sự chứng minh nó không** — và nó không.

Hai chỗ mắc cùng một kiểu: *assertion hẹp hơn lời hứa ngay phía trên nó* (H1 kiểm nhầm biến; M3 kiểm nhầm thứ). Đáng soi lại ở mọi chỗ khác trong repo có comment khẳng định một bất biến.

## Trạng thái cuối

- `pnpm test:unit` — **599 xanh** (51 file; 532 → 599)
- `pnpm typecheck` · `pnpm lint` — sạch
- e2e `claude-login-panel.spec.ts` — 2/2 xanh trên stack thật sau khi sửa
- Dựng lại image, kiểm lại: `/run` vẫn 307 về `/dang-nhap` từ `:8080`; `agent-status` trả `cli_login`

## Câu hỏi chưa giải quyết

1. `claude setup-token` có bao giờ thoát mã 0 mà không in URL không (ví dụ khi đã đăng nhập sẵn)? Quyết định H2 là ca hiếm hay là đường re-login thường gặp.
2. M4 — ghi audit cho cấp vé/Đăng xuất: làm trong vòng 1 hay chấp nhận hoãn?
3. `.env` trên máy dev trỏ `DATABASE_URL_*` vào `localhost:5432` trong khi compose publish `5403` → `pnpm seed` và e2e hỏng nếu không override. Không sửa hộ vì là file secret không commit.

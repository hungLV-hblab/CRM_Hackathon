# Cấu hình `settings.json` cho Hackathon #1

Tài liệu dành cho **người tham gia**. Mục tiêu: mất 5 phút để máy bạn gửi dữ liệu
sử dụng Claude Code về hệ thống đo đạc, để Ban tổ chức chấm điểm bằng **bằng
chứng thật** thay vì tự khai báo.

---

## Phần 1 — Cấu hình cơ bản (bắt buộc)

### Bước 1. Lấy file `settings.json`

Mở **https://tokens.hblab.ai:8443**, đăng nhập bằng tài khoản Google công ty
(`@hblab.vn`), bấm tải `settings.json`.

Trang này tự sinh **token riêng của bạn** — không dùng chung, không xin ai cả.

### Bước 2. Đặt file vào đúng chỗ

| Hệ điều hành | Đường dẫn |
| --- | --- |
| macOS / Linux | `~/.claude/settings.json` |
| Windows | `%USERPROFILE%\.claude\settings.json` |
| WSL | `~/.claude/settings.json` **bên trong WSL** (cấu hình phía Windows không có tác dụng) |

### Bước 3. Nếu bạn ĐÃ có `settings.json` — hãy merge, đừng ghi đè

File tải về là một file hoàn chỉnh. Ghi đè sẽ **xoá mất** `hooks`,
`permissions`, `model`… bạn đang có. Chỉ copy khối `env` sang file cũ:

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_METRICS_EXPORTER": "otlp",
    "OTEL_LOGS_EXPORTER": "otlp",
    "OTEL_EXPORTER_OTLP_PROTOCOL": "grpc",
    "OTEL_EXPORTER_OTLP_ENDPOINT": "https://otel.hblab.ai:4317",
    "OTEL_EXPORTER_OTLP_HEADERS": "Authorization=Bearer TOKEN_CUA_BAN",
    "OTEL_RESOURCE_ATTRIBUTES": "developer=ten_cua_ban",
    "OTEL_LOG_USER_PROMPTS": "1",
    "OTEL_LOG_ASSISTANT_RESPONSES": "1"
  },
  "hooks": { "…giữ nguyên phần cũ của bạn…": {} }
}
```

### Bước 4. Khởi động lại Claude Code

Metrics lên trong ~60 giây, log sự kiện trong ~5 giây.

### Bước 5. Kiểm tra

Quay lại trang portal — trang tự báo bạn đã kết nối hay chưa. Nếu chưa thấy gì
sau 2 phút, xem mục [Sự cố thường gặp](#sự-cố-thường-gặp) ở cuối.

### Vì sao có dòng `developer=`?

Một tài khoản Claude ở đây đang được 2–3 người dùng chung. Mọi nhãn khác
(`user.email`, `organization.id`) đều lấy từ tài khoản đó, nên nếu chỉ dựa vào
chúng thì **công của cả nhóm dồn vào một người**. `developer=` lấy từ tài khoản
Google bạn đăng nhập portal, nên nó là **thứ duy nhất tách được từng người**.

> **Thiếu dòng này = điểm của bạn có thể bị tính sang người khác.** Nếu bạn tải
> `settings.json` từ lâu rồi, hãy tải lại — file cũ không có dòng này.

---

## Phần 2 — Hai hạng mục log chi tiết

Đây là phần quyết định BTC chấm được những tiêu chí nào. Hai hạng mục **độc
lập** với nhau, bật bằng hai cơ chế khác nhau, và mất một hạng mục thì mất hẳn
một nhóm tiêu chí chứ không phải chấm được ít hơn.

### Hạng mục 1 — Nội dung prompt & phản hồi

```json
"OTEL_LOG_USER_PROMPTS": "1",
"OTEL_LOG_ASSISTANT_RESPONSES": "1"
```

**Ai bật:** portal tự ghi sẵn vào file bạn tải. Bạn **không phải làm gì**.

**Ghi lại gì:** nguyên văn câu bạn gõ cho Claude, và nguyên văn câu Claude trả
lời.

**Nếu tắt:** trường vẫn được gửi nhưng giá trị là `<REDACTED>` — API chấm điểm
quy nó về `null` và báo `content_available: false`. BTC biết bạn có gõ bao nhiêu
ký tự, nhưng không biết bạn gõ gì.


### Hạng mục 2 — Chi tiết lời gọi tool

```json
"OTEL_LOG_TOOL_DETAILS": "1"
```

**Ai bật:** **bạn tự thêm bằng tay**, vào chính `settings.json` của mình, trên
máy mình. Portal **không bao giờ** phát dòng này.

Lý do: file portal phát đi giống hệt nhau cho **toàn công ty**. Nếu nhét cờ này
vào đó thì lần tải kế tiếp, cả công ty bị bật ghi log lịch sử shell mà không ai
quyết định cả. Thêm tay thì chậm hơn — và đó chính là mục đích: người sở hữu
những dòng lệnh đó là người bấm bật.

> **Lưu ý:** tải lại `settings.json` từ portal sẽ **xoá mất dòng này**. Portal
> chỉ biết những gì nó phát ra. Tải lại thì thêm lại.

**Ghi lại gì:** tham số của mọi lời gọi tool — dòng lệnh `Bash` bạn chạy, đường
dẫn file `Read`/`Edit`, và **nội dung** file `Write`.

**KHÔNG ghi lại:** *kết quả* trả về của tool. `Read` ghi đường dẫn chứ không ghi
nội dung file đọc được; `Bash` ghi câu lệnh chứ không ghi stdout. Đây là giới
hạn của client, không phải thiết lập ở server — không có cách nào bật.

### Bảng so sánh

| | Hạng mục 1 — Prompt & phản hồi | Hạng mục 2 — Chi tiết tool |
| --- | --- | --- |
| Biến | `OTEL_LOG_USER_PROMPTS`, `OTEL_LOG_ASSISTANT_RESPONSES` | `OTEL_LOG_TOOL_DETAILS` |
| Ai bật | Portal ghi sẵn | Bạn thêm tay |
| Nội dung | Chữ bạn gõ + chữ Claude trả lời | Tham số tool: lệnh shell, đường dẫn, nội dung file ghi |
| Chấm được | Chất lượng prompt, số vòng lặp, cách sửa hướng | **Tên skill tự viết**, cách dùng công cụ, lệnh thực chạy |
| Nếu thiếu | `prompt: null`, `content_available: false` | `input: null`, skill hiện là `custom_skill` |
| Lưu bao lâu | 14 ngày | 14 ngày |

### Một cờ không bao giờ được bật

`OTEL_LOG_RAW_API_BODIES` — gửi **toàn bộ context window mỗi lượt**, bao gồm nội
dung của mọi file Claude đã đọc. Khoảng 100 lần dung lượng, và đồng nghĩa với
việc đẩy phần lớn codebase lên hệ thống log. Không có ở đâu trong hệ thống này,
không có công tắc nào bật được. Đừng tự thêm.

---

## Checklist trước ngày thi

- [ ] Tải `settings.json` **mới** từ portal (file cũ có thể thiếu `developer=`)
- [ ] Merge vào file cũ nếu đã có `hooks`/`permissions`
- [ ] Có dòng `"OTEL_RESOURCE_ATTRIBUTES": "developer=..."` với đúng tên bạn
- [ ] Có `OTEL_LOG_USER_PROMPTS` và `OTEL_LOG_ASSISTANT_RESPONSES`
- [ ] **Tự thêm** `"OTEL_LOG_TOOL_DETAILS": "1"` — nếu không, skill bạn viết
      không chấm được
- [ ] Khởi động lại Claude Code
- [ ] Portal báo đã kết nối
- [ ] Rà lại: có secret nào bạn hay gõ thẳng vào dòng lệnh không? Chuyển sang
      biến môi trường / file `.env` trước khi thi

---

## Sự cố thường gặp

| Triệu chứng | Nguyên nhân |
| --- | --- |
| Không thấy dữ liệu gì | Chưa khởi động lại Claude Code; hoặc file đặt sai chỗ (WSL: phải nằm trong WSL) |
| JSON lỗi, Claude Code không đọc file | Merge tay bị thừa/thiếu dấu phẩy. Kiểm tra: `python3 -m json.tool ~/.claude/settings.json` |
| Có dữ liệu nhưng không có tên bạn | Thiếu `developer=` — tải lại từ portal |
| Skill của bạn hiện là `custom_skill` | Chưa bật `OTEL_LOG_TOOL_DETAILS`, hoặc vừa tải lại `settings.json` và bị mất dòng đó |
| Gửi được ở nhà, không gửi được ở văn phòng | Mạng chặn HTTP/2 (gRPC cần nó). Đổi **cả hai** dòng sang `"OTEL_EXPORTER_OTLP_PROTOCOL": "http/protobuf"` và cổng `:4318` |
| Đăng nhập portal báo từ chối | Phải là tài khoản `@hblab.vn`, không dùng tài khoản cá nhân |

Còn vướng: hỏi trong kênh của BTC, kèm nội dung `settings.json` **đã che token**.

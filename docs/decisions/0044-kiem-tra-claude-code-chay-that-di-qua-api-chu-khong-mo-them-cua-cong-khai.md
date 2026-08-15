# ADR-0044 — Kiểm tra Claude Code **chạy thật** đi qua `api`, chứ không mở thêm cửa công khai

| | |
| --- | --- |
| **Ngày** | 2026-08-15 13:20 |
| **Giai đoạn** | Development |
| **Trạng thái** | Chấp nhận |
| **Người quyết định** | HungLV |
| **Prompt log** | [brainstorm-260815-1311](../../plans/reports/brainstorm-260815-1311-xac-nhan-claude-code-chay-that-report.md) |
| **Nối tiếp** | [ADR-0043](0043-dang-nhap-claude-qua-giao-dien-va-vi-sao-api-chi-ky-ve.md) · [ADR-0042](0042-dang-nhap-trong-container-la-duong-xac-thuc-thu-ba-va-no-song-trong-volume-rieng.md) · [ADR-0041](0041-thieu-cau-hinh-la-mat-nang-luc-khong-phai-chet-va-vi-sao-khong-ghi-audit-tu-day.md) |

## Bối cảnh

ADR-0043 cho phép đăng nhập Claude từ giao diện. Nó chạy được — nhưng sau khi bấm xong, thứ duy nhất người dùng thấy là một badge lấy từ `resolveAuthMode()`, và hàm đó chỉ kiểm **sự tồn tại**: biến môi trường có mặt, hoặc file `.credentials.json` có mặt.

Comment ngay trong `claude-cli.ts:70` thừa nhận điều này là **cố ý**: *"An expired session looks identical from here and is supposed to."* Đúng ở tầng đó — phán xét một credential không phải việc của tiến trình đọc nó. Nhưng hệ quả ở tầng giao diện là badge xanh nói dối trong bốn tình huống:

| Tình huống | Panel hiện | Lượt chạy thật |
| --- | --- | --- |
| Credential hết hạn | 🟢 | `not_authenticated` |
| Token bị thu hồi | 🟢 | `not_authenticated` |
| Hết quota | 🟢 | `quota_exhausted` |
| Thiếu binary `claude` trong image | 🟢 | `spawn_failed` |

Luật 4 của `CLAUDE.md`: **một dòng sai tệ hơn một dòng để trống.** Và cụ thể hơn: **hết credential và hết quota hiện nay trông y hệt nhau**, trong khi hai sự cố này đòi hai hành động ngược nhau — một cái bảo "đăng nhập lại", cái kia bảo "tuyệt đối đừng bấm lại".

Trạng thái bằng chứng, ghi thẳng vì vòng 2 sẽ hỏi: **suy luận từ code, chưa có sự cố thật.** Chưa ai bị badge xanh lừa giữa demo. Nhưng bốn đường hỏng ở trên đọc thẳng ra được từ `errors.ts` và `claude-cli.ts` mà không cần chạy thử.

## Phương án đã cân nhắc

### Trục 1 — bằng chứng "đang hoạt động" lấy từ đâu

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| A. Đọc credential kỹ hơn — parse hạn trong `.credentials.json` | Không tiêu quota | Không bắt được `quota_exhausted` lẫn `spawn_failed`; buộc tiến trình đọc một bí mật nó không có lý do đọc, lật lại chính comment `claude-cli.ts:70` | ❌ Loại |
| **B. Chạy thật một lượt `claude -p`** | Bắt được **cả bốn** kiểu hỏng; sinh số kiểm chứng được thay vì một dấu chấm xanh | ~4–8s và một lượt quota nhỏ | ✅ **Chọn** |

### Trục 2 — ai kích hoạt lượt chạy đó

Đây là trục quan trọng nhất, vì nó quyết định một endpoint **tiêu tiền thật** nằm sau cổng nào.

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| C. `POST /agent-auth/verify` trên runtime, gác bằng vé HMAC | Ít hop nhất; dùng lại đúng cái vé vừa dùng để đăng nhập | Đặt một endpoint **tiêu quota** vào đúng họ route mà Caddy forward ra ngoài. Comment đầu `http-routes.ts` dựng hai tiền tố riêng chính là để Caddyfile gọi tên được `/agent-auth` mà không gọi `/run`; phương án này mở lại cửa đó bằng lối sau. Vé sống 5 phút và bấm liên tục được | ❌ Loại |
| **D. `POST /api/settings/agent-check` (admin) → `api` gọi `/run/health-check` bằng `Bearer AGENT_TOKEN`** | Trình duyệt **không bao giờ** chạm được cửa tiêu quota; Caddyfile không đổi một dòng; dùng lại cổng gác `Bearer` đã có và đã có test hồi quy | Thêm một hop; `api` là bên châm ngòi tiêu quota | ✅ **Chọn** |

Điểm phải nói rõ vì nó dễ bị đọc nhầm thành lật ADR-0038: **`AGENT_TOKEN` không phải credential Claude.** Nó là token liên dịch vụ mà `api` vốn đã cầm để ký vé, và `api` vốn đã proxy `/health` của runtime. Không có bí mật Claude nào đi qua `api` trong luồng này — chỉ có một tên mode, vài con số, và câu model trả lời. Ranh giới của ADR-0038 giữ nguyên.

### Trục 3 — prompt kiểm tra sống ở đâu

| Phương án | Nhược | Kết luận |
| --- | --- | --- |
| E. Hằng số trong `claude-cli.ts` | Nhét prompt vào TypeScript — đúng thứ luật 2 của `apps/agent-runtime/CLAUDE.md` cấm; mất khả năng để người không đọc code review nó | ❌ Loại |
| **F. Skill dữ liệu `skills/health-check/`** | Thêm 2 file | ✅ **Chọn** — `allowedTools: []` tự hiện trong `/health.grants`, nên "skill này không với tới cái gì" là thứ **soi được từ bên ngoài** chứ không phải lời hứa |

### Trục 4 — ghi nhận cái gì

| Phương án | Nhược | Kết luận |
| --- | --- | --- |
| G. Chỉ ghi kết quả lượt `health-check` | Bỏ qua bằng chứng mạnh hơn: một lượt `extract-claims` nghiệp vụ vừa chạy xong chứng minh nhiều hơn một lượt ping giả | ❌ Loại |
| **H. Ghi kết quả **mọi** lượt `/run/*`, thành công lẫn thất bại** | Không có | ✅ **Chọn** |

Hệ quả đáng ghi lại: **nút "Kiểm tra ngay" không phải nguồn sự thật.** Nguồn sự thật là lượt chạy gần nhất, bất kể ai gây ra nó; cái nút chỉ là cách rẻ nhất để ép một lượt xảy ra khi chưa có lượt nào.

### Trục 5 — kết quả lưu ở đâu

| Phương án | Nhược | Kết luận |
| --- | --- | --- |
| I. Ghi CSDL | Sinh trạng thái cũ kiểu "đã kiểm tra 3 ngày trước" trên một container đã bị dựng lại; và ADR-0041 đã chốt runtime **không ghi audit** | ❌ Loại |
| J. Không lưu, chỉ hiện trong phiên bấm | Reload là mất; tab thứ hai mù | ❌ Loại |
| **K. Bộ nhớ tiến trình runtime, lộ qua `/health.lastRun`** | Chết theo container | ✅ **Chọn** — và chết theo container là **đúng**: một container mới thì thật sự chưa ai kiểm tra nó bao giờ |

## Quyết định

Chọn **B + D + F + H + K**.

```
Trình duyệt (admin, đã đăng nhập CRM)
 1. POST /api/settings/agent-check          → api kiểm JWT + @Roles('admin')
                                              thiếu AGENT_TOKEN → 503 (tắt, không phải hỏng)
 2. api → POST agent-runtime/run/health-check
          Authorization: Bearer AGENT_TOKEN   (cửa này Caddy KHÔNG forward, và không được forward)
 3. runtime chạy `claude -p` với policy rỗng tool, maxTurns 1
 4. runtime ghi lastRun vào bộ nhớ — MỌI lượt /run/*, thành công lẫn thất bại
 5. api trả kết quả xuống; reason của lỗi đi xuống NGUYÊN VẸN, không hoá thành 500
 6. panel vẽ bằng chứng: văn bản model trả lời + elapsed/api ms + token + session + authMode thật
```

Panel **tự bắn** bước 1 ngay sau khi đăng nhập thành công, và có thêm nút bấm tay cho các lần sau.

Ba trạng thái hiển thị, không phải hai: **chưa kiểm tra lần nào** · đạt · hỏng kèm lý do. "Chưa kiểm tra" không được vẽ màu đỏ.

Mỗi `AgentFailureReason` ánh xạ sang một câu tiếng Việt **kèm việc phải làm**, vì đó là toàn bộ giá trị của quyết định này: `not_authenticated` bảo đăng nhập lại, `quota_exhausted` bảo **đừng** bấm lại, `spawn_failed` bảo đây là lỗi image chứ không phải lỗi đăng nhập.

## Hệ quả

**Được:**
- Badge trạng thái thôi khẳng định thứ nó không biết; luật 4 được giữ ở cả tầng vận hành.
- Hết credential và hết quota trở thành hai màn hình khác nhau.
- Bằng chứng là **số kiểm chứng được**, không phải dấu chấm xanh — đúng tinh thần "không assert, cho xem nguồn" của cả sản phẩm, và là câu trả lời soạn sẵn cho vòng 2.
- `/run` vẫn không có mặt trong Caddyfile.

**Mất:**
- Mỗi lượt kiểm tra tiêu một lượt quota nhỏ và ~4–8s.
- Luồng đăng nhập dài thêm chừng đó.
- Kết quả kiểm tra chết theo container (đánh đổi có chủ ý, xem trục 5).

**Không đổi:** Caddyfile · `/agent-auth/*` · cổng gác `Bearer` của `/run/*` · ranh giới credential của ADR-0038 · trần tự chủ của AI (không mở thêm vùng nào; skill này không có tool và không chạm dữ liệu chính thức).

**Kiểm chứng bằng test:** `/run/*` vẫn 401 khi thiếu `Bearer` · Sales gọi `/settings/agent-check` → 403 · thiếu `AGENT_TOKEN` → 503 chứ không 500 · runtime chết → `reachable:false` chứ không blank màn admin · `lastRun` ghi cả trường hợp thất bại kèm `reason`.

## Đã chạy thật, không phải suy luận

Ngày 15/08, trên stack compose ở `:8080` sau khi dựng lại image:

| Kiểm | Kết quả |
| --- | --- |
| `/health` của runtime | `grants["health-check"]` = `[]`, và **không có** `lastRun` khi chưa lượt nào chạy |
| `POST /api/settings/agent-check` bằng phiên admin | `200` — `text: "OK"`, `elapsedMs 6154`, `apiMs 1511`, `16.084` token vào / `4` ra, `sessionId 4d830278…`. **Một lượt Claude thật.** |
| `/health.lastRun` sau đó | đủ trường, `authMode: "oauth"` — credential **thật sự chạy**, không phải cái đang cấu hình |
| `GET /api/settings/agent-status` | chuyển tiếp nguyên `lastRun` ⇒ reload trang và tab thứ hai thấy cùng một thứ |
| Sales gọi `POST /api/settings/agent-check` | **403** |
| `POST :8080/run/health-check` từ ngoài | **307** về trang đăng nhập — cửa tiêu quota vẫn không ló ra |

622 unit test xanh (600 → 622), `typecheck` và `lint` sạch, 3/3 e2e của panel xanh trên stack thật.

**Điểm chưa verify, không giấu:** các nhánh hỏng (`quota_exhausted`, `not_authenticated`, `spawn_failed`) mới chỉ được khoá bằng unit test ở cả hai phía, chưa gây ra được trên stack thật — làm vậy phải cố tình phá credential hoặc đốt hết hạn mức. Nhánh `unreachable` cũng vậy.

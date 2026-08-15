# ADR-0041 — Thiếu cấu hình là mất năng lực, không phải chết; và vì sao không ghi audit từ agent-runtime

| | |
| --- | --- |
| **Ngày** | 2026-08-15 09:25 |
| **Giai đoạn** | Design |
| **Trạng thái** | Chấp nhận |
| **Người quyết định** | HungLV |
| **Prompt log** | *không có* — quyết định đến từ đọc mã nguồn `trycompai/crm@f2484fb` |

## Bối cảnh

Hai mẫu từ cùng một repo ngoài, đọc cùng một lúc, và câu trả lời cho chúng ngược nhau. Gộp vào một ADR vì chúng chỉ là **một nguyên tắc nhìn từ hai phía**: cái gì được phép vắng mặt trong tiến trình này, và cái gì không được phép có mặt.

**Phía thứ nhất — năng lực.** `AGENTS.md` của họ: *"Anything a self-hoster might not have is optional and must never throw. A missing key removes a capability."* `agent/lib/capabilities.ts` thi hành: mỗi nguồn ngoài là một `Capability` có `enabled`, boot in ra bật/tắt từng cái, và `markdownFor()` **bơm danh sách đó vào prompt** kèm câu *"Not configured here, so do not plan around them."*

Ta đã có nửa đầu (ADR-0034: thiếu `AGENT_TOKEN` là **TẮT**, không phải chết) nhưng **chưa có nửa sau**: `--allowed-tools` chặn thật ở tầng cờ dòng lệnh, nhưng không ai nói cho model biết nó bị chặn. `extract-claims` chạy với whitelist **rỗng** và không có cách nào biết điều đó — một model tưởng mình có tra cứu sẽ lên kế hoạch tra cứu, và kế hoạch không thực hiện được là chỗ kết quả bịa sinh ra.

**Phía thứ hai — audit.** `agent/hooks/audit.ts` của họ bắt mọi event của agent và ghi xuống bảng `agentEvent`/`agentRunEvent` qua Prisma, cộng dồn token và chi phí vào `agentRun`. Nhìn qua thì rất hợp luật 6 (đo được từ ngày đầu) và luật 7 (vòng 2 hỏi dựa trên log).

## Phương án đã cân nhắc

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| **A. Nói năng lực cho model bằng khối sinh từ `policy.json`; audit vẫn ở phía `api`** | Model biết chính xác nó với tới được gì. Khối sinh từ policy nên không thể lệch với cờ thật. Không tiến trình nào phải cầm thêm credential | Prompt dài thêm ~3 dòng mỗi lượt | ✅ **Chọn** |
| B. Port `hooks/audit.ts`: agent-runtime tự ghi event xuống CSDL | Log đầy đủ nhất, đúng chỗ sinh ra sự kiện | **Buộc tiến trình này cầm credential CSDL** — phá thẳng ADR-0038, lý do duy nhất container này tồn tại. Khi đó một tiến trình con do model sinh ra lại chia sẻ môi trường với `DATABASE_URL` | ❌ Loại — đổi một tính chất an ninh lấy một tiện nghi quan sát |
| C. Chép tay danh sách công cụ vào từng `SKILL.md` | Không cần đụng `skill-registry.ts` | Tạo bản sao thứ hai của `allowedTools`. Bản drift luôn là bản không ai nhìn, và bản drift ở đây là bản **mô tả một ranh giới không còn khớp với cờ thật** | ❌ Loại — cùng lỗi mà `skill-template-vars.ts` đã bị một lần với enum |
| D. Boot chết khi thiếu công cụ / thiếu key | "Hỏng ồn ào" nghe có vẻ trung thực | `.env.example` để trống cả ba biến, nên checkout mặc định — kể cả của BGK — sẽ thấy container flap dưới `restart: unless-stopped`. Đọc thành "stack của đội này hỏng", không thành "tính năng đó đang tắt". Đúng cái bẫy ADR-0034 đã tránh | ❌ Loại — đã có tiền lệ ngược |

## Quyết định

Chọn **A**, và phát biểu thành nguyên tắc chung cho `apps/agent-runtime`:

> **Thiếu cấu hình làm mất một năng lực, không làm chết một tiến trình. Và không thứ gì được thêm vào tiến trình này nếu nó buộc tiến trình phải cầm thêm một credential.**

Vế hai là thứ loại B, và nó là **tiêu chí kiểm tra cho mọi đề xuất về sau**, không riêng audit.

Về quan sát: `api` đã ghi mỗi lượt gọi kèm `elapsedMs`/`apiMs`/token (`agent-claim-extractor.ts`), phía runtime in một dòng mỗi lượt, và `/health` nay trả thêm `grants` — trần tự chủ đọc được **từ ngoài container** mà không cần mở image. Cái B thêm được so với ba thứ đó là chi tiết từng bước, và nó không đáng giá bằng tính chất an ninh phải đổi.

## Hệ quả

- **Kéo theo:** khối "CÔNG CỤ Ở LƯỢT NÀY" sinh trong `skill-registry.ts` từ `policy.allowedTools`, ghép vào **mọi** skill. Nới `allowedTools` giờ tự động đổi cả điều model được nghe — không thể nới cờ mà quên nói.
- **Kéo theo:** `/health` thêm `grants`, **thêm** chứ không sửa `skills`, vì `agent-runtime-client.ts:93` khai kiểu `skills: string[]` và một breaking change cho một trường chẩn đoán là không đáng.
- **Đánh đổi chấp nhận:** không có log từng bước bên trong một lượt chạy. Nếu model đi ba vòng WebSearch rồi trả rỗng, ta thấy "rỗng" và thấy số token, không thấy nó đã tìm gì.
- **Sẽ phải xem lại nếu:** cần biết model tìm gì bên trong một lượt. Đường đi lúc đó là **runtime trả thêm dấu vết trong response cho `api` ghi**, không phải runtime tự ghi CSDL — giữ nguyên vế hai của nguyên tắc.

## AI đã tham gia thế nào

- **Vai trò AI:** đọc repo ngoài, dựng ma trận đánh đổi.
- **AI đề xuất gì mà đội không nghe:** AI xếp hook `audit.ts` vào nhóm "đáng port, hợp luật 6 và luật 7". Người quyết định bác: AI đọc luật trong CLAUDE.md nhưng không đối chiếu với ADR-0038 nằm trong `docs/decisions/`, nên nó cân *lợi ích quan sát* mà bỏ qua *cái giá an ninh*. Đây đúng kiểu sai mà rubric gọi là bấm accept output AI mà không hiểu.
- **AI sai ở đâu:** bản phân tích đầu còn đề xuất trả `/health` với `skills` đổi từ `string[]` thành mảng object. Sai — sẽ vỡ kiểu ở `agent-runtime-client.ts`. Lộ ra khi đọc file gọi, không lộ ra khi đọc file bị sửa.

## Đội đã verify bằng cách nào

- **Chạy test:** `pnpm vitest run --project agent-runtime` xanh, 13 → **25** test. Trong số mới có test chứng minh đúng hành vi được quyết định ở đây: skill whitelist rỗng **phải** được nói là không có công cụ; khối công cụ **sinh từ policy** chứ không chép tay (đổi policy thì chuỗi đổi theo); thiếu `_base.md` là lỗi boot chứ không phải chuỗi rỗng.
- **Đọc file gọi trước khi đổi hợp đồng:** mở `apps/api/src/ai/agent-runtime-client.ts` xác nhận `health()` khai `skills: string[]`, và đó là lý do `grants` được **thêm** thay vì sửa tại chỗ.
- **Đọc thẳng mã nguồn repo ngoài** tại commit ghi ở đầu ADR (`agent/lib/capabilities.ts`, `agent/hooks/audit.ts`), không dựa vào README của họ.
- **Đối chiếu ADR-0038** trước khi loại phương án B, để chắc rằng "không giữ credential CSDL" là tính chất đã quyết định chứ không phải tình cờ của hiện trạng.
- **Chưa verify:** chưa chạy được một lượt thật với OAuth token ở phiên này, nên **chưa đo được** khối công cụ có thật sự làm giảm tỉ lệ bịa URL của `discover-sources` hay không. Cùng điểm treo ADR-0039 đã ghi.

## Rollback

Revert một commit. `skills/_base.md`, phần `toolGrant()`/`compose()` trong `skill-registry.ts` và `grants` ở `/health` đi cùng nhau, không đụng contracts, CSDL hay web.

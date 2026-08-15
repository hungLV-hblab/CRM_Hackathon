# Làm dày agent-runtime theo mẫu `trycompai/crm`

| | |
| --- | --- |
| **Trạng thái** | Code xong, chờ một lượt chạy thật với OAuth token |
| **Ngày** | 2026-08-15 09:01 |
| **Nhánh** | `feat/agent-runtime-walking-skeleton` |
| **Nguồn tham chiếu** | `trycompai/crm@f2484fb08d1dd1357c1e3deddb97610cd8e6f1ed`, branch `release`, scope `apps/agent` |
| **Ràng buộc** | Feature freeze tối 14/08 đã qua. Vòng 1 chốt 15:00 hôm nay. Mọi thay đổi phải chạy lại được test trong ngày |

## Vì sao không copy

Repo nguồn dựng trên framework **`eve` v0.29** (Bun runtime, durable session, hook, sandbox, subagent) — 21.7k LOC, 27 tool, 2 subagent, ghi trạng thái xuống Prisma. `agent-runtime` của ta là 979 LOC Node thuần bọc `claude -p`. `eve` là dependency chịu lực của gần như mọi file trong `agent/` của họ.

Thứ đáng lấy là **thiết kế và văn xuôi hướng dẫn phán đoán**, không phải code. Ba mẫu bị **từ chối có chủ ý**, ghi lại ở đây để không ai port nhầm về sau:

| Mẫu của họ | Vì sao từ chối |
| --- | --- |
| `AGENTS.md`: *"Never add code comments"* | Trái CLAUDE.md §6 của ta. Comment trong `job-queue.ts` / `claude-cli.ts` là bằng chứng mạnh nhất cho vòng 2 |
| `hooks/audit.ts` ghi mọi event xuống DB | Container này **cố ý không giữ credential CSDL** (ADR-0038). Port vào là tự phá quyết định kiến trúc tốt nhất của dự án → ADR-0041 |
| `subagents/agent_builder` | Cần eve + DB, và mở thêm vùng AI tự ghi ngoài hai vùng Specs cho phép (CLAUDE.md §4) |

## Phase

| # | Việc | File | Trạng thái |
| --- | --- | --- | --- |
| 01 | Preamble dùng chung + khai báo công cụ bơm vào prompt | [phase-01](phase-01-preamble-dung-chung-va-khai-bao-cong-cu.md) | ✅ Xong |
| 02 | Phản ví dụ cho `discover-sources` | [phase-02](phase-02-phan-vi-du-cho-discover-sources.md) | ✅ Xong |
| 03 | `CLAUDE.md` cấp app + 2 ADR | [phase-03](phase-03-claude-md-cap-app-va-adr.md) | ✅ Xong |

## Tiêu chí nghiệm thu

- [x] Test gói `agent-runtime` xanh: **13 → 25**. Có test cho: thiếu `_base.md` là lỗi boot; `_base.md` rỗng là lỗi boot; `_base.md` không thành skill thứ ba; thứ tự ghép nền → công cụ → thân; skill whitelist rỗng **được nói** là không có công cụ; khối công cụ sinh từ policy (đổi policy thì chuỗi đổi theo); luật nền có mặt ở **mọi** skill đang ship
- [x] `pnpm typecheck` xanh cả 5 gói · `pnpm lint` sạch
- [x] Full unit suite **521/521** xanh — `apps/api` không phải sửa dòng nào, vì `/health` chỉ **thêm** `grants`
- [x] Đọc mắt prompt ghép của cả hai skill, xác nhận đúng thứ tự và đúng khối công cụ cho từng skill
- [x] **Xong 15/08 ~10:47** (commit `aded85f`): chạy thật `extract-claims` với credential thật → `200`, hai phát hiện kèm câu trích, 19369 token vào / 160 ra, 8029ms, `authMode: cli_login`. Điểm treo của ADR-0038 và ADR-0039 đóng lại. `discover-sources` vẫn chưa chạy thật (tốn WebSearch + 8 lượt)
- [x] ADR-0040 và ADR-0041 có ≥2 phương án bị loại kèm lý do (0040 có 3, 0041 có 3) và mục *đội đã verify thế nào* không rỗng

## Chi phí prompt

System prompt dài thêm ~1.4k ký tự mỗi lượt (≈400 token). Đối chiếu: preamble của chính CLI đã ~16k token mỗi lượt (đo trong `spikes/claude-cli-provider`), nên phần thêm này dưới 3% và không đổi kết luận về tính khả thi của transport.

## Rủi ro

**Phase 01 đổi system prompt của cả hai skill đang chạy.** Đây là thay đổi hành vi, không phải thêm tính năng — nếu lượt chạy thật hồi quy thì rollback là revert đúng một commit, `_base.md` và phần compose trong `skill-registry.ts` đi cùng nhau. Không đụng contracts, DB, hay web.

## Câu hỏi còn treo

- ~~Chưa chạy được lượt thật với OAuth token nào ở phiên này~~ — **đã đóng 15/08**, xem tiêu chí nghiệm thu thứ 5. Credential đến từ `claude /login` trong container, không phải OAuth token trong `.env`; đường thứ ba đó nay là [ADR-0042](../../docs/decisions/0042-dang-nhap-trong-container-la-duong-xac-thuc-thu-ba-va-no-song-trong-volume-rieng.md).
- Còn treo: `discover-sources` chưa có lượt chạy thật nào.

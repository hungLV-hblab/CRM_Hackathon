---
phase: 4
title: "Caddy, panel web và ADR"
status: completed
priority: P1
dependencies: [3]
effort: "~60 phút"
---

# Phase 4: Caddy, panel web và ADR

## Overview

Nối ba mảnh thành đường đi thật: route Caddy, panel trong `/quan-tri`, ADR-0043, chạy full suite.

## Requirements

- Functional: admin bấm nút → hiện URL → dán code → panel đổi trạng thái. Có Đăng xuất.
- Non-functional: theo [design-guidelines](../../docs/design-guidelines.md) — **tím = máy sinh ra, cam = người sắp bấm**; vùng chạm ≥44px; không class màu thô.

## Architecture

### Caddyfile — thứ tự quan trọng

```caddyfile
handle /api/* { reverse_proxy api:3001 }
handle /agent-auth/* { reverse_proxy agent-runtime:4700 }   # MỚI — phải trước handle trần
handle { reverse_proxy web:3000 }
```

Chỉ mở tiền tố `/agent-auth`. **`/run/*` không được có mặt ở đây** — nó là đường tiêu quota, và một dòng thừa trong file này biến nó thành công khai. Cùng gốc `:8080` nên không cần CORS, đúng như comment đầu Caddyfile đã ghi.

### Panel

Component mới trong `/quan-tri`, cạnh `MetricsPanel` / `SystemParametersPanel`. Bốn trạng thái nhìn thấy được:

| Trạng thái | Hiện gì |
| --- | --- |
| Chưa có credential | `authMode: null` + nút **Đăng nhập Claude** |
| Đang chờ uỷ quyền | URL bấm được (mở tab mới) + ô dán code + nút Huỷ |
| Đã đăng nhập | `authMode` hiện tại + nút **Đăng xuất** |
| Đang tắt | `AGENT_TOKEN` chưa đặt → nói rõ, ẩn nút |

**Bẫy bắt buộc xử lý:** nếu `.env` đang có `CLAUDE_CODE_OAUTH_TOKEN` thì biến môi trường **thắng** phiên trên đĩa (ADR-0042). Đăng nhập qua UI sẽ chạy xong mà `authMode` vẫn là `oauth` — trông như hỏng. Panel phải phát hiện và nói thẳng: *"biến môi trường đang thắng; token vừa tạo chỉ có hiệu lực sau khi bỏ `CLAUDE_CODE_OAUTH_TOKEN` khỏi `.env`"*.

Panel gọi `api.agentAuthTicket()` rồi `fetch('/agent-auth/...')` trực tiếp — **không** bọc lời gọi thứ hai vào `api-client.ts`, vì nó không đi tới `api`. Comment nói rõ chỗ này, kẻo người sau "dọn cho nhất quán" và vô tình lôi credential trở lại qua `api`.

## Related Code Files

- Modify: `infra/Caddyfile`
- Create: `apps/web/src/app/(app)/quan-tri/claude-login-panel.tsx`
- Modify: `apps/web/src/app/(app)/quan-tri/page.tsx`
- Modify: `apps/web/src/lib/api-client.ts` (1 method: xin vé)
- Create: `docs/decisions/0043-dang-nhap-claude-qua-giao-dien-va-vi-sao-api-chi-ky-ve.md`
- Modify: `docs/decisions/README.md` · `README.md`

## Implementation Steps

1. Caddyfile + `docker compose up -d --build caddy agent-runtime`; kiểm `/agent-auth/*` tới được và **`/run/*` vẫn 404 từ `:8080`**.
2. `api-client.ts`: thêm method xin vé.
3. Panel — bốn trạng thái ở trên, dùng token màu `machine-*` cho vùng máy sinh, `brand-*` cho nút người bấm.
4. Nối vào `page.tsx`.
5. **Chạy thật trọn luồng**: bấm nút → mở URL → uỷ quyền → dán code → `/health` đổi sang `cli_login` → gọi `/run/extract-claims` ra kết quả.
6. Đăng xuất → `authMode` `null` → lượt chạy trả `not_authenticated`.
7. ADR-0043: ≥2 phương án bị loại (qua `api`; `node-pty`; form dán token), mục *"Đội đã verify bằng cách nào"* ghi số đo thật.
8. `pnpm test:unit` + `typecheck` + `lint` + cập nhật README.

## Success Criteria

- [ ] Luồng thật chạy trọn: bấm → uỷ quyền → dán → `cli_login` → `/run` trả kết quả
- [ ] `/run/*` vẫn không với tới được từ `:8080`
- [ ] Đăng xuất đưa về `null`
- [ ] Cảnh báo "biến môi trường đang thắng" hiện đúng lúc
- [ ] Qua checklist mục 7 design-guidelines
- [ ] 532+ test xanh, typecheck + lint sạch
- [ ] ADR-0043 có ≥2 phương án bị loại

## Risk Assessment

| Rủi ro | Giảm thiểu |
| --- | --- |
| Route Caddy sai thứ tự → `/agent-auth` rơi vào web | Kiểm bằng curl ngay bước 1, trước khi viết panel |
| Vô tình mở `/run` ra ngoài | Bước 1 kiểm cả chiều phủ định; test hồi quy phase 2 |
| Panel vỡ giao diện đang xanh | Component mới, không sửa panel cũ |
| Hết giờ ở phase 4 | Phase 1–3 đã tự đứng được; runtime dùng được bằng curl kể cả khi chưa có panel |

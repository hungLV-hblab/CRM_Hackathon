---
phase: 3
title: "Endpoint cấp vé ở api"
status: completed
priority: P1
dependencies: [2]
effort: "~35 phút"
---

# Phase 3: Endpoint cấp vé ở api

## Overview

`api` ký vé cho admin. Đây là **toàn bộ** phần việc của `api` trong tính năng này — nó không bao giờ thấy code OAuth lẫn credential.

## ⚠️ Đặt vào controller ĐANG CÓ, không tạo module mới

Comment đầu `apps/api/src/settings/settings.controller.ts` ghi nguyên văn bài học đã trả giá:

> *"a module declaring a guarded controller must import `AuthModule` itself, and forgetting it takes the whole API container down with a 502 on the login page while every unit test stays green (phase 7 paid for that lesson)."*

Nên: thêm route vào **`SettingsController`** (đã `@UseGuards(JwtGuard, RolesGuard)`, đã ở module có `AuthModule`). Tạo `AgentAuthModule` mới là mua lại đúng con lỗi 502-mà-test-vẫn-xanh, trong ngày không còn giờ để chẩn đoán nó.

## Requirements

- Functional: `POST /settings/agent-auth-ticket`, `@Roles('admin')`, trả `{ ticket, expiresAt }`.
- Non-functional: thiếu `AGENT_TOKEN` → **503 tắt**, không phải 500 (ADR-0041). Vé không bao giờ vào log.

## Architecture

```ts
// Ký: <exp>.<nonce>.<hmac>, cùng thuật toán agent-runtime verify ở phase 2.
// Bí mật ký là AGENT_TOKEN — api và agent-runtime đã chia sẻ sẵn, không đẻ thêm credential.
```

Hạn 5 phút: đủ cho người mở tab, uỷ quyền, copy code; đủ ngắn để một vé lọt ra ngoài không thành cửa lâu dài.

**Chỗ trùng lặp phải chấp nhận:** thuật toán vé nằm ở hai gói (`api` ký, `agent-runtime` verify). Không đưa vào `packages/contracts` được vì contracts là zod + enum dùng chung, không phải chỗ để mã hoá. Ghi chú chéo ở cả hai file, và test ở phase 2 dùng đúng vé do hàm ký này sinh ra để chúng không lệch âm thầm.

## Related Code Files

- Modify: `apps/api/src/settings/settings.controller.ts` (thêm 1 route)
- Create: `apps/api/src/settings/agent-auth-ticket.ts` (hàm ký thuần, test riêng được)
- Create: `apps/api/src/settings/__tests__/agent-auth-ticket-admin-only.test.ts`
- Modify: `packages/contracts/src/` (DTO `AgentAuthTicketDto`)

## Implementation Steps — test trước

1. **Test trước:**
   - Sales gọi → **403**
   - Admin gọi khi có `AGENT_TOKEN` → 200, đúng shape, `expiresAt` trong tương lai
   - Admin gọi khi **thiếu** `AGENT_TOKEN` → **503** kèm câu nói rõ đang tắt
   - Hai lời gọi liên tiếp → **nonce khác nhau** (nếu trùng thì vé thứ hai chết vì dùng-một-lần)
   - Vé sinh ra **verify được** bằng chính hàm của phase 2 ⇒ khoá hai bản thuật toán vào nhau
2. `agent-auth-ticket.ts`: `signTicket(secret, nowMs)` thuần, `nonce` từ `randomBytes`.
3. Thêm route vào `SettingsController`, `@Roles('admin')`, comment nói rõ vì sao ở đây chứ không ở module mới.
4. DTO vào contracts.
5. `pnpm vitest run --project api` + `typecheck`.

## Success Criteria

- [ ] Sales → 403; admin → 200; thiếu `AGENT_TOKEN` → 503
- [ ] Nonce không trùng
- [ ] Vé của `api` verify được bằng hàm của `agent-runtime` (test bắc cầu hai gói)
- [ ] Không tạo module Nest mới
- [ ] Vé không vào log

## Risk Assessment

| Rủi ro | Giảm thiểu |
| --- | --- |
| Module mới quên `AuthModule` → 502 mà test vẫn xanh | Không tạo module mới. Đây là lý do chính của cả mục ⚠️ ở trên |
| Hai bản thuật toán vé lệch nhau | Test bắc cầu ở bước 1 |
| Đồng hồ lệch giữa hai container | Cùng host Docker, cùng đồng hồ. Hạn 5' đủ rộng |

---
phase: 3
title: "apps/api — actor context, hai pool, đăng nhập"
status: done
priority: P1
dependencies: [1, 2]
---

# Phase 3: apps/api — actor context, hai pool, đăng nhập

## Overview

NestJS với `actor` chạy suốt mọi đường ghi (lớp 1 của ADR-0004), hai pool CSDL (lớp 2, ADR-0010), và đăng nhập thật 2 tài khoản. Có **T-10 mini** ở tầng service — chứng minh chặn được khi gọi thẳng, không qua HTTP.

## Requirements

- Functional: login trả cookie httpOnly; `RolesGuard` phân biệt Sales/Admin; service từ chối `actor=system` chạm 4 hành động cấm và ghi `AuditEvent`; tạo/liệt kê Company.
- Non-functional: `domain/*` không dính decorator nào ngoài `@Injectable` → test khởi tạo trực tiếp bằng `new`, không cần boot HTTP.

## Architecture

```
main.ts                 APP_ROLE=api → AppModule ; =worker → WorkerModule (Phase 4)
common/actor/           AsyncLocalStorage<Actor>, ActorInterceptor gắn actor từ session
common/db/              DbModule cấp 2 token: DRIZZLE_APP, DRIZZLE_SYSTEM
common/audit/           AuditEventService.ghiTuChoi(actor, action, entity, id, detail)
auth/                   POST /auth/login, JwtGuard (cookie), RolesGuard
domain/company/         CompanyService (create, list)
domain/opportunity/     OpportunityService (updateStage, updateNextStep)
```

**Hai lớp làm hai việc khác nhau, cần cả hai:** Postgres chỉ trả lỗi trống `permission denied`; lớp domain mới ghi được `AuditEvent` với lý do đọc được. Đó là câu trả lời cho vòng 2 khi BGK hỏi "chứng minh nó bị chặn thật".

## Related Code Files

- Create: `apps/api/src/main.ts`, `app.module.ts`, `vitest.config.ts`
- Create: `apps/api/src/common/actor/{actor-context.ts,actor.interceptor.ts}`
- Create: `apps/api/src/common/db/db.module.ts`
- Create: `apps/api/src/common/audit/audit-event-service.ts`
- Create: `apps/api/src/auth/{auth.module.ts,auth.controller.ts,auth-service.ts,jwt.guard.ts,roles.guard.ts}`
- Create: `apps/api/src/domain/company/{company-service.ts,company.controller.ts}`
- Create: `apps/api/src/domain/opportunity/opportunity-service.ts`
- Create: `apps/api/src/__tests__/{t10-mini-chan-actor-system,dang-nhap}.test.ts`

## Implementation Steps

### Bước đỏ — T-10 mini trước tiên

`t10-mini-chan-actor-system.test.ts` — **không boot HTTP**, khởi tạo service trực tiếp:

```ts
const svc = new OpportunityService(dbSystem, auditService)
await expect(svc.updateStage({ actor: 'system' }, oppId, 'won')).rejects.toThrow(/không được/)
expect(await demAuditEvent({ action: 'update_stage', actor: 'system' })).toBe(1)
// và giá trị thật trong CSDL không đổi
expect(await layStage(oppId)).toBe('qualified')
```

Ba khẳng định, không phải một: **ném lỗi** · **ghi AuditEvent** · **dữ liệu không đổi**. Chỉ kiểm "ném lỗi" thì một service ném rồi vẫn ghi vẫn xanh.

`dang-nhap.test.ts` (supertest):
- `POST /auth/login` đúng mật khẩu → 200 + `Set-Cookie` có `HttpOnly`
- sai mật khẩu → 401, **không** có cookie
- gọi endpoint cần quyền khi chưa login → 401
- tài khoản Sales gọi endpoint chỉ-Admin → 403

### Bước xanh

1. `ActorContext` bằng `AsyncLocalStorage`; interceptor lấy actor từ JWT, mặc định `human`. Đường ghi của worker đặt `actor='system'` tường minh.
2. `DbModule` cấp 2 token; **service chạm dữ liệu chính thức chỉ được inject `DRIZZLE_APP`**, service AI dùng `DRIZZLE_SYSTEM`.
3. `AuthService`: bcryptjs so hash, JWT ký `JWT_SECRET`, set cookie `httpOnly` + `sameSite=lax` + `secure=false` (chạy sau Caddy, không TLS nội bộ).
4. `OpportunityService.updateStage`: `actor === 'system'` → ghi `AuditEvent` rồi ném lỗi. Kiểm ở **đầu** hàm, trước mọi truy vấn.
5. `CompanyService.create/list` — tối thiểu đủ cho Phase 5 và nghiệm thu điểm 3.
6. `main.ts` rẽ nhánh `APP_ROLE`; log JSON (pino) ra stdout.

## Success Criteria

- [x] 3 khẳng định T-10 mini xanh — `t10-mini-system-actor-blocked.test.ts`
- [x] 4 khẳng định đăng nhập xanh — điểm nghiệm thu 2 (`sales@` 200 · `admin@` 200 · sai mật khẩu 401 · Sales gọi `/api/settings` 403)
- [x] Bỏ dòng kiểm `actor` trong `updateStage` → test vẫn **đỏ** ở tầng CSDL. Sau đó khôi phục — **phép đo này bắt được lỗi thật**: lần 1 chạy lọt (ghi cứng `dbApp`), sửa xong đo lại ra `permission denied for table opportunities`
- [x] `POST /companies` + `GET /companies` chạy qua cookie phiên — điểm nghiệm thu 3, qua e2e Playwright trên stack production
- [ ] Không service nào ở `domain/` import từ `@nestjs/common` ngoài `Injectable` — **không đạt theo đúng câu chữ**: `company-service.ts` và `opportunity-service.ts` còn import `ForbiddenException`, `Inject`. Mục đích (khởi tạo bằng `new`, không boot HTTP) vẫn đạt — T-10 mini chạy đúng kiểu đó. Chốt lại tiêu chí này khi mở nhóm 3/4/5

## Risk Assessment

- **Quên truyền `actor` ở một đường ghi** → chính là rủi ro ADR-0004 cảnh báo. Giảm bằng cách để `actor` là **tham số đầu tiên bắt buộc** của mọi phương thức ghi, không phải tuỳ chọn, không đọc ngầm từ context bên trong service.
- **Cookie không set được vì cross-origin** → Phase 6 đưa về một origin qua Caddy. Ở phase này test bằng supertest nên chưa lộ.
- **JWT_SECRET lọt vào repo** → chỉ nằm ở `.env`, `.env.example` để giá trị rỗng.

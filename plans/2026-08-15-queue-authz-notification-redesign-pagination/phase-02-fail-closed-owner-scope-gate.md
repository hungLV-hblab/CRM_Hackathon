---
phase: 2
title: "Cổng phân quyền fail-closed"
status: pending
priority: P1
dependencies: [1]
---

# Phase 2: Cổng phân quyền fail-closed

## Overview

Dựng **một** hàm quyết định phạm vi, dùng chung cho mọi controller ở phase 4 và 5. Chưa gắn vào endpoint nào — phase này chỉ tạo cổng và chứng minh nó fail-closed.

Lý do có phase riêng: hơn 10 endpoint sẽ hỏi cùng một câu hỏi. Mười bản sao của `actor.role === 'sales' ? ... : ...` là mười cơ hội viết ngược chiều, và red team đã bắt được chính lỗi đó trong bản plan đầu.

## Requirements

- Functional: `ownerScopeFor(actor)` trả về `null` nghĩa là "không lọc" (admin), hoặc một `userId` nghĩa là "chỉ công ty của người này"; actor người **không có role** → ném `ForbiddenException`; actor hệ thống → ném (mọi đường đọc/ghi của người không dành cho `crm_system`).
- Non-functional: hàm thuần, không đụng DB, không đọc ambient context — nhận `Actor` làm tham số (ADR-0004).

## Architecture

```ts
// apps/api/src/common/actor/owner-scope.ts
/**
 * FAIL-CLOSED. Viết theo chiều "thu hẹp trừ khi là admin", không phải "thu hẹp nếu là sales".
 * `Actor.role` là optional (actor-context.ts:22) nên chiều ngược lại sẽ cho actor thiếu role
 * rơi vào nhánh admin — nhánh rộng nhất — qua hai đường thật:
 *   1. test dựng `{ kind: 'human', userId }` không role (company-source-candidates.test.ts:32)
 *   2. JWT cũ/thiếu `role` qua actor.interceptor.ts:25
 */
export function ownerScopeFor(actor: Actor): string | null {
  if (actor.kind !== 'human' || !actor.userId) throw new ForbiddenException(...)
  if (actor.role === 'admin') return null
  if (actor.role === 'sales') return actor.userId
  throw new ForbiddenException('Tài khoản thiếu vai trò, không xác định được phạm vi dữ liệu')
}
```

Và một helper Drizzle dùng chung cho mệnh đề `where`, để 8 query không tự viết lại điều kiện:

```ts
// ownerCondition(scope): scope === null ? undefined : eq(companies.ownerId, scope)
```

Lưu ý ngữ nghĩa **công ty chưa gán người phụ trách**: `eq(companies.ownerId, scope)` tự động loại `NULL` (SQL: `NULL = x` là unknown). Đó là hành vi mong muốn — nhưng phase 4 phải **đếm và nói ra** số bị loại, không im lặng.

## Related Code Files

- Create: `apps/api/src/common/actor/owner-scope.ts`
- Create: `apps/api/src/common/actor/__tests__/owner-scope.test.ts`

## Implementation Steps

1. **Test đỏ trước** — đây là phase mà test quan trọng hơn code:
   - admin → `null`
   - sales → chính `userId` của họ
   - `{ kind: 'human', userId }` **không role** → ném (fail-closed). Đây là case bản plan đầu sai.
   - `{ kind: 'system' }` → ném
   - human không `userId` → ném
2. Viết `owner-scope.ts`.
3. Chạy test; `pnpm typecheck`.

## Success Criteria

- [ ] 5 case test xanh, đặc biệt case "human không role → ném"
- [ ] Không endpoint nào dùng nó ở phase này (grep xác nhận), để phase 4/5 là nơi hành vi thật sự đổi

## Risk Assessment

- Cám dỗ "gắn luôn vào một endpoint cho tiện" — không làm; phase này phải revert được độc lập mà không đổi hành vi sản phẩm.
- Nếu sau này có role thứ ba, hàm này là chỗ duy nhất phải sửa. Đó là lý do nó tồn tại.

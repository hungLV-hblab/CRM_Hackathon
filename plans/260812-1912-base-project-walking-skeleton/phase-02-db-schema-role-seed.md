---
phase: 2
title: "packages/db — schema, ba role, seed idempotent"
status: pending
priority: P1
dependencies: [1]
---

# Phase 2: packages/db — schema, ba role, seed idempotent

## Overview

Drizzle schema cho lát cắt skeleton, ba role Postgres theo [ADR-0010](../../docs/decisions/0010-chan-tang-csdl-bang-hai-role-va-quyen-theo-cot.md), và seed idempotent theo I-14. Đây là phase **không được cắt** — mọi thứ sau nó phụ thuộc vào tên bảng và quyền ở đây.

## Requirements

- Functional: migration chạy được từ CSDL trống; seed chạy 2 lần cho kết quả giống hệt; `crm_system` bị chặn đúng 4 thao tác và được phép đúng 2 thao tác.
- Non-functional: tên bảng/cột/enum lấy nguyên từ ontology mục 3; không `drizzle-kit push`.

## Architecture

Ba role, phân vai rõ:

| Role | Dùng ở đâu | Quyền |
| --- | --- | --- |
| `crm_owner` | **chỉ** migration + seed | sở hữu schema |
| `crm_app` | API phục vụ Sales/Admin | full, có `ALTER DEFAULT PRIVILEGES` → bảng mới tự có quyền |
| `crm_system` | worker + nhánh AI trong API | **không** default privileges → bảng mới mặc định cấm, phải GRANT tay |

Role tạo ở `infra/postgres-init/01-roles.sql` (mount vào `/docker-entrypoint-initdb.d`, chạy 1 lần lúc khởi tạo cluster). GRANT nằm trong migration để versioned cùng schema.

**Bảng ở phase này (7, không phải 15):** `users`, `companies`, `opportunities`, `timeline_entries`, `system_settings`, `watch_cycle_runs`, `audit_events`. Enum thì khai báo **cả 11** ngay — rẻ, và tránh phải sửa migration lần hai.

## Related Code Files

- Create: `packages/db/src/schema/{index,companies,opportunities,timeline-entries,users,system-settings,watch-cycle-runs,audit-events}.ts`
- Create: `packages/db/src/schema/enums.ts` — `pgEnum` sinh từ `@crm/contracts`
- Create: `packages/db/drizzle.config.ts`, `packages/db/src/client.ts` (2 pool: app/system)
- Create: `packages/db/migrations/0000_*.sql` (generate) + `0001_grants.sql` (`--custom`)
- Create: `infra/postgres-init/01-roles.sql`
- Create: `packages/db/src/seed/{index.ts,du-lieu-btc.ts}`
- Create: `packages/db/src/__tests__/{quyen-cot-chan-actor-system,seed-idempotent}.test.ts`
- Create: `packages/db/src/__tests__/global-setup.ts`

## Implementation Steps

### Bước đỏ — dựng lại 4 phép đo của ADR-0010 thành test

`quyen-cot-chan-actor-system.test.ts` — kiểm **cả hai chiều**, vì chỉ kiểm chiều cấm thì một GRANT quá tay vẫn xanh:

| # | Thao tác của `crm_system` | Kỳ vọng |
| --- | --- | --- |
| 1 | `UPDATE opportunities SET stage='won'` | ném lỗi `permission denied` |
| 2 | `UPDATE opportunities SET expected_value=1` | ném lỗi |
| 3 | `DELETE FROM opportunities` | ném lỗi |
| 4 | `DELETE FROM timeline_entries` | ném lỗi |
| 5 | `UPDATE opportunities SET next_step_text='x'` | **thành công** |
| 6 | `INSERT INTO timeline_entries(...)` | **thành công** |

`seed-idempotent.test.ts`: chạy `seed()` → chụp trạng thái (đếm mọi bảng + hash nội dung companies) → chạy `seed()` lần hai → so bằng nhau.

`global-setup.ts`: chạy migration lên `DATABASE_URL_TEST` (database `crm_test` riêng, cùng cluster dev) trước toàn bộ test.

### Bước xanh

1. `01-roles.sql`: tạo 3 role, `crm_owner` sở hữu database. **Không role nào là superuser.**
2. Schema Drizzle theo ontology mục 3.1/3.3/3.4. `raw_content` chưa cần ở phase này (chờ Q-3 BTC).
3. `drizzle-kit generate` → `0000_*.sql`.
4. `drizzle-kit generate --custom` → `0001_grants.sql`, nội dung đúng ADR-0010:
   - `GRANT ALL … TO crm_app` + `ALTER DEFAULT PRIVILEGES … TO crm_app`
   - `crm_system`: `GRANT SELECT ON opportunities`; `GRANT UPDATE (next_step_text, next_step_due_date, next_step_source) ON opportunities`; `GRANT SELECT, INSERT ON timeline_entries`, `watch_cycle_runs`, `audit_events`; `GRANT SELECT ON system_settings`, `companies`
   - **Tuyệt đối không `GRANT UPDATE` toàn bảng rồi `REVOKE` theo cột** — đã đo, không chặn gì cả
5. `client.ts`: 2 pool riêng từ `DATABASE_URL_APP` / `DATABASE_URL_SYSTEM`.
6. Seed: `TRUNCATE … RESTART IDENTITY CASCADE` mọi bảng rồi insert, chạy bằng `crm_owner`. Gồm 2 user (`sales@`, `admin@`, mật khẩu hash bcryptjs), vài công ty, ≥1 cơ hội đang mở, `system_settings` = `{ai_enabled: true, watch_cycle_seconds: 60}` lấy giá trị khởi tạo từ env.

## Success Criteria

- [ ] Từ CSDL trống: `pnpm db:migrate && pnpm seed` chạy sạch
- [ ] 6 khẳng định quyền cột xanh, **cả chiều cấm lẫn chiều cho**
- [ ] Thử đổi `0001_grants.sql` thành `GRANT UPDATE ON opportunities TO crm_system` → test 1 **đỏ** (chứng minh test bắt được đúng cái bẫy ADR-0010 đã đo)
- [ ] `pnpm seed` hai lần → trạng thái giống hệt
- [ ] Không có script `db:push` nào trong `package.json`

## Risk Assessment

- **Quên GRANT bảng mới** → đây là hướng an toàn theo thiết kế (AI mất quyền chứ không thừa quyền), nhưng sẽ làm Phase 4 đỏ khó hiểu. Ghi chú trong `packages/db/README` hoặc đầu file `0001_grants.sql`: *thêm bảng thì thêm GRANT cho `crm_system` ở đây*.
- **Test cần Postgres chạy** → `global-setup` báo lỗi rõ ràng nếu không kết nối được, không để test fail mơ hồ.
- **Role tạo trong init script chỉ chạy lúc volume trống** → nếu đã có volume cũ, `docker compose down -v` trước. Ghi vào README.

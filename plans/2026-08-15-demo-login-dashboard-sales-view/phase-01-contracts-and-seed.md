---
phase: 1
title: "Contracts + Seed"
status: completed
priority: P1
dependencies: []
---

# Phase 1: Contracts + Seed

## Overview
Nền cho cả hai task: hằng số tài khoản demo dùng chung, mở rộng `OverviewDto`, seed 3 sales + 1 admin với mật khẩu `hackathon#1`, chia quyền sở hữu công ty 2/2/1.

## Requirements
- Functional: một nguồn sự thật duy nhất cho danh sách tài khoản demo mà seed + login page + dropdown admin cùng import.
- Non-functional: không migration; email/tên đổi được theo danh sách BTC bằng cách sửa đúng 1 file.

## Architecture
- `DEMO_ACCOUNTS` sống trong `packages/contracts` (đã là chỗ chia sẻ enum/schema giữa api và web). Gồm `{ email, name, role }` + `DEMO_PASSWORD = 'hackathon#1'` — mật khẩu này BTC phát công khai, không phải secret.
- Seed derive `SEED_USERS` từ `DEMO_ACCOUNTS` + id cố định + passwordHash (hash bcrypt của `hackathon#1`, tạo một lần bằng script bcryptjs, commit chuỗi hash — không commit plaintext logic).

## Related Code Files
- Create: `packages/contracts/src/demo-accounts.ts` (export từ `index.ts`)
- Modify: `packages/contracts/src/dto/overview.ts` — thêm vào `OverviewDto`:
  - `dueSoon: OpportunityDto[]` (đến hạn hôm nay→+3 ngày)
  - `missingNextStep: OpportunityDto[]` (cơ hội mở thiếu Việc tiếp theo)
  - `unassignedCompanies: number` (công ty `ownerId IS NULL` bị loại khi lọc)
  - `perSales?: OverviewPerSalesRow[]` — `{ userId, name, runningPipeline: string, openCount, overdueCount, missingNextStepCount, pendingProposals, oldestPendingProposalDays: number | null }`
  - schema query: `overviewQuerySchema = z.object({ ownerId: z.string().uuid().optional() })`
- Modify: `packages/db/src/seed/seed-data.ts` — `SEED_USERS` 1 admin + 3 sales; gán lại `ownerId` 5 công ty theo tỷ lệ 2/2/1.

## Implementation Steps
1. Tạo `demo-accounts.ts`: 3 sales tên/email placeholder VN (vd `sales1@hblab.vn`…) + 1 admin. Comment rõ: "đổi theo danh sách BTC phát, chỉ sửa file này".
2. Sinh hash bcrypt của `hackathon#1` (`bcryptjs.hashSync`, cost 10 — khớp hash hiện có), thay cho hash `sales123`/cũ trong seed.
3. Chia ownerId: sales1 → Sakura + Nimbus (2 công ty watched — demo vòng quét vẫn tập trung 1 người), sales2 → 2 công ty kế, sales3 → Marlin. Đảm bảo mỗi sales có ≥1 cơ hội quá hạn hoặc đến hạn trong seed để demo luật 5; nếu thiếu, chỉnh `nextStepDueDate` của cơ hội seed có sẵn, KHÔNG thêm cơ hội mới.
4. `pnpm reset && pnpm seed` chạy sạch; kiểm tra test seed-dependent hiện có (`column-grants-block-system-actor`, watch-cycle…) còn xanh — các test này có thể assume 1 sales duy nhất.

## Success Criteria
- [ ] Login được bằng cả 4 account với `hackathon#1` (curl hoặc test login.test.ts mở rộng)
- [ ] `select owner_id, count(*) from companies group by 1` ra 2/2/1
- [ ] `pnpm typecheck` + `pnpm test:unit` xanh

## Risk Assessment
- Test hiện có hardcode `SEED_USERS[0]` hoặc email `sales@hblab.vn` → grep trước khi đổi, sửa theo constant thay vì string. Mitigation: bước 4.
- Đổi email account sales cũ có thể phá e2e đăng nhập hiện có → giữ `sales@hblab.vn` làm sales1 nếu e2e đang dùng nó.

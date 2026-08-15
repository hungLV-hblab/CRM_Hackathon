---
phase: 3
title: "Overview API theo role"
status: completed
priority: P1
dependencies: [1]
---

# Phase 3: Overview API theo role

## Overview
`GET /overview?ownerId=` — sales bị ép self-scope, admin filter tuỳ chọn; thêm 3 khối dữ liệu mới (`dueSoon`, `missingNextStep`, `perSales`) + `unassignedCompanies`.

## Requirements
- Functional:
  - actor sales → server bỏ qua param, ép `ownerId = actor.userId`; `perSales` = `undefined`.
  - actor admin → `ownerId` tuỳ chọn (trống = tất cả); `perSales` luôn trả.
  - `dueSoon`: `nextStepDueDate` trong `[today, today+3]`, loại giai đoạn đóng, loại quá hạn (đã có khối riêng).
  - `missingNextStep`: cơ hội mở (loại won/lost/on_hold — on_hold ngừng có chủ đích, không phải "ngừng tim") thiếu `nextStepText` HOẶC `nextStepDueDate`.
  - `unassignedCompanies`: đếm công ty `ownerId IS NULL` chưa xoá — chỉ có nghĩa khi đang lọc, nhưng trả luôn cho đơn giản.
- Non-functional: filter là VIEW không phải authorization (ontology mục 1 nguyên vẹn); các màn khác không đổi.

## Architecture
- Controller: zod validate `overviewQuerySchema`; đọc actor qua `getCurrentActor()` (pattern sẵn có ở `auth.controller.ts`); resolve `effectiveOwnerId` + `includePerSales` rồi truyền xuống service — logic role nằm Ở CONTROLLER, service nhận tham số tường minh, dễ test.
- Service: helper `ownerFilter(ownerId?)` trả điều kiện `eq(companies.ownerId, ownerId)` hoặc `undefined`, AND vào WHERE của 5 query sẵn có (tất cả đã join `companies`). 3 query mới cùng khuôn `Promise.all`, dùng lại `OPPORTUNITY_SELECTION` + `toOpportunityDto` + `todayIso()`.
- `perSales`: 1 query gộp GROUP BY `companies.ownerId` join `users` (role sales) cho counts cơ hội; proposal pending per owner đi qua `proposals → companies.ownerId` — **xác minh linkage `proposals.companyId` trong schema trước khi viết**; nếu proposal không nối được về company thì bỏ 2 cột proposal khỏi bảng (để trống + nói rõ, luật 4) thay vì join gượng.

## Related Code Files
- Modify: `apps/api/src/domain/overview/overview.controller.ts`
- Modify: `apps/api/src/domain/overview/overview-service.ts`
- Create: `apps/api/src/domain/overview/__tests__/overview-owner-scoping.test.ts`

## Implementation Steps
1. Controller: parse query, resolve theo role, truyền `{ ownerId, includePerSales }` vào `summary()`.
2. Service: thread `ownerFilter` qua 5 query hiện có; viết 3 query mới; lắp vào `Promise.all`.
3. Test (khuôn `overview-excludes-on-hold.test.ts`):
   - admin + `ownerId=sales1` → mọi con số chỉ gồm data sales1; `unassignedCompanies` đúng.
   - actor sales1 truyền `ownerId=sales2` → nhận data sales1 (bị ép).
   - actor sales → `perSales` vắng mặt; admin → có, đúng số dòng = số sales.
   - `dueSoon` không chứa quá hạn, không chứa stage đóng; `missingNextStep` không chứa on_hold.

## Success Criteria
- [ ] 4 nhóm test trên xanh; test overview cũ xanh không sửa assertion
- [ ] `pnpm typecheck` xanh
- [ ] Không chạm file nào ngoài 3 file trên + contracts (phase 1)

## Risk Assessment
- Proposal linkage chưa xác minh → bước xác minh đứng trước khi code; fallback đã định nghĩa (bỏ cột, không join gượng).
- `todayIso()` và cộng-3-ngày qua ranh giới tháng — dùng date arithmetic của Postgres (`+ interval '3 days'`) hoặc helper sẵn có, không tự cộng string.

---
phase: 1
title: "ADR + contract + cổng build"
status: pending
priority: P1
dependencies: []
---

# Phase 1: ADR + contract + cổng build

## Overview

Ghi hai ADR (một trong đó **thay thế một phần** hai ADR đã ký), sửa các dòng tài liệu sẽ thành sai, dựng contract phân trang, và đóng cổng build cho `packages/contracts` — thứ bản plan đầu bỏ sót và sẽ chặn phase 8 nếu quên.

## Requirements

- Functional: ADR-0046 (phân quyền theo người phụ trách) + ADR-0047 (contract phân trang); schema/type phân trang export được **và nhìn thấy được từ `apps/web`**.
- Non-functional: ADR-0046 phải nêu rõ nó lật cái gì; tài liệu cũ phải được sửa trong **cùng commit**, không để trôi.

## Architecture

### ADR-0046 — Phân quyền theo người phụ trách, toàn hệ thống

Đây **không phải quyết định mới**. Nó lật hai quyết định đã ký, và ADR phải nói thẳng điều đó ở dòng đầu:

- **Thay thế một phần ADR-0033**: ADR-0033 chốt "vòng 1 Admin có quyền CRM y hệt Sales, ma trận quyền chi tiết ngoài phạm vi", và tự nêu điều kiện xem lại là *"seed có từ hai người sở hữu trở lên"*. Điều kiện đó **đã xảy ra** khi ADR-0045 đổi seed thành 3 sales. ADR-0046 ghi nhận việc đó — phần "Admin = Sales về quyền CRM" vẫn giữ, chỉ phần "chưa có ma trận theo người sở hữu" bị thay.
- **Lật phương án E của ADR-0045**: ADR-0045 loại "RBAC per-owner" là scope creep. ADR-0046 phải ghi lý do lật: yêu cầu lọc theo **quyền** (không phải theo view) đến sau khi ADR-0045 ký, và người quyết định chấp nhận vượt mốc 15:00 để làm.

Nội dung quyết định:

- Sale chỉ thấy và chỉ ghi được trong phạm vi công ty mình phụ trách (`companies.owner_id`); admin toàn quyền.
- Cổng **fail-closed**: thu hẹp trừ khi `role === 'admin'`; actor người không có role → từ chối.
- Logic vai ở **controller**, scope truyền xuống service tường minh (giữ đúng tiền lệ `OverviewController`).
- **Một tầng, và nói thật**: `crm_app` giữ `GRANT ALL ON ALL TABLES` (`0001_grants.sql:24-31`), repo không có RLS → luật này chỉ sống ở tầng domain, khác với trần tự chủ AI vốn có CSDL đỡ lưng. ADR phải liệt kê mọi nơi đọc `proposals`/`companies` qua `dbApp` như bề mặt phải bảo trì.
- Công ty chưa gán người phụ trách: loại khỏi phạm vi sale **và đếm rồi nói rõ** — theo đúng pattern `unassignedCompanies` đã ship ở `/tong-quan` (`overview-service.ts:250`).

Phương án bị loại (bắt buộc ghi): (a) giữ nguyên "scope = view" của ADR-0045 — không đáp ứng yêu cầu mới; (b) chỉ phân quyền hàng đợi — hàng rào nửa vời, để ngỏ đường ghi qua `undo()`, tạo màn hình nói dối ở badge; (c) làm RLS ở CSDL cho đủ hai tầng — đúng chuẩn hơn nhưng cần migration + đổi cách nối pool trong ngày chấm.

### ADR-0047 — Contract phân trang offset

- Query `page`/`pageSize`, envelope `{ items, total, page, pageSize }`, áp cho notifications + companies.
- **Sắp xếp phải có khoá phụ `id`** — `ORDER BY created_at DESC, id DESC`. Không có khoá phụ thì dòng trùng timestamp có thể hiện hai trang hoặc không trang nào, và vòng quét chạy 10s/lần trong e2e nên đây là race thật.
- `items` và `count(*)` là hai câu lệnh: hoặc gói trong một transaction, hoặc **ghi nhận thẳng vào ADR** rằng `total` có thể lệch một nhịp so với `items`.
- Ghi trung thực lý do: **do người dùng yêu cầu**, không phải do dữ liệu tăng vô hạn. Seed có 5 công ty; công ty chỉ người tạo được (`company-service.ts:31-36`, `crm_system` không có GRANT INSERT); thông báo do vùng 3 viết chứ không phải vùng 4. Bản brainstorm ghi sai điều này — ADR sửa lại.

### Contract

```ts
// packages/contracts/src/dto/pagination.ts
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})
export interface Paginated<T> { items: T[]; total: number; page: number; pageSize: number }

/** Query strings have no booleans. NEVER z.coerce.boolean() — it is Boolean(input), so "false" → true. */
export const booleanQuerySchema = z.enum(['true', 'false']).optional().transform((v) => v === 'true')
```

`booleanQuerySchema` là bản đóng gói của pattern đã có sẵn ở `company.controller.ts:52-58` kèm comment giải thích. Bản plan đầu viết `z.coerce.boolean()` — sai, 3/4 reviewer bắt được.

## Related Code Files

- Create: `docs/decisions/0046-phan-quyen-theo-nguoi-phu-trach-toan-he-thong.md`
- Create: `docs/decisions/0047-contract-phan-trang-offset-co-khoa-phu.md`
- Modify: `docs/decisions/0033-vong-1-admin-co-quyen-crm-nhu-sales-ma-tran-quyen-chi-tiet-ngoai-pham-vi.md` (trạng thái: bị thay thế một phần)
- Modify: `docs/decisions/0045-dang-nhap-demo-tai-dung-luong-mat-khau-va-dashboard-scope-theo-vai.md` (ghi phương án E bị lật)
- Modify: `docs/ontology.md` (dòng 18 và dòng 326)
- Modify: `docs/decisions/README.md` (mục lục)
- Create: `packages/contracts/src/dto/pagination.ts`
- Create: `packages/contracts/src/__tests__/pagination-query-parsing.test.ts`
- Modify: `packages/contracts/src/index.ts`

## Implementation Steps

1. Đọc `0038-*.md` để lấy đúng format (bảng phương án, mục "AI đã tham gia thế nào", "Đội đã verify bằng cách nào"). **Số kế tiếp là 0039** — thư mục đã có 0037, 0038; convention tên file là `NNNN-slug.md`, **không** tiền tố `ADR-`.
2. Viết ADR-0046, ADR-0047.
3. Sửa `ontology.md:18` + `:326`, sửa trạng thái ADR-0033/0038.
4. **Test đỏ trước** cho contract — chỉ test cái nào là bất biến sản phẩm, không test lại hành vi của zod:
   - `booleanQuerySchema` với `'false'` → `false` (đây là bất biến thật, và là bug bản đầu suýt ship).
   - `booleanQuerySchema` với `undefined` → `false`; với `'true'` → `true`.
   - `paginationQuerySchema` chặn `page=0`, `pageSize=101`.
5. Viết `pagination.ts`, export qua barrel.
6. **Cổng bàn giao**: chạy `pnpm --filter @crm/contracts build` rồi xác nhận `apps/web` typecheck thấy `Paginated`. `packages/contracts/dist` bị gitignore và `apps/web` resolve qua `dist` (`package.json` main/types), nên bỏ bước này thì phase 6/8 gặp lỗi "has no exported member 'Paginated'" trỏ nhầm chỗ.

## Success Criteria

- [ ] ADR-0046 mở đầu bằng câu nói rõ nó thay thế phần nào của ADR-0033 và lật phương án nào của ADR-0045
- [ ] `ontology.md:18` không còn khẳng định điều mà code sắp làm ngược lại
- [ ] Test contract xanh, gồm case `'false'` → `false`
- [ ] `pnpm --filter @crm/contracts build` chạy, `apps/web` typecheck thấy `Paginated`

## Risk Assessment

- Sửa ADR đã ký là việc nhạy cảm — không xoá nội dung cũ, chỉ thêm trạng thái + trỏ sang ADR mới. Lịch sử quyết định là bằng chứng vòng 2.
- Đụng số ADR với người khác: lấy số ngay trước khi commit.

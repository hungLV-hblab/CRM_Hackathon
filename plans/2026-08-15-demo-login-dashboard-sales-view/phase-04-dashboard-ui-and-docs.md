---
phase: 4
title: "Dashboard UI + docs"
status: completed
priority: P2
dependencies: [3]
---

# Phase 4: Dashboard UI + docs

## Overview
Màn Tổng quan render theo role: sales tự scope + 2 khối mới; admin thêm filter + bảng per-sales. Chốt README + ADR.

## Requirements
- Functional:
  - Sales: dòng "Đang xem: dữ liệu của bạn"; các khối như cũ + `dueSoon` + `missingNextStep`.
  - Admin: dropdown filter theo sales (pattern `filter-bar.tsx`), lựa chọn đẩy vào URL param (`?sales=`) để share link demo; bảng per-sales mỗi-người-một-dòng; khi lọc hiện dòng "Không gồm N công ty chưa gán người phụ trách" nếu N > 0.
  - Cột "gợi ý chờ duyệt" trong bảng per-sales: máy sinh → tím theo design-guidelines; nếu phase 3 bỏ cột proposal (linkage fail) thì UI cũng bỏ, kèm ghi chú.
- Non-functional: giữ triết lý màn — mọi con số nói rõ nó không gồm gì; KHÔNG nhân đôi metric chất lượng AI từ màn Quản trị; thứ tự khối theo luật 5: quá hạn → đến hạn sắp tới → thiếu next step → pipeline → còn lại.

## Architecture
- Role lấy từ nguồn actor sẵn có của frontend (`/auth/me` — tìm hook/context đang dùng ở `app-shell`/`layout` và tái dùng, không gọi thêm).
- Query key `['overview', ownerId]` để filter đổi là refetch; `ownerId` từ `useSearchParams`.
- Khối mới dùng `Table`/`EmptyState`/`SectionCard` sẵn có — không component mới.

## Related Code Files
- Modify: `apps/web/src/app/(app)/tong-quan/page.tsx` (nếu vượt xa 200 dòng sau khi thêm — hiện ~275 — tách `per-sales-table.tsx` cùng thư mục)
- Modify: `apps/web/src/lib/api-client.ts` (thêm param ownerId cho `api.overview`)
- Modify: `README.md` (mật khẩu `hackathon#1`, hướng dẫn tab demo)
- Create: `docs/decisions/ADR-00XX-demo-login-va-dashboard-theo-role.md` (số kế tiếp trong thư mục) — gộp: 2-tab tái dùng luồng mật khẩu (loại endpoint bypass) · sales tự scope là view không phải quyền (loại RBAC) · chiều sở hữu qua `companies.ownerId` (loại owner trên opportunity) · tài khoản demo là shared constant (loại endpoint public, giữ anti-oracle)
- Create: `e2e/dashboard-role-view.spec.ts`

## Implementation Steps
1. `api.overview(ownerId?)` + query key mới.
2. Render theo role: sales — banner scope + 2 khối mới; admin — filter + bảng per-sales + dòng "không gồm".
3. E2E: login sales1 (tab demo) → tổng quan chỉ thấy số của sales1, không thấy filter; login admin → filter chọn sales2 → con số đổi, bảng per-sales đủ 3 dòng.
4. README + ADR.
5. Chạy full `pnpm lint && pnpm typecheck && pnpm test`.

## Success Criteria
- [ ] E2E role-view xanh; e2e cũ xanh
- [ ] Checklist design-guidelines mục 7 (không class màu thô, tím chỉ ở chỗ máy sinh, vùng chạm ≥44px, tương phản)
- [ ] ADR có mục "phương án bị loại"; README hết `sales123`
- [ ] Một người khác trong đội giải thích lại được thiết kế (DoD mục 7 CLAUDE.md)

## Risk Assessment
- Sát 15:00: bảng per-sales là phần cắt được cuối cùng — filter đơn thuần đã thoả yêu cầu BTC 3.3. Nếu cắt, ghi chú vào ADR.
- `useSearchParams` cần Suspense boundary trong App Router — bọc đúng chỗ, tránh lỗi build standalone.

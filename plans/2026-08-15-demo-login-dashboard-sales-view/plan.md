---
title: "Demo login 2 tab + Dashboard theo role Sales/Admin"
status: completed
created: 2026-08-15
completed: 2026-08-15
mode: fast
blockedBy: []
blocks: []
source: plans/2026-08-15-demo-login-dashboard-sales-view/brainstorm-report.md
---

# Plan — Demo login 2 tab + Dashboard theo role

Mọi quyết định thiết kế đã chốt trong [brainstorm-report.md](brainstorm-report.md) (8 quyết định kèm phương án bị loại). Plan này chỉ triển khai, không mở lại quyết định.

**Ràng buộc cứng:** hôm nay 15/08 — hardening day, vòng 1 chốt 15:00. Không migration, không endpoint auth mới, không component UI tổng quát mới.

## Phases

| # | Phase | Status | Phụ thuộc |
| --- | --- | --- | --- |
| 1 | [Contracts + Seed](phase-01-contracts-and-seed.md) | completed | — |
| 2 | [Login 2 tab](phase-02-demo-login-tabs.md) | completed | 1 |
| 3 | [Overview API theo role](phase-03-overview-api-role-scoping.md) | completed | 1 |
| 4 | [Dashboard UI + docs](phase-04-dashboard-ui-and-docs.md) | completed | 3 (e2e cần 2) |

## Kết quả

- Test: `pnpm test:unit` 483/483 · Playwright 47/47 · lint + typecheck sạch. `pnpm build` trên host fail vì EPERM symlink của Windows (hạn chế môi trường); bản production build trong Docker thành công.
- ADR: [0038](../../docs/decisions/0045-dang-nhap-demo-tai-dung-luong-mat-khau-va-dashboard-scope-theo-vai.md).
- Phát sinh ngoài plan (đều là hệ quả trực tiếp, không mở scope):
  - Mật khẩu seed đổi `sales123`/`admin123` → `hackathon#1` kéo theo 14 file e2e và `login.test.ts`.
  - Hạn của cơ hội Sakura dời 2026-08-20 → 2026-08-17 để khối "đến hạn 3 ngày tới" có dữ liệu vào ngày demo.
  - `t1-crm-without-ai.spec.ts`: bước Tổng quan chuyển sang assert theo vai; hai assert bị trùng khớp (`Thương lượng`, tên ngành) được scope vào đúng bảng vì khối mới cũng render các chuỗi đó.
  - `login.test.ts` định vị admin bằng role thay vì vị trí mảng (seed giờ có 3 sales đứng trước admin).

## Acceptance criteria (toàn plan)

- Tab demo trên màn login: bấm 1 tài khoản → vào app đúng identity, không gõ mật khẩu; tab mật khẩu cũ nguyên vẹn.
- `GET /overview`: actor sales bị ép self-scope (kể cả truyền `ownerId` người khác); admin filter được từng sales hoặc xem tất cả; `perSales` chỉ trả cho admin.
- Dashboard có khối "đến hạn hôm nay→+3 ngày" và "cơ hội thiếu Việc tiếp theo"; khi lọc có dòng "Không gồm N công ty chưa gán người phụ trách".
- `pnpm test` xanh; checklist design-guidelines mục 7 cho phần UI.
- ADR gộp đã ghi; README hết nhắc `sales123`.

## Rollback

Toàn bộ additive trừ seed users và hành vi `/overview` với role sales. Rollback = revert commit; seed chạy lại bằng `pnpm reset && pnpm seed`. Không có migration nên không có rollback CSDL.

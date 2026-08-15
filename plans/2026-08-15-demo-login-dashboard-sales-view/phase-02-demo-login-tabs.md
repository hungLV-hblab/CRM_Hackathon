---
phase: 2
title: "Login 2 tab"
status: completed
priority: P1
dependencies: [1]
---

# Phase 2: Login 2 tab

## Overview
Màn đăng nhập thêm tab "Tài khoản demo" — danh sách nút, bấm là vào thẳng. Tab mật khẩu giữ nguyên từng dòng logic.

## Requirements
- Functional: bấm nút account → gọi `api.login(email, DEMO_PASSWORD)` → push `/cong-ty` + `refresh()` đúng luồng cũ (comment trong page giải thích vì sao cần refresh — giữ nguyên hành vi đó).
- Non-functional: không endpoint mới; segmented control cục bộ trong page, KHÔNG tạo component Tabs chung (YAGNI); vùng chạm ≥44px; nút hành-động-người → ngôn ngữ màu cam theo design-guidelines, không có màu tím ở màn này (không có gì máy sinh).

## Architecture
Một state `tab: 'password' | 'demo'` trong `LoginPage`. Tab demo render `DEMO_ACCOUNTS.map(...)` — mỗi nút hiện tên + role (nhãn tiếng Việt: "Sales" / "Quản trị"). `pending` state dùng chung để khoá cả hai tab khi đang gọi login.

## Related Code Files
- Modify: `apps/web/src/app/dang-nhap/page.tsx`
- Create: `e2e/demo-login.spec.ts`

## Implementation Steps
1. Thêm segmented control 2 nút trên đầu form (aria: `role="tablist"`, `aria-selected`).
2. Tab demo: nút mỗi account từ `DEMO_ACCOUNTS` (import từ `@crm/contracts`), onClick gọi chung hàm submit với email account + `DEMO_PASSWORD`; hiển thị lỗi qua `ErrorState` sẵn có.
3. E2E: mở `/dang-nhap` → chuyển tab demo → bấm sales1 → land `/cong-ty`; bấm admin → thấy nav Quản trị. Kiểm tra tab mật khẩu vẫn login được.

## Success Criteria
- [ ] E2E demo-login xanh trên stack `:8080`
- [ ] Login mật khẩu cũ không đổi hành vi (login.test.ts + e2e cũ xanh)
- [ ] Checklist design-guidelines mục 7: không class màu thô, vùng chạm ≥44px

## Risk Assessment
- Mật khẩu nằm trong bundle client — chấp nhận có chủ đích (BTC phát công khai), đã ghi trong ADR. Không gate env để khỏi phức tạp demo.

---
phase: 9
title: "Hàng đợi — bộ lọc trên giao diện"
status: pending
priority: P2
dependencies: [4]
---

# Phase 9: Hàng đợi — bộ lọc trên giao diện

## Overview

Yêu cầu số 2 của người dùng: `/hang-doi` có bộ lọc theo công ty; admin có thêm bộ lọc theo sale.

Sau phase 4, phân quyền đã thu hẹp *dữ liệu*; phase này thêm bộ lọc để thu hẹp *tầm nhìn* trong phạm vi đã được phép. Hai thứ khác nhau và cả hai đều cần: một sale phụ trách 8 công ty vẫn muốn lọc còn 1.

## Requirements

- Functional: dropdown công ty cho mọi vai (option từ dữ liệu đang hiển thị); dropdown sale **chỉ hiện với admin**; hai bộ lọc kết hợp AND; xoá được bộ lọc.
- Non-functional: dropdown sale ẩn hẳn với sale, không phải disable — nhưng đây là tiện ích hiển thị, **không phải lớp bảo mật**; lớp bảo mật đã nằm ở phase 4/5, và đó là lý do việc ẩn UI ở đây là đủ.
- Design: checklist mục 7 design-guidelines; vùng chạm ≥44px; bộ lọc là hành động người bấm → cam `brand-*`, **không** dùng tím `machine-*`.

## Architecture

- Vai lấy từ `api.me()` (`apps/web/src/lib/api-client.ts:105`), theo pattern đã dùng ở `apps/web/src/components/shell/ai-status-pill.tsx:23`.
- Bộ lọc là state cục bộ của page (`useState`), áp bằng `useMemo` lên `rows`. **Không** đưa vào queryKey: dữ liệu đã scope ở server, lọc thêm chỉ thu hẹp tầm nhìn, và thêm vào key sẽ tạo một cache entry cho mỗi tổ hợp lọc mà chẳng để làm gì.
- Option dropdown dedupe theo `companyId` / `ownerId`; nhãn là `companyName` / `ownerName` (hai trường này do phase 4 thêm vào `ProposalDto`).
- Tái dùng `FilterBar` (`apps/web/src/components/ui/filter-bar.tsx`) và `Select` — lưu ý `Select` nằm trong `apps/web/src/components/ui/input.tsx:97`, **không** có file `select.tsx` (bản plan đầu ghi sai chỗ này).
- Empty state phải phân biệt hai trạng thái khác nhau: "hàng đợi trống" (đã có, testid `queue-empty` tại `hang-doi/page.tsx:114`) và "bộ lọc ra 0 dòng". Gộp hai câu này lại là nói sai với người đọc.

## Related Code Files

- Modify: `apps/web/src/app/(app)/hang-doi/page.tsx`
- Modify (nếu hiện tên sale trên card cho admin): `apps/web/src/app/(app)/hang-doi/proposal-card.tsx`
- Create: `e2e/queue-filters.spec.ts`

## Implementation Steps

1. **Test đỏ trước** (e2e, cần stack `:8080`):
   - Đăng nhập sale → thấy dropdown công ty, **không** thấy dropdown sale.
   - Đăng nhập admin → thấy cả hai; chọn sale → chỉ còn gợi ý của sale đó; chọn thêm công ty → giao hai bộ lọc.
   - Bộ lọc ra 0 dòng → hiện empty state "do bộ lọc" (khác `queue-empty`); xoá bộ lọc → danh sách quay lại.
2. Thêm `api.me()` query + hai dropdown; lọc `rows` bằng `useMemo`.
3. (Admin) hiện tên sale phụ trách trên card để dropdown có ngữ cảnh.
4. Checklist design-guidelines; chạy e2e mới + e2e hàng đợi sẵn có (T-5 đã di trú ở phase 3 — đọc lại bảng owner ở đó trước khi viết selector).

## Success Criteria

- [ ] 3 kịch bản e2e xanh; T-5 và các e2e hàng đợi khác không gãy
- [ ] Sale không nhìn thấy dropdown lọc theo sale
- [ ] Hai empty state phân biệt được; không class màu thô ngoài token

## Risk Assessment

- Dropdown sale chỉ liệt kê sale **đang có gợi ý chờ** — với admin nhìn toàn hệ thống thì đó là hành vi đúng cho mục đích lọc, nhưng phải nói rõ trên UI nếu gây khó hiểu.
- Sau phase 4, một sale có thể chỉ còn 1–2 công ty trong phạm vi, khiến dropdown công ty gần như vô dụng với họ. Nếu vậy thì vẫn giữ (admin cần), nhưng đừng đầu tư thêm gì cho nó.

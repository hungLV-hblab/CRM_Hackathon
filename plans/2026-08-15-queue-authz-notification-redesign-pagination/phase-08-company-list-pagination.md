---
phase: 8
title: "/cong-ty — phân trang"
status: pending
priority: P3
dependencies: [1, 4]
---

# Phase 8: /cong-ty — phân trang

## Overview

Phân trang server-side cho `GET /companies` và màn `/cong-ty`. Phase rủi ro cao nhất trên mỗi đơn vị giá trị: nó đổi shape response của endpoint có **5 nơi gọi** và **1 test API** tiêu thụ, để phục vụ một bảng hiện có 5 dòng.

Ghi nhận thẳng: lý do làm là **người dùng yêu cầu**, không phải vì dữ liệu tăng. Công ty chỉ người tạo được (`company-service.ts:31-36`; `crm_system` không có GRANT INSERT — `0001_grants.sql:38-63`). Bản brainstorm ghi "vòng quét zone 4 tự sinh" là **sai**, ADR-0047 đã sửa lại.

Đây là phase **đầu tiên nên cắt** nếu hết thời gian.

## Requirements

- Functional: `GET /companies?...&page&pageSize` trả `Paginated<CompanyDto>`; đổi filter/search reset về trang 1; dropdown industry/country vẫn đầy đủ.
- Non-functional: cả 5 nơi gọi được xử lý **tường minh**; không màn nào im lặng bị cắt còn 20 dòng.

## Năm nơi gọi `listCompanies` — không nơi nào được bỏ quên

Bản plan đầu liệt kê 1/5. Đây là danh sách đủ:

| Nơi gọi | File | Cần gì |
| --- | --- | --- |
| Bảng công ty | `cong-ty/page.tsx:44` | phân trang thật |
| Dropdown filter | `cong-ty/page.tsx:53` | **toàn bộ** giá trị distinct |
| Bảng cơ hội | `co-hoi/page.tsx:44` | danh sách đủ |
| Đang theo dõi | `dang-theo-doi/page.tsx:37` | danh sách đủ |
| Command palette | `command-palette.tsx:37` | danh sách đủ |
| Chuyển bản chụp (quản trị) | `quan-tri/snapshot-variant-switch.tsx:26` | danh sách đủ |

Bốn nơi cuối cần "đủ", không cần trang. Quyết định phải chốt: hoặc chúng truyền `pageSize` cao tường minh (và ADR ghi trần đó), hoặc contract quy định **thiếu `page` nghĩa là không giới hạn**. Chọn cách nào cũng được, nhưng phải viết ra — im lặng cắt 20 dòng là chế độ hỏng đã được cảnh báo.

Bằng chứng đây là rủi ro thật, không lý thuyết: `t8-watch-cycle-writes-timeline.spec.ts:206` tìm "Marlin Product Labs" trong `/dang-theo-doi`; `login-and-create-company.spec.ts` thêm một công ty mỗi lần chạy e2e trên stack chung; thứ tự là `asc(companies.name)` (`company-service.ts:67`). Qua 20 công ty thì Marlin (M) rớt khỏi trang 1 và T-8 đỏ **theo số lần đã chạy e2e** — trông y hệt flake.

## Hai bẫy cache key

1. `['companies', {}]` **không** của riêng `/cong-ty`: `command-palette.tsx:37` dùng key giống hệt với `queryFn` khác. Mở ⌘K trước rồi vào `/cong-ty` → dropdown dựng từ cache của palette. → Đặt key riêng cho dropdown: `['company-facets']`.
2. Query chính của `/cong-ty` là `['companies', filters]`, bằng đúng `['companies', {}]` khi chưa lọc — va chạm sẵn có, trở nên có hại khi hai bên khác `pageSize`.

## Bẫy sắp xếp

`/cong-ty` hiện sort client-side bằng `localeCompare(..., 'vi')` trên toàn mảng (`cong-ty/page.tsx:84-96`), trong khi server đã `orderBy(asc(companies.name))` (`company-service.ts:67`). Khi phân trang, sort client chỉ sắp trong trang → **sai âm thầm**.

- (a) Đưa sort xuống server, `ORDER BY name, id` (khoá phụ theo ADR-0047). **Phải test collation thật** với dữ liệu có Đ và dấu — nếu Postgres trong container không có locale `vi`, đỏ ở đây.
- (b) Nếu (a) đỏ: bỏ sort khi đang phân trang, giữ sort chỉ khi tổng ≤ pageSize. Xấu nhưng không bao giờ sai. Ghi lý do vào ADR-0047.

## Related Code Files

- Modify: `apps/api/src/domain/company/company-service.ts`, `company.controller.ts`
- Modify: `packages/contracts/src/dto/company.ts` — `ListCompaniesQuery` hiện là **interface TS thuần**, controller tự parse 5 param (`company.controller.ts:44-59`). Thêm zod schema là **viết lại chữ ký list**, không phải mở rộng pattern sẵn có; phải xoá interface cũ để không có hai nguồn sự thật.
- Modify: cả 6 dòng gọi trong bảng trên
- **Modify: `apps/api/src/domain/company/__tests__/company-search-and-filter.test.ts:56-64`** — `rows.map(row => row.name)` gãy typecheck với envelope
- Create: `apps/api/src/domain/company/__tests__/company-list-pagination.test.ts`
- Đọc, có thể sửa: `e2e/t8-watch-cycle-writes-timeline.spec.ts`, `e2e/login-and-create-company.spec.ts`

## Implementation Steps

1. **Test đỏ trước** (API): page/pageSize cắt đúng; `total` đếm theo filter chứ không đếm toàn bảng; `q` + filter + trang gộp lại khớp `total`; **test collation** với Đ và dấu; hai công ty cùng tên → khoá phụ `id` giữ thứ tự ổn định.
2. Chuyển query sang zod schema duy nhất, xoá interface cũ, sửa controller.
3. Sửa service: limit/offset + count + `orderBy(name, id)`.
4. Sửa **cả 6** dòng gọi; đặt key `['company-facets']` cho dropdown.
5. Sửa `company-search-and-filter.test.ts`.
6. Sửa page: state `page`, reset khi filter/search đổi, bỏ sort client (hoặc phương án b), thêm điều khiển trang.
7. Chạy: test API → `pnpm typecheck` → **e2e đầy đủ** (không chỉ e2e công ty — T-8 và command palette đều chạm).

## Success Criteria

- [ ] Test phân trang + collation xanh (hoặc phương án b đã áp dụng và ghi lý do vào ADR-0047)
- [ ] Cả 6 nơi gọi được xử lý tường minh; không nơi nào im lặng cắt 20 dòng
- [ ] Dropdown filter có key riêng, không va với command palette
- [ ] T-8 xanh kể cả sau nhiều lần chạy e2e (đã tạo thêm công ty)

## Risk Assessment

- **Cắt phase này trước tiên nếu hết giờ.** Giá trị thấp nhất (5 dòng dữ liệu), bán kính ảnh hưởng rộng nhất (6 nơi gọi + 2 test + 1 bài nghiệm thu).
- Sort + phân trang là cái bẫy chính; bỏ qua sẽ ship danh sách sắp xếp sai mà không ai để ý ngay.

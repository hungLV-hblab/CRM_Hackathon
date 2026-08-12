---
phase: 5
title: "apps/web — đăng nhập + danh sách công ty"
status: done
priority: P2
dependencies: [1]
---

# Phase 5: apps/web — đăng nhập + danh sách công ty

## Overview

Next.js 15 App Router, Tailwind + shadcn/ui, TanStack Query. Đúng hai màn hình: đăng nhập và danh sách/tạo công ty. **Không làm UI đẹp** — mục tiêu là chứng minh đường ống FE→API→CSDL thông.

## Requirements

- Functional: đăng nhập bằng form thật, cookie giữ phiên qua reload; danh sách công ty đọc từ API; tạo công ty mới thấy ngay trong danh sách.
- Non-functional: `output: 'standalone'`; build production chạy được; không hot reload trong compose.

## Architecture

Client component + TanStack Query gọi thẳng `/api/*`. Cùng origin nhờ Caddy (Phase 6) nên cookie `httpOnly` chạy thẳng, không CORS, không `SameSite=None`.

Không dùng Server Action: hàng đợi duyệt (nhóm 3) cần phản hồi tức thì và đo `seconds_to_decide` — chọn kiểu lấy dữ liệu ở đây là chọn cho **cả** những màn hình sau, không chỉ hai màn này.

C dựng UI theo type ở `@crm/contracts` ngay khi Phase 1 xong, không chờ Phase 3. Nối API thật ở Phase 6, hoặc sớm hơn nếu B xong trước.

## Related Code Files

- Create: `apps/web/{next.config.ts,tailwind.config.ts,package.json,tsconfig.json}`
- Create: `apps/web/src/app/{layout.tsx,page.tsx}`
- Create: `apps/web/src/app/dang-nhap/page.tsx`
- Create: `apps/web/src/app/cong-ty/page.tsx`
- Create: `apps/web/src/components/ui/*` (shadcn: button, input, table, dialog, badge)
- Create: `apps/web/src/lib/api-client.ts` — fetch wrapper, `credentials: 'include'`
- Create: `apps/web/src/lib/query-provider.tsx`
- Create: `e2e/dang-nhap-va-tao-cong-ty.spec.ts`, `playwright.config.ts`

## Implementation Steps

### Bước đỏ — Playwright trước

`dang-nhap-va-tao-cong-ty.spec.ts`:

1. Vào `/` khi chưa đăng nhập → chuyển hướng `/dang-nhap`
2. Đăng nhập sai → hiện lỗi, vẫn ở trang đăng nhập
3. Đăng nhập `sales@` đúng → tới `/cong-ty`
4. **Reload trang → vẫn đăng nhập** (cookie httpOnly thật, không phải state trong bộ nhớ)
5. Tạo công ty tên `Cty Kiem Thu` → xuất hiện trong bảng
6. Đăng xuất → về `/dang-nhap`

Điểm 4 là điểm dễ bỏ sót nhất và đúng thứ spec 7.3 đòi ("đăng nhập thật"). Viết nó ngay từ đầu.

### Bước xanh

1. `create-next-app` App Router + Tailwind, đặt `output: 'standalone'` **ngay từ đầu** (đổi muộn hay vỡ đường dẫn tài nguyên).
2. `shadcn init` + thêm đúng 5 component cần: button, input, table, dialog, badge.
3. `api-client.ts`: `credentials: 'include'`, base `/api`. **Không** hardcode `localhost:3001` ở đâu cả.
4. Trang đăng nhập: form, gọi `POST /api/auth/login`, lỗi hiện tại chỗ.
5. Trang công ty: `useQuery` liệt kê, dialog tạo mới, `invalidateQueries` sau khi tạo.
6. Chặn truy cập: middleware Next kiểm cookie tồn tại (kiểm chữ ký ở API, FE chỉ chặn hiển thị).

### Chuẩn bị cho luật 2 (chưa dùng ở phase này)

Tạo sẵn 3 component rỗng có tên đúng, để nhóm 2/3 không mỗi người tự đặt tên một kiểu: `badge-do-tin-cay.tsx`, `khoi-cau-trich.tsx`, `nhan-do-he-thong-them.tsx`. Chỉ khung + props, chưa cần đẹp. YAGNI cho phép — đây là điểm hẹn đặt tên, không phải tính năng dự phòng.

## Success Criteria

- [x] 6 bước e2e xanh trên bản **production build** — chạy trong compose sau Caddy, không phải `next dev`
- [x] Không chuỗi `localhost:3001` nào trong `apps/web`
- [x] `output: 'standalone'` có trong `next.config.ts`
- [x] Xoá cookie → reload → bị đá về `/dang-nhap` (tự động hoá bằng `context.clearCookies()`)

## Chốt lại — khác gì so với lúc viết phase

| Định làm | Làm thật | Vì sao |
| --- | --- | --- |
| shadcn/ui init + 5 component | Primitives tự viết ở **đúng** đường dẫn `@/components/ui/*` | `shadcn init` hỏi tương tác và hay xung đột với token Tailwind v4. Giữ nguyên đường import nên đổi sang shadcn thật sau chỉ là thay file, không phải refactor |
| `badge-do-tin-cay.tsx` · `khoi-cau-trich.tsx` · `nhan-do-he-thong-them.tsx` | Gộp vào `components/provenance/quote-block.tsx`: `QuoteBlock` · `ConfidenceBadge` · `SystemAddedLabel` | Luật mới của đội: **tên file luôn tiếng Anh**. Ba component cùng phục vụ luật 1 (provenance) nên ở chung một file vẫn dưới 200 dòng |
| `playwright.config.ts` có `webServer` | **Không** có `webServer`, trỏ `:8080` | Môi trường duy nhất đáng chấm là stack production sau Caddy. Cho Playwright tự bật `next dev` là xanh trên thứ không ai ship |
| 6 bước trong 1 spec | 3 spec: luồng 6 bước · xoá cookie · cờ `HttpOnly` | Hai điểm sau là tiêu chí riêng, tách ra thì khi đỏ biết ngay đỏ ở đâu |

`next build` chạy **trên Windows** gãy ở bước symlink của `standalone` (`EPERM`, cần Developer Mode). Không ảnh hưởng sản phẩm — bước này chạy trong Docker và đã xanh.

## Risk Assessment

- **shadcn init hỏi tương tác, treo trong môi trường không TTY** → chạy tay một lần, commit kết quả.
- **Playwright cần API + CSDL chạy** → `webServer` trong `playwright.config.ts` khởi động sẵn; ở Phase 6 chuyển sang trỏ vào compose.
- **P5 chạy song song P3 nên chưa có API thật** → dùng type ở contracts, chấp nhận nối muộn. Không viết mock server: nó sẽ thành rác phải xoá (development-rules cấm mock để qua test).

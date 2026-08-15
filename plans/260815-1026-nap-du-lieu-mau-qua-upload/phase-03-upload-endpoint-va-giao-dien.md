---
phase: 3
title: "Endpoint upload + giao diện admin"
status: pending
priority: P1
dependencies: [2]
---

# Phase 3: Endpoint upload + giao diện admin

## Overview

Tính năng thật người dùng bấm: admin vào `/quan-tri`, chọn file zip, xác nhận, hệ thống nạp lại — đúng yêu cầu gốc spec mục 7 điều kiện 5. Đích danh phần này thay thế "nạp bằng một lệnh".

## Requirements

- Route `POST /admin/import-data`, `@Roles('admin')` + `JwtGuard` + `RolesGuard`, nhận `multipart/form-data` field `file` (zip).
- Dùng lại **nguyên hàm** `parseZipDataset()` (phase 1) + `seed()` (phase 2) — không viết logic import thứ hai.
- Trả về tóm tắt: số công ty/liên hệ/cơ hội/trang bản chụp đã nạp + danh sách cảnh báo (mã rác bị lọc).
- UI: panel trên `/quan-tri`, file input `.zip`, modal xác nhận trước khi gọi API ("Toàn bộ dữ liệu hiện tại sẽ bị xoá và thay bằng dữ liệu trong file này — không hoàn tác được"), trạng thái loading, hiển thị tóm tắt sau khi xong.
- Nạp lại đúng file cũ → cùng kết quả với `pnpm seed` (cùng hàm, cùng dataset, cùng ID tất định).

## Architecture

### Không dùng DI token `DRIZZLE_OWNER` sống lâu — quyết định khác brainstorm report ban đầu

Brainstorm report đề xuất thêm token `DRIZZLE_OWNER` vào `db.module.ts`, giữ kết nối `crm_owner` mở suốt vòng đời process. Lúc lập plan, phát hiện cách đơn giản hơn và AN TOÀN HƠN: `seed()` (phase 2) đã nhận `connectionString` thô và tự mở/tự đóng pool trong đúng lời gọi đó — `AdminImportService` chỉ cần gọi thẳng:

```ts
await seed(requireEnv('DATABASE_URL_OWNER'), dataset)
```

`DATABASE_URL_OWNER` **đã có sẵn** trong environment của container `api` (đã verify — `infra/docker-compose.yml` dùng chung anchor `&database-urls` cho `migrate`/`api`/`worker`), không cần sửa docker-compose. Không có provider mới trong `db.module.ts`, không có pool `crm_owner` nào tồn tại lâu hơn đúng 1 lời gọi import. Bề mặt tấn công nhỏ hơn hẳn cách brainstorm report đề xuất ban đầu — ghi nhận lệch, không âm thầm.

**Vẫn cần ADR** (phase 5): dù không có DI token, `AdminImportService` vẫn là code trong `apps/api` đọc `DATABASE_URL_OWNER` — một ngoại lệ có chủ đích với nguyên tắc "API không bao giờ dùng `crm_owner`" mà `client.ts` ghi rõ trong comment. Phải giải thích vì sao an toàn (hành động admin người thật, đúng 1 route, kết nối ngắn hạn).

### Enforcement: đúng 1 file được đọc `DATABASE_URL_OWNER` trong `apps/api`

Viết test grep-based (`apps/api/src/__tests__/owner-credential-scoped-to-import.test.ts`):
```ts
const files = glob('apps/api/src/**/*.ts', { ignore: '**/__tests__/**' })
const matches = files.filter((f) => readFileSync(f, 'utf8').includes('DATABASE_URL_OWNER'))
expect(matches).toEqual(['apps/api/src/admin/admin-import-service.ts'])
```

## Related Code Files

- Create: `apps/api/src/admin/admin-import.controller.ts`
- Create: `apps/api/src/admin/admin-import-service.ts`
- Create: `apps/api/src/admin/admin.module.ts`
- Modify: `apps/api/src/app.module.ts` — import module mới
- Modify: `apps/api/package.json` — thêm `@types/multer` nếu chưa có
- Create: `apps/api/src/admin/__tests__/admin-import.e2e-spec.ts` hoặc integration test tương đương
- Create: `apps/api/src/__tests__/owner-credential-scoped-to-import.test.ts`
- Create: `apps/web/src/app/(app)/quan-tri/import-data-panel.tsx`
- Modify: `apps/web/src/app/(app)/quan-tri/page.tsx` — thêm panel
- Modify: `apps/web/src/lib/api-client.ts` — thêm method gọi endpoint mới (multipart upload)
- Create: `e2e/admin-import-data.spec.ts`

## Implementation Steps

1. **`AdminImportService`** — nhận `Buffer`, gọi `parseZipDataset()` rồi `seed()`, trả tóm tắt. Test integration: upload buffer thật của `hackathon-1-data.zip`, assert số liệu.
2. **`AdminImportController`** — `FileInterceptor('file')` từ `@nestjs/platform-express` (đã có sẵn, không cần thêm gói). Giới hạn kích thước file (đặt cỡ hợp lý, ví dụ 50MB) để tránh upload rác làm treo request.
3. **Test grant/role**: request không phải admin → 403. Request thiếu file → 400 rõ ràng.
4. **Test grep** đúng 1 file đọc `DATABASE_URL_OWNER` (bước Architecture trên) — viết SAU khi đã có `admin-import-service.ts`, chạy xanh ngay từ đầu vì chỉ có đúng 1 file đọc biến này.
5. **UI panel** — theo đúng token màu/component đã có trên `/quan-tri` (không tự bịa class màu thô, theo `docs/design-guidelines.md`). Modal xác nhận dùng pattern dialog sẵn có trong `apps/web/src/components/`.
6. **e2e**: đăng nhập admin → upload lại đúng `hackathon-1-data.zip` (đọc từ `packages/db/seed-assets/`) → xác nhận modal → chờ tóm tắt → assert số liệu đúng 25/38/15 + cảnh báo 8 mã rác. Chạy lại lần 2 trong cùng spec → xác nhận vẫn ra đúng kết quả (idempotent qua đường UI, không chỉ qua CLI).

## Success Criteria

- [ ] Admin upload qua UI → dữ liệu trong app khớp file zip, xác nhận bằng cách mở 1 công ty thật trên giao diện sau khi upload
- [ ] Sales (không phải admin) gọi endpoint → 403
- [ ] Upload file không phải zip / file rỗng → lỗi rõ ràng, không crash server
- [ ] Test grep xác nhận `DATABASE_URL_OWNER` chỉ xuất hiện ở đúng 1 file `apps/api/src`
- [ ] `e2e/admin-import-data.spec.ts` xanh, kể cả bước upload lần 2
- [ ] `pnpm typecheck` · `pnpm lint` xanh

## Risk Assessment

| Rủi ro | Giảm thiểu |
| --- | --- |
| Request upload treo lâu (16MB, parse CSV+HTML+unzip) chặn event loop Node | Đo thời gian thực tế lúc test; nếu quá chậm (>vài giây) cân nhắc chạy parse trong worker thread — quyết định khi có số đo thật, không đoán trước |
| Admin bấm nhầm, mất dữ liệu demo đang có | Modal xác nhận bắt buộc, chữ cảnh báo rõ "không hoàn tác được" — đây là hành vi ĐÚNG THIẾT KẾ (I-14 đòi reset được), chỉ cần người bấm hiểu hậu quả trước khi bấm |
| Route mới không qua Caddy đúng cách | `infra/Caddyfile` đã proxy mọi thứ dưới `/api` hay tương tự — kiểm tra pattern hiện có, route mới phải khớp, không tạo path riêng ngoài quy ước |

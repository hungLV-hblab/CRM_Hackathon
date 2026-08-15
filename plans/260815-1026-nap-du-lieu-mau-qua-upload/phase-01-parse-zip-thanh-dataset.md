---
phase: 1
title: "Parse zip thành dataset"
status: pending
priority: P1
dependencies: []
---

# Phase 1: Parse zip thành dataset

## Overview

Hàm thuần `parseZipDataset(buffer): Promise<SeedDataset>` — không chạm CSDL, không chạm HTTP. Input là bytes của `hackathon-1-data.zip`, output là dữ liệu đã validate, sẵn sàng để `seed()` (phase 2) ghi vào bảng. Test được độc lập, không cần Postgres.

## Requirements

- Đọc `Account.csv`, `Contacts.csv`, `Opps.csv` bằng CSV parser thật — **không split dòng tay**, cột `notes` có xuống dòng trong ô (đã verify: naive line-split đếm nhầm 89 dòng thay vì 25 công ty thật).
- Lọc `Opps.csv`: bỏ dòng có `company_code` không tồn tại trong `Account.csv` (8 dòng `O1`-`O8`, `sales_owner=Demo`) — KHÔNG throw, log rõ số dòng bị lọc + mã của chúng vào kết quả trả về (rule 4: trống hơn sai, và người dùng cần thấy).
- `company_type`/`stage`: reverse-lookup qua `COMPANY_TYPE`/`STAGE` của `packages/contracts/src/enums.ts` — đã verify khớp 100% nhãn tiếng Việt, không cần bảng map riêng. Giá trị không khớp → dòng đó bị loại + cảnh báo (không đoán).
- `is_tracked` (`Có`/`Không`) → `isWatched: boolean`.
- `sales_owner` **không đọc, không lưu** (quyết định đã chốt trong brainstorm).
- Gom `snapshot/*.html` theo regex `^(C\d+)-(.+)-(before|after)\.html$` → nhóm theo `(company_code, page_slug)`, mỗi nhóm tối đa 1 file `before` + 1 file `after`.
- `source_url` mỗi trang: `${website_url}#${page_slug}` khi `website_url` có giá trị, `null` khi không (C32) — đã verify không có code nào đọc giá trị thật của cột này ngoài hiển thị.
- **ID tất định, không random.** `deterministicUuid(kind: string, code: string): string` — sha256(`${kind}:${code}`), lấy 16 byte đầu, format theo dạng UUID chuẩn (dash ở đúng vị trí, set version nibble = '4', variant nibble ∈ {8,9,a,b} để hợp lệ với kiểu `uuid` của Postgres). Áp dụng cho company/contact/opportunity — cùng file zip luôn ra cùng ID, nạp lại vẫn đúng bộ ID cũ.

## Architecture

```
parseZipDataset(buffer)
  ├── unzip(buffer) → { 'Account.csv': Buffer, 'Contacts.csv': Buffer, 'Opps.csv': Buffer,
  │                      'snapshot/C15-homepage-before.html': Buffer, ... }
  ├── parseAccounts(csv) → RawCompany[]           (company_code giữ lại làm khoá tạm)
  ├── parseContacts(csv, companyCodes) → RawContact[]
  ├── parseOpportunities(csv, companyCodes) → { rows: RawOpportunity[], orphansDropped: string[] }
  ├── groupSnapshots(files) → Map<`${company_code}:${page_slug}`, { before?: Buffer, after?: Buffer }>
  └── assemble → SeedDataset { companies, contacts, opportunities, snapshotPages, warnings: string[] }
```

`SeedDataset` là kiểu dùng chung giữa CLI seed và endpoint upload — định nghĩa trong `packages/db/src/seed/seed-dataset.ts` (thay thế hoàn toàn nội dung cũ của `seed-data.ts`).

Vị trí: `packages/db` (không phải `apps/api`) — vì cả CLI (`packages/db/src/seed/index.ts`) lẫn API endpoint (phase 3) đều cần gọi, và `apps/api` đã phụ thuộc `@crm/db`, chiều phụ thuộc đúng hướng sẵn có.

Chưa có thư viện CSV/zip trong repo (đã grep xác nhận trống) — thêm vào `packages/db/package.json`:
- CSV: `csv-parse` — **dùng API đồng bộ `parse()` của thư viện, không dùng bản stream/async**
- Zip: `adm-zip` (API hoàn toàn đồng bộ) — **không dùng `unzipper`**, API của nó là stream/Promise-based, phá tính đồng bộ bắt buộc dưới đây

**Ràng buộc bắt buộc, phát hiện lúc validate plan (Contract Verifier):** `apps/api/src/ai/resolve-observation-source.ts:21` tính `SEED_COMPANY_IDS` **đồng bộ lúc load module** — thiết kế có chủ đích, comment gốc ghi rõ "a gate that needs a database... is a gate nobody re-checks" (I-16, chặn crawl thật công ty seed). Hai chỗ khác (`company-source-service.ts:101`, `company-service.ts:135`) gọi `isSeedCompany()` đồng bộ trong đường xử lý request. Nếu `parseZipDataset` là async-only, 3 chỗ này phải đổi cascade sang async — vỡ tính chất "pure function không cần DB" của toàn bộ I-16.

**Vì vậy `parseZipDataset` PHẢI có bản đồng bộ khả dụng** (`unzipZip()`/`parseCsvSync()` bên trong dùng API sync của `adm-zip`/`csv-parse`), để phase 2 tính `SEED_COMPANY_IDS` tại module-load time từ file zip checked-in, y hệt cách hiện tại tính từ mảng TS — chỉ đổi nguồn đọc, không đổi tính đồng bộ. Xem phase 2 mục Architecture.

## Related Code Files

- Create: `packages/db/src/seed/parse-zip-dataset.ts` — hàm chính
- Create: `packages/db/src/seed/deterministic-uuid.ts` — helper ID tất định
- Create: `packages/db/src/seed/seed-dataset.ts` — kiểu `SeedDataset`
- Create: `packages/db/src/seed/__tests__/parse-zip-dataset.test.ts`
- Create: `packages/db/src/seed/__tests__/deterministic-uuid.test.ts`
- Create: `packages/db/seed-assets/hackathon-1-data.zip` — copy nguyên văn từ `/home/trungmd/projects/ai-hackathon/hackathon-1-data.zip`
- Delete: `packages/db/src/seed/seed-data.ts` (sau khi phase 2 hết phụ thuộc vào nó)
- Modify: `packages/db/package.json` — thêm 2 dependency

## Implementation Steps

1. **Copy file zip vào repo** đúng đường dẫn trên. Xác nhận kích thước (~16MB) không phạm giới hạn nào của git/CI đội đang dùng (kiểm `.gitattributes`/LFS config nếu có).
2. **`deterministicUuid()` trước, có test riêng** — assert: cùng input → cùng output luôn; input khác nhau → output khác nhau (chạy qua toàn bộ 25+38+15 mã thật, assert không đụng nhau); output khớp regex UUID chuẩn.
3. **Viết `parseAccounts`/`parseContacts`/`parseOpportunities` từng hàm nhỏ, test riêng từng hàm** trên chính `hackathon-1-data.zip` thật (không fixture giả) — vì mục tiêu là parse ĐÚNG file này, test trên dữ liệu khác không chứng minh gì.
   - Test bắt buộc: `parseOpportunities` trả đúng 15 dòng thật + báo đúng 8 mã bị lọc (`O1`-`O8`).
   - Test bắt buộc: tổng công ty = 25, tổng liên hệ = 38.
   - Test bắt buộc: mỗi công ty có ĐÚNG MỘT `isPrimary=true` trong liên hệ của nó (ràng buộc `contacts_one_primary_per_company` sẽ từ chối nếu sai — bắt lỗi ở đây rẻ hơn bắt ở lúc insert).
4. **`groupSnapshots`** — test đếm: 24 công ty có ít nhất 1 trang, `C32` có 0. Test riêng case thiếu 1 vế (before hoặc after) không bị crash, chỉ để `null` ở vế thiếu.
5. **`parseZipDataset` lắp ráp toàn bộ**, test end-to-end trên file zip thật, assert `warnings` chứa đúng dòng cảnh báo 8 mã rác.
6. **Xoá `seed-data.ts`** — CHỈ sau khi `packages/db/src/seed/index.ts` (phase 2) không còn import nó. Nếu phase 1 làm riêng trước phase 2, để `seed-data.ts` tồn tại song song tới hết phase 2, không xoá giữa chừng làm gãy `pnpm seed` hiện tại.

## Success Criteria

- [ ] `pnpm --filter @crm/db test` xanh, riêng file `parse-zip-dataset.test.ts` chạy trên `seed-assets/hackathon-1-data.zip` thật
- [ ] `parseZipDataset()` trả 25 companies / 38 contacts / 15 opportunities / warnings có đúng 8 mã bị lọc
- [ ] `deterministicUuid('company', 'C18')` gọi 100 lần liên tiếp ra đúng 1 giá trị
- [ ] `pnpm typecheck` xanh

## Risk Assessment

| Rủi ro | Giảm thiểu |
| --- | --- |
| Chọn thư viện zip cần binary ngoài, vỡ trong Alpine image | Test bằng cách chạy đúng lệnh trong `node:22-alpine` container trước khi chốt thư viện, không chỉ chạy trên máy host |
| `deterministicUuid` đụng độ (collision) giữa 2 mã khác nhau | sha256 + 128 bit đủ an toàn cho <100 mã; vẫn viết test đếm unique trên toàn bộ mã thật để tự tin, không chỉ tin toán học |
| File zip 16MB làm chậm `pnpm install`/CI | Không liên quan install — đây là asset tĩnh, chỉ ảnh hưởng kích thước checkout git; ghi nhận nhưng không chặn |

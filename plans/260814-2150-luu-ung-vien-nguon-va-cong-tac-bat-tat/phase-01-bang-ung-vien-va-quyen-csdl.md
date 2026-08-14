---
phase: 1
title: "Bảng ứng viên và quyền CSDL"
status: done
effort: small
priority: P1
dependencies: []
---

# Phase 1: Bảng ứng viên và quyền CSDL

## Overview

Bảng `company_source_candidates` để ứng viên `web_search` sống qua reload — và **không một dòng GRANT nào** cho `crm_system`, nên AI không đọc nổi danh sách ứng viên của chính nó.

## Requirements

- Ứng viên lưu được `url`, `source_tier`, `reason`, `snippet`, `found_by`, `found_at`
- Cùng một `(company_id, url)` chỉ có một hàng ứng viên
- `crm_system` bị từ chối **cả bốn phép** SELECT/INSERT/UPDATE/DELETE
- `crm_app` ghi được, không cần thêm dòng GRANT nào
- Reseed (I-14) và `resetTestDatabase` dọn sạch bảng này

## Architecture

Vì sao **không** cần GRANT nào cho `crm_app` và vì sao **không được** thêm GRANT cho `crm_system` — cả hai đến từ `0001_grants.sql` và phải viết vào header migration để người sau không "sửa cho đủ bộ":

- `crm_owner` có `ALTER DEFAULT PRIVILEGES` grant ALL cho `crm_app` trên bảng nó tạo ⇒ migration chạy dưới `crm_owner` là `crm_app` tự có quyền.
- `crm_system` **cố ý không có** `ALTER DEFAULT PRIVILEGES` (`0001_grants.sql:13`) ⇒ bảng mới **tự động bị cấm** tới khi ai đó grant tay. Ở đây mặc định đó đúng và ta giữ nguyên. Đây là chỗ khác `company_sources`: bảng kia được cấp `SELECT` vì crawler phải biết đọc trang nào; bảng này crawler **không có việc gì** phải biết.

`reason` `NOT NULL`: nó là câu người dùng đọc để quyết định tick hay không. Một ứng viên không có lý do là một dòng để trống ở đúng chỗ quan trọng nhất (luật 4).

`found_by` nullable ở cột nhưng luôn có giá trị trong sản phẩm — cùng lập luận với `company_sources.added_by`.

## Related Code Files

- Create: `packages/db/migrations/0010_source_candidates.sql`
- Create: `packages/db/src/schema/company-source-candidates.ts`
- Modify: `packages/db/src/schema/index.ts` — export bảng mới
- Modify: `packages/db/src/schema/all-tables.ts` — thêm vào `ALL_TABLES`
- Modify: `packages/db/src/__tests__/live-source-columns-and-grants.test.ts` — thêm describe mới

## Implementation Steps

### 1. Test trước — bốn phép đều bị từ chối

Thêm vào `live-source-columns-and-grants.test.ts` một describe mới **sau** describe `company_sources` (test 13–18), đánh số tiếp **19–22**:

```ts
describe('company_source_candidates — AI không thấy nổi danh sách ứng viên của chính nó', () => {
  it('19 · crm_app thêm được ứng viên', async () => { /* INSERT qua app → 1 hàng */ })
  it('20 · crm_system SELECT bị từ chối — bảng này crm_system không có việc gì phải đọc', async () => {
    await expect(
      system.query('SELECT url FROM company_source_candidates'),
    ).rejects.toThrow(/permission denied/i)
  })
  it('21 · crm_system INSERT/UPDATE/DELETE đều bị từ chối', async () => { /* 3 assertion */ })
  it('22 · cùng một url không thêm hai lần cho một công ty', async () => { /* unique */ })
})
```

**Đỏ đúng lý do:** lần chạy đầu bảng chưa tồn tại nên lỗi là `relation ... does not exist`, **không** phải `permission denied`. Ghi nhận điều đó rồi mới viết migration — nếu sau khi có migration mà test 20 vẫn đỏ vì `does not exist` thì bảng đặt sai schema, không phải quyền sai.

### 2. Migration `0010_source_candidates.sql`

```sql
-- Header phải trả lời: bảng này có thuộc một QUYẾT ĐỊNH CỦA NGƯỜI không?
-- Có. Vậy crm_system không được grant gì, và dòng KHÔNG CÓ ở đây là dòng quan trọng nhất.
CREATE TABLE company_source_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  url text NOT NULL,
  source_tier text NOT NULL DEFAULT 'company_website',
  reason text NOT NULL,
  snippet text,
  found_at timestamptz NOT NULL DEFAULT now(),
  found_by uuid REFERENCES users(id),
  CONSTRAINT company_source_candidates_company_id_url_unique UNIQUE (company_id, url),
  CONSTRAINT company_source_candidates_source_tier_check
    CHECK (source_tier IN ('company_website', 'news', 'social'))
);
CREATE INDEX company_source_candidates_company_id_idx ON company_source_candidates (company_id);
-- KHÔNG có GRANT cho crm_system. Xem header.
```

### 3. Schema drizzle + `ALL_TABLES`

`company-source-candidates.ts` theo đúng khuôn `company-sources.ts` (comment giải thích quyền, không chỉ mô tả cột).

Trong `ALL_TABLES`, đặt **ngay trên `companySources`** — nó tham chiếu `companies` và `users` nên phải xoá trước hai bảng đó. Header của `all-tables.ts` đã cảnh báo: thiếu ở đây thì reseed để lại rác và test rò hàng giữa các file.

### 4. Chạy

`pnpm db:generate` chỉ để đối chiếu snapshot drizzle; **migration viết tay** vì có dòng GRANT/không-GRANT có ý nghĩa. Rồi `pnpm db:migrate` + chạy test.

## Success Criteria

- [ ] Test 19–22 xanh; test 1–18 cũ không đổi một dòng nào
- [ ] Đảo code chứng minh test có răng: thêm tay `GRANT SELECT ON company_source_candidates TO crm_system` → **test 20 đỏ**, rồi bỏ ra
- [ ] `ALL_TABLES` có `companySourceCandidates`, đặt trên `companySources`
- [ ] `pnpm typecheck` xanh

## Risk Assessment

| Rủi ro | Giảm thiểu |
| --- | --- |
| Thêm GRANT "cho đủ bộ" vì thấy `company_sources` có SELECT | Header migration nói thẳng vì sao hai bảng khác nhau; test 20 chặn |
| Quên `ALL_TABLES` | Test integration khác sẽ rò hàng và đỏ ngẫu nhiên — khó truy. Việc này ở step 3, không để cuối |
| Đặt migration số trùng | `0009` đã dùng (thêm `unreachable`). Kiểm `ls packages/db/migrations` trước khi đặt tên |

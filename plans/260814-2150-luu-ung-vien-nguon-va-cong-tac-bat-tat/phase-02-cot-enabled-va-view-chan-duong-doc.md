---
phase: 2
title: "Cột enabled và view chặn đường đọc"
status: done
effort: small
priority: P1
dependencies: [1]
---

# Phase 2: Cột enabled và view chặn đường đọc

## Overview

Cột `enabled` cho nguồn đã lưu, và cách chặn "AI đọc trang người ta vừa tắt" bằng **quyền CSDL** thay vì bằng một `WHERE` phải nhớ: `REVOKE SELECT` trên bảng, tạo view `company_sources_enabled`, grant `SELECT` trên view.

## Requirements

- Nguồn đã lưu tạm tắt được mà không mất `search_snippet` / `added_by` / `created_at`
- `enabled` mặc định `true` — nguồn đang chạy không đổi hành vi khi migration lên
- `crm_system` **không** `SELECT` được thẳng `company_sources` nữa
- `crm_system` `SELECT` được view, và view **chỉ** ra hàng `enabled`
- Đường đọc (`liveSourceUrls`) loại nguồn đã tắt; tắt hết thì rơi về `companies.website` như cũ

## Architecture

**Đây là phase đảo một test đang xanh, có chủ ý.** Test 15 của `live-source-columns-and-grants.test.ts` hiện nói:

> `15 · crm_system can READ the list — the crawler has to know what to fetch`

Sau phase này khẳng định đó **sai một nửa**: crawler phải biết đọc trang nào, nhưng nó không cần — và không được — thấy trang người ta đã tắt. Test 15 phải viết lại thành hai assertion, không phải xoá.

I-18 mạnh lên: *"`crm_system` có SELECT và không có INSERT/UPDATE/DELETE trên `company_sources`"* → *"`crm_system` **không** đọc được `company_sources`; nó chỉ đọc được `company_sources_enabled`, và không ghi được gì ở đâu."*

View là `SELECT ... WHERE enabled` chứ không phải `security_barrier` hay RLS: đơn giản nhất mà đủ, vì mối lo là code của mình quên filter, không phải người dùng thù địch dò dữ liệu.

Drizzle: khai bằng `pgView('company_sources_enabled', {...}).existing()` — view do migration tay tạo, drizzle chỉ cần kiểu để `select().from()` gõ đúng.

## Related Code Files

- Create: `packages/db/migrations/0011_source_enabled_view.sql`
- Modify: `packages/db/src/schema/company-sources.ts` — thêm cột `enabled` + khai `companySourcesEnabled` view
- Modify: `packages/db/src/schema/index.ts` — export view
- Modify: `apps/api/src/domain/observation/observation-service.ts:244-251` — `dbSystem.select().from(companySourcesEnabled)`
- Modify: `packages/db/src/__tests__/live-source-columns-and-grants.test.ts` — viết lại test 15, thêm 23–24
- Create: `apps/api/src/domain/observation/__tests__/disabled-source-not-read.test.ts`

## Implementation Steps

### 1. Test trước — ba khẳng định

**a. Viết lại test 15** thành:

```ts
it('15 · crm_system KHÔNG đọc được bảng — nó không được thấy nguồn người ta đã tắt', async () => {
  await expect(
    system.query('SELECT url FROM company_sources'),
  ).rejects.toThrow(/permission denied/i)
})

it('23 · crm_system đọc được view, và view chỉ ra hàng đang bật', async () => {
  // app thêm 2 nguồn, tắt 1 → view trả đúng 1
})

it('24 · crm_system không ghi được vào view', async () => {
  // INSERT/UPDATE/DELETE trên company_sources_enabled → permission denied
})
```

**b. Test đường đọc** — file mới `disabled-source-not-read.test.ts`, dùng khuôn `multi-source-ingest.test.ts` đang có:

```
2 nguồn đã lưu, tắt 1  → đọc sinh 1 Observation, source_url là nguồn đang bật
tắt cả 2               → rơi về companies.website (không phải "không có nguồn")
```

**Đỏ đúng lý do:** trước migration, test 15 mới đỏ vì `SELECT` **thành công** (không throw) — đúng cái ta muốn đảo. Test 23 đỏ vì view chưa tồn tại.

### 2. Migration `0011_source_enabled_view.sql`

```sql
ALTER TABLE company_sources ADD COLUMN enabled boolean NOT NULL DEFAULT true;

-- Quên WHERE ở tầng code thì phải HỎNG ỒN ÀO, không phải đọc lén thành công.
REVOKE SELECT ON company_sources FROM crm_system;

CREATE VIEW company_sources_enabled AS
  SELECT id, company_id, url, source_tier, discovered_via, search_snippet, added_by, created_at
  FROM company_sources
  WHERE enabled;

GRANT SELECT ON company_sources_enabled TO crm_system;
```

View **không** trả cột `enabled`: một hàng ra khỏi view thì đã đang bật, thêm cột đó chỉ mời người ta lọc lần hai.

### 3. Sửa đường đọc

`observation-service.ts:247-251` đổi `.from(companySources)` → `.from(companySourcesEnabled)`. Không thêm `WHERE enabled` — cả điểm của phase này là **không có** filter nào ở tầng code để mà quên.

### 4. Đảo code chứng minh test có răng

Đổi tạm view thành `WHERE true` → **test 23 đỏ**. Đổi `.from(companySourcesEnabled)` về `.from(companySources)` → test đường đọc đỏ **bằng permission denied**, không phải bằng assertion sai. Khôi phục cả hai. Ghi kết quả vào ADR-0037 mục verify (phase 5).

## Success Criteria

- [ ] Test 15 (bản mới), 23, 24 xanh
- [ ] `disabled-source-not-read.test.ts` xanh cả hai case
- [ ] 39 e2e cũ vẫn xanh (nguồn mới tạo mặc định `enabled = true` nên không kịch bản nào đổi hành vi)
- [ ] Hai lần đảo code ở step 4 cho đúng test đỏ, đã khôi phục
- [ ] `pnpm typecheck` xanh

## Risk Assessment

| Rủi ro | Giảm thiểu |
| --- | --- |
| Chỗ khác cũng đọc `company_sources` bằng vai system mà chưa thấy | Trước khi sửa, `grep -rn "companySources" apps/api/src` — hiện chỉ 2 chỗ: `observation-service` (system) và `company-source-service` (app). App vẫn đọc bảng bình thường, `REVOKE` không chạm `crm_app` |
| `pgView(...).existing()` không khớp phiên bản drizzle | Nếu API khác, fallback là `sql` thô trong `liveSourceUrls` — vẫn giữ được guarantee vì guarantee ở GRANT, không ở drizzle |
| `REVOKE` làm test cũ đỏ ngoài dự kiến | Chạy **cả** `packages/db` test suite ngay sau migration, không chờ tới cuối phase |

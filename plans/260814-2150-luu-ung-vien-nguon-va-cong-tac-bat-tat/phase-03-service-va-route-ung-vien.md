---
phase: 3
title: "Service và route ứng viên"
status: done
effort: medium
priority: P1
dependencies: [1, 2]
---

# Phase 3: Service và route ứng viên

## Overview

`findCandidates` đổi nghĩa: vẫn không chạm `company_sources`, nhưng **ghi ứng viên** vào bảng của phase 1 và thay danh sách cũ. Thêm route đọc/xoá ứng viên và route bật/tắt nguồn. Bốn route ghi, bốn cửa gác `actor.kind === 'system'`.

## Requirements

- `POST :id/source-candidates` — search → xoá ứng viên cũ của công ty → ghi bộ mới → trả về, **một transaction**
- `GET :id/source-candidates` — ứng viên đã lưu + `savedSourceId: string | null`
- `DELETE :id/source-candidates/:candidateId`
- `PATCH :id/sources/:sourceId` — `{ enabled: boolean }`
- Cả bốn route ghi: `actor.kind === 'system'` → `ForbiddenException` + `audit.recordRefusal`
- Công ty seed: `POST` vẫn `throw` I-16; `GET` trả `[]` **không** throw
- Tìm lần hai thay ứng viên nhưng **không** chạm nguồn đã lưu

## Architecture

**`savedSourceId` suy ra bằng join theo url, không phải cột.** `GET candidates` `LEFT JOIN company_sources ON (company_id, url)` → UI biết ứng viên nào đã trong danh sách đọc và bỏ tick được ngay bằng id đó. Không có cờ thứ hai nào để lệch pha với thực tế.

**Vì sao gác cả route ghi ứng viên** dù ứng viên vẫn phải qua người tick mới vào danh sách đọc: một danh sách ứng viên do máy tự nhồi là một cú đẩy, và vùng cấm phải chặn được cả khi lệnh không đến từ giao diện. Rẻ: một dòng, giống hai chỗ đã có.

**`audit_events.action` là `text` tự do** (`audit-events.ts:19`) ⇒ **không cần migration** cho action mới. Ba action mới: `save_source_candidates`, `remove_source_candidate`, `toggle_company_source`.

**Thay thế, không cộng dồn** (quyết định (c) của brainstorm): `DELETE FROM company_source_candidates WHERE company_id = $1` rồi `INSERT` bộ mới, trong một transaction để không có khoảnh khắc danh sách trống nếu insert lỗi.

**Trần ứng viên:** cần một hằng `MAX_CANDIDATES_PER_COMPANY` trong contracts. Đề xuất **12**. Trước khi chốt, đọc `anthropic-source-discovery.ts` xem provider đã cắt chưa — nếu đã cắt ở N thì lấy đúng N thay vì thêm số thứ hai (câu 1 mục 8 của brainstorm report).

## Related Code Files

- Modify: `packages/contracts/src/dto/company-source.ts` — `CompanySourceCandidateDto`, `toggleCompanySourceSchema`, `MAX_CANDIDATES_PER_COMPANY`; `CompanySourceDto` thêm `enabled: boolean`
- Modify: `apps/api/src/domain/company/company-source-service.ts` — `findCandidates` ghi; thêm `listCandidates`, `removeCandidate`, `setEnabled`
- Modify: `apps/api/src/domain/company/company-source.controller.ts` — 3 route mới
- Modify: `apps/web/src/lib/api-client.ts:185-200` — 3 hàm mới
- Modify: `apps/api/src/domain/company/__tests__/company-source-candidates.test.ts` — sửa nghĩa test 1, thêm 10–15
- Modify: `apps/api/src/domain/company/__tests__/live-source-toggle.test.ts` — nếu trùng phạm vi `setEnabled`, thêm vào đây thay vì tạo file mới

## Implementation Steps

### 1. Test trước

**a. Sửa nghĩa test 1** của `company-source-candidates.test.ts`. `describe` hiện tên `'finding sources writes nothing at all'` → `'tìm nguồn ghi ứng viên, không chạm danh sách đọc'`. Assertion đổi:

```ts
it('1 · ứng viên được lưu, và `company_sources` vẫn rỗng', async () => {
  const found = await buildService(discovery).findCandidates(HUMAN, COMPANY_ID)
  expect(found).toHaveLength(2)
  expect(await candidateRows()).toHaveLength(2)   // MỚI
  expect(await sourceRows()).toHaveLength(0)      // giữ nguyên — đây vẫn là dòng quan trọng nhất
})
```

Thêm helper `candidateRows()` cạnh `sourceRows()` (dòng 72).

**b. Test mới 10–15:**

| # | Khẳng định |
| --- | --- |
| 10 | Tìm lần hai **thay** danh sách: 2 ứng viên → discovery trả 1 khác → ứng viên = 1 |
| 11 | Tìm lần hai **không** chạm nguồn đã lưu: tick 1 → tìm lại → `company_sources` vẫn 1 hàng |
| 12 | `listCandidates` trả `savedSourceId` khác null cho ứng viên đã tick, null cho ứng viên chưa |
| 13 | `findCandidates` bằng actor `system` → throw, và ứng viên = 0 |
| 14 | `removeCandidate` / `setEnabled` bằng actor `system` → throw |
| 15 | `listCandidates` cho công ty seed trả `[]`, không throw |

**Đỏ đúng lý do:** 10–15 đỏ vì method chưa tồn tại (TypeScript không compile) — đó là đỏ hợp lệ ở bước này. Test 1 đỏ vì `candidateRows()` trả 0.

### 2. Contracts

```ts
export interface CompanySourceCandidateDto {
  id: string
  companyId: string
  url: string
  sourceTier: string
  reason: string
  snippet: string | null
  foundAt: string
  foundBy: string | null
  /** Có hàng trong `company_sources` cùng url ⇒ id của hàng đó. Không có ⇒ null. */
  savedSourceId: string | null
}

export const toggleCompanySourceSchema = z.object({ enabled: z.boolean() })
export const MAX_CANDIDATES_PER_COMPANY = 12   // xác nhận với provider trước khi chốt
```

`CompanySourceDto` thêm `enabled: boolean`. Comment trên `SourceCandidateDto` (dòng 25-27) hiện nói *"has no id because it was never stored"* — **câu đó hết đúng**, sửa hoặc gộp hai type.

### 3. Service

`findCandidates` sau khi có `candidates`:

```ts
return this.db.transaction(async (tx) => {
  await tx.delete(companySourceCandidates).where(eq(companySourceCandidates.companyId, companyId))
  if (candidates.length === 0) return []
  const rows = await tx.insert(companySourceCandidates)
    .values(candidates.slice(0, MAX_CANDIDATES_PER_COMPANY).map(...))
    .returning()
  return rows.map(...)
})
```

Cửa gác `system` thêm vào **đầu** `findCandidates` (trước cả kill switch — actor sai thì không cần biết AI bật hay tắt), `removeCandidate`, `setEnabled`. Mỗi cái kèm `audit.recordRefusal` với lý do viết bằng câu, giống hai chỗ đã có (dòng 106-110, 171-176).

`setEnabled` dùng `UPDATE ... RETURNING`, `NotFoundException` nếu không có hàng — cùng khuôn `remove` (dòng 178-183).

Comment đầu class (dòng 27-42) mô tả `findCandidates` *"RETURNS candidates, writes nothing"* và *"a page refresh loses the candidate list. That is accepted"* — **cả hai câu phải viết lại**, đây là chỗ dễ để lại nhất.

### 4. Controller + api-client

Ba route mới theo khuôn 4 route đang có. `PATCH` chứ không `POST`: đổi một cột của một tài nguyên đã tồn tại.

api-client thêm `listSourceCandidates`, `removeSourceCandidate`, `setCompanySourceEnabled`.

## Success Criteria

- [ ] Test 1 (bản mới) và 10–15 xanh; test 2–9 cũ không đổi
- [ ] Đảo code: bỏ dòng `DELETE` trong transaction → **test 10 đỏ**; bỏ một cửa gác `system` → **test 13 hoặc 14 đỏ**. Khôi phục
- [ ] `pnpm test:unit` xanh toàn bộ `apps/api`
- [ ] Không còn comment nào nói ứng viên không được lưu (grep `"writes nothing"`, `"never stored"`, `"refresh"` trong `apps/api` và `packages/contracts`)
- [ ] `pnpm typecheck` · `pnpm lint` xanh

## Risk Assessment

| Rủi ro | Giảm thiểu |
| --- | --- |
| Comment cũ nói ngược code mới ⇒ đúng bẫy vòng 2 | Đưa việc grep comment vào Success Criteria, không để "làm nếu còn thời gian" |
| `savedSourceId` join theo url lệch vì url khác nhau ở dấu `/` cuối | `sourceUrlSchema` không normalize. Nếu lệch thì so sánh url đã `trim()` ở cả hai phía; **không** tự sửa url người ta lưu |
| Transaction thay danh sách xong nhưng discovery lỗi giữa đường | Search **xong trước**, transaction chỉ ghi ⇒ lỗi search không bao giờ xoá danh sách cũ |
| Trần ứng viên đặt sai chỗ | Cắt ở service (`slice`) chứ không ở zod: đây là kết quả máy trả, không phải input người gõ |

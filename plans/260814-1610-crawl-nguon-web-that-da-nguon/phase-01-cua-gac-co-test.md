---
phase: 1
title: "Cửa gác có test — I-15, I-16, I-17, I-3"
status: pending
priority: P1
dependencies: []
---

# Phase 1: Cửa gác có test — I-15, I-16, I-17, I-3

## Overview

Trả món nợ mà `docs/ontology.md` mục 6 tự khai. Sau phase này ba bất biến nguồn thật **có test**, `source_kind` có mặt trong CSDL và ontology, và I-3 so hash theo URL. **Không có một byte nào đi ra Internet trong phase này** — `LiveCrawlSource` chưa tồn tại.

Đây là phase **không được cắt**: nó là điều kiện của mọi phase sau, và nó một mình đã xoá được cáo buộc "ontology trang trí" (CLAUDE.md mục 8).

## Requirements

**Chức năng**
- `Observation` mang `source_kind` (`demo_snapshot` | `live_crawl`) và `fetch_error_reason` (chỉ có giá trị khi `fetch_status='failed'`).
- `Company` mang công tắc `live_source_enabled`, mặc định **tắt**.
- Bảng `company_sources` tồn tại; `crm_system` chỉ **SELECT** được.
- Bật công tắc cho công ty thuộc bộ seed → **từ chối** + `AuditEvent`.
- Phân giải nguồn theo thứ tự I-17, nhánh an toàn là nhánh mặc định.
- `Claim` rút từ `live_crawl` **chỉ** sinh `Proposal` — kể cả công ty `is_watched = true`, và **cửa I-5 gạt sang chiều gợi ý**.
- I-3 so `content_hash` theo `(company_id, source_url)`.

**Phi chức năng**
- Migration chỉ **cộng thêm**. Không sửa, không xoá cột nào.
- Không sửa `ClaimExtractor` / `ClaimService`.
- Không test nào gọi mạng.

## Architecture

### Phân giải nguồn — nhánh an toàn là nhánh mặc định (I-17)

Hàm thuần, tách khỏi service để test được không cần CSDL:

```ts
// apps/api/src/ai/resolve-observation-source.ts
// Order matters: every early return lands on the SAFE branch.
export function resolveObservationSource(input: {
  aiEnabled: boolean
  configuredSource: string | undefined   // process.env.OBSERVATION_SOURCE
  companyId: string
  liveSourceEnabled: boolean
}): 'disabled' | 'demo_snapshot' | 'live_crawl'
```

```
aiEnabled === false                        → 'disabled'        [I-17]
configuredSource !== 'live_crawl'          → 'demo_snapshot'   [I-17] (trống, gõ sai, chữ hoa lẫn…)
companyId ∈ SEED_COMPANY_IDS               → 'demo_snapshot'   [I-16]
liveSourceEnabled === false                → 'demo_snapshot'
_                                          → 'live_crawl'
```

`SEED_COMPANY_IDS` dẫn xuất từ `SEED_COMPANIES` của `@crm/db` — **đã kiểm dùng được ngay**: `packages/db/src/index.ts` có `export * from './seed'` và `seed/index.ts:26` có `export * from './seed-data'`.

Ghi log lúc boot **nguồn nào đang chạy**, đúng mẫu `claim-extractor.provider.ts:24-32` — "đang chạy nguồn nào" phải trả lời được từ log, không phải đoán từ hành vi.

### I-15 — hai vế, ba chỗ chạm

`ClaimReactionService.react()` nhận thêm `sourceKind: SourceKind` và truyền xuống. Ba nhánh:

| Chỗ | Với `live_crawl` | Vế |
| --- | --- | --- |
| `AutoNextStepService.react` (bước 1) | **chạy ở chế độ chỉ-đề-xuất**: vẫn tính ra Việc tiếp theo, nhưng **không ghi** `AutoNextStepEvent`, không sửa `opportunities` — đẩy **toàn bộ** sang `blockedNextSteps` | 1 + 2 |
| `SystemTimelineEntryService.react` (bước 3) | **trả 0**, kể cả `is_watched = true` | 1 |
| `ProposalService.buildTimelineEntry` (bước 2) | cửa `isWatched` **gạt sang chiều gợi ý** — vẫn sinh `timeline_entry` | 2 |

**Hai chỗ phải lật chiều, không phải một** (quyết định validation V1). Bản nháp đầu của plan cho `AutoNextStepService` **không chạy** với `live_crawl`. Đó là cùng một cái hố ADR-0028, chỉ ở tầng khác: `blockedNextSteps` là **đường duy nhất** để hàm ý về Việc tiếp theo thành gợi ý `next_step`, nên bỏ hẳn nhóm 4 làm hàm ý đó **biến mất không dấu vết** — không log, không đếm, không ai biết. I-15 nói nguồn thật *"chỉ sinh được `Proposal`"*: nó **đòi** gợi ý này tồn tại, chứ không đòi bỏ nó.

Bảng bắt buộc phải đo cả bốn ô, **và cả cột `next_step`**:

| | `demo_snapshot` | `live_crawl` |
| --- | --- | --- |
| `is_watched = false` | gợi ý `timeline_entry` · 0 mục · `next_step`: ghi thẳng (hoặc gợi ý nếu I-7 chặn) | gợi ý `timeline_entry` · 0 mục · **gợi ý `next_step`, 0 `AutoNextStepEvent`** |
| `is_watched = true` | **0 gợi ý** `timeline_entry` · có mục · `next_step`: ghi thẳng | **có gợi ý** `timeline_entry` · **0 mục** · **gợi ý `next_step`, 0 `AutoNextStepEvent`** |

Hai ô của cột `live_crawl` là hai ô mà quên lật chiều sẽ thành **0 gợi ý + 0 mục + 0 việc tiếp theo** = phát hiện không có đường nào ra, rồi I-3 làm nó vĩnh viễn ([ADR-0028](../../docs/decisions/0028-quyen-ghi-muc-dong-thoi-gian-den-tu-nhan-dang-theo-doi-khong-tu-trigger-context.md)).

Lưu ý phụ: với `live_crawl`, I-7 (không đè ô do người gõ) trở nên **vô nghĩa** vì không có đường ghi nào — mọi trường hợp đều thành gợi ý. Test phải chứng minh điều đó đúng cho **cả hai** ca: ô Việc tiếp theo đang trống, và ô đang có chữ người gõ.

<!-- Updated: Validation Session 1 - V1 nhóm 4 chạy chế độ chỉ-đề-xuất thay vì bỏ hẳn -->


### I-3 theo URL

`observation-service.ts:238` `latestObservation(companyId)` → `latestObservationForUrl(companyId, sourceUrl)`:

```sql
WHERE company_id = $1 AND source_url = $2
ORDER BY captured_at DESC LIMIT 1
```

Tương thích ngược: bản chụp mỗi công ty đúng 1 URL ⇒ hành vi không đổi. Vẫn giữ ở tầng service, **không** thêm `UNIQUE` — [ADR-0017](../../docs/decisions/0017-i3-enforce-o-tang-service-rang-buoc-csdl-chi-danh-cho-ranh-gioi.md) đã giải thích vì sao index toàn cục sai (nó chặn cả chuỗi trước → sau → trước mà giám khảo tạo ra khi chạy lại T-6/T-8).

## Related Code Files

**Create**
- `packages/db/migrations/0008_live_source.sql`
- `packages/db/src/schema/company-sources.ts`
- `apps/api/src/ai/resolve-observation-source.ts`
- `apps/api/src/ai/__tests__/resolve-observation-source.test.ts`
- `apps/api/src/domain/observation/__tests__/live-source-autonomy-ceiling.test.ts`
- `apps/api/src/domain/observation/__tests__/observation-dedup-per-url.test.ts`
- `apps/api/src/domain/company/__tests__/live-source-toggle.test.ts`
- `apps/api/src/domain/company/__tests__/company-sources-privileges.test.ts`

**Modify**
- `packages/db/src/schema/observations.ts` · `companies.ts` · `all-tables.ts` · `index.ts`
- `packages/contracts/src/enums.ts`
- `packages/contracts/src/__tests__/ontology-enum-parity.test.ts` (số dòng 12 → 13)
- `docs/ontology.md` (thêm dòng `source_kind` vào **bảng 3.5**)
- `apps/api/src/domain/observation/observation-service.ts`
- `apps/api/src/domain/claim/claim-reaction-service.ts`
- `apps/api/src/domain/proposal/proposal-service.ts`
- `apps/api/src/watch/system-timeline-entry-service.ts`
- `apps/api/src/domain/opportunity/auto-next-step-service.ts`
- `apps/api/src/domain/company/company.controller.ts` + service tương ứng

## Implementation Steps

### Bước 0 — test trước, phải thấy đỏ

Viết **toàn bộ** test dưới đây trước khi sửa một dòng code sản phẩm. Chạy `pnpm test:unit`. **Nếu có test nào xanh ngay thì test đó không đo gì** — sửa test, đừng đi tiếp.

1. `resolve-observation-source.test.ts` — bảng đầu vào:
   - `aiEnabled=false` → `disabled` (kể cả khi mọi thứ khác bật)
   - `configuredSource` = `undefined` / `''` / `'snapshot'` / `'LIVE_CRAWL'` / `'live-crawl'` / rác → `demo_snapshot`
   - `configuredSource='live_crawl'` + companyId ∈ seed → `demo_snapshot`
   - `configuredSource='live_crawl'` + ngoài seed + `liveSourceEnabled=false` → `demo_snapshot`
   - `configuredSource='live_crawl'` + ngoài seed + `liveSourceEnabled=true` → `live_crawl`
2. `live-source-autonomy-ceiling.test.ts` — **bảng bốn ô + cột `next_step`** ở mục Architecture. Mỗi ô assert **ba** con số: số `TimelineEntry`, số `AutoNextStepEvent`, số `Proposal` **tách theo `proposal_type`** (`timeline_entry` / `next_step` / `field_update`). Riêng cột `live_crawl` thêm hai ca của I-7: ô Việc tiếp theo trống, và ô đang có chữ người gõ — **cả hai** phải ra gợi ý `next_step` và **0** `AutoNextStepEvent`.
3. `observation-dedup-per-url.test.ts` — cùng URL hai lần nội dung không đổi → 1 bản lưu **và extractor gọi 0 lần lượt hai** (spy đếm, không chỉ đếm hàng: assert "no new row" một mình vẫn để lọt bản vẫn trả tiền LLM mỗi 60 giây — chính lý do comment ở `observation-service.ts:74-76` tồn tại). Hai URL khác nhau **cùng nội dung** → 2 bản lưu.
4. `live-source-toggle.test.ts` — bật cho công ty seed → từ chối + đúng một `AuditEvent`; bật cho công ty ngoài seed → thành công.
5. `company-sources-privileges.test.ts` — nối bằng `DATABASE_URL_TEST_SYSTEM`, `INSERT INTO company_sources` → **permission denied**. `SELECT` → được. Theo đúng cách các test quyền theo cột đang có.
6. Bổ sung assert vào bộ nghiệm thu: với `OBSERVATION_SOURCE=live_crawl`, đọc công ty seed → `source_kind='demo_snapshot'`.

### Bước 1 — migration

`0008_live_source.sql`, viết tay, **chỉ cộng thêm**:

```sql
ALTER TABLE observations
  ADD COLUMN source_kind text NOT NULL DEFAULT 'demo_snapshot';
--> statement-breakpoint
ALTER TABLE observations
  ADD CONSTRAINT observations_source_kind_check
  CHECK (source_kind IN ('demo_snapshot','live_crawl'));
--> statement-breakpoint
ALTER TABLE observations ADD COLUMN fetch_error_reason text;
--> statement-breakpoint
-- Closed list + the pairing rule: a reason may exist ONLY on a failed read.
ALTER TABLE observations
  ADD CONSTRAINT observations_fetch_error_reason_check
  CHECK (
    fetch_error_reason IS NULL
    OR (fetch_status = 'failed' AND fetch_error_reason IN (
      'timeout','http_4xx','http_5xx','redirect_loop','js_required',
      'not_html','too_large','blocked_url','invalid_url'))
  );
--> statement-breakpoint
ALTER TABLE companies
  ADD COLUMN live_source_enabled boolean NOT NULL DEFAULT false;
--> statement-breakpoint
CREATE TABLE company_sources ( ... UNIQUE (company_id, url) );
--> statement-breakpoint
-- crm_system reads the list; it may NEVER write it. The AI does not choose the
-- source it then draws conclusions from -- same guarantee `snapshot_variant` has.
GRANT SELECT ON company_sources TO crm_system;
```

**Không** grant INSERT/UPDATE/DELETE. **Không** cần grant gì cho `observations` (table-level đã có) hay `companies` (crm_system chỉ SELECT, và đó chính là điều muốn).

Chạy `pnpm db:migrate`. **Tuyệt đối không** dùng `db:push`.

### Bước 2 — enums + ontology bảng 3.5, cùng một commit

> ⚠️ **Bước này đã làm KHÁC plan sau khi đọc `enums.ts`.** Xem [Đã chạy](#đã-chạy--1408) mục D1. Tóm lại: `source_kind` **không** vào `ENUMS`/bảng 3.5, parity **vẫn 12 dòng**, `ontology-enum-parity.test.ts` **không phải sửa**.

~~`enums.ts`: thêm `SOURCE_KIND` **vào `ENUMS`**, và thêm dòng tương ứng vào **bảng 3.5**. Sửa `toHaveLength(12)` → `13`.~~

`FETCH_ERROR_REASON`: khai **ngoài `ENUMS`**, kèm comment giải thích (đúng tiền lệ `USER_ROLE` ở `enums.ts:183-189`), vì nó là chi tiết chẩn đoán chứ không phải thuộc tính nghiệp vụ. Danh sách đóng do `CHECK` của CSDL giữ. Nhãn tiếng Việt cho Sales:

```ts
timeout: 'Trang không phản hồi kịp'
http_4xx: 'Trang từ chối máy đọc tự động'
js_required: 'Trang cần chạy JavaScript mới hiện nội dung'
blocked_url: 'Địa chỉ không được phép đọc'
...
```

> **Đã chốt (validation V2):** giữ ngoài `ENUMS`. Lý do: đây là chi tiết chẩn đoán, không phải thuộc tính nghiệp vụ của thực thể. Bảng 3.5 vì thế chỉ thêm **một** dòng (`source_kind`) ⇒ parity test đi từ 12 → **13**, không phải 14. ADR ở P4 phải ghi rằng lập luận ngược (nó *có* nhãn hiển thị cho Sales, mà đó chính là tiêu chí để một enum thuộc bảng 3.5) cũng đứng được — đây là lựa chọn, không phải chân lý.

<!-- Updated: Validation Session 1 - V2 fetch_error_reason giữ ngoài ENUMS -->


### Bước 3 — truyền `sourceKind` và enforce I-15

`ObservationService.ingest` gọi `resolveObservationSource` trước; ghi `source_kind` vào bản lưu; truyền xuống `ClaimReactionService.react({..., sourceKind })`. Sửa ba nhánh theo bảng ở mục Architecture. **Không gộp cặp gương thành helper chung.**

### Bước 4 — công tắc + từ chối I-16

`PATCH /companies/:id/live-source` (hoặc mở rộng `@Patch(':id')` đang có ở `company.controller.ts:67`). Công ty ∈ seed → `BadRequest` + `AuditEvent{ actor:'human', action:'rejected_live_source_for_seed_company', entity:'companies', entityId }`.

**Quyền (validation V3):** **bất kỳ người dùng đã đăng nhập**, giống mọi thao tác sửa hồ sơ công ty khác — theo [ADR-0033](../../docs/decisions/0033-vong-1-admin-co-quyen-crm-nhu-sales-ma-tran-quyen-chi-tiet-ngoai-pham-vi.md), ma trận quyền chi tiết vẫn ngoài phạm vi vòng 1. Chỉ `JwtGuard`, **không** thêm cửa kiểm vai trò. `AuditEvent` ghi actor nên vẫn truy được ai bật. Đây là câu trả lời cho **câu hỏi mở số 2 của `docs/ontology.md`** — P4 phải xoá nó khỏi danh sách câu hỏi mở.

<!-- Updated: Validation Session 1 - V3 quyền bật công tắc -->


### Bước 5 — xanh lại

`pnpm test:unit` → `pnpm lint` → `pnpm typecheck` → `pnpm test:e2e` (stack ở `:8080`). Commit.

## Success Criteria

- [ ] Mọi test ở Bước 0 **đã từng đỏ**, giờ xanh
- [ ] `resolveObservationSource` phủ đủ 5 nhóm đầu vào, mọi nhánh sai/thiếu cấu hình đều về `demo_snapshot`
- [ ] Bảng bốn ô xanh, **kể cả cột `live_crawl`**: có gợi ý `timeline_entry` · 0 mục · **có gợi ý `next_step`** · **0 `AutoNextStepEvent`** · 0 hàng `opportunities` bị sửa
- [ ] Với `live_crawl`, **cả hai** ca của I-7 (ô Việc tiếp theo trống / đang có chữ người gõ) đều ra gợi ý `next_step`
- [ ] Cùng URL hai lần → 1 bản lưu, extractor **0** lượt gọi lần hai; hai URL cùng nội dung → 2 bản lưu
- [ ] Bật nguồn thật cho công ty seed → từ chối + đúng 1 `AuditEvent`
- [ ] `crm_system` `INSERT INTO company_sources` → permission denied, đo bằng `DATABASE_URL_TEST_SYSTEM`
- [ ] `OBSERVATION_SOURCE=live_crawl` + T-1…T-10 → xanh, mọi bản lưu `source_kind='demo_snapshot'`
- [ ] `ontology-enum-parity` xanh với 13 dòng; `source_kind` có trong bảng 3.5 **và** `enums.ts`
- [ ] `pnpm test` · `lint` · `typecheck` xanh; **không** test nào gọi mạng
- [ ] Log lúc boot nói rõ đang chạy nguồn nào

## Đã chạy — 14/08

**Xanh. 337 unit test (baseline 281, cộng đúng 56 test mới), 0 hồi quy.** `typecheck` · `lint` sạch cả 4 project.

| Test mới | Số assertion | Đo gì |
| --- | --- | --- |
| `apps/api/src/ai/__tests__/resolve-observation-source.test.ts` | 19 | I-16 + I-17 dạng hàm thuần; 10 kiểu cấu hình sai đều rơi về `demo_snapshot`; phủ **cả 5** công ty seed |
| `packages/db/src/__tests__/live-source-columns-and-grants.test.ts` | 18 | `source_kind` mặc định + CHECK · `fetch_error_reason` cặp đôi với `failed` + 9 giá trị · `crm_system` không UPDATE `live_source_enabled` · **`crm_system` không INSERT/UPDATE/DELETE `company_sources`** |
| `apps/api/src/domain/observation/__tests__/live-source-autonomy-ceiling.test.ts` | 7 | Bảng bốn ô `(source_kind × is_watched)`, mỗi ô ba con số; hai ca I-7; không thông báo nào cho nguồn thật |
| `apps/api/src/domain/observation/__tests__/observation-dedup-per-url.test.ts` | 5 | I-3 theo `(company_id, source_url)`, có đếm lượt gọi extractor; lỗi đọc liên tiếp vẫn ra hai hàng |
| `apps/api/src/domain/company/__tests__/live-source-toggle.test.ts` | 7 | I-16 ở đường ghi: từ chối + `AuditEvent`, chỉ chặn chiều BẬT, chặn cả `actor=system` |

### Bốn chỗ làm khác plan, và lý do

| | Chỗ lệch | Lý do |
| --- | --- | --- |
| **D1** | `source_kind` **không** vào `ENUMS`/bảng 3.5; parity vẫn **12** dòng | `enums.ts` khai tiêu chí tường minh: bảng 3.5 liệt kê enum **tồn tại như một kiểu Postgres**. `source_kind` là `text` + CHECK, **giống hệt `source_tier` trên cùng bảng và `snapshot_variant`** — cả hai đều ngoài 3.5. Hai cột cùng trục mà chia hai quy ước là bất nhất. `SOURCE_KIND`/`SOURCE_TIER`/`FETCH_ERROR_REASON` khai ngoài `ENUMS` kèm comment. Ontology 3.6 đã sửa lại |
| **D2** | Test quyền nằm ở `packages/db/src/__tests__/`, không phải `apps/api/.../company/__tests__/` | Có tiền lệ đúng chỗ: `column-grants-block-system-actor-on-snapshot-variant.test.ts` cũng ở đó và cũng dùng ba pool owner/app/system. Đây là bảo đảm tầng CSDL, `packages/db` đã sở hữu loại test này |
| **D3** | `resolveObservationSource` **chưa được nối** vào `ObservationService` | Phân giải sang `live_crawl` trước khi có crawler sẽ dán nhãn nội dung bản chụp là "đọc thật" — nói dối ở đúng cột mà trần tự chủ tính từ đó. `ObservationService` ghi thẳng `sourceKind: 'demo_snapshot'`, nối resolver cùng lúc với `LiveCrawlSource` ở P2. Hệ quả: **P1 chưa có đường nào sinh ra `live_crawl` trong sản phẩm** — I-17 hiện được bảo đảm bởi test hàm thuần, không bởi đường chạy |
| **D4** | Test I-15 chạm thẳng `ClaimReactionService.react()`, không qua `ObservationService` | Bất biến sống ở seam đó, và test được nó mà không cần crawler. Đi qua `ObservationService` sẽ buộc phải có nguồn đọc được cho công ty ngoài seed — tức là phải có P2 trước |

### Việc phát sinh, không có trong plan

- **Mutation check cho I-3.** Test I-3 xanh ngay lần chạy đầu, vì implementation đã sửa ở Bước 3 trước khi test được viết — trái luật "phải thấy đỏ" của chính plan. Đã hoàn nguyên tạm điều kiện `source_url`, xác nhận **3 test đỏ**, rồi khôi phục. Test có răng thật, đo được.
- **Index `observations_company_source_url_captured_at_idx`** thêm vào cả migration và schema Drizzle — I-3 giờ tra theo `(company_id, source_url)` nên cần nó.
- **`companySources` vào `ALL_TABLES`** — thiếu là rò dữ liệu giữa các file test và `seed()` không dọn sạch (I-14).
- **`CompanyDto` thêm `liveSourceEnabled`** — công tắc mà giao diện không đọc được trạng thái là công tắc không ai tin.
- **Bẫy build:** `pnpm typecheck` của `apps/api` resolve `@crm/db` qua `dist`. Sửa `packages/db/src` mà không build lại thì ra 15 lỗi `Cannot find module '@crm/db'` **không liên quan gì** đến thay đổi thật. Build `contracts` + `db` trước khi typecheck.

## Risk Assessment

| Rủi ro | Đối sách |
| --- | --- |
| Quên lật chiều I-5 ⇒ phát hiện không đường ra | Bảng hai chiều bốn ô, viết **trước** khi code. Đây là lý do phase này chạy TDD |
| `ontology-enum-parity` đỏ vì thêm dòng 3.5 | **Đúng thiết kế.** Sửa `toHaveLength` cùng commit với migration, không sớm hơn |
| `SEED_COMPANY_IDS` import từ `@crm/db` kéo theo `seed()` và `dotenv` vào bundle api | Đã kiểm đường export tồn tại. Nếu kéo theo nặng thì khai một hằng ID riêng trong contracts và một test assert nó khớp `SEED_COMPANIES` — đừng chép tay không có test |
| Migration đêm freeze | Chỉ cộng thêm; mọi cột mới có `DEFAULT`. `git revert` + một migration hạ cấp là đủ |
| Sửa `observation-service.ts` làm đỏ `reading-zone-provenance.test.ts` | Chạy riêng file đó ngay sau Bước 3, trước khi đi tiếp. Lưu ý spec này **đã có flake sẵn** (ghi ở plan `260814-1249` mục "Phát hiện thêm") — chạy trên code trước và sau để phân biệt |

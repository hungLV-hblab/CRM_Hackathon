---
phase: 2
title: "Schema snapshot_pages + tổng quát seed()/DemoSnapshotSource"
status: pending
priority: P1
dependencies: [1]
---

# Phase 2: Schema `snapshot_pages` + tổng quát `seed()`/`DemoSnapshotSource`

## Overview

Bảng CSDL mới thay hoàn toàn `apps/api/src/ai/demo-snapshots.ts` (hằng số TS, 1 trang/công ty — ADR-0021 tự nêu điều kiện xem lại, đã vượt ở 24 công ty × tới 4 trang). `seed()` nhận `SeedDataset` từ phase 1 thay vì import mảng viết tay. Kết thúc phase này: `pnpm seed` nạp 25 công ty thật vào CSDL, `DemoSnapshotSource` đọc được N trang/công ty.

## Requirements

- `snapshot_pages`: `company_id`, `page_slug`, `source_url`, `before_html`, `after_html` (cả hai html nullable — một số công ty thiếu 1 vế), timestamps.
- `crm_system`: `SELECT` duy nhất — AI đọc nội dung để rút phát hiện, không bao giờ ghi (giống hệt lý do `company_sources` chỉ SELECT).
- `crm_app`: full quyền qua `ALTER DEFAULT PRIVILEGES` sẵn có (không cần dòng GRANT tay, xem `0001_grants.sql`).
- `seed(connectionString, dataset)` — TRUNCATE `ALL_TABLES` CASCADE + INSERT, y hệt hành vi idempotent hiện tại, chỉ đổi nguồn `dataset`.
- `DemoSnapshotSource.readAll(companyId, variant): Promise<Snapshot[]>` thay `read()` — trả N kết quả, mỗi trang 1 phần tử. Trang không có html cho variant đang hỏi → phần tử với `rawHtml: null` (giữ đúng ngữ nghĩa "đọc không được" hiện có cho case Ohara/C32/C29/C35).
- `runFromCli()` đọc `packages/db/seed-assets/hackathon-1-data.zip` từ đĩa, gọi `parseZipDataset()`, rồi `seed()`.

## Architecture

### Vì sao `DemoSnapshotSource` cần inject DB ngay bây giờ

Trước: `@Injectable()` không constructor, đọc thẳng object TS trong module. Sau: phải đọc bảng `snapshot_pages` → cần `@Inject(DRIZZLE_SYSTEM)` (đọc, không ghi — đúng vai AI, xem bảng grant trên). `observation-service.ts` đã inject `this.snapshots: DemoSnapshotSource` sẵn — chỉ cần `DemoSnapshotSource` tự thêm constructor, không đổi cách `ObservationService` inject nó.

### Điểm duy nhất phải sửa trong `collectReads()`

`apps/api/src/domain/observation/observation-service.ts`, nhánh `demo_snapshot` hiện tại:

```ts
// TRƯỚC — 1 kết quả
const snapshot = this.snapshots.read(company.id, variant)
if (!snapshot) { return [{ sourceUrl: ..., rawHtml: null, ... }] }
return [{ sourceUrl: snapshot.sourceUrl, rawHtml: snapshot.rawHtml, ... }]
```

```ts
// SAU — N kết quả, downstream (vòng for outcomes) đã hỗ trợ N sẵn — không đổi gì thêm
const snapshots = await this.snapshots.readAll(company.id, variant)
if (snapshots.length === 0) {
  return [{ sourceUrl: this.snapshots.sourceUrlFor(company.id) ?? 'unknown', rawHtml: null, ... }]
}
return snapshots.map((s) => ({ sourceUrl: s.sourceUrl, rawHtml: s.rawHtml, ... }))
```

Không đổi gì ở `ingestOne`, `claim-reaction-service`, `system-timeline-entry-service` — vòng lặp `for (const read of reads)` đã tồn tại, xây sẵn cho `company_sources`.

### `SEED_COMPANY_IDS` (I-16) phải sống sót qua đổi nguồn dữ liệu — phát hiện lúc validate

`apps/api/src/ai/resolve-observation-source.ts` tính `SEED_COMPANY_IDS`/`isSeedCompany()` **đồng bộ, lúc module load**, từ `SEED_COMPANIES` — dùng ở 3 chỗ sản xuất: chính file đó (I-16, chặn crawl thật công ty seed dù `OBSERVATION_SOURCE=live_crawl`), `company-source-service.ts:101` và `company-service.ts:135` (chặn admin bật `live_source_enabled` cho công ty seed). Cả 3 đều đồng bộ theo thiết kế — không phải tình cờ (comment gốc: *"a gate that needs a database... is a gate nobody re-checks"*).

Sửa: `SEED_COMPANY_IDS` đổi nguồn từ mảng TS sang **file zip checked-in**, vẫn tính đồng bộ lúc module load (nhờ phase 1 bắt buộc `parseZipDataset` có bản sync):

```ts
// resolve-observation-source.ts — chỉ đổi 2 dòng
import { loadDefaultDatasetSync } from '@crm/db'
const SEED_COMPANY_IDS: ReadonlySet<string> =
  new Set(loadDefaultDatasetSync().companies.map((c) => c.id))
```

**Phạm vi bảo vệ của I-16 sau khi đổi:** vẫn đúng cho file zip checked-in mặc định (kịch bản thật: giám khảo/team nạp lại đúng file BTC, ID tất định từ phase 1 nên `SEED_COMPANY_IDS` không đổi giữa các lần seed). **Không** bảo vệ công ty của một file zip KHÁC nếu admin upload qua UI một file không phải `hackathon-1-data.zip` gốc — chấp nhận được, vì I-16 tồn tại để giữ T-6/T-8 replay được trên đúng bộ dữ liệu chấm điểm, không phải để bảo vệ mọi dataset bất kỳ ai có thể upload. Ghi rõ điều này trong ADR phase 5, không để ngầm hiểu.

### Gộp timeline khi nhiều trang cùng công ty đổi 1 chu kỳ (quyết định đã chốt)

Hiện tại `claim-reaction-service.react()` phản ứng theo TỪNG claim độc lập → N trang đổi = N lời gọi `SystemTimelineEntryService`. Quyết định: **1 công ty = 1 mục dòng thời gian/chu kỳ**, dù mấy trang đổi. Cần thêm bước gộp ở tầng gọi `ObservationService.ingest()` (watch-cycle-service.ts) hoặc bên trong `ClaimReactionService`: gom toàn bộ claim mới của MỘT công ty trong MỘT lần `ingest()` thành 1 lời gọi ghi timeline, nội dung tóm tắt N phát hiện. Đây là thay đổi hành vi thật — viết test trước (xem Implementation Steps).

## Related Code Files

- Create: `packages/db/migrations/0012_snapshot_pages.sql`
- Create: `packages/db/src/schema/snapshot-pages.ts`
- Modify: `packages/db/src/schema/index.ts` — export bảng mới
- Modify: `packages/db/src/schema/all-tables.ts` — thêm vào `ALL_TABLES`, đặt cạnh `companySources` (cùng lý do: tham chiếu `companies`, xoá trước nó)
- Modify: `packages/db/src/seed/index.ts` — `seed()` nhận `dataset`, `runFromCli()` đọc zip từ đĩa
- Delete: `packages/db/src/seed/seed-data.ts`
- Modify: `apps/api/src/ai/demo-snapshots.ts` → **thay nội dung hoàn toàn**: `DemoSnapshotSource` đọc DB, không còn hằng số `SNAPSHOTS`
- Modify: `apps/api/src/ai/__tests__/demo-snapshots.test.ts` — viết lại cho class đọc DB (cần Postgres test, chuyển thành integration test)
- Modify: `apps/api/src/domain/observation/observation-service.ts` — `collectReads()` nhánh `demo_snapshot`
- Modify: `apps/api/src/ai/resolve-observation-source.ts` — `SEED_COMPANY_IDS` đổi nguồn (xem mục Architecture)
- Modify: `apps/api/src/ai/__tests__/resolve-observation-source.test.ts` — dùng `SEED_COMPANIES[0]`/`.map()` trên toàn bộ mảng, số test sẽ đổi theo 25 công ty thật thay vì 5 công ty hư cấu — review lại assertion, không chỉ đổi ID
- Kiểm không sửa (chỉ cần chạy lại, vẫn hợp lệ vì `SEED_COMPANIES` vẫn export, chỉ đổi giá trị): `company-service.ts`, `company-source-service.ts` (dùng `isSeedCompany()`, không đổi cách gọi)
- Create/Modify: logic gộp timeline theo công ty — file cụ thể xác định khi đọc `apps/api/src/domain/claim/claim-reaction-service.ts` và `apps/api/src/watch/system-timeline-entry-service.ts` lúc implement
- Modify: `packages/db/src/__tests__/seed-idempotent.test.ts` — checksum mới cho dataset thật
- Create: `packages/db/src/seed/default-dataset.ts` — `loadDefaultDataset()`, đọc zip checked-in 1 lần, cache trong process (test suite gọi seed() rất nhiều lần, không parse lại zip mỗi lần)
- Modify: `apps/api/src/__tests__/login.test.ts:20` — **caller thứ 3 của `seed()`, không có trong bản brainstorm ban đầu.** Gọi `seed(process.env.DATABASE_URL_TEST as string)` 1 tham số, vỡ ngay khi đổi chữ ký. Sửa thành `seed(url, await loadDefaultDataset())`

## Implementation Steps

### 1. Migration trước — test trước, y khuôn `0008_live_source.sql`

Viết test `snapshot-pages-grants.test.ts` (đặt cạnh `live-source-columns-and-grants.test.ts`):
- `crm_app` INSERT được
- `crm_system` SELECT được, INSERT/UPDATE/DELETE đều bị từ chối

Chạy — đỏ vì `relation does not exist` (đúng, bảng chưa có).

### 2. `0012_snapshot_pages.sql`

```sql
CREATE TABLE snapshot_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  page_slug text NOT NULL,
  source_url text,
  before_html text,
  after_html text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT snapshot_pages_company_id_page_slug_unique UNIQUE (company_id, page_slug)
);
CREATE INDEX snapshot_pages_company_id_idx ON snapshot_pages (company_id);
-- crm_app: đã có qua ALTER DEFAULT PRIVILEGES (0001), không cần dòng GRANT.
GRANT SELECT ON snapshot_pages TO crm_system;
```

Chạy lại test bước 1 — phải xanh.

### 3. Schema drizzle + `ALL_TABLES`

Theo đúng khuôn `company-sources.ts`: comment giải thích quyền, không chỉ mô tả cột.

### 4. Tổng quát `seed()`

`seed(connectionString: string, dataset: SeedDataset)` — **`dataset` bắt buộc, không có giá trị mặc định ngầm** (một hàm "seed" tự ý đọc file khi không ai truyền gì là hành vi ẩn, khó test). `loadDefaultDataset()` là helper tường minh gọi ra, không phải default param:

```ts
// packages/db/src/seed/default-dataset.ts
let cached: SeedDataset | null = null
export async function loadDefaultDataset(): Promise<SeedDataset> {
  if (!cached) {
    const zipPath = resolve(__dirname, '../../seed-assets/hackathon-1-data.zip')
    cached = await parseZipDataset(readFileSync(zipPath))
  }
  return cached
}
```

`runFromCli()`:
```ts
await seed(url, await loadDefaultDataset())
```

**3 caller khác phải sửa cùng lúc** (grep xác nhận, không phải 2 như brainstorm report ban đầu):
- `packages/db/src/__tests__/seed-idempotent.test.ts` — 8 lời gọi `seed(url)` → `seed(url, await loadDefaultDataset())`
- `apps/api/src/__tests__/login.test.ts:20` — 1 lời gọi, cùng cách sửa

Insert thêm `snapshotPages` vào transaction, cùng chỗ insert `companies`/`contacts`/`opportunities`.

`SEED_USERS` (2 tài khoản đăng nhập demo) **giữ nguyên hardcode** — không nằm trong zip, không có nguồn nào khác, và README đã công khai mật khẩu `sales123`/`admin123` cho giám khảo. Giữ trong `seed-dataset.ts` như hằng số cố định của dataset, không phải "gõ tay dữ liệu công ty".

Chạy `pnpm seed`, xác nhận thủ công: `SELECT count(*) FROM companies` = 25.

### 5. `DemoSnapshotSource` đọc DB

Viết `readAll()`, test bằng integration test thật (DB test), không mock.

### 6. Sửa `collectReads()` — 1 dòng, có test trước

Viết test: công ty có 3 trang, 2 trang đổi nội dung → `ingest()` trả `sourcesAttempted: 3`. Đỏ trước khi sửa (hiện tại luôn trả 1). Sửa, xanh.

### 7. Gộp timeline theo công ty

Viết test trước: công ty 3 trang, 2 đổi trong 1 chu kỳ → đúng **1** dòng `timeline_entries` mới, không phải 2. Đỏ trước, cài logic gộp, xanh. Nội dung dòng gộp: liệt kê tên các trang có tin mới (không chỉ nói chung chung "có thay đổi" — vẫn phải giữ được câu trích/provenance của từng phát hiện, bấm vào phải ra đúng đoạn văn gốc của ĐÚNG trang đó, không lẫn giữa các trang).

## Success Criteria

- [ ] `pnpm seed` từ host nạp đúng 25/38/15, `SELECT count(*) FROM snapshot_pages` = tổng nhóm trang thật (≤172, một số công ty thiếu 1 vế)
- [ ] Chạy `pnpm seed` 2 lần liên tiếp → ID công ty giống hệt (UUID tất định từ phase 1)
- [ ] Test grant `snapshot_pages`: `crm_system` bị từ chối INSERT/UPDATE/DELETE
- [ ] `ObservationService.ingest()` trên công ty nhiều trang trả đúng số `sourcesAttempted`
- [ ] 1 công ty nhiều trang đổi cùng chu kỳ → đúng 1 timeline entry, mỗi phát hiện bên trong vẫn bấm ra đúng nguồn của đúng trang
- [ ] `apps/api/src/ai/demo-snapshots.ts` không còn hằng số công ty nào
- [ ] `pnpm typecheck` xanh

## Risk Assessment

| Rủi ro | Giảm thiểu |
| --- | --- |
| Gộp timeline làm mất provenance từng trang | Test riêng: bấm vào 1 trong 2 phát hiện gộp → phải ra đúng đoạn văn của ĐÚNG trang, không phải trang kia. Không tự tin bằng đọc code, phải chạy test |
| `DemoSnapshotSource` giờ cần DB nhưng test cũ mock nó | `demo-snapshots.test.ts` chuyển thành integration test (DB thật), không mock `readAll()` — mock sẽ không bắt được lỗi query SQL |
| Quên xoá `seed-data.ts` để lại import chết | `pnpm typecheck` bắt được import không tồn tại nếu xoá đúng, hoặc bắt được export thừa nếu quên xoá file — chạy typecheck ngay sau bước 4 |

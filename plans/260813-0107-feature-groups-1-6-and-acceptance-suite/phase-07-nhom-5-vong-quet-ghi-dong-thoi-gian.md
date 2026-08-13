---
phase: 7
title: "Nhóm 5 — vòng quét ghi dòng thời gian"
status: done
priority: P1
dependencies: [2, 4]
owner: C
estimate: 3h
---

# Phase 7: Nhóm 5 — vòng quét ghi dòng thời gian

> Thiết kế chốt 14/08 02:35 — [báo cáo phản biện](../reports/from-brainstorm-to-planner-260814-0159-phase-07-nhom-5-vong-quet-ghi-dong-thoi-gian-report.md).
> Hai quyết định đổi thiết kế so với bản 13/08: quyền ghi mục dòng thời gian đến từ **nhãn Đang theo dõi**, không từ `trigger_context` (ADR-0028) · `GRANT INSERT` trên `timeline_entries` siết theo cột (ADR-0029).

## Overview

Vùng tự chủ 4: **vòng lặp khép kín, không dừng chờ ai duyệt ở bất kỳ bước nào.** Khung vòng quét đã có và đã verify chạy thật ([ADR-0011](../../docs/decisions/0011-worker-cung-image-va-vong-quet-tu-hen-nhip.md)); `ObservationService.ingest()` đã làm trọn vòng đọc → so hash → claim → nhóm 4 → nhóm 3. Phase này thêm **bước nhóm 5** vào cuối chuỗi phản ứng, cho nó quyền ghi `TimelineEntry`, và dựng hai màn hình + đường xoá của I-13.

**Không viết lại logic hash/claim.** Vòng quét gọi `ingest()` qua interface đã có, đúng như plan skeleton dặn.

## Requirements

- Functional: bật/tắt nhãn Đang theo dõi bằng **một thao tác** + màn danh sách riêng; mỗi vòng: đọc lại nguồn → so bản lưu gần nhất → có nội dung mới thì rút phát hiện → **tự thêm** `TimelineEntry` (`created_by = system`, `entry_type = system_entry`) kèm nhãn "do hệ thống thêm" + câu trích bấm ra nguồn; mỗi vòng ghi một `WatchCycleRun` đủ 4 con số; mỗi 10 vòng thêm dòng cộng dồn; Sales xoá được mục hệ thống **kèm lý do ngắn**.
- Non-functional: chu kỳ cấu hình được, mặc định 60s, đọc từ CSDL mỗi lượt (đã có); gọi LLM tràn nhịp → **bỏ nhịp + ghi `skipped_reason`** (I-10, đã có); nguồn lỗi của một công ty **không** làm vòng chết.

## Quyết định đã chốt

| Câu hỏi | Chốt | ADR |
| --- | --- | --- |
| Công ty đang theo dõi + người bấm `Đọc lại nguồn` thì ai ghi tin | **Điều kiện là `is_watched`, không phải `trigger_context`.** Uỷ quyền là thuộc tính của công ty (ADR-0006), không của người bấm | **ADR-0028** (phải viết) — sửa I-4 ở ontology mục 6 + bảng M-5 |
| Lớp CSDL của vùng 4 | `GRANT INSERT` **theo cột** trên `timeline_entries` (bỏ `created_by`) + `DEFAULT 'system'` + CHECK nhãn hệ thống ⇒ có `source_claim_id` | **ADR-0029** (phải viết) — mở rộng [ADR-0015](../../docs/decisions/0015-grant-insert-phai-theo-cot-khi-bang-co-cot-thuoc-quyet-dinh-cua-nguoi.md) sang bảng của skeleton |
| Dòng cộng dồn mỗi 10 vòng | **Làm** — một câu `INSERT … SELECT`, mốc lấy trong SQL. Vẫn là món cắt số 2 nếu trượt lịch | — |
| Màn Đang theo dõi | **Màn `/dang-theo-doi` riêng** + công tắc một thao tác + dòng cảnh báo uỷ quyền của ADR-0006 | — |
| Nav | **Không sửa `layout.tsx`.** Nav thuộc chủ quyền [plan UI phase 2](../260814-0056-nang-cap-ui-shadcn-shell-tour/phase-02-app-shell-header-sidebar-footer.md); P7 chỉ thêm hai `<Link>` tạm theo đúng lối đang có, plan đó sẽ dọn | — |
| `occurred_at` của mục hệ thống lấy ở đâu | **Truyền `capturedAt` vào `ClaimReactionInput`** — `ObservationService` đã có `created.capturedAt` từ `.returning()`, nên **0 truy vấn thêm**. Không dùng `now()`: mục phải mang mốc bản lưu nó sinh ra từ | — |
| Câu trích trên dòng thời gian lấy đường nào | **Tra trong query `readingZone` đã cache** — `cong-ty/[id]/page.tsx:46` đã fetch observations kèm claims; tra `sourceClaimId` → claim → observation tại client. **0 endpoint mới, 0 DTO đổi**, không đụng `toDto` của B | — |
| Phạm vi đường xoá | **Chỉ mục `created_by='system'`.** I-13 chỉ nói về mục hệ thống; `stage_change` là vết đổi giai đoạn nên xoá nó là chuyện khác, chưa có ADR nào | Câu treo cho P8, xem mục cuối |
| ADR-0011 nói "worker không có pool `crm_app`" | **Sửa một dòng của ADR-0011** — câu đó sai từ trước P7 (`DbModule` là `@Global`, tạo cả hai pool; `SystemSettingService` nhận cả hai). Ghi kèm số đo: **không đường ghi nào của vòng quét đi qua `crm_app`** | Việc kèm bắt buộc |

**Lỗ mà ADR-0028 bịt:** I-5 chặn *Proposal* theo `is_watched`, I-4 chặn *system entry* theo `trigger_context` ⇒ công ty đang theo dõi mà người bấm đọc tay thì **không đường nào ghi**, và I-3 làm nó vĩnh viễn. `e2e/t6-t7` bấm "Đọc bản chụp sau" trên **Nimbus, `isWatched: true`** ⇒ tin của Nimbus không bao giờ lên dòng thời gian và T-8 phụ thuộc thứ tự spec.

## Bất biến phải có test

| # | Nội dung |
| --- | --- |
| I-3 | Hash trùng → **không** tạo bản lưu, **không** gọi LLM (đếm số lần gọi extractor = 0), `WatchCycleRun` ghi `new_content_count = 0` → Nhật ký hiện "đã đọc, không đổi" |
| I-4 **bản mới** | Công ty **không** theo dõi → 0 mục hệ thống, dù đọc tay hay vòng quét. Công ty **đang** theo dõi → có mục, dù ai đọc |
| I-5 | Đúng **một** trong hai đường chạy cho mỗi phát hiện: đang theo dõi → mục hệ thống, không có gợi ý `timeline_entry`; không theo dõi → gợi ý, không có mục hệ thống |
| I-10 | Vòng trước chưa xong → bỏ nhịp kế, ghi `skipped_reason`, **không ghi trùng mục** (đã có test từ skeleton, chạy lại với LLM trong vòng) |
| I-13 | Xoá `TimelineEntry` do hệ thống thêm **kèm lý do ngắn** + ghi `AuditEvent` — tín hiệu error-detection duy nhất của nhóm 5 |
| Nhãn | Mục vòng quét ghi có `created_by='system'` + `entry_type='system_entry'` + `source_claim_id` trỏ về claim có câu trích. `crm_system` **không** ghi được `created_by='human'` |
| T-8 | 3 công ty Đang theo dõi, đổi nguồn 2 → trong 2 chu kỳ có **2 mục mới** không ai bấm gì; Nhật ký có dòng tổng kết từng vòng |

## Architecture

```
ObservationService.ingest(company, variant, trigger)      ← KHÔNG sửa một dòng
  └─ ClaimReactionService.react()
       1. nhóm 4 · tự đặt Việc tiếp theo        (đã có)
       2. nhóm 3 · hàng đợi gợi ý               (đã có)
       3. nhóm 5 · SystemTimelineEntryService   ← THÊM, bọc try/catch, trả về số mục đã ghi
```

Ba lý do đặt ở **bước 3** chứ không phải trong `WatchCycleService`: ADR-0028 bắt đường đọc tay cũng phải ghi được ⇒ không thể nằm trong worker; đặt cuối thì lỗi của nó không giết nhóm 4/3 đã ghi xong; và nó là **gương** của `ProposalService.buildTimelineEntry` nên I-5 chứng minh được bằng một test.

Bộ lọc phải **copy nguyên** từ `proposal-service.ts:245-268` — `confidence ∈ {certain, likely}` + `signalType ≠ 'other'` + `is_watched` — lệch một điều kiện là hai đường bất đồng và không ai thấy.

`WatchCycleService.scan()`:

```
companies = SELECT id, name, snapshot_variant FROM companies WHERE is_watched = true
for mỗi công ty:
  try   { r = ingest(id, variant, 'watch_cycle'); cộng dồn 4 con số }
  catch { error_count += 1; gom message vào error_detail }        ← không ném ra ngoài
insert WatchCycleRun { started_at, duration_ms, companies_scanned, new_content_count,
                       entries_added, error_count, error_detail }
maybeRollup()
```

**Bốn con số đi đường nào:** `IngestResultDto` thêm **một** trường `systemEntriesAdded: number`; `react()` đổi từ `void` sang trả số đó. `new_content_count` = số công ty `!unchanged && fetchStatus==='ok'`; `entries_added` = tổng trường mới. Không đếm ngược theo thời gian ⇒ **không giá trị thời gian nào rời CSDL rồi quay lại** (bẫy `timestamptz` của P6).

`ClaimReactionInput` thêm `observationCapturedAt: Date` — `ObservationService` đã có `created.capturedAt` từ `.returning()` nên đây là **0 truy vấn**, và nó là mốc `occurred_at` của mục hệ thống.

**Hai module, đừng nhầm:**

- `WatchModule` (worker, không controller) nạp thêm **đúng 9 provider** — đã kiểm bằng đọc constructor từng service, thiếu một là worker vỡ lúc boot mà Docker restart trông giống hệt lỗi `unref()` của ADR-0011: `ObservationService` · `ClaimService` · `ClaimReactionService` · `AutoNextStepService` · `ProposalService` · `AuditEventService` · `DemoSnapshotSource` · `claimExtractorProvider` · `SystemTimelineEntryService`.
  **`NotificationService` KHÔNG cần** — `AutoNextStepService` tự `INSERT INTO notifications` trong transaction của mình (`auto-next-step-service.ts:249`), nó chỉ nhận `dbSystem`, `dbApp`, `AuditEventService`.
- `WatchLogModule` (api) — `GET /watch-cycle-runs` + đường xoá của I-13. Đặt controller vào `WatchModule` là **404 im lặng**: nhánh worker không phục vụ HTTP.

Hai hệ quả phải nói ra:

- **Vòng quét từ nay chạy cả nhóm 3 và nhóm 4** mỗi vòng — đúng Specs, nhưng nghĩa là 3 lần gọi LLM mỗi nhịp và vòng quét có thể sinh thông báo.
- **Worker CÓ pool `crm_app`** vì `DbModule` là `@Global` và tạo cả hai (`db.module.ts:20-36`) — đúng từ trước P7, `SystemSettingService` đã nhận cả hai. Nhưng **không đường ghi nào của vòng quét đi qua nó**: event + thông báo của nhóm 4 nằm trong transaction của `dbSystem` (actor = `SYSTEM_ACTOR`), `dbApp` chỉ dùng ở `listActive()` — đường đọc của bảng deal. Sửa một dòng Hệ quả của ADR-0011 cho khớp, xem "Việc kèm bắt buộc".

## Files

| Tạo/sửa | Vai trò |
| --- | --- |
| `packages/db/migrations/0007_timeline_entry_system_label.sql` | **tạo** — `DEFAULT 'system'` + CHECK + `REVOKE`/`GRANT INSERT` theo cột (ADR-0029) |
| `apps/api/src/watch/system-timeline-entry-service.ts` | **tạo** — bước nhóm 5, `INSERT` nêu đúng cột được phép |
| `apps/api/src/watch/system-timeline-entry-removal-service.ts` | **tạo** — I-13: xoá kèm lý do, `crm_app`, ghi `AuditEvent` |
| `apps/api/src/watch/watch-log-service.ts` + `watch-log.controller.ts` + `watch-log.module.ts` | **tạo** — `GET /watch-cycle-runs`, `DELETE /companies/:companyId/timeline/:entryId` |
| `apps/api/src/watch/watch-cycle-rollup.ts` | **tạo** — dòng cộng dồn mỗi 10 vòng |
| `apps/api/src/watch/watch-cycle-service.ts` | sửa — `scan()` nối vào `ingest()`, đếm 4 con số, lỗi từng công ty không làm chết vòng |
| `apps/api/src/watch/watch.module.ts` | sửa — nạp cây nhóm 2/3/4/5 |
| `apps/api/src/domain/claim/claim-reaction-service.ts` | sửa **một khối** (file của A) — bước 3 + trả `systemEntriesAdded` |
| `apps/api/src/domain/observation/observation-service.ts` | sửa **một dòng** (file của A) — chuyển `systemEntriesAdded` vào kết quả |
| `apps/api/src/app.module.ts` | sửa — thêm `WatchLogModule` (file dùng chung) |
| `packages/contracts/src/index.ts` (+ `dto/`) | sửa — `IngestResultDto.systemEntriesAdded`, `WatchCycleRunDto`, `deleteSystemTimelineEntrySchema` (file dùng chung) |
| `apps/web/src/app/dang-theo-doi/page.tsx` | **tạo** — danh sách + công tắc một thao tác + dòng cảnh báo uỷ quyền |
| `apps/web/src/app/quan-tri/nhat-ky-vong-quet/page.tsx` | **tạo** — Nhật ký vòng quét |
| `apps/web/src/app/cong-ty/[id]/timeline-section.tsx` | sửa (file của B) — câu trích bấm ra nguồn + nút Xoá hỏi lý do |
| `apps/web/src/app/cong-ty/page.tsx` | sửa (file của B) — một `<Link>` sang `/dang-theo-doi` |
| `apps/web/src/lib/api-client.ts` | sửa — 3 hàm mới (file dùng chung) |
| `apps/api/src/watch/__tests__/*` · `e2e/t8-watch-cycle-writes-timeline.spec.ts` | **tạo** — bộ test dưới |
| `apps/api/src/domain/observation/__tests__/reading-zone-provenance.test.ts` | **sửa test đang xanh** — xem mục "Việc kèm bắt buộc" |
| `docs/decisions/0028-*.md` · `0029-*.md` · `docs/decisions/README.md` · `docs/ontology.md` | **tạo/sửa** — hai ADR + dòng chỉ mục + I-4 mục 6 + bảng M-5 |

## Implementation steps

**Thứ tự TDD: mỗi bước viết test đỏ trước, rồi mới code cho xanh.** Không gộp hai bất biến vào một lượt.

1. **Migration + phép đo lớp CSDL trước tiên.** Viết test "`crm_system` không ghi được `created_by='human'` / `source_claim_id=NULL` / `entry_type='activity'`" trong `packages/db/src/__tests__/` (chạy trực tiếp bằng `pg`, không qua service) → đỏ vì hiện GRANT mức bảng. Rồi viết `0007`:

   ```sql
   ALTER TABLE timeline_entries ALTER COLUMN created_by SET DEFAULT 'system';
   ALTER TABLE timeline_entries ADD CONSTRAINT timeline_system_entry_needs_quote
     CHECK (created_by::text <> 'system' OR (entry_type::text = 'system_entry' AND source_claim_id IS NOT NULL));
   REVOKE INSERT ON timeline_entries FROM crm_system;
   GRANT INSERT (id, company_id, entry_type, occurred_at, description, source_claim_id, created_at)
     ON timeline_entries TO crm_system;
   ```

   So `::text` trong CHECK vì enum — **bẫy 55P04 của P5**: drizzle chạy mọi migration trong một transaction. `contact_id` **cố tình vắng** khỏi danh sách GRANT: AI gán một người liên hệ vào mục nó tự ghi là bịa ra một cuộc gặp. Kèm chiều-cho: `crm_app` vẫn ghi được `created_by='human'` (đã kiểm: `timeline-service.ts:53` và `opportunity-service.ts:218` đều truyền tường minh nên `DEFAULT` không bịt miệng ai).

2. **`SystemTimelineEntryService`.** Test đỏ cho I-4 bản mới + I-5 (bảng hai chiều: {đang theo dõi, không} × {đọc tay, vòng quét}). Ghi bằng `INSERT` nêu đúng cột — **không** `db.insert().values()`, nó liệt kê mọi cột nên chỉ cần *nêu tên* `created_by` là Postgres từ chối cả câu (bẫy drizzle của P5). `description = claim.statement`, `occurred_at = input.observationCapturedAt`, `source_claim_id = claim.id`.

3. **Nối vào `ClaimReactionService` bước 3** + thêm `observationCapturedAt` vào input + trả `systemEntriesAdded` qua `react()` → `ingest()` → `IngestResultDto`. Bọc try/catch: lỗi bước 3 không được xoá công của bước 1–2.

4. **`WatchCycleService.scan()`.** Test đỏ: I-3 trong vòng (0 bản lưu mới, extractor gọi 0 lần) · một công ty extractor **ném** → `error_count=1` mà các công ty khác vẫn xong và vòng vẫn ghi `WatchCycleRun` · I-10 với extractor cố tình chậm, không ghi trùng mục. Đọc `snapshot_variant` **theo từng công ty** ([ADR-0022](../../docs/decisions/0022-ban-chup-hien-tai-la-cot-text-tren-companies-khong-phai-enum-cua-ontology.md) — vòng quét không nhận tham số).

5. **Rollup.** Test đỏ: 10 vòng → đúng 1 dòng `is_rollup`, `cycles_covered=10`.

   ```sql
   INSERT INTO watch_cycle_runs (started_at, duration_ms, companies_scanned, new_content_count,
                                 entries_added, error_count, is_rollup, cycles_covered)
   SELECT max(started_at), sum(duration_ms), sum(companies_scanned), sum(new_content_count),
          sum(entries_added), sum(error_count), true, count(*)
   FROM watch_cycle_runs
   WHERE is_rollup = false
     AND started_at > coalesce((SELECT max(started_at) FROM watch_cycle_runs WHERE is_rollup), '-infinity')
   HAVING count(*) >= 10
   ```

   `max(started_at)` chứ không `min` — dòng cộng dồn phải nằm **sau** 10 dòng nó tổng kết. Nhịp bị bỏ cũng tính là một vòng. Mốc lấy bằng subquery, **không** gửi `Date` xuống làm tham số.

6. **I-13.** Test đỏ **bốn** nhánh: thiếu lý do → 400 · đủ → row mất + `AuditEvent` · mục `created_by='human'` → 403 (ngoài phạm vi I-13, xem mục câu treo) · dưới danh nghĩa `system` → 403 + `AuditEvent` từ chối (đúng khuôn `TimelineService.add`). Xoá qua `crm_app`. Bản ghi:

   ```
   AuditEvent{ actor:'human', action:'delete_system_timeline_entry', entity:'timeline_entry',
               entityId: <entry.id>, detail:{ reason, sourceClaimId, description } }
   ```

   **Đây là hợp đồng với P8** — ontology mục 7 kể tên "số lần xoá mục hệ thống" trong tử số error-detection rate, và `action` ở trên là chỗ P8 đếm.

7. **`WatchLogModule` + `GET /watch-cycle-runs`** (mới nhất trước, có `is_rollup`). Đặt vào `AppModule`, **không** vào `WatchModule`.

8. **Web.** `/dang-theo-doi`: danh sách + công tắc một thao tác (`PATCH /companies/:id` đã nhận `isWatched` — `contracts/src/dto/company.ts:37`) + dòng *"hệ thống sẽ tự ghi tin mới vào dòng thời gian, không hỏi duyệt"* mà [ADR-0006](../../docs/decisions/0006-bat-dang-theo-doi-la-uy-quyen-phan-ghi-tin.md) bắt buộc — thiếu dòng này thì nhãn thành cái bẫy. `/quan-tri/nhat-ky-vong-quet`: dòng từng vòng, dòng cộng dồn nổi bật, `skipped_reason` dịch tiếng Việt, `new_content_count=0` render "đã đọc, không đổi".

   `timeline-section.tsx` đã có `machine-*` + `Badge tone="system"` (dòng 107-116) — thêm câu trích + nút Xoá. **`SourceViewer` cần cả object `observation`** (`source-viewer.tsx:28`), không chỉ `sourceClaimId`: tra ngược trong query `readingZone` mà `cong-ty/[id]/page.tsx:46` **đã** fetch (observations kèm claims) → `sourceClaimId` → claim → observation. **Không endpoint mới, không đổi `TimelineEntryDto`.** Mục hệ thống mà không tra ra claim (bản lưu đã bị cuộn khỏi vùng đọc) thì hiện nhãn + câu "không tra được bản lưu", **không** hiện nút bấm rỗng — luật 1 CLAUDE.md.

   **Không sửa `layout.tsx`**, chỉ hai `<Link>`.

9. **Hai ADR + sửa ontology.** ADR-0028 phải ghi đủ ba phương án bị loại, gồm lý do loại "chặn đọc tay trên công ty đang theo dõi": **nó làm đỏ T-6/T-7 vì Nimbus đang theo dõi**, và đổi cờ `is_watched` trong seed thì đổi luôn số thẻ hàng đợi P5 đã đo.

10. **T-8 e2e** trên stack thật, `watch_cycle_seconds = 10`.

## Việc kèm bắt buộc

- **Sửa 1 test đang xanh:** `reading-zone-provenance.test.ts:224` (test 8 · I-4) đọc **Sakura — công ty đang theo dõi** — nên giờ phải khẳng định **có** 1 mục hệ thống; ca "không theo dõi ⇒ 0 mục" chuyển sang **Marlin**. Việc sửa test này chính là bằng chứng ngữ nghĩa đổi **có ý thức**, không phải hồi quy che đi.
- **Sửa `docs/ontology.md`**: I-4 ở mục 6 + bảng M-5 ở mục 7. Không sửa = ontology trang trí, và test parity của P5 đã chứng minh lớp chống đó cắn thật.
- **Bỏ bước 8 của bản phase cũ** (`@Cron`): nợ đó **đã trả** 12/08 trên stack thật (ADR-0011 mục "Đội đã verify", hai phép đo có log giờ). Thay bằng phép đo `scheduleNextTick(60)` cứng ở bảng dưới.
- **Sửa một dòng Hệ quả của [ADR-0011](../../docs/decisions/0011-worker-cung-image-va-vong-quet-tu-hen-nhip.md)**: *"Worker kết nối bằng `crm_system`, không có pool `crm_app`"* → sai từ trước P7 vì `DbModule` là `@Global`. Ghi lại đúng: worker **có** cả hai pool, nhưng **không đường ghi nào của vòng quét đi qua `crm_app`** — event + thông báo của nhóm 4 nằm trong transaction của `dbSystem` (`auto-next-step-service.ts:235-252`, actor = `SYSTEM_ACTOR`), `dbApp` chỉ dùng ở `listActive()`. Đây là chỗ vòng 2 hỏi được từ log, và câu trả lời phải là số đo chứ không phải lời hứa.
- **Nói với plan UI `260814-0056`** *(đã cập nhật 14/08 02:40)*: P7 tạo thêm 2 route ⇒ nav phase 2 của plan đó là **8 mục** (Nhật ký nằm trong Quản trị), `git mv` 7 thư mục, command palette phase 5 là 8 route.

## Ba phép đo đột biến

| Đột biến | Test phải đỏ |
| --- | --- |
| `scheduleNextTick(60)` cứng thay vì đọc CSDL | test 2 của `self-scheduling-watch-cycle` — **thay cho món `@Cron`**, cùng sức bác bỏ, một dòng thay vì viết lại service |
| `GRANT INSERT` mức bảng trên `timeline_entries` | "`crm_system` không ghi được `created_by='human'`" |
| Bỏ điều kiện `is_watched` ở bước nhóm 5 | "công ty KHÔNG theo dõi không có mục hệ thống" — I-4 bản mới |

## Validation

- [x] Ba phép đo đột biến đều cắn, đã khôi phục
- [x] I-3: công ty có bản "sau" giống hệt bản trước → 0 bản lưu mới, **0 lần gọi extractor**, `new_content_count = 0`
- [x] I-4 bản mới: bảng hai chiều {đang theo dõi, không} × {đọc tay, vòng quét} đúng cả 4 ô
- [x] I-5: mỗi phát hiện đi đúng **một** đường — không ô nào vừa có mục hệ thống vừa có gợi ý `timeline_entry`
- [x] I-10: vòng tràn nhịp → có `skipped_reason`, **không** ghi trùng mục
- [x] I-13: xoá thiếu lý do → từ chối · đủ → mất row + `AuditEvent` đúng `action` · mục người gõ → 403 · dưới danh nghĩa system → 403 + `AuditEvent` — *ba nhánh sau đo ở tầng service; nhánh thiếu lý do đo ở tầng schema (`deleteSystemTimelineEntrySchema`) chứ không phải qua HTTP, vì `ZodValidationPipe` là đường chung đã dùng ở mọi endpoint khác. Đường xoá đủ-lý-do có chạy thật qua HTTP trong e2e.*
- [x] Worker **boot được** trên compose và log in đúng một dòng `Starting Nest application` (thiếu provider thì Docker restart trông y hệt lỗi `unref()` của ADR-0011 — đếm số dòng log là phép đo nói dối)
- [x] ADR-0011 đã sửa dòng "không có pool `crm_app`", kèm câu chỉ ra đường ghi nào dùng pool nào
- [x] Nguồn lỗi một công ty → `error_count` tăng, `error_detail` có nội dung, các công ty khác vẫn xong
- [x] Mỗi 10 vòng có đúng 1 dòng `is_rollup`, `cycles_covered = 10`, nằm **sau** 10 dòng nó tổng kết
- [x] Mục do hệ thống thêm: nhãn "do hệ thống thêm" + câu trích bấm ra được đoạn gốc có đánh dấu
- [x] `/dang-theo-doi` bật/tắt **một thao tác** + có dòng cảnh báo uỷ quyền
- [x] T-8 xanh trên stack thật, chu kỳ 10s, `docker compose up --build` **trước** khi đọc kết quả e2e (bài học P4)
- [x] ADR-0028 + ADR-0029 đã viết, ontology I-4 + M-5 đã sửa, test parity xanh
- [x] `pnpm test` · `pnpm lint` · `pnpm typecheck` xanh (`pnpm build` trên Windows fail `EPERM: symlink` — **có sẵn từ trước**, không debug lại)

## Risks

| Rủi ro | Xử lý |
| --- | --- |
| Vòng quét giờ gọi LLM 3 lần + chạy nhóm 3/4 mỗi nhịp → tràn 60s | I-10 đã có cơ chế và test. T-8 chạy chu kỳ 10s nên **tràn nhịp là chuyện thường** — đọc `skipped_reason` như trạng thái bình thường, không phải lỗi |
| Bộ lọc nhóm 5 lệch khỏi `buildTimelineEntry` | Test I-5 hai chiều là chỗ duy nhất bắt được. Copy nguyên ba điều kiện, không diễn giải lại |
| Xoá mục xong nó mọc lại vòng sau | Ghi-một-lần-lúc-tạo-claim ⇒ I-3 tự bảo đảm. **Đừng thêm "quét bù"** — phương án đó đã bị loại vì cần tombstone (xem ADR-0028) |
| Đặt controller vào `WatchModule` | 404 im lặng, không có lỗi để đọc. `WatchLogModule` vào `AppModule` |
| Cửa chặn báo đúng nhưng prompt sai (bài học P5) | Nhật ký phải hiện đủ 4 con số **từng vòng**. `entries_added=0` mà `new_content_count>0` là dấu hiệu bộ lọc/prompt sai, **không** phải "LLM không tìm được gì" |
| `crm_system` thiếu GRANT `timeline_entries` sau khi `REVOKE` | Chiều-cho nằm cùng test với chiều-cấm ở bước 1 — quên GRANT lại thì đỏ ngay, không im lặng |
| **Thiếu một provider trong `WatchModule` → worker vỡ lúc boot** | Docker restart lại, và log trông *gần đúng* — đúng hình dạng lỗi `unref()` mà ADR-0011 kể. Đọc dòng `Starting Nest application`, **không** đếm số dòng `WatchCycleRun`. Danh sách 9 provider ở mục Architecture đã kiểm bằng đọc constructor từng service |
| Ước lượng 3h, P8 4h, freeze tối 14/08 | Cắt theo thứ tự: rollup (mục cắt số 2 của plan) → `/dang-theo-doi` hạ xuống công tắc trên danh sách sẵn có. **Không cắt**: I-13, nhãn + câu trích, T-8 |

## Rollback

`ai_enabled = false` dừng vòng ngay, mục đã thêm còn nguyên (T-9). Đường lùi từng lớp:

- Bỏ rollup, giữ dòng từng vòng — 5'.
- Bỏ bước 3 khỏi `ClaimReactionService` (một khối) → về đúng trạng thái trước P7, dữ liệu đã ghi không cần dọn — 5'.
- ADR-0029 lùi bằng `REVOKE` + `GRANT` lại mức bảng — 5', đã đo là `REVOKE` **có** tác dụng khi quyền cấp theo cột (ADR-0015 bước 3).
- ADR-0028 lùi bằng đổi điều kiện về `trigger_context` — 2', nhưng lỗ ở mục "Quyết định đã chốt" quay lại.

## Câu treo giao cho P8

**Xoá mục dòng thời gian do người gõ.** Specs viết *"Sales vẫn xoá được một mục do hệ thống thêm, **như mọi mục khác**"* — đọc kỹ thì mệnh đề phụ đó ngầm hứa mục người gõ cũng xoá được, nhưng hiện **không** có đường nào và I-13 chỉ ràng buộc mục hệ thống. P7 chốt phạm vi hẹp (chỉ `created_by='system'`, mục người gõ → 403) vì `stage_change` là vết đổi giai đoạn: xoá nó là xoá bằng chứng của một hành vi, cần ADR riêng chứ không nới cùng lúc với I-13. P8 cân: hoặc mở cho `activity`/`note` (không đòi lý do, không vào metric), hoặc nói thẳng với BGK đây là phạm vi đã chọn.

## Kết quả — đóng 14/08 03:38

**262 test đơn vị (225 → +37) + 16 e2e (11 → +5) xanh**, lint/typecheck sạch, ba phép đo đột biến đều cắn và đã khôi phục. Worker boot trên compose với **đúng một** dòng `Starting Nest application`, và trên stack thật nó đọc nguồn bằng LLM thật (`claude-haiku-4-5`).

Bốn thứ chỉ lộ ra lúc gõ code, ghi lại vì cả bốn đều là bẫy sẽ gặp lại:

- **`WatchLogModule` khai báo controller có guard mà không import `AuthModule` → sập cả container API.** Dependency của guard được giải trong module **khai báo controller**, không phải trong `AppModule` dù `AppModule` import cả hai. Triệu chứng là **502 ở trang đăng nhập** — không có gì trong đó chỉ về phía nhật ký vòng quét, và toàn bộ test đơn vị vẫn xanh. Chỉ e2e bắt được, và chỉ vì nó tình cờ đăng nhập. Đã thêm `watch-module-boots.test.ts` giải **cả hai** cây module: lỗi này giờ đỏ trong 17ms thay vì thành 502.
- **`CHECK` và `GRANT` theo cột không dư nhau — đã đo.** Cấp lại `GRANT INSERT` mức bảng thì test "AI ghi `created_by='human'`" đỏ **trong khi `CHECK` vẫn xanh**: `CHECK` không hề chặn được ca đó. Ai định bỏ một trong hai lớp cho gọn thì đọc con số này trước.
- **Dialog luôn mounted làm đỏ T-1.** `<dialog>` đóng vẫn nằm trong DOM kèm nội dung, nên mỗi mục dòng thời gian xuất hiện **hai lần**; `getByText(<hoạt động>)` khớp 2 phần tử. Màn hình trông đúng hoàn toàn. Sửa: chỉ mount khi mở.
- **Vòng quét từ nay đọc thật, nên nó là tải nền của mọi spec khác.** Trước P7 `scan()` chỉ đếm công ty. Hai spec cũ mã hoá giả định đó: T-3 khẳng định vùng đọc rỗng lúc mở màn (Sakura là công ty đang theo dõi), và các assertion chờ đọc nguồn để mặc định 5s của Playwright — 5s là con số đặt ra khi vòng quét không làm gì. Đã sửa cả hai **có ý thức**, không nới lỏng: T-3 giờ khẳng định thứ mạnh hơn (**đếm** số phát hiện = số nút xem nguồn, tức không phát hiện nào không có đường về nguồn), còn timeout nâng lên 30s mà assertion giữ nguyên.

**Ba test cũ đổi nghĩa có chủ ý** (không phải hồi quy che đi): `reading-zone-provenance` test 8 (Sakura đang theo dõi ⇒ **có** mục hệ thống, ca không-theo-dõi chuyển sang Marlin thành test 8b) · T-4 test 1 (khẳng định "không mục nào do **người** ghi" + "số mục hệ thống **không tăng** qua 3 vòng" thay cho `count = 0`, mạnh hơn bản cũ) · grant test 6 của P1 (không nêu `created_by` nữa, thêm 6b khẳng định nêu vào thì bị từ chối).

**Một chỗ vượt phạm vi phase file, cố ý:** rollup gọi ở `tick()` chứ không ở cuối `scan()`. Phase file ghi `scan()`, nhưng "nhịp bị bỏ cũng tính là một vòng" thì 10 vòng toàn skip sẽ không bao giờ được tổng kết — đúng đoạn nhật ký mà người đọc cần tổng kết nhất. Test 8 của `watch-cycle-scans-and-writes` là chỗ đo điều đó.

**P8 mở khoá.** Hợp đồng đã có: `audit_events.action = 'delete_system_timeline_entry'`, `detail` mang `reason` · `sourceClaimId` · `description`.

<!-- Updated: Validation Session 10 - occurred_at qua ClaimReactionInput · provenance qua readingZone cache · phạm vi xoá chỉ mục hệ thống · ADR-0011 sửa dòng pool -->
<!-- Closed: 14/08 03:38 - 262 unit + 16 e2e, 3 mutation measurements bite -->


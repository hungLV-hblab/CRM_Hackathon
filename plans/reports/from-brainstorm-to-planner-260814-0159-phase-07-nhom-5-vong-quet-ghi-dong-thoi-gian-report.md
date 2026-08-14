# Phản biện thiết kế Phase 7 — nhóm 5, vòng quét ghi dòng thời gian

| | |
| --- | --- |
| **Ngày** | 2026-08-14 01:59 → 02:35 |
| **Phạm vi** | [phase-07-nhom-5-vong-quet-ghi-dong-thoi-gian.md](../260813-0107-feature-groups-1-6-and-acceptance-suite/phase-07-nhom-5-vong-quet-ghi-dong-thoi-gian.md) |
| **Người quyết định** | HungLV |
| **Cách kiểm** | Đọc mã nguồn thật (không chạy đo), 14 file + 4 ADR + Specs mục nhóm 5 + ontology mục 6/7 |
| **Kết quả** | 4 quyết định chốt · 2 ADR phải viết · 1 test đang xanh phải sửa · ước lượng 2h → 3h |

## 1 · Vấn đề

Phase 7 viết cùng lúc với plan (13/08 01:07), **trước khi P2/P4/P5/P6 xong** — cùng hoàn cảnh đã làm phase 4, 5, 6 lệch với code thật. Kiểm lại trước khi gõ code: hai chỗ lệch đủ nặng để đổi thiết kế, sáu chỗ là bẫy triển khai, một bước là nợ đã trả rồi.

## 2 · Đã có sẵn — phase file không biết

| Thứ | Ở đâu | Hệ quả cho P7 |
| --- | --- | --- |
| Vòng đọc trọn gói: hash-compare I-3 → `observations` → claims → `ClaimReactionService.react()` (nhóm 4 rồi nhóm 3) | `observation-service.ts:77-175` | "Nối vào đường ống nhóm 2" = một vòng `for` + một lời gọi. Không viết lại hash/claim, đúng như bước 2 đã dặn |
| 4 con số + `is_rollup` + `cycles_covered` | `watch-cycle-runs.ts:11-25` | **0 migration** cho phần log |
| Nửa còn lại của I-5 kèm bộ lọc `confidence ∈ {certain, likely}` + `signalType ≠ 'other'` + biến đếm `blockedByWatchedCompany` | `proposal-service.ts:245-268` | Nhóm 5 phải soi gương **đúng** bộ lọc này; lệch một điều kiện là hai đường bất đồng và không ai thấy |
| Nợ verify ADR-0011 | ADR-0011 mục "Đội đã verify" (12/08, stack thật) + test 1–6 gồm I-10, T-9 | **Bước 8 của phase file sai tiền đề** — món nợ đã trả |
| `ANTHROPIC_API_KEY` cho worker | `infra/docker-compose.yml:82-90` | Hạ tầng đã sẵn, T-8 chạy được với LLM thật |
| Badge `tone="system"` + màu `machine-*` cho mục hệ thống | `timeline-section.tsx:107-116` | Chỉ còn thiếu câu trích + nút xoá |
| Bộ lọc + badge `Đang theo dõi`, checkbox trong form Sửa | `cong-ty/page.tsx:150-201`, `company-profile-section.tsx:127-131` | Cái **thật thiếu** là "một thao tác" — hiện tốn 3 (Sửa → tick → Lưu) |

## 3 · Hai chỗ lệch đủ nặng để đổi thiết kế

### 3.1 · Lệch điều kiện I-4 ↔ I-5: một lỗ ăn mất vật liệu của T-8

I-5 chặn *Proposal* theo `is_watched`. I-4 chặn *system entry* theo `trigger_context`. Công ty **đang theo dõi** + người bấm `Đọc lại nguồn` ⇒ **không đường nào ghi**, và I-3 làm nó **vĩnh viễn**: vòng quét sau thấy hash trùng → 0 claim → không có lần thứ hai.

Không phải giả thiết. `e2e/t6-t7-auto-next-step-and-undo.spec.ts:50` bấm "Đọc bản chụp sau" trên **Nimbus, `isWatched: true`** (`seed-data.ts:51-57`). Chạy T-6 trước T-8 thì tin lãnh đạo mới của Nimbus không bao giờ lên dòng thời gian, và **T-8 thành phụ thuộc thứ tự spec** — đúng loại lỗi tốn nhiều giờ nhất vào ngày cuối.

### 3.2 · `GRANT INSERT` mức bảng trên `timeline_entries`

`0001_grants.sql:53` cấp `SELECT, INSERT` **mức bảng** ⇒ `crm_system` ghi được `created_by='human'` và `source_claim_id=NULL`: **AI viết được một dòng trông như người gõ, không nguồn**. Đúng cấu trúc lỗi ADR-0015 đã bắt, đúng bảng mà ADR đó không phân loại (nó chỉ xét 7 bảng *mới* của P1). Nhãn của vùng 4 hiện chỉ có **một** lớp chặn, trong khi mục 4 CLAUDE.md đòi hai.

Đã kiểm điều kiện an toàn để sửa: mọi đường ghi của người truyền `createdBy` tường minh (`timeline-service.ts:53`, `opportunity-service.ts:218`) ⇒ thêm `DEFAULT 'system'` không bịt miệng ai.

## 4 · Sáu bẫy triển khai

1. **`WatchModule` chỉ có `[DbModule] + SystemSettingService + WatchCycleService`.** Nối nhóm 2 kéo theo 10 provider. Hệ quả chưa ai ghi: **vòng quét chạy cả nhóm 3 và nhóm 4** mỗi vòng — đúng Specs, nhưng nghĩa là 3 lần gọi LLM mỗi nhịp và vòng quét có thể sinh thông báo.
2. **Endpoint Nhật ký + endpoint xoá không được nằm trong `WatchModule`** — nhánh worker không phục vụ HTTP và cố tình không có controller. Đặt sai = 404 im lặng.
3. **Xoá xong không được mọc lại.** Ghi-một-lần-lúc-tạo-claim thì I-3 tự bảo đảm; mọi kiểu "quét bù" đều cần tombstone.
4. **Phép đo `@Cron` ở bước 8 đắt và trùng.** Cùng sức bác bỏ, một dòng: thay `parameters.watchCycleSeconds` bằng `60` cứng.
5. **`started_at` là `timestamptz`** — bẫy micro/mili của P6. Tính mốc rollup **trong SQL**, không gửi `Date` xuống làm tham số.
6. **Không có nav dùng chung** (nợ từ P6) ⇒ hai màn mới không tới được nếu không thêm.

## 5 · Bốn quyết định chốt

| Câu hỏi | Chốt | Phương án bị loại | Hệ quả lan ra |
| --- | --- | --- | --- |
| Đóng lỗ I-4/I-5 thế nào | **Đồng bộ điều kiện về `is_watched`**: công ty đang theo dõi + claim mới ⇒ ghi mục hệ thống, bất kể ai đọc | *Giữ I-4 nguyên văn, chấp nhận lỗ* — vòng lặp "khép kín" có chỗ rỉ, T-8 phụ thuộc thứ tự · *Quét bù + tombstone từ AuditEvent* — đóng được lỗ mà không sửa I-4, nhưng thêm một luật vỡ im lặng · *Chặn `Đọc lại nguồn` trên công ty đang theo dõi* — **làm đỏ T-6/T-7 vì Nimbus đang theo dõi**, và đổi cờ `is_watched` trong seed thì đổi luôn số thẻ hàng đợi P5 đã đo | **ADR-0028** + sửa I-4 ở ontology mục 6 và bảng M-5 + sửa test 8 đang xanh. Đường ghi bắt buộc nằm ở `ClaimReactionService`, không nằm trong `WatchCycleService` |
| Lớp CSDL cho vùng 4 | **`GRANT INSERT` theo cột + `DEFAULT 'system'` + CHECK** nhãn hệ thống ⇒ có `source_claim_id` | *Để nguyên, chặn ở domain* — vòng 2 hỏi "vùng 4 chặn mấy lớp" thì đáp án là một | **ADR-0029** + migration `0007`. Đường ghi phải nêu đúng cột, **không** `db.insert().values()` (bẫy drizzle của P5) |
| Dòng cộng dồn mỗi 10 vòng (mục cắt số 2 của plan) | **Làm** — một câu `INSERT … SELECT`, mốc lấy trong SQL | *Cắt* — tiết kiệm ~30' nhưng hở một dòng Specs mục nhóm 5 | Không migration. `max(started_at)` để dòng cộng dồn nằm **sau** 10 dòng nó tổng kết |
| Màn Đang theo dõi | **Màn `/dang-theo-doi` riêng** + công tắc một thao tác + dòng cảnh báo uỷ quyền của ADR-0006 | *Chỉ thêm công tắc vào danh sách sẵn có, coi bộ lọc là màn danh sách* — rẻ hơn ~30' nhưng lệch câu Specs "có một màn hình danh sách riêng" | Cần nav tối thiểu trong `layout.tsx`, P8 dùng tiếp |

## 6 · Thiết kế đã duyệt

### 6.1 · Nơi nhóm 5 ghi

```
ObservationService.ingest(company, variant, trigger)      ← không sửa một dòng
  └─ ClaimReactionService.react()
       1. nhóm 4 · tự đặt Việc tiếp theo        (đã có)
       2. nhóm 3 · hàng đợi gợi ý               (đã có)
       3. nhóm 5 · SystemTimelineEntryService   ← THÊM, bọc try/catch
```

Ba lý do đặt ở bước 3: quyết định số 1 bắt buộc đường **đọc tay** cũng phải ghi được nên nó không thể nằm trong `WatchCycleService`; đặt cuối thì lỗi của nó không giết nhóm 4/3 đã ghi xong; và nó là **gương** của `buildTimelineEntry` nên "đúng một trong hai đường chạy cho mỗi claim" chứng minh được bằng một test.

`WatchCycleService.scan()`: `SELECT id, snapshot_variant WHERE is_watched` → `for` gọi `ingest(id, variant, 'watch_cycle')` → cộng 4 con số → 1 `WatchCycleRun` → `maybeRollup()`. Lỗi từng công ty bắt trong vòng lặp, cộng `error_count`, không ném ra ngoài.

Chủ quyền file: service mới đặt ở `apps/api/src/watch/` (của C); `claim-reaction-service.ts` của A sửa **một khối** — đúng khuôn ADR-0023 đã chuẩn bị ("P6 và P7 chỉ sửa file điều phối").

### 6.2 · Bốn con số đi đường nào

`IngestResultDto` thêm **một** trường `systemEntriesAdded: number`; `react()` đổi từ `void` sang trả số đó. `new_content_count` = số công ty `!unchanged && fetchStatus==='ok'`; `entries_added` = tổng trường mới. Không đếm ngược theo thời gian ⇒ **không giá trị thời gian nào rời CSDL rồi quay lại**.

I-3 "ghi *đã đọc, không đổi*" **không cần cột mới**: `companies_scanned=3, new_content_count=0` chính là bản ghi đó, Nhật ký render thành câu.

### 6.3 · Rollup

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

Nhịp bị bỏ cũng tính là một vòng.

### 6.4 · Migration `0007_timeline_entry_system_label.sql`

```sql
ALTER TABLE timeline_entries ALTER COLUMN created_by SET DEFAULT 'system';
ALTER TABLE timeline_entries ADD CONSTRAINT timeline_system_entry_needs_quote
  CHECK (created_by::text <> 'system' OR (entry_type::text = 'system_entry' AND source_claim_id IS NOT NULL));
REVOKE INSERT ON timeline_entries FROM crm_system;
GRANT INSERT (id, company_id, entry_type, occurred_at, description, source_claim_id, created_at)
  ON timeline_entries TO crm_system;
```

`created_by` **vắng** khỏi danh sách ⇒ CSDL tự bảo đảm mọi mục AI ghi đều mang nhãn hệ thống **và** có câu trích. So `::text` trong CHECK vì enum (bài học 55P04 của P5).

### 6.5 · I-13

`DELETE /companies/:companyId/timeline/:entryId`, body `{ reason }` 3–200 ký tự, chỉ xoá mục `created_by='system'`, qua `crm_app`. Ghi `AuditEvent{ actor:'human', action:'delete_system_timeline_entry', entity:'timeline_entry', entityId, detail:{ reason, sourceClaimId, description } }`.

**Đây là hợp đồng với P8**: ontology mục 7 kể tên "số lần xoá mục hệ thống" trong tử số error-detection rate, và `action` ở trên là chỗ P8 đếm. `actor.kind==='system'` gọi vào → 403 + AuditEvent từ chối, đúng khuôn `TimelineService.add`.

### 6.6 · Module

- `WatchModule` (worker) nạp thêm: `ObservationService`, `ClaimService`, `ClaimReactionService`, `AutoNextStepService`, `ProposalService`, `NotificationService`, `SystemTimelineEntryService`, `DemoSnapshotSource`, `claimExtractorProvider`, `AuditEventService`.
- `WatchLogModule` (api) — `GET /watch-cycle-runs` + controller xoá của I-13.

### 6.7 · Web

| Màn | Nội dung |
| --- | --- |
| `/dang-theo-doi` | Danh sách + công tắc một thao tác (`PATCH /companies/:id`) + dòng cảnh báo uỷ quyền ADR-0006 |
| `/quan-tri/nhat-ky-vong-quet` | Dòng từng vòng · dòng cộng dồn nổi bật · `skipped_reason` tiếng Việt · `new_content_count=0` → "đã đọc, không đổi" |
| `timeline-section.tsx` (file của B, sửa nhỏ) | Thêm câu trích bấm ra nguồn qua `source-viewer.tsx` + nút Xoá hỏi lý do |
| `layout.tsx` | Nav tối thiểu, P8 dùng tiếp |

## 7 · Ba phép đo đột biến

| Đột biến | Test phải đỏ |
| --- | --- |
| `scheduleNextTick(60)` cứng thay vì đọc CSDL | test 2 `self-scheduling-watch-cycle` — **thay cho món `@Cron` của bước 8** |
| `GRANT INSERT` mức bảng trên `timeline_entries` | "crm_system không ghi được `created_by='human'`" |
| Bỏ điều kiện `is_watched` ở bước nhóm 5 | "công ty KHÔNG theo dõi không có mục hệ thống" — I-4 bản mới |

## 8 · Test viết đỏ trước

I-3 trong vòng (0 bản lưu mới, extractor 0 lần gọi) · I-10 với extractor cố tình chậm, không ghi trùng mục · I-13 ba nhánh (thiếu lý do → 400 · đủ → mất row + AuditEvent · dưới danh nghĩa system → 403) · nhãn + `source_claim_id` trỏ về claim có câu trích · một công ty lỗi thật (extractor ném) → `error_count=1` mà công ty khác vẫn xong · 10 vòng → đúng 1 dòng `is_rollup`, `cycles_covered=10` · **T-8 e2e** chu kỳ 10s, 3 công ty theo dõi, flip 2 → 2 mục mới không ai bấm gì.

## 9 · Việc kèm bắt buộc

- **Sửa 1 test đang xanh:** `reading-zone-provenance.test.ts:224` (test 8) đọc Sakura — công ty đang theo dõi — nên giờ phải khẳng định **có** 1 mục hệ thống; ca "không theo dõi ⇒ 0 mục" chuyển sang Marlin. Chính việc sửa test này là bằng chứng ngữ nghĩa đổi có ý thức, không phải hồi quy.
- **Sửa ontology mục 6** (I-4) và bảng M-5 mục 7. Không sửa = ontology trang trí, và test parity của P5 đã chứng minh lớp chống đó chạy thật.
- **Bỏ bước 8 của phase file**, thay bằng phép đo `scheduleNextTick` cứng.

## 10 · Rủi ro còn lại

| Rủi ro | Xử lý |
| --- | --- |
| Vòng quét giờ gọi LLM 3 lần + chạy nhóm 3/4 mỗi nhịp → tràn 60s | I-10 đã có cơ chế và đã có test; T-8 chạy chu kỳ 10s nên tràn nhịp là **chuyện thường**, phải đọc `skipped_reason` như trạng thái bình thường chứ không phải lỗi |
| `pnpm build` trên Windows fail `EPERM: symlink` | Có sẵn từ trước P6, không phải do P7. Bản Linux trong container xanh; đừng debug lại |
| Đếm cửa chặn báo đúng nhưng prompt sai (bài học P5) | Nhật ký phải hiện đủ 4 con số **từng vòng**; `entries_added=0` mà `new_content_count>0` là dấu hiệu bộ lọc hoặc prompt sai, không phải "LLM không tìm được gì" |
| Ước lượng 2h → **3h**, P8 4h, freeze tối 14/08 | Còn ~17 tiếng. Món cắt đầu tiên nếu trượt: rollup (mục cắt số 2 của plan), rồi màn `/dang-theo-doi` hạ xuống công tắc trên danh sách sẵn có |

## 11 · Câu hỏi chưa giải quyết

- Có cần **nút flip bản chụp** trong `/quan-tri` hay CLI `pnpm switch-snapshot` đủ cho vòng 1? Treo từ P4, không chặn gì — nhưng giờ `/quan-tri` đã có một màn nên chi phí thêm gần bằng 0.
- Xoá mục dòng thời gian **do người gõ** vẫn không có đường nào (P7 chỉ mở đường cho mục hệ thống). Specs viết "như mọi mục khác" — đọc là quyền của Sales, nhưng chưa ai làm và `stage_change` là vết đổi giai đoạn nên xoá nó là chuyện khác. Để P8 cân, không chặn P7.

---
title: "Phản biện thiết kế Phase 4 — seed, bản chụp trước/sau, T-1"
type: brainstorm-report
date: 2026-08-13
time: "19:56"
phase: plans/260813-0107-feature-groups-1-6-and-acceptance-suite/phase-04-seed-ban-chup-truoc-sau-va-t1.md
branch: feat/phase-3-nhom-1-crm-lam-tay
status: approved
---

# Phản biện thiết kế Phase 4

Phase-04 viết **trước khi P2 xong**. Phiên này hoà giải phase file với code thật, chốt 4 quyết định + 1 quyết định con, bỏ 4 hạng mục đã có hoặc phủ trùng, và bịt lỗ hổng chặn T-8.

## Vấn đề

Phase file mô tả một bộ bản chụp chưa tồn tại và một cơ chế đổi bản chụp không khớp với cách code thật hoạt động. Cụ thể: (1) bản chụp đã có sẵn ở chỗ khác dạng khác, (2) `variant` là tham số request nên `switch-snapshot.ts` không có gì để đổi, (3) vòng quét không nhận `variant` → **T-8 không đóng được**, (4) T-1 không có đường tắt AI.

## Scout — 8 phát hiện lệch

| # | Phát hiện | Nguồn |
| --- | --- | --- |
| 1 | Bản chụp **đã tồn tại**: 4 công ty × before/after dạng TS constant, HTML bẩn có chủ ý | `apps/api/src/ai/demo-snapshots.ts` |
| 2 | Ca `fetch_status = failed` **đã có** (Ohara `rawHtml: ''`) → không cần công ty thứ 5 cho việc này | `demo-snapshots.ts:90-99` |
| 3 | Phân bố tin hiện tại **tốt hơn bảng trong phase file**: I-6 không đọc loại công ty, chỉ đọc `signal_type` + có cơ hội mở | `docs/ontology.md:156` |
| 4 | Dọn I-14 (bước 3 của phase) **đã xong**: `seed()` TRUNCATE cả `ALL_TABLES` (15 bảng) | `packages/db/src/seed/index.ts:41-47`, `schema/all-tables.ts:29-46` |
| 5 | I-3 (đọc lại không tạo bản lưu) + replay trước→sau→trước **đã có test** | `reading-zone-provenance.test.ts` test 6, 7 |
| 6 | `variant` là **tham số request**, không phải trạng thái lưu; vòng quét chỉ `count()` công ty theo dõi | `observation.controller.ts:30`, `watch-cycle-service.ts:113` |
| 7 | **Không có đường ghi `ai_enabled`** — controller chỉ có `@Get()` | `settings.controller.ts:17` |
| 8 | Seed thiếu thật: **0 contact · 0/12 ô dấu hiệu · 0 cơ hội `lost`** | `seed-data.ts` |

Kèm theo: `apps/web` không có project trong `vitest.config.mts` → T-1 gánh toàn bộ coverage giao diện của P3 (nợ có chủ ý, phiên 1 đã ghi).

## Phương án đã cân — và vì sao loại

### Nhà bản chụp: TS constant vs HTML file

| | Chọn | Loại |
| --- | --- | --- |
| | Giữ TS constant, mở rộng `demo-snapshots.ts` | HTML file trong `packages/db/src/seed/snapshots/` + đọc fs |
| Được | `DemoSnapshotSource` không đổi một dòng; không có rủi ro asset | Đúng phase file, đúng ADR-0013 "thay một file" |
| Mất | Nội dung ở `apps/api` (A sở hữu) chứ không `packages/db`; ADR-0013 thành "thay 2 file" | Viết lại `DemoSnapshotSource`, import xuyên package vào ruột seed, **cộng rủi ro copy asset vào Nest standalone image — thiếu file thì `ENOENT` chỉ nổ trên `pnpm start`, đúng cái stack e2e và giám khảo mở** |

Lý do quyết định: ngày 13/08 không phải lúc nhận loại lỗi chỉ hiện trên stack production.

### Trạng thái variant: cột vs key-value vs không lưu

| Phương án | Kết luận |
| --- | --- |
| **Cột `companies.snapshot_variant`** | **Chọn.** Vòng quét đọc theo từng công ty; I-14 tự đúng vì seed TRUNCATE + insert lại; `crm_system` không cần GRANT mới |
| Row `system_settings` giữ danh sách | Loại: dữ liệu theo-công-ty nhét vào bảng key-value, không FK về `companies` → xoá công ty để lại rác treo |
| Giữ request param, e2e gọi thẳng ingest | Loại: **T-8 đòi "trong 2 chu kỳ"**, chu kỳ tự chạy phải biết đọc bản nào. Chọn cái này = chấp nhận T-8 không đóng đúng đề bài |

### Tắt AI cho T-1

Chọn **helper SQL trong `e2e/` qua `DATABASE_URL_OWNER`** (`global-setup.ts` đã có đường DB). Loại phương án làm `PATCH /settings` sớm: module `settings` không có tên ai trong bảng chủ quyền, và P4 đang là đường chặn P7 nên phình phase này ra là đổi hướng sai. Nút tắt là T-9/P8.

### Hình dạng T-1

**Người quyết định chọn một spec liền mạch**, khác khuyến nghị tách ba của phiên phản biện. Lý do khuyến nghị tách: một spec 40 bước hỏng ở bước 12 thì bước 13–40 không biết đúng sai, vào sáng 14/08. Hoà giải đã chấp nhận: giữ một spec, bọc mỗi chặng trong `test.step()` → reporter chỉ ra step nào đỏ, `trace: 'retain-on-failure'` đã bật sẵn. Giữ được "đi hết luồng" mà không mù chẩn đoán, chi phí gần bằng không.

## Quyết định con lộ ra sau khi chốt cột

`snapshot_variant` **không được vào `ENUMS`**. `ontology-enum-parity.test.ts` đọc `docs/ontology.md` §3.5 lúc chạy, assert `toHaveLength(12)`, và có ca *"no enum in code that the ontology never declared"* → thêm vào `ENUMS` là đỏ hai chỗ cộng phải sửa `ontology.md` (file dùng chung) và đổi 12→13.

→ `text('snapshot_variant').notNull().default('before')` + `CHECK (snapshot_variant IN ('before','after'))`.

Lý do không chỉ là né test: variant là **giàn giáo demo**, không phải từ vựng nghiệp vụ. Ontology §3.5 mô tả CRM; "đọc file HTML nào trong hai file đóng hộp" biến mất ngày có crawler thật. `SnapshotVariant` giữ nguyên chỗ nó đang ở.

## Thiết kế chốt

### 1. Bảng bản chụp — thay bảng trong phase file

| Công ty | Loại | `isWatched` | Bản "sau" thêm | Dùng cho |
| --- | --- | --- | --- | --- |
| Sakura | `traditional` | **true** (đã có) | funding (đã có) | I-7: cơ hội mở `nextStepSource: human` → **Proposal**, không tự ghi |
| Nimbus | `it_solution` | **true** (đã có) | leadership_hire (đã có) | **T-6, T-7**: cơ hội mở, next step trống → tự đặt |
| Kitefin | `tech_startup` | **false → true** | expansion (đã có) | Nhóm 3: I-6 loại `expansion` → hàng đợi |
| Ohara | `other_ito` | false | `rawHtml: ''` (đã có) | `fetch_status = failed` |
| **Mới #5** | **`it_product`** | false | **đúng đoạn funding của Sakura** | Ống kính loại công ty (Specs nhóm 2): cùng tin, hai nhận định |

Việc thật: Kitefin `isWatched: true` + thêm công ty #5. Còn lại giữ nguyên.

T-8 đếm đúng: 3 công ty theo dõi → flip 2 → 2 mục mới; công ty thứ ba vẫn `'before'` → I-3 → 0 mục. Ohara để ngoài theo dõi cho phép đếm chính xác.

### 2. Seed còn thiếu thật

- **Contacts (đang 0):** ≥2 cho Sakura, một `isPrimary: true` → đầu mối chính tự hạ của P3 có gì mà diễn; FK `timeline_entries.contact_id ON DELETE no action` có ca thật.
- **Ô dấu hiệu (đang 0/12 ô):** cơ hội Sakura `qualified` điền **cả bốn** ô → không cờ; Nimbus giữ trống → có cờ. Đúng chỗ phiên 2 ghi "màn hình chỉ hiện một trạng thái".
- **`lost` (đang 0 dòng):** 2 cơ hội `lost`, một có `lostReason` một trống → khối lý do thua ở tổng quan có cả bảng lẫn dòng đứng ngoài bảng.
- Giữ nguyên: Sakura opp `nextStepSource: 'human'` (I-7), Nimbus opp next step trống (I-6).

### 3. Cột variant + đường flip — không chạm file của A, không chạm contracts

```
0004_snapshot_variant.sql
  ALTER TABLE companies ADD COLUMN snapshot_variant text NOT NULL DEFAULT 'before'
  + CHECK (snapshot_variant IN ('before','after'))
```

- `crm_app` đã có `GRANT ALL ON ALL TABLES` (`0001_grants.sql:23`) → cột mới tự được UPDATE. **Không thêm GRANT.**
- `crm_system` chỉ có `GRANT SELECT ON companies` mức bảng → thấy cột, **không sửa được**. Tức là **AI không tự đổi được nguồn nó đọc** — đáng một dòng test, cùng họ T-10.
- I-14 tự đúng: seed TRUNCATE + insert lại ⇒ mọi công ty về `'before'`. **Không viết code dọn.**

Đường ghi: module mới `apps/api/src/demo/` (C sở hữu, **không sửa `domain/company/` của B**) — `POST /demo/companies/:id/snapshot-variant`. Cộng `packages/db/src/seed/switch-snapshot.ts` làm CLI diễn tay.

**Ai đọc cột:** chỉ **vòng quét** (P7, cũng C). `ObservationService.ingest(companyId, variant, ctx)` giữ nguyên chữ ký, `ingestSnapshotSchema.variant` giữ nguyên trong body ⇒ **0 dòng sửa ở `apps/api/src/ai/`, `domain/observation/`, `packages/contracts/`; 15 test của P2 không đỏ.** T-6 đi đường ingest tay nên không cần cột; cột tồn tại vì chu kỳ tự chạy không nhận tham số.

### 4. T-1

Một spec, mỗi chặng một `test.step()`. Tắt AI bằng helper `e2e/turn-ai-off.ts` (`DATABASE_URL_OWNER`), bật lại ở `afterAll` để spec khác không bị lây. Kéo thả: `Tab` → `Space` → `ArrowRight` × n → `Space`, **giãn ≥50ms giữa phím** theo ADR-0020.

### 5. Bỏ khỏi phase — đã có hoặc phủ trùng

| Việc trong phase file | Vì sao bỏ |
| --- | --- |
| `packages/db/src/seed/snapshots/*.html` | Đã chốt giữ TS constant |
| Bước 3 "bổ sung dọn dẹp I-14" | `seed()` đã TRUNCATE `ALL_TABLES`; `seed-idempotent.test.ts` đã assert |
| Công ty có bản sau **byte-identical** | I-3 đã phủ: test 6 (đọc lại y nguyên → 0 row, extractor 0 lần) + test 7 (trước→sau→trước) |
| Công ty thứ 5 cho `fetch_status = failed` | Ohara `rawHtml: ''` đã là ca đó |

### 6. Việc kèm bắt buộc

`packages/db/src/__tests__/seed-idempotent.test.ts` hardcode số công ty **5/4** → thành **6/5** sau khi thêm công ty #5.

## Ước lượng lại — ~2h15' (phase ghi 2h)

| Việc | Ước |
| --- | --- |
| Snapshot công ty #5 | 20' |
| `seed-data.ts`: contact, ô dấu hiệu, `lost`, `isWatched` | 30' |
| Migration + module `demo/` + `switch-snapshot.ts` | 30' |
| T-1 e2e | 45' |
| Sửa số đếm seed-idempotent + chạy | 10' |

Cột + module demo (~30') là việc **P4 làm thay P7** vì không có nó T-8 không đóng được. Đổi lại bỏ được 4 hạng mục ở mục 5 nên tổng gần như không đổi.

## Nghiệm thu (thay mục Validation của phase file)

- [ ] `pnpm seed` hai lần → trạng thái giống hệt (`seed-idempotent.test.ts` xanh sau khi sửa 6/5)
- [ ] 5 công ty; 4 có bản "sau" khác bản trước; Ohara `rawHtml: ''` cho `fetch_status = failed`
- [ ] Công ty #5 `it_product` mang **đúng** đoạn funding của Sakura
- [ ] 3 công ty `isWatched: true`, đều đọc được nguồn
- [ ] Có cơ hội `qualified` đủ bốn ô dấu hiệu (không cờ) **và** cơ hội thiếu (có cờ)
- [ ] Có cơ hội `lost` có lý do **và** cơ hội `lost` thiếu lý do
- [ ] ≥2 contact cho một công ty, đúng một `isPrimary`
- [ ] `snapshot_variant` mặc định `'before'`; seed lần hai đưa mọi công ty về `'before'`
- [ ] `crm_system` **không** UPDATE được `snapshot_variant` (test, cùng họ T-10)
- [ ] `POST /demo/companies/:id/snapshot-variant` đổi được; `switch-snapshot.ts` chạy được từ CLI
- [ ] T-1 xanh với `ai_enabled = false`, không chức năng nhóm 1 nào hỏng
- [ ] 15 test của P2 vẫn xanh (bằng chứng không chạm file của A)

## Rủi ro

| Rủi ro | Xử lý |
| --- | --- |
| Thêm công ty #5 làm đỏ test/e2e ăn theo seed | Đã quét: chỉ `login.test.ts` dùng `SEED_USERS[0..1]` (an toàn); e2e tham chiếu công ty **theo tên**, không theo số lượng; chỉ `seed-idempotent.test.ts` hardcode 5/4 |
| Kitefin thành watched → vòng quét gọi LLM cho 3 công ty | Đúng yêu cầu T-8. Chi phí/nhịp là việc của P7 (ADR-0011 đã có luật bỏ nhịp) |
| Cột demo nằm trong bảng nghiệp vụ `companies` | Chấp nhận có ý thức: đổi lại là 0 GRANT mới, I-14 tự đúng, không JOIN thêm. Phương án bảng riêng `demo_snapshot_state` đã cân và loại vì +1 bảng +1 GRANT +1 JOIN |
| T-1 một spec dài, hỏng giữa đường thì mù nửa sau | `test.step()` từng chặng + trace retain-on-failure. Nếu vẫn mù thì tách theo gợi ý sẵn trong phase file |

## Quyết định cần ADR

1. **Bản chụp giữ dạng TS constant trong `apps/api/src/ai/`, không tách HTML file** — phương án bị loại: HTML file + đọc fs; lý do loại: rủi ro asset trong Nest standalone image chỉ hiện trên stack production. Sửa cả cách đọc ADR-0013 ("thay `seed-data.ts`" → thay 2 file).
2. **`snapshot_variant` là cột `text` + CHECK trên `companies`, không phải pgEnum, không vào `ENUMS`** — phương án bị loại: pgEnum + row ontology §3.5; row `system_settings`; không lưu gì. Lý do: variant là giàn giáo demo, không phải từ vựng nghiệp vụ; cộng chi phí thật lên parity test.

## Câu hỏi chưa giải quyết

- Công ty #5 `it_product` **không thuộc T-1…T-10** — thuần điểm sản phẩm và câu trả lời vòng 2. Là hạng mục cắt được đầu tiên nếu trưa 14/08 trượt.
- Ai flip variant lúc demo: CLI `switch-snapshot.ts` là đủ cho vòng 1, hay cần nút trong `apps/web/src/app/quan-tri/` (P8)? Chưa chốt, không chặn P4.

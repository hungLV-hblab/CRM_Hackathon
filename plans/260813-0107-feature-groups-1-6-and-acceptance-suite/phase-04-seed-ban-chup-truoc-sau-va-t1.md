---
phase: 4
title: "Seed bản chụp trước/sau + T-1"
status: pending
priority: P1
dependencies: [1]
owner: C
estimate: 2h15
---

# Phase 4: Seed bản chụp trước/sau + T-1

> **Đã hoà giải với code thật ngày 13/08 19:56** ([báo cáo phản biện](../reports/from-brainstorm-to-planner-260813-1956-GH-3-phase-04-seed-ban-chup-va-t1-report.md)). Phase này viết trước khi P2 xong nên bảng bản chụp cũ đã lệch; bốn hạng mục bỏ đi vì đã có sẵn hoặc phủ trùng, một hạng mục thêm vào vì T-8 đang hở.
> Quyết định chi phối: [ADR-0013](../../docs/decisions/0013-seed-theo-du-lieu-tu-dat-chap-nhan-migrate-khi-btc-giao-du-lieu.md) (dữ liệu tự đặt) · [ADR-0021](../../docs/decisions/0021-ban-chup-demo-giu-dang-hang-so-typescript-khong-tach-thanh-file-html.md) (bản chụp giữ dạng hằng số TS) · [ADR-0022](../../docs/decisions/0022-ban-chup-hien-tai-la-cot-text-tren-companies-khong-phai-enum-cua-ontology.md) (cột `snapshot_variant`) · [ADR-0020](../../docs/decisions/0020-doi-giai-doan-chi-bang-keo-tha-dnd-kit-duong-ban-phim-la-duong-lai-cua-t1.md) (**đọc trước khi viết T-1** — khoảng cách phím ≥50ms).

## Overview

Bộ dữ liệu demo đủ để diễn mọi kịch bản nghiệm thu, **cột lưu "công ty X đang ở bản chụp nào"** (không có nó thì T-8 không đóng được), và T-1 chạy khi AI đang tắt.

## Đã có sẵn — không làm lại

Bốn hạng mục của bản phase cũ đã bị bỏ, vì code thật đã phủ:

| Việc trong bản cũ | Vì sao bỏ |
| --- | --- |
| `packages/db/src/seed/snapshots/*.html` | Bản chụp đã có ở `apps/api/src/ai/demo-snapshots.ts`, giữ dạng hằng số TS theo [ADR-0021](../../docs/decisions/0021-ban-chup-demo-giu-dang-hang-so-typescript-khong-tach-thanh-file-html.md) |
| "Bổ sung dọn dẹp I-14" | `seed()` đã `TRUNCATE` đủ `ALL_TABLES` (15 bảng: O/C/P/proposal_decisions/auto_next_step_events/notifications/watch_cycle_runs + dữ liệu chính thức). `seed-idempotent.test.ts` đã assert cả hai chiều |
| Công ty có bản "sau" **byte-identical** với bản trước | I-3 đã có test: `reading-zone-provenance.test.ts` test 6 (đọc lại y nguyên → 0 bản lưu, **extractor gọi 0 lần**) + test 7 (trước→sau→trước đều lưu) |
| Công ty thứ 5 cho `fetch_status = failed` | Ohara đã là ca đó: `rawHtml: ''` ở cả hai biến thể, `DemoSnapshotSource.read()` trả `null` |

## Requirements

- **Functional:** `pnpm seed` nạp users/công ty/liên hệ/cơ hội/dòng thời gian; mọi công ty ở bản chụp `'before'`; có endpoint + CLI đổi một công ty sang `'after'`; chạy `pnpm seed` lần nữa đưa **mọi thứ về bản "trước"** và xoá sạch vùng AI (I-14).
- **Non-functional:** không crawl mạng. Dữ liệu seed đánh dấu rõ là seed. `crm_system` **không** đổi được bản chụp nó đọc.

## Bộ bản chụp — bảng chốt

Thay bảng của bản cũ. Bản cũ gán tin `funding` cho `tech_startup` rồi mong nó tự đặt Việc tiếp theo — **sai, vì [I-6](../../docs/ontology.md) không đọc loại công ty**, nó đọc `signal_type ∈ {funding, leadership_hire}` **và** có ≥1 cơ hội mở.

| Công ty | Loại | `isWatched` | Bản "sau" thêm | Dùng cho | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| Sakura Manufacturing | `traditional` | true | đoạn **funding** | **I-7**: có cơ hội mở `nextStepSource: 'human'` → sinh **Proposal**, không tự ghi | đã có |
| Nimbus Cloud | `it_solution` | true | đoạn **leadership_hire** | **T-6, T-7**: cơ hội mở, next step trống → tự đặt | đã có |
| Kitefin Analytics | `tech_startup` | **false → true** | đoạn **expansion** | Nhóm 3: I-6 loại `expansion` → vào hàng đợi | đổi 1 dòng |
| Ohara Retail | `other_ito` | false | — (`rawHtml: ''`) | `fetch_status = failed`, không đoán | đã có |
| **Mới #5** | **`it_product`** | false | **đúng đoạn funding của Sakura** | Ống kính loại công ty (Specs nhóm 2): cùng một tin, hai nhận định khác nhau | **thêm** |

**T-8 đếm đúng nhờ bảng này:** 3 công ty theo dõi (Sakura · Nimbus · Kitefin), đều đọc được nguồn. Đổi 2 → 2 mục mới; công ty thứ ba vẫn `'before'` → I-3 → 0 mục. Ohara để ngoài theo dõi để con số không bị nhiễu bởi ca `failed`.

**Công ty #5 là hạng mục cắt được đầu tiên** — nó không thuộc T-1…T-10, thuần điểm sản phẩm và câu trả lời vòng 2.

## Files

| Tạo/sửa | Vai trò |
| --- | --- |
| `apps/api/src/ai/demo-snapshots.ts` | **sửa file của A** (ngoại lệ có ý thức, xem ADR-0021): thêm khoá công ty #5 vào `SNAPSHOTS`. `DemoSnapshotSource` không đổi |
| `packages/db/src/schema/companies.ts` | thêm `snapshotVariant: text(...).notNull().default('before')` |
| `packages/db/migrations/0004_snapshot_variant.sql` | `ADD COLUMN` + `CHECK (snapshot_variant IN ('before','after'))`. **Không GRANT mới** — xem ADR-0022 |
| `packages/db/src/seed/seed-data.ts` | công ty #5, contacts, ô dấu hiệu, cơ hội `lost`, Kitefin `isWatched: true` |
| `packages/db/src/seed/index.ts` | insert `contacts` (bảng chưa được seed) |
| `packages/db/src/seed/switch-snapshot.ts` | CLI đổi một công ty sang `'after'` — dùng lúc demo tay |
| `apps/api/src/demo/` (module mới) | `POST /demo/companies/:id/snapshot-variant`. Module riêng để **không sửa `domain/company/` của B** |
| `apps/api/src/app.module.ts` | +1 dòng đăng ký (file dùng chung — sửa nhỏ, pull trước khi push) |
| `packages/db/src/__tests__/seed-idempotent.test.ts` | số đếm công ty **5/4 → 6/5** |
| `e2e/turn-ai-off.ts` | helper bật/tắt `ai_enabled` qua `DATABASE_URL_OWNER` |
| `e2e/t1-crm-without-ai.spec.ts` | T-1 |

## Implementation steps

1. **Công ty #5 + bản chụp.** Thêm 1 dòng vào `SEED_COMPANIES` (`it_product`, `isWatched: false`) và 1 khoá vào `SNAPSHOTS` của `demo-snapshots.ts`. Bản "sau" mang **đúng** đoạn funding của Sakura — đó là cả điểm của cặp này. Giữ luật **mỗi bản "sau" đúng một đoạn mới** để câu trích chỉ có một chỗ để vào.

2. **Mở rộng `seed-data.ts`.** Chạy lại `seed-idempotent.test.ts` sau mỗi lần sửa — nó là bằng chứng cho hạng mục nộp bài số 5.
   - **Contacts (đang 0 dòng):** ≥2 cho Sakura, đúng một `isPrimary: true`. Không có nó thì đầu mối chính tự hạ của P3 không có gì mà diễn, và bẫy xoá người liên hệ (FK `timeline_entries.contact_id ON DELETE no action`) không có ca thật.
   - **Ô dấu hiệu (đang 0/12 ô):** cơ hội Sakura `qualified` điền **cả bốn** ô (`needSignal` · `needSignalSource` · `budgetSignal` · `budgetSignalSource`) → không cờ; Nimbus giữ trống → có cờ. P3 chốt "đủ = cả bốn ô" ([định nghĩa cờ](phase-03-nhom-1-crm-lam-tay.md#định-nghĩa-cờ-và-quá-hạn--một-chỗ-duy-nhất)); hiện mọi cơ hội đều mang cờ nên **màn hình chỉ hiện một trạng thái** — phiên 2 đã thấy trên màn hình, không phải suy đoán.
   - **`lost` (đang 0 dòng):** 2 cơ hội `lost`, một có `lostReason` một trống → khối lý do thua ở màn tổng quan có cả bảng lẫn dòng đứng ngoài bảng.
   - Kitefin `isWatched: true`.
   - **Giữ nguyên:** Sakura opp `nextStepSource: 'human'` (ca I-7 sẵn cho nhóm 4), Nimbus opp next step trống (ca I-6).

3. **Cột `snapshot_variant` + đường đổi.**
   - Migration: `ADD COLUMN text NOT NULL DEFAULT 'before'` + `CHECK`. **Không thêm GRANT**: `crm_app` đã có `GRANT ALL ON ALL TABLES` (`0001_grants.sql:23`), `crm_system` có `GRANT SELECT ON companies` mức bảng (`:38`) — cả hai phủ cột thêm sau.
   - `POST /demo/companies/:id/snapshot-variant` trong module `demo/`, ghi qua pool `crm_app`.
   - `switch-snapshot.ts` cho đường CLI.
   - **Không sửa `ObservationService`, không sửa `ingestSnapshotSchema`.** Ingest tay vẫn nhận `variant` trong body; cột là đầu vào của **vòng quét** (P7 tiêu thụ). Nhờ vậy 15 test của P2 không phải chạm — và đó là điều kiện đóng phase.
   - I-14 **không cần code dọn**: `DEFAULT 'before'` + `TRUNCATE` + insert lại là xong.

4. **Phép đo GRANT (nợ của ADR-0022, phải trả ở đây).** `crm_system` UPDATE `snapshot_variant` → **bị từ chối**; `crm_app` UPDATE → **thành công**. Đây là chỗ chứng minh AI không tự đổi được nguồn nó đọc — một AI tự chuyển sang bản "sau" là một AI tự tạo tin rồi kết luận từ tin đó.

5. **T-1 e2e.** Một spec liền mạch, **mỗi chặng một `test.step()`** để reporter chỉ ra chặng đỏ (`trace: 'retain-on-failure'` đã bật trong `playwright.config.ts`). Tắt AI bằng `e2e/turn-ai-off.ts`, **bật lại ở `afterAll`** để spec khác không bị lây. Viết trước, để đỏ nếu P3 chưa xong — nhưng P3 đã xong nên phải xanh ngay.
   - Chặng: tạo công ty → tạo liên hệ (có đầu mối chính) → tạo cơ hội → kéo qua ba giai đoạn tới `qualified` → bỏ hai ô dấu hiệu vẫn kéo được + có cờ → ghi hoạt động → tìm/lọc → mở màn tổng quan.
   - **Kéo thả lái bằng bàn phím, không bằng chuột:** `Tab` → `Space` nhấc → `ArrowRight` × n → `Space` thả, **giãn ≥50ms giữa các phím** ([ADR-0020](../../docs/decisions/0020-doi-giai-doan-chi-bang-keo-tha-dnd-kit-duong-ban-phim-la-duong-lai-cua-t1.md) đã đo: 0ms **không chuyển**, ≥50ms chuyển đúng một cột). Bấm liền nhau thì T-1 đỏ **vì harness, không vì sản phẩm** — đúng loại lỗi tốn nhiều giờ nhất vào ngày cuối. Chờ xác định bằng vùng `aria-live` của dnd-kit (`moved over` → `dropped over`), không `waitForTimeout`.
   - Nếu bàn phím vẫn không ổn: tách hai — một spec gọi thẳng `PATCH /opportunities/:id/stage` chứng minh luật không chặn, một spec riêng cho cơ chế kéo. Hỏng cái nào biết ngay cái đó.

## Validation

- [ ] `pnpm seed` hai lần → trạng thái giống hệt (`seed-idempotent.test.ts` xanh sau khi sửa 6/5)
- [ ] Seed lần hai sau khi đã chạy demo → sạch vùng AI, mọi công ty về `snapshot_variant = 'before'` (I-14)
- [ ] 5 công ty; 4 có bản "sau" khác bản trước; Ohara cho `fetch_status = failed`
- [ ] Công ty #5 `it_product` mang **đúng** đoạn funding của Sakura
- [ ] 3 công ty `isWatched: true`, cả ba đọc được nguồn
- [ ] Có cơ hội `qualified` đủ cả bốn ô dấu hiệu (không cờ) **và** cơ hội thiếu (có cờ)
- [ ] Có cơ hội `lost` có lý do **và** cơ hội `lost` thiếu lý do
- [ ] ≥2 contact cho một công ty, đúng một `isPrimary`
- [ ] **`crm_system` UPDATE `snapshot_variant` bị từ chối; `crm_app` thành công** (nợ ADR-0022)
- [ ] `POST /demo/companies/:id/snapshot-variant` đổi được; `switch-snapshot.ts` chạy được từ CLI
- [ ] T-1 xanh với `ai_enabled = false`, **không** chức năng nhóm 1 nào hỏng; AI bật lại sau spec
- [ ] **15 test của P2 vẫn xanh** — bằng chứng không chạm `domain/observation/`, `ai/anthropic-*`, `contracts`
- [ ] Dữ liệu seed đánh dấu rõ là seed, không lẫn dữ liệu người dùng nhập

## Risks

| Rủi ro | Xử lý |
| --- | --- |
| Bản "sau" có nhiều hơn một đoạn mới → claim nhảy vào nhiều chỗ, test giòn | Mỗi bản "sau" đúng **một** đoạn mới |
| Thêm công ty làm đỏ test/e2e ăn theo seed | Đã quét: chỉ `login.test.ts` dùng `SEED_USERS[0..1]` (an toàn); e2e tham chiếu công ty **theo tên** (`reading-zone-provenance.spec.ts:22-25`), không theo số lượng; duy nhất `seed-idempotent.test.ts` hardcode 5/4 |
| Kitefin thành watched → vòng quét gọi LLM cho 3 công ty | Đúng yêu cầu T-8. Chi phí/nhịp là việc của P7 (ADR-0011 đã có luật bỏ nhịp + `skipped_reason`) |
| Sửa `demo-snapshots.ts` (file của A) đụng A | Sửa thuộc loại **thêm dữ liệu**, không đổi cấu trúc: +1 khoá trong `SNAPSHOTS`. Pull trước khi push |
| T-1 một spec dài, hỏng giữa đường thì mù nửa sau | `test.step()` từng chặng + trace retain-on-failure. Vẫn mù thì tách theo bước 5 |
| Cột demo nằm trong bảng nghiệp vụ `companies` | Chấp nhận có ý thức ([ADR-0022](../../docs/decisions/0022-ban-chup-hien-tai-la-cot-text-tren-companies-khong-phai-enum-cua-ontology.md)): 0 GRANT mới, I-14 tự đúng, không JOIN. Bù: DTO công ty **liệt kê cột**, không `SELECT *`, để cột giàn giáo không lọt ra API |
| Dữ liệu BTC về giữa ngày | ADR-0013 + ADR-0021: thay `seed-data.ts` **và** `demo-snapshots.ts`, không sửa loader |

## Ước lượng

| Việc | Ước |
| --- | --- |
| Snapshot công ty #5 | 20' |
| `seed-data.ts`: contact · ô dấu hiệu · `lost` · `isWatched` | 30' |
| Migration + module `demo/` + `switch-snapshot.ts` + phép đo GRANT | 30' |
| T-1 e2e | 45' |
| Sửa số đếm seed-idempotent + chạy | 10' |

Cột + module demo (~30') là việc **P4 làm thay P7** vì không có nó T-8 không đóng được. Đổi lại bỏ được 4 hạng mục ở mục "Đã có sẵn" nên tổng gần như không đổi so với 2h ban đầu.

## Rollback

Seed là dữ liệu: `pnpm reset` rồi seed lại. Cột `snapshot_variant`: `DROP COLUMN`, vòng quét quay về đọc `'before'` cứng — mất T-8, giữ mọi thứ khác.

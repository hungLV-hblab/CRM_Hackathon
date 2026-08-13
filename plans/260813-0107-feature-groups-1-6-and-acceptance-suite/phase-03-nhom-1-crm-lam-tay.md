---
phase: 3
title: "Nhóm 1 — CRM làm tay"
status: done
priority: P1
dependencies: [1]
owner: B
estimate: 5h
mode: tdd
---

# Phase 3: Nhóm 1 — CRM làm tay

> Thiết kế đã chốt ở [báo cáo brainstorm 13/08 12:15](../reports/from-brainstorm-to-planner-260813-1215-phase-03-nhom-1-crm-lam-tay-report.md).

## Overview

Toàn bộ công việc bán hàng **không có một thành phần AI nào**. Tắt sạch AI thì phase này vẫn chạy đủ (Specs nhóm 1, ràng buộc cuối). Đây là bề mặt UI lớn nhất của cả plan và là điều kiện của T-1.

Giá trị của phase **không nằm ở số màn hình** mà ở ba luật không chặn — thứ Specs lặp lại ba lần và cũng là thứ dễ làm ngược nhất.

## Requirements

- Functional: CRUD công ty · CRUD người liên hệ (đúng một đầu mối chính) · cơ hội với 7 giai đoạn · chốt Đủ điều kiện hỏi hai ô dấu hiệu · lý do thua · dòng thời gian gộp ba loại · Việc tiếp theo + ngày hạn có cờ cảnh báo · tìm theo tên · lọc · màn tổng quan.
- Non-functional: **không chặn thao tác nào của Sales** — thiếu dữ liệu thì mang cờ cảnh báo, vẫn lưu được.
- **Không cần migration.** Schema của P1 đã đủ: `contacts` (partial unique index `contacts_one_primary_per_company`), `opportunities` (7 stage, 4 ô dấu hiệu, `lostReason`, `nextStep*`), `timeline_entries`. `crm_app` có `GRANT ALL`.

## Ba chỗ Specs nói kỹ, dễ làm sai

1. **Không bao giờ chặn.** Kéo sang Đủ điều kiện mà bỏ hai ô dấu hiệu → **vẫn sang**, mang cờ. Sang Thua mà bỏ lý do → **vẫn sang**, mang cờ + đứng ngoài bảng thống kê lý do thua. Cơ hội mở thiếu Việc tiếp theo/ngày hạn → **vẫn lưu**, mang cờ + **không xuất hiện trong danh sách việc phải làm**.
2. **Đi lùi và nhảy cóc đều được.** Không validate thứ tự giai đoạn.
3. **Màn tổng quan tách `on_hold` khỏi pipeline đang chạy** ([ontology 3.5](../../docs/ontology.md#35-enum--giá-trị-cố-định-không-đội-nào-tự-đổi-tên)) — deal tạm dừng cộng vào tổng làm con số mang đi họp sai.

## Quyết định đã chốt

| Quyết định | Phương án bị loại |
| --- | --- |
| **Cờ cảnh báo suy ra từ cột null**, một hàm `opportunity-warnings.ts` dùng chung list · detail · overview | Thêm cột `has_warning` — nguồn sự thật thứ hai, sẽ lệch, cộng một migration thừa |
| **Kéo thả bằng dnd-kit, không có Select** (quyết định của người dùng). Bật **KeyboardSensor** làm đường lái của T-1 | Select làm đường chính + dnd chồng lên sau |
| **Đầu mối chính: đặt người mới thì tự hạ người cũ** trong transaction | Từ chối, bắt Sales bỏ tick người cũ trước — hai thao tác cho một ý định |
| **Màn tổng quan có khối thứ 4**: đếm `lost` theo `lostReason` + một dòng "N cơ hội Thua chưa ghi lý do" đứng ngoài bảng | Giữ đúng 3 khối Specs liệt kê — checklist "không vào bảng thống kê lý do thua" không chứng minh được ở đâu cả |
| **Cơ hội không có endpoint xoá** — Specs chỉ đòi "tạo và quản lý" | — |
| **Sales sửa được mọi ô hồ sơ công ty, kể cả `companyType`.** I-11 cấm *Proposal* sửa lăng kính (sửa lăng kính bằng chính thứ đọc qua lăng kính là vòng lặp tự tham chiếu); ràng buộc đó không áp cho người | Khoá `companyType` cho mọi actor — chặn thật một thao tác nghiệp vụ bình thường, Sales gõ sai lúc tạo thì phải xoá công ty tạo lại |
| **`description` của `stage_change` lưu sẵn câu tiếng Việt** ("Đổi giai đoạn: Tiếp cận → Đủ điều kiện") | Lưu code `prospecting->qualified` — cột này đã là ô người gõ tự do cho `activity`/`note`, thêm định dạng máy đọc là hai định dạng trong một cột + phải viết parser |
| **Xoá mềm công ty chỉ ẩn công ty**; truy vấn cơ hội/dòng thời gian JOIN `companies` lọc `deletedAt IS NULL` | Lan xoá mềm xuống cơ hội — cần thêm cột, cần migration |

## Định nghĩa cờ và quá hạn — một chỗ duy nhất

| Cờ | Điều kiện |
| --- | --- |
| `missing_qualification_signals` | `stage ∈ {qualified, drafting, negotiation, won}` && **bất kỳ** trong bốn ô `needSignal` · `needSignalSource` · `budgetSignal` · `budgetSignalSource` null |
| `missing_lost_reason` | `stage = 'lost'` && `lostReason` null |
| `missing_next_step` | `stage ∈ OPEN_STAGES` && (`nextStepText` null \|\| `nextStepDueDate` null) |

`overdue` = `nextStepDueDate != null && < CURRENT_DATE && stage ∈ OPEN_STAGES`.

Thiếu Việc tiếp theo → có cờ → **không** overdue → tự vắng khỏi danh sách việc phải làm. Một mệnh đề, không phải hai luật rời có thể quên một.

Hai chỗ định nghĩa này đánh đổi có ý thức, đừng "sửa lại cho hợp lý" khi gặp:

- **Tập giai đoạn cố định `{qualified, drafting, negotiation, won}`**, không đọc dòng thời gian. Nhảy cóc `prospecting → negotiation` vẫn mang cờ (đúng — chưa kiểm hai chiều); đi lùi về `prospecting` thì cờ mất (đúng — chưa tới chốt chặn); `on_hold` và `lost` **không** mang cờ này. Cái giá đã chấp nhận: deal đã qualified rồi tạm dừng sẽ mất cờ. Đổi lại hàm suy cờ vẫn thuần, không JOIN, dùng được cả ở list và overview.
- **Đủ = cả bốn ô**, câu và nguồn. Chốt chặn Qualify của Specs là "kiểm được cả hai chiều", một câu không nguồn thì chưa kiểm được. Hệ quả: cơ hội seed nào chưa có bốn ô sẽ mang cờ — **đó là việc của seed phải sửa, không phải của định nghĩa cờ** (xem [P4](phase-04-seed-ban-chup-truoc-sau-va-t1.md)).

## Files

| Tạo/sửa | Vai trò |
| --- | --- |
| `packages/contracts/src/dto/opportunity.ts` | create/update/updateStage schema + `OpportunityDto` (`warnings[]`, `isOverdue`) |
| `packages/contracts/src/dto/{contact,timeline,overview}.ts` | DTO ba domain còn lại |
| `packages/contracts/src/enums.ts` | thêm `OPPORTUNITY_WARNING` — **đứng ngoài registry `ENUMS`** |
| `apps/api/src/domain/opportunity/opportunity-warnings.ts` | hàm suy cờ, thuần, không chạm DB |
| `apps/api/src/domain/opportunity/opportunity.controller.ts` | mới |
| `apps/api/src/domain/opportunity/opportunity-service.ts` | mở rộng: tạo/sửa/list/filter, transaction đổi giai đoạn |
| `apps/api/src/domain/contact/*` | mới — CRUD + tự hạ `is_primary` cũ |
| `apps/api/src/domain/timeline/*` | mới — ghi hoạt động/ghi chú + đọc dòng thời gian |
| `apps/api/src/domain/overview/*` | mới — 4 khối |
| `apps/api/src/domain/company/*` | `GET :id` · `PATCH` · `DELETE` (soft) · tìm theo tên + 4 bộ lọc |
| `apps/api/src/app.module.ts` | đăng ký controller/service mới (**file dùng chung — sửa nhỏ, pull trước khi push**) |
| `apps/web/src/app/cong-ty/page.tsx` | + ô tìm theo tên + 4 bộ lọc |
| `apps/web/src/app/cong-ty/[id]/page.tsx` | chỉ ghép; **Vùng đọc của A giữ nguyên vị trí** |
| `apps/web/src/app/cong-ty/[id]/{company-profile,contact,timeline}-section.tsx` | ba khu tách file |
| `apps/web/src/app/co-hoi/{page,stage-board,opportunity-card,stage-transition-dialog}.tsx` | bảng 7 cột + hộp thoại hỏi dấu hiệu/lý do thua |
| `apps/web/src/app/tong-quan/page.tsx` | 4 khối |
| `apps/web/src/components/ui/warning-flag.tsx` | một component cho cả ba cờ |
| `apps/web/package.json` | + `@dnd-kit/core`, `@dnd-kit/sortable` |

---

## Bước 1 — Contracts + hàm suy cờ (30')

Không chạm DB, không chạm HTTP. Chạy được ngay sau khi gõ.

1. **Test đỏ:** `apps/api/src/domain/opportunity/__tests__/opportunity-warnings.test.ts` — ba cờ + `isOverdue`. Sáu ca chốt đúng hai đánh đổi ở mục trên, viết trước khi viết hàm:
   - `qualified` đủ **cả bốn** ô dấu hiệu → không cờ; điền câu nhưng **bỏ trống nguồn** → **vẫn có cờ**
   - `prospecting → negotiation` (nhảy cóc, chưa từng qualify) → có cờ dấu hiệu
   - `negotiation → prospecting` (đi lùi) → cờ dấu hiệu **mất**
   - `on_hold` → **không** cờ dấu hiệu, **có** cờ thiếu next step (vẫn là stage mở)
   - `won` → không cờ next step (đã đóng)
   - `lost` không lý do → cờ `missing_lost_reason`, **không** cờ dấu hiệu (không mang hai cờ cùng lúc)
2. Viết `dto/opportunity.ts`, `dto/contact.ts`, `dto/timeline.ts`, `dto/overview.ts`.
3. Thêm `OPPORTUNITY_WARNING` vào `enums.ts` **ngoài** `ENUMS` — giống `USER_ROLE`. Nhét vào registry là `ontology-enum-parity.test.ts` đỏ ngay; chạy test đó ở bước này để biết sớm.
4. Viết `opportunity-warnings.ts` → test xanh.

**Gate:** `pnpm typecheck` + `pnpm test:unit` xanh trước khi sang bước 2.

## Bước 2 — Test đỏ ba luật không chặn + phép đo đột biến (40')

Không có code nào "làm" việc không chặn — nó là việc *không viết `.refine()`*. Loại bằng chứng đó biến mất trong review bằng mắt, nên mỗi luật có sẵn cách phá.

`apps/api/src/domain/opportunity/__tests__/opportunity-stage-never-blocks.test.ts`, dựng service bằng `new` trên DB thật (theo đúng mẫu `reading-zone-provenance.test.ts`):

| Ca | Kỳ vọng |
| --- | --- |
| Kéo sang `qualified`, bỏ trống hai ô dấu hiệu | vẫn sang, `warnings` chứa `missing_qualification_signals` |
| Kéo sang `lost`, bỏ trống lý do | vẫn sang, có cờ, **không** vào bảng thống kê lý do thua |
| Lưu cơ hội mở thiếu Việc tiếp theo | lưu được, có cờ, **không** trong danh sách việc phải làm |
| `negotiation` → `prospecting` (đi lùi) | không bị chặn |
| `prospecting` → `negotiation` (nhảy cóc) | không bị chặn |

**Phép đo đột biến, ghi kết quả vào phần Validation:** thêm `.refine()` theo stage vào `updateStageSchema` → test phải đỏ. Không đỏ nghĩa là test đang không chứng minh gì.

## Bước 3 — API (2h)

Thứ tự: contact → opportunity → timeline → company filter → overview.

1. **contact**: CRUD. Đặt đầu mối chính chạy **transaction** — hạ `is_primary` của người cũ rồi mới nâng người mới. Xoá người liên hệ cũng transaction: `SET contact_id = NULL` trên `timeline_entries` trước, vì FK hiện **không có `ON DELETE`**.
   - Test `contact-primary-swap.test.ts` + **phép đo đột biến**: ghi thẳng hai dòng `is_primary = true` không qua service → Postgres phải từ chối (index còn cắn).
2. **opportunity**: controller + create/update/list. `updateStage` chạy **một transaction**: đổi stage (+ hai ô dấu hiệu / lý do thua nếu Sales có điền) **và** ghi `TimelineEntry` loại `stage_change`, `createdBy = 'human'`.
   - Giữ nguyên `const db = actor.kind === 'system' ? dbSystem : dbApp` — **luật số 1 của [plan.md](plan.md)**. Thêm controller không được làm T-10 mini đỏ.
   - Test `stage-change-writes-timeline.test.ts` + phép đo đột biến: bỏ insert khỏi transaction → phải đỏ.
3. **timeline**: `GET /companies/:id/timeline` (mới nhất trên, gộp `activity` · `stage_change` · `note`) · `POST` ghi hoạt động/ghi chú.
4. **company**: `GET :id` · `PATCH` (mọi ô, **kể cả `companyType`** — I-11 chỉ ràng buộc Proposal) · `DELETE` (soft, cột `deletedAt` đã có) · `GET ?q&industry&companyType&country&isWatched`.
   - Test `company-search-and-filter.test.ts`. Truy vấn cơ hội và dòng thời gian JOIN `companies` lọc `deletedAt IS NULL` — xoá mềm không lan xuống dữ liệu con.
5. **overview**: 4 khối. Test `overview-excludes-on-hold.test.ts` — `on_hold` **không** cộng vào pipeline đang chạy; cơ hội Thua thiếu lý do đứng ngoài bảng.
6. Đăng ký vào `app.module.ts`.

**Gate (kiểm điểm với người trước khi sang web):** `pnpm test` xanh, gồm cả `t10-mini-system-actor-blocked.test.ts` cũ.

## Bước 4 — Web (2h)

Thứ tự: co-hoi board → cong-ty filter + 3 section → tong-quan.

1. `pnpm add -F @crm/web @dnd-kit/core @dnd-kit/sortable`.
2. **`co-hoi/`**: `DndContext` 7 cột, **PointerSensor + KeyboardSensor**. Thả vào `qualified` hoặc `lost` thì mở `stage-transition-dialog` — luôn có nút **"Để trống, bổ sung sau"**, đó là chỗ luật không chặn xuất hiện trên màn hình. Lọc theo giai đoạn và theo quá hạn.
3. **`cong-ty/`**: ô tìm theo tên + 4 bộ lọc. Trang chi tiết tách `company-profile-section` · `contact-section` · `timeline-section`; `page.tsx` chỉ ghép, **không sửa `components/provenance/*` của A**, Vùng đọc giữ nguyên vị trí.
4. **`tong-quan/`**: công ty theo ngành · cơ hội + tổng giá trị theo giai đoạn (`on_hold` tách riêng) · Việc tiếp theo quá hạn · lý do thua.
5. **`warning-flag.tsx`**: `Badge tone="warning"` + **câu giải thích ngắn** ("Chưa có dấu hiệu nhu cầu/ngân sách"). Không `—` trơ trọi ([design-guidelines](../../docs/design-guidelines.md) mục 5 luật 4).

**Timebox kéo thả 60'.** Quá thì giữ đường bàn phím, ghi một dòng vào [plan.md](plan.md), đi tiếp.

### Nợ test có chủ ý — web P3 không có test trong phase

`vitest.config.mts` chỉ collect `packages/*` và `apps/api`; **`apps/web` không có project nào**, nên bốn màn hình của bước 4 không có test đơn vị nào trong phase này. Đã chọn chấp nhận: **T-1 chính là test nghiệm thu của nhóm 1**, nó nằm ở [P4](phase-04-seed-ban-chup-truoc-sau-va-t1.md) chạy cùng ngày 13/08 — luật số 4 của [plan.md](plan.md) cấm dồn test sang **P8** (ngày cuối), không cấm đặt ở P4.

Điều kiện đi kèm: **bước 4 xong thì chạy tay đủ checklist Validation dưới đây trước khi coi là hết phase.** Không có T-1 xanh thì web của P3 chưa có bằng chứng nào.

### Luật màu — kiểm bằng một lệnh

Cờ cảnh báo mang token `warning`, **tuyệt đối không** `machine-*`: cờ là dữ liệu người còn thiếu, không phải thứ máy sinh; tô tím là phá thẳng luật 2 của [CLAUDE.md](../../CLAUDE.md). Nhóm 1 không có AI nên:

```bash
grep -rn "machine-" apps/web/src/app/{co-hoi,tong-quan} apps/web/src/components/ui/warning-flag.tsx
# phải ra 0 dòng
```

---

## Validation

- [x] Kéo qua ba giai đoạn có Đủ điều kiện, **bỏ trống hai ô dấu hiệu** → vẫn sang, có cờ (T-1)
- [x] `qualified` điền câu dấu hiệu nhưng **bỏ trống ô nguồn** → **vẫn có cờ** (đủ = cả bốn ô)
- [x] Nhảy cóc `prospecting → negotiation` → có cờ dấu hiệu; đi lùi về `prospecting` → cờ mất
- [x] `on_hold` không mang cờ dấu hiệu; `lost` không lý do chỉ mang cờ lý do thua, không mang hai cờ
- [x] `PATCH /companies/:id` sửa được `companyType`
- [x] Sang Thua bỏ trống lý do → vẫn sang, có cờ, **không** vào bảng thống kê lý do thua
- [x] Cơ hội mở thiếu Việc tiếp theo → lưu được, có cờ, **không** trong danh sách việc phải làm
- [x] Đi lùi giai đoạn và nhảy cóc: không bị chặn
- [x] **Phép đo đột biến 1:** thêm `.refine()` theo stage vào `updateStageSchema` → test không-chặn phải đỏ
- [x] Đúng một `is_primary` per company — đặt người thứ hai thì người cũ tự xuống phụ
- [x] **Phép đo đột biến 2:** ghi thẳng hai dòng `is_primary = true` không qua service → Postgres từ chối
- [x] Đổi giai đoạn xong dòng thời gian có mục `stage_change`, `created_by = 'human'`
- [x] **Phép đo đột biến 3:** bỏ insert timeline khỏi transaction `updateStage` → test phải đỏ
- [x] Tìm theo tên + 4 bộ lọc công ty + 2 bộ lọc cơ hội
- [x] Màn tổng quan: `on_hold` **không** cộng vào pipeline đang chạy
- [x] Cơ hội Thua thiếu lý do hiện **ngoài** bảng thống kê, kèm cờ
- [x] `grep -rn "machine-"` trên file mới của P3 → 0 dòng class (một dòng duy nhất là **comment** trong `warning-flag.tsx` giải thích vì sao cấm dùng)
- [x] `t10-mini-system-actor-blocked.test.ts` còn xanh sau khi thêm controller
- [ ] **T-1 chạy với `ai_enabled = false`** — không chức năng nào hỏng (**test này thuộc P4**; P3 đã sẵn sàng: không màn hình nào của nhóm 1 gọi endpoint AI nào)

### Kết quả chạy — 13/08 17:20

| Cổng | Kết quả |
| --- | --- |
| `pnpm test:unit` | **158 xanh** (trước phase: 155). T-10 mini còn nguyên, không sửa một dòng |
| `pnpm test:e2e` | **6 xanh** trên stack production `:8080` |
| `pnpm typecheck` · `pnpm lint` · `pnpm build` | xanh, cả 4 package |
| Phép đo đột biến 1 (`.refine()` theo stage) | ca 9 **đỏ** ✓ |
| Phép đo đột biến 2 (2 dòng `is_primary` bằng SQL thẳng) | Postgres từ chối ✓ (ca thường trực trong `contact-primary-swap.test.ts`) |
| Phép đo đột biến 3 (bỏ insert timeline khỏi transaction) | ca 8 **đỏ** ✓ |
| Kiểm tay 4 màn hình trên `:8080` | xanh — bảng 7 cột, hộp thoại + nút "Để trống, bổ sung sau", tổng quan 4 khối, chi tiết công ty 3 khu + Vùng đọc của A giữ nguyên vị trí |

**Ba việc phát sinh, đã xử lý:**

1. **Phép đo đột biến 1 như plan mô tả sẽ không cắn.** Test không-chặn gọi thẳng service, mà `updateStageSchema` không nằm trên đường đó — thêm `.refine()` sẽ chặn Sales ở `ZodValidationPipe` trong khi mọi ca ở tầng service vẫn xanh. Đã thêm ba ca **ở tầng schema** (9, 10, 11) để phép đo đo đúng thứ nó tuyên bố.
2. **`getByLabel('Ngành')` thành mơ hồ** sau khi thêm bộ lọc — `getByLabel` khớp chuỗi con không phân biệt hoa thường nên "Lọc theo ngành" cũng dính. Sửa `e2e/login-and-create-company.spec.ts` bằng cách giới hạn vào `getByRole('dialog')` (3 dòng, **chạm file của C** — báo lại khi merge).
3. **Đường bàn phím cần khoảng cách giữa các phím.** Đo được: 0ms **không chuyển**, ≥50ms chuyển đúng. Xem [ADR-0020](../../docs/decisions/0020-doi-giai-doan-chi-bang-keo-tha-dnd-kit-duong-ban-phim-la-duong-lai-cua-t1.md) — **P4 phải đọc trước khi viết T-1**, không thì T-1 đỏ vì harness chứ không vì sản phẩm.

**Hai ADR đã trả:** [ADR-0019](../../docs/decisions/0019-co-canh-bao-suy-ra-tu-cot-null-khong-luu-thanh-cot.md) (cờ suy ra) · [ADR-0020](../../docs/decisions/0020-doi-giai-doan-chi-bang-keo-tha-dnd-kit-duong-ban-phim-la-duong-lai-cua-t1.md) (dnd-kit).

## Risks

| Rủi ro | Xử lý |
| --- | --- |
| dnd-kit làm T-1 e2e giòn (không có Select làm đường lái) | KeyboardSensor làm đường lái của test: `Tab` → `Space` nhấc → `ArrowRight` × n → `Space` thả. Xác định, không chờ animation. Dự phòng: e2e chạy thêm một đường `PATCH /opportunities/:id/stage` để tách logic không-chặn khỏi cơ chế kéo |
| Phình ra ăn hết ngày 13 | Cắt theo thứ tự ở [plan.md](plan.md): kéo thả → bỏ, tổng quan gọn sau |
| Kéo thả tốn thời gian hơn ước lượng | Timebox 60'. Quá → giữ bàn phím, ghi 1 dòng vào plan, đi tiếp |
| Thêm controller làm T-10 mini đỏ | Giữ nguyên chọn pool theo actor; chạy lại T-10 ngay ở gate bước 3 |
| `OPPORTUNITY_WARNING` lọt vào registry `ENUMS` | `ontology-enum-parity.test.ts` bắt được — chạy ở bước 1, không đợi tới cuối |
| Xoá người liên hệ nổ FK từ `timeline_entries.contact_id` | `SET contact_id = NULL` trong cùng transaction. Không migration |
| Đụng file với A ở màn hình công ty | A sở hữu khu Vùng đọc; B tách 3 section thành file riêng, `page.tsx` chỉ ghép, không sửa `components/provenance/*` |

## Rollback

Từng màn hình độc lập; bỏ màn tổng quan hoặc bỏ kéo thả không ảnh hưởng phần còn lại. Không có migration nên không có gì để rollback ở tầng CSDL.

## Câu hỏi chưa giải quyết

- **`SEED_CONTACTS` chưa có** (việc của C ở P4). Test integration của P3 tự tạo dữ liệu nên không bị chặn, nhưng demo tay sẽ không có người liên hệ nào cho tới khi P4 xong.
- **Seed phải có ít nhất một cơ hội `qualified` đủ cả bốn ô dấu hiệu** — không thì demo chỉ thấy trạng thái có cờ, không thấy trạng thái sạch. Đã chuyển thành yêu cầu của [P4](phase-04-seed-ban-chup-truoc-sau-va-t1.md).

<!-- Updated: Validation Session 1 - chốt tập giai đoạn của cờ dấu hiệu, đủ = cả bốn ô, companyType người sửa được, nợ test web có chủ ý -->

*Đã đóng ở phiên validate 13/08:* ô nào Sales sửa được — **mọi ô, kể cả `companyType`**; I-11 chỉ ràng buộc Proposal, không ràng buộc người.

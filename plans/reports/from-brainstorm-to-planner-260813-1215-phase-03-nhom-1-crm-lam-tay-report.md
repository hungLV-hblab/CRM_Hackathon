# Brainstorm — Phase 3: Nhóm 1 CRM làm tay

> Nguồn: [phase-03-nhom-1-crm-lam-tay.md](../260813-0107-feature-groups-1-6-and-acceptance-suite/phase-03-nhom-1-crm-lam-tay.md) · Phiên 13/08/2026 12:15 · Bàn giao sang `/ck:plan --tdd`

## 1. Bài toán

Toàn bộ công việc bán hàng chạy được **không có một thành phần AI nào**. Tắt sạch AI thì nhóm 1 vẫn đủ chức năng (Specs mục 4 nhóm 1, ràng buộc cuối). Đây là bề mặt UI lớn nhất của plan và là điều kiện của T-1.

Giá trị của phase không nằm ở số màn hình mà ở **ba luật không chặn** — thứ Specs lặp lại ba lần và cũng là thứ dễ làm ngược nhất.

## 2. Hiện trạng đã scout

| Vùng | Có sẵn | Thiếu |
| --- | --- | --- |
| API | `POST/GET /companies` · `OpportunityService.updateStage/updateNextStep` (không controller) | contact · timeline · overview · opportunity controller · filter/search · `GET /companies/:id` |
| Schema | `contacts` (partial unique index `contacts_one_primary_per_company`) · `opportunities` (7 stage, 4 ô dấu hiệu, `lostReason`, `nextStep*`) · `timeline_entries` · `crm_app` có `GRANT ALL` | **không cần migration nào** |
| Contracts | `dto/company.ts` · `enums.ts` (`STAGE`, `OPEN_STAGES`, `CLOSED_STAGES`, `ENTRY_TYPE`) | dto opportunity/contact/timeline/overview |
| Web | `cong-ty/` list + detail (A viết: Hồ sơ read-only + Vùng đọc) · UI kit đủ (`Badge tone="warning"` đã có) | search/filter · `co-hoi/` · `tong-quan/` · dnd-kit |
| Seed | users · companies · opportunities · timeline | `SEED_CONTACTS` — việc của C ở P4 |

## 3. Quyết định

### 3.1 Cờ cảnh báo suy ra, không lưu cột

| Cờ | Điều kiện |
| --- | --- |
| `missing_qualification_signals` | đã qua `qualified` && (`needSignal` null \|\| `budgetSignal` null) |
| `missing_lost_reason` | `stage = 'lost'` && `lostReason` null |
| `missing_next_step` | `stage ∈ OPEN_STAGES` && (`nextStepText` null \|\| `nextStepDueDate` null) |

**Phương án bị loại:** thêm cột `has_warning`. Tạo nguồn sự thật thứ hai, sẽ lệch với cột null; cộng một migration + một GRANT không cần thiết.

Hệ quả: `opportunity-warnings.ts` dùng chung cho list · detail · overview. "Không vào danh sách việc phải làm" và "đứng ngoài bảng thống kê lý do thua" trở thành **cùng một mệnh đề với cờ**, không phải hai luật rời có thể quên một.

`overdue` = `nextStepDueDate != null && < CURRENT_DATE && stage ∈ OPEN_STAGES`. Thiếu Việc tiếp theo → có cờ → **không** overdue → tự vắng khỏi danh sách việc phải làm.

### 3.2 Đổi giai đoạn bằng dnd-kit, không có Select — **quyết định của người dùng**

Đã nêu rủi ro: HTML5 native DnD Playwright không lái được bằng chuột giả lập; dnd-kit PointerSensor lái được nhưng phải chờ animation, e2e T-1 dễ giòn.

**Phương án bị loại (do người dùng chọn khác):** Select trên mỗi thẻ làm đường chính, dnd-kit chồng lên sau.

**Giảm rủi ro đã chốt:** bật **KeyboardSensor**. T-1 lái bàn phím (`Tab` → `Space` nhấc → `ArrowRight` × n → `Space` thả) — xác định, không phụ thuộc toạ độ hay animation, và chính là đường bàn phím checklist giao diện đòi. Chuột vẫn kéo bình thường cho giám khảo thử tay. Tuỳ chọn thêm: e2e chạy song song một đường `PATCH /opportunities/:id/stage` để tách "logic không chặn" khỏi "cơ chế kéo".

### 3.3 Đầu mối chính: tự hạ người cũ trong transaction

Đặt B làm chính → A tự xuống phụ, một thao tác. Khớp luật "không chặn thao tác nào của Sales".

**Phương án bị loại:** từ chối, bắt Sales bỏ tick người cũ trước — hai thao tác cho một ý định, đúng cái Specs chê.

Partial unique index giữ nguyên vai trò lớp chặn thứ hai, kèm **phép đo đột biến**: ghi thẳng hai dòng `is_primary = true` không qua service → Postgres phải từ chối.

### 3.4 Màn tổng quan có khối thứ 4 — thống kê lý do thua

Specs chỉ liệt kê 3 khối, nhưng checklist P3 có dòng *"không vào bảng thống kê lý do thua"* — không có bảng đó thì dòng này không chứng minh được ở đâu cả. Thêm: đếm `lost` theo `lostReason`, cộng một dòng "N cơ hội Thua chưa ghi lý do" **đứng ngoài bảng**. Chi phí một `GROUP BY`.

### 3.5 Xoá — hai cái bẫy

- `timeline_entries.contact_id` FK **không có `ON DELETE`** → trong transaction `SET contact_id = NULL` rồi mới xoá người liên hệ. Không migration.
- Công ty: soft delete (`deletedAt` đã có). Người liên hệ: hard delete. **Cơ hội: không có endpoint xoá** — Specs chỉ đòi "tạo và quản lý". YAGNI.

## 4. Bề mặt kỹ thuật

```
packages/contracts/src/dto/
  opportunity.ts   create/update/updateStage schema + OpportunityDto (warnings[], isOverdue)
  contact.ts · timeline.ts · overview.ts

apps/api/src/domain/
  company/     + GET :id · PATCH · DELETE(soft) · GET ?q&industry&companyType&country&isWatched
  contact/     [mới] GET/POST /companies/:id/contacts · PATCH/DELETE /contacts/:id
  opportunity/ [+controller] GET ?stage&overdue · POST · PATCH :id · PATCH :id/stage
               opportunity-warnings.ts   ← hàm suy cờ dùng chung
  timeline/    [mới] GET /companies/:id/timeline · POST
  overview/    [mới] GET /overview

apps/web/src/
  app/cong-ty/page.tsx              + tìm theo tên + 4 bộ lọc
  app/cong-ty/[id]/page.tsx         chỉ ghép; Vùng đọc của A giữ nguyên vị trí
    company-profile-section.tsx · contact-section.tsx · timeline-section.tsx
  app/co-hoi/page.tsx · stage-board.tsx · opportunity-card.tsx
    stage-transition-dialog.tsx     mở khi thả vào Đủ điều kiện / Thua,
                                    luôn có nút "Để trống, bổ sung sau"
  app/tong-quan/page.tsx            4 khối
  components/ui/warning-flag.tsx    Badge tone="warning" + câu giải thích ngắn
```

Thêm `@dnd-kit/core` + `@dnd-kit/sortable` vào `apps/web/package.json`.

**Hai bẫy đặt tên phải nhớ:**

1. `OPPORTUNITY_WARNING` khai báo trong `enums.ts` nhưng **đứng ngoài registry `ENUMS`** — giống `USER_ROLE`. Nó không phải enum ontology 3.5; nhét vào registry là `ontology-enum-parity.test.ts` đỏ ngay.
2. `updateStage` giữ nguyên `const db = actor.kind === 'system' ? dbSystem : dbApp` (luật số 1 của plan.md). Thêm controller không được làm T-10 mini đỏ.

`updateStage` chạy **một transaction**: đổi stage (+ hai ô dấu hiệu / lý do thua nếu Sales có điền) **và** ghi `TimelineEntry` loại `stage_change`, `createdBy='human'`.

## 5. Luật màu — kiểm được bằng grep

- Cờ cảnh báo mang token `warning`, **tuyệt đối không** `machine-*`. Cờ là dữ liệu người còn thiếu, không phải thứ máy sinh; tô tím là phá thẳng luật 2 của CLAUDE.md.
- Nhóm 1 không có AI → **`grep -r "machine-" trên file mới của P3 phải ra 0 dòng.** Một lệnh, chứng minh được ranh giới.
- Cờ luôn kèm câu ngắn ("Chưa có dấu hiệu nhu cầu/ngân sách"), không `—` trơ trọi (design-guidelines mục 5 luật 4).

## 6. Test — ba luật không chặn là **thứ vắng mặt**

Không có code nào "làm" việc không chặn; nó là việc *không viết `.refine()`*. Loại bằng chứng đó biến mất trong review bằng mắt, nên mỗi luật có một cách phá kèm theo.

| Test | Chứng minh | Phép đo đột biến |
| --- | --- | --- |
| `opportunity-stage-never-blocks` | bỏ 2 ô dấu hiệu · bỏ lý do thua · thiếu Việc tiếp theo → vẫn lưu, có cờ; đi lùi + nhảy cóc không bị chặn | thêm `.refine()` theo stage vào zod → phải đỏ |
| `opportunity-warnings` (unit, không DB) | ba cờ + `isOverdue` | — |
| `contact-primary-swap` | đặt người thứ hai → người cũ tự xuống phụ | ghi thẳng 2 dòng `is_primary=true` không qua service → Postgres từ chối |
| `stage-change-writes-timeline` | mỗi lần đổi giai đoạn có `stage_change`, `created_by='human'` | bỏ insert khỏi transaction → phải đỏ |
| `company-search-and-filter` | tìm theo tên + 4 bộ lọc | — |
| `overview-excludes-on-hold` | `on_hold` không cộng vào pipeline đang chạy; cơ hội Thua thiếu lý do đứng ngoài bảng | — |
| `t10-mini-system-actor-blocked` (cũ) | còn xanh sau khi thêm controller | — |

## 7. Thứ tự làm

1. Contracts + `opportunity-warnings.ts` (unit thuần, không DB) — 30'
2. Test đỏ ba luật không chặn + phép đo đột biến — 40'
3. API: contact → opportunity → timeline → company filter → overview — 2h
4. Web: co-hoi board → cong-ty filter + 3 section → tong-quan — 2h

**Kiểm điểm sau bước 3** trước khi sang web.

## 8. Rủi ro

| Rủi ro | Xử lý |
| --- | --- |
| dnd-kit làm T-1 e2e giòn | KeyboardSensor làm đường lái của test; timebox 60' cho kéo thả, quá thì giữ bàn phím + ghi 1 dòng vào plan |
| Đụng `cong-ty/[id]/page.tsx` của A | Tách 3 section thành file riêng, `page.tsx` chỉ ghép; `components/provenance/*` không đụng |
| Thêm controller làm T-10 mini đỏ | Giữ nguyên chọn pool theo actor; chạy lại T-10 ngay sau bước 3 |
| `OPPORTUNITY_WARNING` lọt vào registry `ENUMS` | `ontology-enum-parity.test.ts` bắt được — chạy sớm ở bước 1 |
| Phase phình ăn hết ngày 13 | Cắt theo plan.md: kéo thả trước, tổng quan còn 3 con số sau |

## 9. Nghiệm thu

Nguyên checklist Validation của phase file, cộng hai mục mới sinh từ phiên này:

- [ ] `grep -r "machine-"` trên file mới của P3 → 0 dòng
- [ ] Cơ hội Thua thiếu lý do hiện ngoài bảng thống kê ở màn tổng quan, kèm cờ

## 10. Câu hỏi chưa giải quyết

- **`SEED_CONTACTS` chưa có** (việc của C ở P4). P3 test tay sẽ không có người liên hệ nào cho tới khi P4 xong — test integration của P3 tự tạo dữ liệu nên không bị chặn, nhưng demo tay thì cần.
- **Sửa hồ sơ công ty ở màn chi tiết** sẽ đụng vùng nhóm 3 sinh gợi ý `field_update` (P5). Chưa quyết ô nào Sales sửa trực tiếp được vs ô nào chỉ đi qua hàng đợi — I-11 mới cấm `companyType`. Để P5 chốt.

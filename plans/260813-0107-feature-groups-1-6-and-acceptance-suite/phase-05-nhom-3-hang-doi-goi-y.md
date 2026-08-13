---
phase: 5
title: "Nhóm 3 — hàng đợi gợi ý"
status: done
priority: P1
dependencies: [2]
owner: B
estimate: 4.5h (thực: ~1h20')
---

# Phase 5: Nhóm 3 — hàng đợi gợi ý

## Overview

Vùng tự chủ 2: máy chuẩn bị, **người bấm**. Cơ chế an toàn duy nhất của vùng này là *không duyệt thì không có gì xảy ra, vô thời hạn* — không tự hết hạn thành hành động, không có chế độ tự duyệt.

Quyết định chi phối: [ADR-0008](../../docs/decisions/0008-bo-goi-y-bang-menu-ly-do-tai-cho.md) (Bỏ = menu lý do tại chỗ, "số thao tác" đọc là số bước) · [ADR-0006](../../docs/decisions/0006-bat-dang-theo-doi-la-uy-quyen-phan-ghi-tin.md) (I-5) · [ADR-0009](../../docs/decisions/0009-pham-vi-nut-tat-ai-chi-dung-sinh-moi.md) (tắt AI vẫn duyệt được hàng đợi tồn).

**Ba quyết định chốt 13/08 20:51** ([báo cáo](../reports/from-brainstorm-to-planner-260813-2051-phase-05-nhom-3-hang-doi-goi-y-report.md)) — đọc trước khi gõ dòng đầu, vì cả ba đổi phạm vi phase này:

- [ADR-0023](../../docs/decisions/0023-goi-y-viec-tiep-theo-la-proposal-type-thu-ba-kem-cot-opportunity-id.md) — I-7 cần `proposal_type = next_step` + cột `opportunity_id`. **Không có nó thì Proposal của nhóm 4 không lưu được**: CHECK hiện tại chỉ có hai nhánh.
- [ADR-0024](../../docs/decisions/0024-goi-y-sua-o-ho-so-do-llm-de-xuat-code-giu-ba-cua-chan.md) — `field_update` = bản chụp có khối dữ kiện → LLM đề xuất → code giữ **ba cửa chặn**. `Claim` hiện **không mang cặp (ô, giá trị)** nên không có đường nào khác mà không ghi dữ liệu sai.
- [ADR-0025](../../docs/decisions/0025-moc-do-thoi-gian-quyet-dat-lai-sau-moi-quyet-dinh.md) — mốc `seconds_to_decide` **đặt lại sau mỗi quyết định**; ontology mục 7 đã sửa theo.

## Requirements

- Functional: claim mới → sinh `Proposal` (`field_update` | `timeline_entry` | `next_step`); hàng đợi hiện đủ 4 thứ tại chỗ (hiện tại → đề nghị · câu trích · mức chắc chắn · hệ quả nếu sai); 3 nút Duyệt / Sửa rồi duyệt / Bỏ; ghi `ProposalDecision` kèm `seconds_to_decide`; dấu hiệu "đang có gợi ý chờ duyệt" ở màn công ty và danh sách cơ hội.
- Non-functional: **số bước để Bỏ không nhiều hơn số bước để Duyệt** (ADR-0008); gợi ý đã Bỏ không sinh lại cùng nội dung trừ khi có bản lưu mới.

## Bất biến phải có test

| # | Nội dung |
| --- | --- |
| I-5 | Công ty `is_watched = true` → **không** sinh `Proposal` loại `timeline_entry` (vẫn sinh `field_update`) |
| I-11 | `target_field` của `field_update` chỉ trong `industry`, `country`, `size`, `website`. **Cấm** `name`, `company_type`. `next_step` là **loại khác**, không phải ngoại lệ của I-11 (ADR-0023) |
| I-12 | `decision = edit` đếm riêng, **không** cộng vào `accept` |
| **G1** | `targetField` ngoài whitelist → từ chối ở service **và** CHECK CSDL từ chối `INSERT` thô |
| **G2** | `proposedValue` không phải chuỗi con nguyên văn của `quoteText` → **bỏ `fieldSuggestion`, claim vẫn lưu**; số bị bỏ đếm được |
| **G3** | `currentValue == proposedValue` (sau trim) → **không sinh** proposal |
| T-4 | Sinh gợi ý rồi không làm gì → sau ≥3 chu kỳ vòng quét hồ sơ công ty **y nguyên** |

## Files

| Tạo / sửa | Vai trò |
| --- | --- |
| `packages/db/migrations/` + `schema/proposals.ts`, `enums.ts` | **đầu phase, không cuối** — `proposal_type = next_step`, cột `opportunity_id`, CHECK ba nhánh, `GRANT INSERT (opportunity_id)` (ADR-0023) |
| `apps/api/src/domain/proposal/proposal-service.ts` | sinh gợi ý từ claim; enforce I-5, I-11, G1–G3; `impact_if_wrong` từ bảng cố định theo `targetField` |
| `apps/api/src/domain/proposal/proposal-decision-service.ts` | Duyệt / Sửa rồi duyệt / Bỏ; áp thay đổi vào hồ sơ **chỉ khi người quyết** |
| `apps/api/src/domain/proposal/proposal.controller.ts` | `GET /proposals?status=pending` · `POST /proposals/:id/decide` · `GET /proposals/pending-summary` |
| `apps/api/src/domain/claim/claim-reaction-service.ts` | **một chỗ nối duy nhất** cho P5/P6/P7; `ObservationService` gọi **1 dòng**. Thứ tự: nhóm 4 trước → nhóm 3 sau (I-7) |
| `apps/web/src/app/hang-doi/page.tsx` | hàng đợi; mốc `seconds_to_decide` đặt lại sau mỗi quyết định (ADR-0025) |
| **File của người khác — sửa nhỏ, thông báo trước, pull trước push** | `ai/demo-snapshots.ts` (khối dữ kiện, A) · `ai/anthropic-claim-extractor.ts` (prompt + `fieldSuggestion`, A) · `contracts/dto/claim.ts` (field tuỳ chọn, dùng chung) · `observation-service.ts` (1 dòng gọi, A) · `seed/seed-data.ts` (1 công ty watched `website: null`, C) |

## Implementation steps

1. **Migration trước tiên** (ADR-0023): enum `next_step`, cột `opportunity_id`, CHECK ba nhánh, GRANT cột mới. Ba `INSERT` thô phải bị từ chối trước khi viết service.
2. Test đỏ cho 7 dòng bảng bất biến. T-4 là test quan trọng nhất của phase — nó chứng minh vùng 2 không tự trôi thành vùng 3.
3. Bản chụp thêm khối dữ kiện + seed 1 công ty watched `website: null` ⇒ có **cả ca "ô trống" và ca "ô đã cũ" trên công ty đang theo dõi**, hàng đợi demo không phụ thuộc Marlin.
4. Prompt trả thêm `fieldSuggestion` tuỳ chọn, nhận vào giá trị hiện tại của 4 ô. `ProposalService` áp G1 → G2 → G3, đếm số bị loại từng cửa (cùng họ `droppedNoVerbatimQuote` của ADR-0014).
5. `ClaimReactionService`: P5 viết **chỉ bước nhóm 3**, ghi comment thứ tự cho P6. Không stub, không interface rỗng.
6. `ProposalDecisionService`: ba nhánh; `edit` lưu `final_value` và đếm riêng. Áp thay đổi khi duyệt bằng `actor = human` — `field_update` tái dùng `CompanyService.update(actor, …)` (đã từ chối `actor=system`); `timeline_entry` ghi `created_by = human`, `entry_type = note`; `next_step` ghi `next_step_source = 'human'`, hạn = ngày duyệt + I-9.
7. Hàng đợi web: 4 thứ tại chỗ, menu 5 lý do bung tại chỗ, ba kiểu thẻ (thẻ `next_step` hiện **tên cơ hội**).
8. Không sinh lại gợi ý đã Bỏ: so `(company_id, proposal_type, target_field, proposed_value)`, chỉ mở lại khi claim đến từ `Observation` **mới hơn** cái đã bị Bỏ. Lớp một vẫn là I-3.
9. Dấu hiệu chờ duyệt ở màn công ty + danh sách cơ hội qua `GET /proposals/pending-summary` (map `companyId → count`), **không** phình `CompanyDto`/`OpportunityDto`.

## Validation — **tất cả xanh 13/08 22:07**

- [x] T-4 xanh — **integration** (`crm_test` + fake timer, tiền lệ `apps/api/src/watch/__tests__`): ≥3 tick, hồ sơ y nguyên, `status` vẫn `pending`, 0 dòng `proposal_decisions`
- [x] T-5 xanh — **e2e mỏng** ba nút + integration: cả ba quyết định có bản ghi ai/lúc nào/quyết gì; `edit` **không** cộng vào `accept`
- [x] I-5, I-11 xanh — thử sinh `field_update` cho `company_type` phải bị từ chối ở **cả hai** lớp
- [x] G2 xanh: `proposedValue` không nằm trong câu trích → bỏ suggestion, **claim vẫn lưu**
- [x] G3 xanh: giá trị đề xuất trùng giá trị hiện tại → không sinh
- [x] CHECK ba nhánh từ chối đúng ba ca sai (`next_step` thiếu `opportunity_id` · `field_update` kèm `opportunity_id` · `timeline_entry` kèm `target_field`)
- [x] Đếm số bước: Bỏ (1) ≤ Duyệt (1); Sửa rồi duyệt (2)
- [x] Tắt AI → hàng đợi tồn **vẫn duyệt được** (ADR-0009)
- [x] Gợi ý đã Bỏ không quay lại sau 3 chu kỳ; quay lại **được** khi có bản lưu mới
- [x] **Nợ đo của ADR-0024 — trả đủ, 13/08 22:32.** Đường tất định: 3 gợi ý, `impact_if_wrong` 77–113 ký tự. **LLM thật** (`claude-haiku-4-5`, 3 lượt × 10 lần đọc): lượt đầu G2 loại **2/3** vì model gắn đề xuất vào phát hiện tin tức ⇒ **sửa prompt, không hạ G2** ⇒ hai lượt sau G2 loại **0/3**, kết quả lặp lại từng dòng
- [x] **Ba phép đo đột biến — cả ba cắn:** xoá dòng kiểm I-11 → đỏ · `GRANT INSERT (status)` cho `crm_system` → lớp CSDL của T-4 đỏ · bỏ `GRANT INSERT (opportunity_id)` → sinh `next_step` thất bại

## Risks

| Rủi ro | Xử lý |
| --- | --- |
| Duyệt xong ghi bằng `actor = system` → mất ý nghĩa "người quyết" | Tái dùng `CompanyService.update(actor, …)` đã có sẵn nhánh từ chối `system`; test khẳng định bản ghi mang danh người bấm |
| `impact_if_wrong` bị điền cho có | Code sinh theo bảng cố định theo `targetField`, không nhờ LLM ⇒ không có ca chuỗi rỗng nào tồn tại được; test khẳng định **nội dung**, không chỉ độ dài |
| B phải sửa 4 file của A và C | Làm **đầu phase**, thông báo trước, pull trước push, không refactor (tiền lệ ADR-0021) |
| LLM trả 0 `fieldSuggestion` → hàng đợi trống | Nợ đo ở mục Validation làm ca này lộ ra ngay; rơi về parser tất định trên đúng khối dữ kiện vừa thêm (~30') |
| Migration đụng thứ tự file với P6/P7 | Đẩy migration đầu phase, không cuối |

## Cắt theo thứ tự nếu trưa 14/08 chưa xong

1. `next_step` proposal → đẩy sang P6 (A đã phải chạm `opportunities` ở phase đó). Enum thừa + cột NULL không cần migration ngược.
2. Khối dữ kiện chỉ làm 2 công ty thay vì 5.
3. Dấu hiệu chờ duyệt chỉ ở màn công ty, chưa ở danh sách cơ hội.

**Không cắt:** T-4 · T-5 · ba cửa chặn G1–G3 · menu 5 lý do tại chỗ · duyệt được khi đã tắt AI.

## Rollback

Không áp thay đổi tự động ở đâu cả → tắt UI hàng đợi là hết tác dụng, dữ liệu chính thức không bị chạm. Migration là thêm-vào: `proposals` cũ đọc/ghi bình thường.

## Kết quả — 13/08 22:07

**203 test đơn vị + 9 e2e xanh**, lint/typecheck sạch. Hàng đợi trên stack thật có **3 gợi ý**: Sakura `size 500-1000 → 1000+` (ô cũ, công ty đang theo dõi) · Kitefin `website (trống) → https://kitefin.example.com` (ô trống, cũng đang theo dõi) · Marlin một mục dòng thời gian (không theo dõi). Cả hai nửa của Specs nhóm 3 nằm **trong** tập theo dõi nên không phụ thuộc Marlin.

Bốn thứ khác dự kiến, ghi lại vì phase sau sẽ gặp:

1. **`db.insert().values()` của drizzle không dùng được cho đường ghi của AI.** Nó liệt kê **mọi** cột của bảng (điền `DEFAULT` cho cột thiếu), nên chỉ cần *nêu tên* `status` là Postgres từ chối cả câu lệnh — `crm_system` không có quyền trên cột đó. Cách sửa **không phải** nới GRANT mà là viết `INSERT` nêu đúng các cột được phép (`ProposalService.insertAsSystem`). **P6/P7 sẽ đụng y hệt**: `auto_next_step_events` có `undo_deadline` + 4 cột `undone_*` vắng khỏi GRANT, `timeline_entries` cũng có cột của người.
2. **`ALTER TYPE ... ADD VALUE` rồi dùng ngay giá trị đó trong cùng transaction là lỗi 55P04**, mà drizzle chạy mọi migration trong một transaction ⇒ CHECK phải so `proposal_type::text`, không so kiểu enum. Không sửa thì migration vỡ trên **mọi CSDL mới**, tức mỗi lần chạy test và mỗi lần giám khảo diễn lại.
3. **`crm_system` không có quyền nào trên `proposal_decisions`** (đúng ADR-0016), nên luật "đã quyết thì không sinh lại" phải đọc `proposals.status`, không đọc bảng quyết định. Giữ được ranh giới: AI không biết ai quyết gì, chỉ biết "còn chờ hay không".
4. **Phép đo trên bộ demo tìm ra một lỗi thật:** Kitefin ra **hai thẻ y hệt** (bản trước + bản sau, cùng dòng website). Luật chống sinh lại chỉ chặn nội dung *đã quyết*. Đã sửa để một gợi ý *đang chờ* cũng chặn bản trùng, kèm test 11. Đây là lý do phải đo trên dữ liệu thật chứ không chỉ chạy test.

Test parity của ontology cũng cắn khi thêm `next_step` vào enum mà chưa sửa `docs/ontology.md` mục 3.5 — đúng lớp chống "ontology trang trí".

## Nợ mang sang phase khác

- **P6 đọc ADR-0023 trước khi viết nhánh I-7.** Type `next_step` và cột `opportunity_id` đã có; P6 chỉ thêm dòng của mình vào `ClaimReactionService` theo thứ tự đã ghi comment.
- **P6 và P7 đọc mục "Kết quả" ở trên trước khi ghi bằng `crm_system`** — hai bẫy drizzle/GRANT và bẫy `ALTER TYPE` sẽ gặp lại nguyên vẹn.
- **`ClaimReactionService` đã có chỗ chờ cho nhóm 4**: P6 thêm bước của mình **phía trên** bước nhóm 3, rồi truyền danh sách bị I-7 chặn vào `generate({ blockedNextSteps })`. Kiểu `BlockedNextStep` đã có, nhánh duyệt `next_step` đã có test 6.
- **P8 đọc ADR-0025**: `seconds_to_decide` nullable, bảng điều khiển phải **nói rõ mẫu là bao nhiêu**, không lặng lẽ tính trung vị trên tập con.

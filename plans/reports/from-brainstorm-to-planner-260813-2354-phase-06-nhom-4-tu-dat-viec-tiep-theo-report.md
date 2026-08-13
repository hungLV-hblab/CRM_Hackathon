# Phiên phản biện thiết kế Phase 6 — Nhóm 4: tự đặt Việc tiếp theo + Hoàn tác

| | |
| --- | --- |
| **Ngày** | 2026-08-13 23:54 → 14/08 00:20 |
| **Phạm vi** | [phase-06-nhom-4-tu-dat-viec-tiep-theo.md](../260813-0107-feature-groups-1-6-and-acceptance-suite/phase-06-nhom-4-tu-dat-viec-tiep-theo.md) |
| **Phương pháp** | Đọc mã nguồn thật (không chạy đo). Đối chiếu phase file với `apps/api/src`, `packages/db/migrations`, `packages/contracts`, `apps/web/src` |
| **Quyết định chi phối** | [ADR-0005](../../docs/decisions/0005-tran-tu-chu-cua-viec-tu-dat-viec-tiep-theo.md) (I-6/I-7/I-8) · [ADR-0023](../../docs/decisions/0023-goi-y-viec-tiep-theo-la-proposal-type-thu-ba-kem-cot-opportunity-id.md) (nhánh I-7 hạ cánh) · [ADR-0015](../../docs/decisions/0015-grant-insert-phai-theo-cot-khi-bang-co-cot-thuoc-quyet-dinh-cua-nguoi.md) (GRANT theo cột) |

## Kết luận một dòng

Phase 6 viết **trước khi P2 và P5 xong**, nên nó mô tả một nền móng trống trong khi thực tế **hơn nửa phần backend đã có sẵn** — và bù lại nó **không tính phần web của thông báo**, thứ Specs bắt buộc và T-6 chấm. Ước lượng 3h là thiếu, không phải thừa.

## 1. Bảy chỗ phase file lệch với code thật

| # | Phase file viết | Thực tế trong repo | Hệ quả |
| --- | --- | --- | --- |
| 1 | Tạo `domain/opportunity/urgency-table.ts` | `SIGNAL_DUE_DAYS` + `SIGNAL_DUE_REASON` đã ở `packages/contracts/src/enums.ts:77-92`; `dueDateFor()` đã là hàm private ở `proposal-decision-service.ts:183` (đã xử lý bẫy UTC+7) | Làm theo phase file = **bản sao thứ hai** của bảng độ gấp và viết lại phần chống lệch múi giờ |
| 2 | "Bảng mới mà nhóm 4 cần ghi thì phải thêm GRANT tay" (luật 3 của plan) | `auto_next_step_events` + `notifications` đã có bảng (`0002_closed_cyclops.sql:69,86`) **và** GRANT theo cột (`0003_grants_ai_tables.sql:52-66`) | Không nợ GRANT mới. Nhưng **phép đo đột biến vẫn nợ** — chưa ai chứng minh cột-list đó cắn |
| 3 | "Nhánh I-7 → sinh `Proposal` (gọi service của B qua interface)" | `BlockedNextStep` interface + nhánh `next_step` trong `ProposalService.generate()` đã có (`proposal-service.ts:79-86,138-149`), GRANT `opportunity_id` đã có (`0006`) | Việc còn lại chỉ là **điền vào chỗ trống đã chừa sẵn** ở `claim-reaction-service.ts:44-45` |
| 4 | `domain/notification/*` — "thông báo; không biến mất trước khi `read_at` có giá trị" | `NotificationDto` đã có ở `packages/contracts/src/dto/notification.ts` kèm `autoEventId`/`undoDeadline`/`canUndo`. Module API **chưa có**, UI **chưa có** | Contract đã chốt hình dạng; phần thiếu là service + controller + **toàn bộ mặt web** |
| 5 | `AutoNextStepService`: "chọn pool theo `actor`" như việc mới | `OpportunityService.updateNextStep()` đã tồn tại, **đã chọn pool theo actor**, đã có nhánh I-7 nhưng hiện **ném `ForbiddenException`** kèm comment "nhóm 4 chưa có" | Phải quyết: đi qua hàm đó hay tự ghi. Quyết định 6 bên dưới |
| 6 | Files table: 4 dòng, đều backend + `components/next-step/*` | Web **không có nav dùng chung**, **không có route thông báo**, và **không có chỗ nào cho người gõ `nextStepText`** (grep `nextStepText` trong `apps/web` chỉ ra 2 file, đều là hiển thị) | Phần web lớn hơn phase file mô tả. Ước lượng phải sửa |
| 7 | Ước lượng 3h | Cộng thật: service + undo + notification module + endpoint map + 3 thành phần web + e2e | **~4h** |

Ba thứ phase file nói **đúng và quan trọng**, không đụng vào: phép đo đột biến ghi cứng `dbApp` · I-8 là chỗ dễ sai nhất · seed đã có sẵn hai ca demo (Sakura `qualified` + `next_step_source: 'human'` cho I-7 · Nimbus `negotiation` + ô trống cho T-6/T-7).

## 2. Sáu quyết định chốt

| Câu hỏi | Chốt | Hệ quả lan ra |
| --- | --- | --- |
| I-8 lấy mốc "giá trị người-gõ gần nhất" ở đâu | **Lần ngược chuỗi event lúc hoàn tác**: đọc `auto_next_step_events` của cơ hội theo `created_at DESC`, lấy event gần nhất có `previous_source ≠ 'system'` | Cột `previous_*` giữ đúng nghĩa "thứ có ngay trước tôi", khớp comment schema (`auto-next-step-events.ts:25-28`). Tốn một query mỗi lần hoàn tác |
| Nút Hoàn tác đặt ở đâu | **Ngay trên thẻ cơ hội** — và màn thông báo **vẫn phải làm** vì Specs đòi "thông báo trong sản phẩm" | Đây là phương án đắt nhất trong ba, đội chọn có ý thức. Là nguồn chính của việc ước lượng 3h → 4h |
| Thẻ cơ hội lấy dữ liệu `autoNextStep` bằng đường nào | **Endpoint riêng + gộp ở client**: `GET /opportunities/auto-next-steps` trả map, bảng deal `useQuery` rồi truyền prop | `OpportunityDto`, `OPPORTUNITY_SELECTION`, `toDto` **không đổi một dòng** ⇒ không đụng file dùng chung của B, không ảnh hưởng `/tong-quan` và 203 test đang xanh. Đổi lại bảng deal có hai nguồn dữ liệu |
| Bảng độ gấp I-9 | **Rút `dueDateFor` ra `domain/opportunity/next-step-due-date.ts`**, `ProposalDecisionService` đổi sang import | Một nguồn cho "đổi bảng → ngày hạn đổi theo". Sửa 1 dòng import trong file của B. **Phase file phải bỏ yêu cầu tạo `urgency-table.ts`** |
| Một tin ở công ty nhiều cơ hội mở | **Một thông báo / một event**, giao diện gộp theo tin khi hiển thị | Đúng hình dạng schema (`notifications.auto_event_id` là FK đơn) và giữ được "mỗi cơ hội một nút Hoàn tác riêng" của ADR-0005 B1 |
| Thông báo hiện ở đâu | **Cả hai**: dải đầu bảng deal + route `/thong-bao`. `read_at` chỉ ghi khi Sales bấm **"Đã xem"** | Dải giải quyết bài toán không có nav dùng chung; route giữ lịch sử đầy đủ. Đánh dấu tường minh làm "thông báo chưa xem không biến mất" thành hành vi quan sát được |

### Phương án bị loại — ghi lại để không bàn lại

| Bị loại | Vì sao |
| --- | --- |
| **I-8:** chép mốc người sang mọi event lúc ghi (hoàn tác chỉ đọc một hàng) | `previous_text` sẽ **nói dối** — không còn là giá trị ngay trước. Người đọc bảng sau này hiểu sai, và trail là thứ duy nhất biện minh cho quyền tự ghi của vùng 3 |
| **Hoàn tác:** chỉ nằm trong màn thông báo | Rẻ nhất và đóng đủ T-6/T-7, nhưng Sales đang nhìn bảng deal thấy ô lạ phải rời màn hình mới sửa được — trái tinh thần "sửa lại phải dễ hơn cả lúc máy làm" (CLAUDE.md mục 4) |
| **Dữ liệu:** mở rộng `OpportunityDto` + lateral join | Bắt 5 màn không dùng tới phải gánh join, và sửa vào `opportunity-service.ts` — file dùng chung của B, đang đứng trên đường găng P8 |
| **Thông báo:** một thông báo / một tin | `auto_event_id` chỉ trỏ được một event ⇒ một cú bấm chỉ hoàn tác 1 trong N cơ hội, phần còn lại không có đường. Vỡ T-7 theo cách khó thấy |
| **I-9:** tạo `urgency-table.ts` riêng như phase file viết | Hai hàm tính ngày hạn, hai lần bẫy UTC+7, và bảng chỉ "sửa được" ở một nửa hệ thống |

## 3. Thiết kế chốt

### Backend

| File | Vai trò |
| --- | --- |
| `domain/opportunity/next-step-due-date.ts` **mới** | `dueDateFor()` rút từ `proposal-decision-service.ts:183` + `dueReasonFor()`. Decision-service đổi sang import |
| `domain/opportunity/auto-next-step-service.ts` **mới** | I-6…I-9, `poolFor(actor)`, không ghi cứng pool |
| `domain/opportunity/auto-next-step.controller.ts` **mới** | `GET /opportunities/auto-next-steps` · `POST /auto-next-step-events/:id/undo`. Controller riêng để không đụng `opportunity.controller.ts` của B |
| `domain/notification/*` **mới** | `GET /notifications` · `POST /notifications/:id/read` (`crm_app`); phần sinh thông báo là method nhận `tx` của `crm_system`, chạy trong transaction của nhóm 4 |
| `domain/claim/claim-reaction-service.ts` | Điền step 1 đang để trống, truyền `blockedNextSteps` xuống `proposals.generate()` |
| `packages/contracts/src/dto/auto-next-step.ts` **mới** | DTO cho endpoint map |

**Luồng ghi — một transaction, pool chọn theo actor:**

1. Lọc I-6: `confidence ∈ {certain, likely}` ∧ `signal_type ∈ {funding, leadership_hire}`. **Một claim mỗi lượt** (certain trước likely, rồi theo thứ tự lưu) — không thì một bản chụp hai tin sẽ ghi đè chính nó trên cùng một ô, và event thứ hai làm I-8 phải lần ngược ngay trong lần chạy đầu.
2. Cơ hội mở = `stage ∉ CLOSED_STAGES` ⇒ **gồm cả `on_hold`**, đúng ontology 3.5. Lệch đi thì cần ADR mới.
3. Mỗi cơ hội mở: `next_step_source = 'human'` **và** có text → `BlockedNextStep`, không ghi. Còn lại → ghi.
4. `next_step_text` **do code ghép** từ `claim.statement`; LLM không chạm. Ngày hạn từ bảng I-9, lý do lấy từ `SIGNAL_DUE_REASON`.
5. `UPDATE opportunities` (3 cột) → `INSERT auto_next_step_events` → `INSERT notifications`. **Hai INSERT viết SQL thô nêu đúng cột được GRANT.** `db.insert().values()` của drizzle nêu mọi cột, chỉ cần nhắc tên `undo_deadline` là Postgres từ chối cả câu — đúng bẫy P5 đã dính trên `proposals.status`.

**Hoàn tác (`crm_app`, một transaction):** lần ngược chuỗi lấy mốc người (I-8) → trả `next_step_*` về mốc đó (`source = 'human'` nếu có text, `NULL` nếu rỗng) → ghi 4 cột `undone_*` **chỉ trên event mới nhất chưa hoàn tác**. Quá `undo_deadline` hoặc đã hoàn tác → từ chối. `canUndo` tính theo giờ **máy chủ**.

> `OpportunityService.updateNextStep()` giữ nguyên làm lớp chặn chung; nhóm 4 **không** đi qua nó vì cần cùng transaction với event + thông báo. Hai đường ghi vào `next_step_*` là mùi chấp nhận có ý thức — đổi lại "ghi vết hai chiều" không bao giờ lệch với ô. Comment ở `opportunity-service.ts:225-231` phải sửa lại vì nó đang nói nhóm 4 không tồn tại.

### Web

| File | Vai trò |
| --- | --- |
| `components/next-step/auto-next-step-cell.tsx` | Dấu hiệu máy bằng **màu `machine-*` + hình khối** (phân biệt được không cần đọc chữ) · câu trích bấm ra `SourceViewer` đã có · dòng lý do ngày hạn · nút Hoàn tác + đếm "còn N ngày" |
| `components/notification/notification-strip.tsx` | Dải đầu bảng deal, gộp theo tin, nút "Đã xem" |
| `app/thong-bao/page.tsx` | Danh sách đầy đủ, dùng lại cùng component |
| *(file của B)* `co-hoi/page.tsx` · `co-hoi/opportunity-card.tsx` | Chèn `<NotificationStrip/>` một dòng; thẻ render `<AutoNextStepCell>` khi có prop |

### Test và hai phép đo đột biến

- I-6 bốn ca (funding/certain ghi · leadership_hire/likely ghi · `expansion` **không** ghi, đi hàng đợi · `speculative` không) · I-7 (ô người quá hạn không bị đè, có `next_step` proposal) · I-8 (máy đặt hai lần → hoàn tác về giá trị **người**) · I-9 (3 và 5 ngày; đổi bảng → đổi theo) · thông báo chưa xem không mất · hoàn tác quá 7 ngày bị từ chối · `crm_system` ghi `stage`/`expected_value` qua đường này → `permission denied`.
- **Đo 1 — ghi cứng `dbApp`:** test "hoàn tác dưới danh nghĩa system" phải chuyển từ đỏ sang xanh ⇒ chứng minh lớp CSDL đang gánh thật, không phải chỉ lớp domain.
- **Đo 2 — nới GRANT `undo_deadline` cho `crm_system`:** test "AI không rút ngắn được cửa sổ 7 ngày" phải chuyển từ đỏ sang xanh ⇒ chứng minh cột-list của `0003` còn hiệu lực. Đây là món nợ đo đã tồn từ khi viết migration.
- e2e `t6-t7-auto-next-step-and-undo.spec.ts` (Nimbus, đổi bản chụp sang `after`).

## 4. Rủi ro

| Rủi ro | Xử lý |
| --- | --- |
| Ước lượng 4h trên đường găng của A, ngay trước freeze | Món cắt đầu tiên: **route `/thong-bao`** (dải ở bảng deal đủ đóng T-6). Cắt sau: gộp theo tin trong dải. **Không cắt:** nút Hoàn tác, dấu hiệu ô máy, hai phép đo |
| Hai đường ghi vào `next_step_*` (nhóm 4 tự ghi · `updateNextStep`) | Chấp nhận có ý thức, lý do ghi trong báo cáo này và trong comment. Cả hai đều `poolFor(actor)` |
| Bảng deal có hai nguồn dữ liệu sau khi tách endpoint | Đổi lấy việc không đụng `opportunity-service.ts` của B trước freeze. Gộp lại được sau vòng 1 nếu cần |
| `on_hold` được tính là cơ hội mở ⇒ máy đặt việc cho deal đang tạm dừng | Đúng ontology 3.5, không tự ý lệch. Nếu đội thấy sai thì cần ADR, không sửa ngầm trong code |
| Ghi cứng pool trong service mới | Đo 1 ở trên. **Bắt buộc**, không suy diễn từ `updateNextStep` cũ |

## Câu hỏi chưa giải quyết

- **Sales không có chỗ nào để tự gõ Việc tiếp theo trên web.** Grep `nextStepText` trong `apps/web` chỉ ra hai file, cả hai đều hiển thị; form tạo cơ hội cũng không có ô này. Ca I-7 của demo chạy được vì **seed** đặt sẵn `next_step_source: 'human'`. Đây là lỗ sản phẩm thật ("Sales sở hữu dữ liệu của mình") nhưng **ngoài phạm vi P6**; đề xuất để P8 cân, sửa tại chỗ bằng một ô sửa nhanh trên thẻ cơ hội.
- **Thông báo gửi cho ai** khi có nhiều tài khoản `role = 'sales'`: hiện chốt là mỗi người một hàng thông báo cho mỗi event. Seed chỉ có một tài khoản Sales nên chưa quan sát được sự khác biệt.
- ADR-0005 còn nợ việc **hỏi một Sales thật** xem C1 (không đè ô người gõ quá hạn) có đúng thứ họ muốn không. Người làm: HungLV, hạn 14/08. Không chặn code.

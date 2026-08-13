# ADR-0023 — Gợi ý Việc tiếp theo là `proposal_type` thứ ba kèm cột `opportunity_id`, không ép vào hai loại có sẵn

| | |
| --- | --- |
| **Ngày** | 2026-08-13 20:51 |
| **Giai đoạn** | Design (phase 5 — nhóm 3 hàng đợi gợi ý) |
| **Trạng thái** | Chấp nhận |
| **Người quyết định** | HungLV |
| **Prompt log** | phiên brainstorm phase 5 ngày 13/08 20:51 — [báo cáo](../../plans/reports/from-brainstorm-to-planner-260813-2051-phase-05-nhom-3-hang-doi-goi-y-report.md) |

## Bối cảnh

[ADR-0005](0005-tran-tu-chu-cua-viec-tu-dat-viec-tiep-theo.md) chốt I-7: gặp ô `next_step_source = human` thì **không đè**, sinh `Proposal` thay vì tự ghi — và ghi rõ đây là "đường ngược từ nhóm 4 sang nhóm 3". Đọc code thật thì đường ngược đó **không có chỗ hạ cánh**:

- `proposal_type` chỉ có `field_update | timeline_entry` (`packages/db/src/schema/enums.ts`).
- CHECK trên bảng buộc `field_update` nhắm vào whitelist 4 ô hồ sơ và `timeline_entry` mang `target_field IS NULL` (`packages/db/src/schema/proposals.ts:51-56`). Không nhánh nào chứa Việc tiếp theo.
- Nặng hơn: `proposals` chỉ có `company_id`, **không có `opportunity_id`** — mà Việc tiếp theo thuộc **cơ hội**, và một công ty có thể có nhiều cơ hội mở.

Nếu không quyết ở P5 thì P6 (nhóm 4) sẽ đụng đúng chỗ này vào tối 14/08, đúng lúc freeze, và P5 lại là phase sở hữu giao diện hàng đợi phải render nó.

## Phương án đã cân nhắc

Tiêu chí so: *(1)* I-7 chạy đúng như ADR-0005 đã chốt hay phải sửa lại quyết định cũ · *(2)* hàng đợi hiển thị được "cho cơ hội nào" — điều kiện để Sales quyết được · *(3)* số lớp chặn CSDL mất đi · *(4)* giờ tiêu vào ngày freeze.

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| **A.** Thêm `proposal_type = next_step` + cột `opportunity_id uuid NULL` + CHECK ba nhánh + `GRANT INSERT (opportunity_id)` | I-7 chạy nguyên văn ADR-0005. Thẻ hàng đợi chỉ được đúng cơ hội. CHECK ba nhánh **chặt hơn** bản hai nhánh: mỗi loại bị ghim cả `target_field` lẫn `opportunity_id` | Migration + 1 GRANT tay + 1 phép đo. Hàng đợi có kiểu thẻ thứ ba. ~45–60' | ✅ **Chọn** |
| B. Ép vào `timeline_entry` (gợi ý "ghi một tin nhắc đổi Việc tiếp theo") | 0 dòng schema | **Chết đúng kịch bản cần nó**: Sakura là công ty `is_watched = true`, I-5 chặn `timeline_entry` cho chính công ty đó. Và một tin trên dòng thời gian không đổi được ô Việc tiếp theo — duyệt xong vẫn chưa ai làm gì | ❌ Loại — thoả kiểu dữ liệu, không thoả nghiệp vụ |
| C. I-7 chỉ sinh **thông báo**, bỏ hẳn Proposal; sửa I-7 trong ontology | 0 dòng schema, nhanh nhất | Đảo một quyết định đã ghi ADR mà **không có bằng chứng mới** — đúng thứ [luật review](../../.claude/rules/review-audit-self-decision.md) cấm. Thông báo không có accept/reject nên ô người gõ quá hạn không sinh **số đo** nào, mất tín hiệu error-detection ở đúng chỗ nhạy nhất | ❌ Loại |
| D. Nới `target_field` thành text tự do, bỏ whitelist khỏi CHECK | Một nhánh CHECK cho mọi loại | Xoá I-11 ở tầng CSDL để thêm một tính năng — đổi một lớp chặn lấy tiện tay. `name` và `company_type` lại ghi được | ❌ Loại — mất lớp chặn |
| E. Thêm bảng `next_step_proposals` riêng | Không đụng CHECK cũ | Hàng đợi phải UNION hai bảng, mọi con số nhóm 6 phải cộng hai nguồn ⇒ đúng cấu trúc lỗi mà [ADR-0016](0016-proposal-status-chi-hai-gia-tri-moi-con-so-do-lay-tu-proposal-decisions.md) vừa dẹp (một nguồn sự thật cho mọi số đo) | ❌ Loại |

## Quyết định

Chọn **A**.

Tiêu chí quyết là *(1)* đọc cùng *(2)*: B và C đều "rẻ" bằng cách làm cho tính năng **không dùng được** — B chết vì I-5 trên đúng công ty demo, C bỏ mất chỗ Sales bấm. Tiêu chí *(3)* loại D: whitelist trong CHECK là lớp chặn thứ hai của I-11, không phải trang trí.

Bốn điểm ghim kèm, để vòng 2 không đọc thành nới lỏng:

1. **I-11 giữ nguyên nghĩa: whitelist ô *hồ sơ công ty*.** `next_step` không phải ngoại lệ của I-11 — nó là loại gợi ý khác, nhắm vào bảng khác. `name` và `company_type` vẫn bị cấm ở cả hai lớp.
2. **CHECK ba nhánh**: `field_update` ⇒ `target_field` ∈ whitelist ∧ `opportunity_id IS NULL` · `timeline_entry` ⇒ cả hai NULL · `next_step` ⇒ `target_field = 'next_step_text'` ∧ `opportunity_id IS NOT NULL`.
3. **Ngày hạn không cần cột mới**: tính lúc **duyệt** = ngày duyệt + bảng độ gấp I-9 theo `signal_type` của claim. Gợi ý có thể tồn nhiều ngày trong hàng đợi (vùng 2 không hết hạn), nên tính từ lúc sinh sẽ cho ra một cái hạn đã quá khứ.
4. **Duyệt ghi `next_step_source = 'human'`.** Ghi `'system'` thì ô rơi vào vùng tự chủ 3 và kéo theo thông báo + Hoàn tác 7 ngày — sai vùng, vì đây là người bấm.

## Hệ quả

- Kéo theo: cột mới **không** tự được `GRANT INSERT` phủ (danh sách cột ở `0003_grants_ai_tables.sql:38-40` là liệt kê tường minh). Quên GRANT thì `crm_system` không sinh được `next_step` — **lỗi ồn, hướng an toàn**, đúng luật 3 của plan. Phép đo đột biến: bỏ dòng GRANT ⇒ test sinh `next_step` phải đỏ.
- Kéo theo: hàng đợi có ba kiểu thẻ; thẻ `next_step` phải hiện tên cơ hội, không chỉ tên công ty.
- Kéo theo: P6 gọi sang P5 qua `ClaimReactionService` (thứ tự nhóm 4 → nhóm 3), không copy code.
- Đánh đổi chấp nhận: `opportunity_id` NULL với hai loại cũ, tức bảng có một cột chỉ dùng cho 1/3 số dòng. CHECK ba nhánh làm cái NULL đó **bắt buộc** thay vì tuỳ ý, nên không sinh ra ca "quên điền".
- Sẽ phải xem lại nếu: xuất hiện loại gợi ý thứ tư nhắm vào bảng thứ ba (khi đó `entity_type + entity_id` đa hình đáng hơn là thêm cột thứ hai).

## AI đã tham gia thế nào

- Vai trò AI: đọc chéo schema + ADR-0005 + ontology và phát hiện I-7 **không lưu được** — chỗ này không lộ ra khi đọc riêng từng file, chỉ lộ khi đối chiếu CHECK constraint với câu "sinh Proposal thay vì tự ghi".
- **AI sai ở đâu:** chính AI viết `phase-05` với dòng *"claim mới → sinh `Proposal` (`field_update` | `timeline_entry`)"* và bảng bất biến có I-5/I-11/I-12 — tức đã đọc kỹ hai loại proposal — mà **vẫn không thấy** I-7 của phase 6 không có type nào để lưu. Cùng kiểu lỗi ADR-0008 đã ghi: hai mệnh đề mâu thuẫn nằm ở hai file khác nhau thì lọt.
- AI đề xuất gì mà đội không nghe: AI xếp phương án C (thông báo suông) là lựa chọn "0 dòng schema" đáng cân nhắc. Đội loại ngay vì nó đảo một ADR đã chốt mà không có bằng chứng mới.

## Đội đã verify bằng cách nào

**Đã làm** — đọc mã nguồn, ghi kèm vị trí để kiểm lại được:

1. **Đọc CHECK constraint thật, không đọc mô tả.** `packages/db/src/schema/proposals.ts:51-56` và `packages/db/migrations/0002_closed_cyclops.sql:53-55`: CHECK chỉ có hai nhánh, `field_update` bị ghim vào 4 ô. Xác nhận I-7 **bị CSDL từ chối**, không phải "chưa ai làm".
2. **Đọc danh sách cột của `GRANT INSERT`** (`0003_grants_ai_tables.sql:38-40`) và đếm: 9 cột liệt kê tường minh, `opportunity_id` chưa tồn tại ⇒ cột mới chắc chắn cần GRANT tay. Đây là suy luận từ ngữ nghĩa `GRANT` theo cột, và P4 vừa **đo thật** cùng cấu trúc này với `snapshot_variant` ([ADR-0022](0022-ban-chup-hien-tai-la-cot-text-tren-companies-khong-phai-enum-cua-ontology.md)) — nên lần này là suy luận **đã được kiểm nghiệm một lần trên chính repo này**, không phải suy diễn mới.
3. **Kiểm phương án B bằng dữ liệu seed, không bằng cảm giác.** `packages/db/src/seed/seed-data.ts:46` — Sakura `isWatched: true`. Đối chiếu I-5 ⇒ `timeline_entry` bị chặn cho đúng công ty mà plan dùng để diễn I-7. B chết bằng dữ liệu, không bằng lập luận.
4. **Kiểm "ngày hạn tính lúc nào" bằng bảng độ gấp I-9** (ontology mục 6): `funding` = 3 ngày. Gợi ý tồn 4 ngày trong hàng đợi rồi mới duyệt thì hạn tính từ lúc sinh đã quá khứ — ca này có thật vì vùng 2 không hết hạn.

**Đã đo, 13/08 21:28 — nợ ở trên đã trả:** migration chạy trên `crm_test`, 13 test tầng CSDL xanh (`apps/api/src/domain/proposal/__tests__/proposal-boundary-check-and-grants.test.ts`). CHECK ba nhánh từ chối đúng ba ca sai (`next_step` thiếu `opportunity_id` · `field_update` kèm `opportunity_id` · `timeline_entry` kèm `target_field`), và phép đo đột biến GRANT **chạy trong chính test 13**: REVOKE `INSERT (opportunity_id)` ⇒ `permission denied`, GRANT lại ⇒ xanh.

**Một điều không lường được, phát hiện lúc code:** `ALTER TYPE ... ADD VALUE 'next_step'` rồi **dùng** giá trị đó trong cùng transaction bị Postgres từ chối (55P04), mà drizzle chạy mọi migration trong một transaction — nên trên CSDL mới (mỗi lần chạy test, mỗi lần giám khảo diễn lại) migration sẽ vỡ. CHECK phải so `proposal_type::text = 'next_step'`; so kiểu enum thì không chạy được. Ghi vào comment của `packages/db/src/schema/proposals.ts` để P6/P7 không lặp lại.

## Rollback

Migration thêm-vào, không đổi cột cũ: `proposals` cũ đọc/ghi bình thường. Đảo lại = cắt `next_step` khỏi phase 5 và để I-7 sinh thông báo tạm (phương án C), mất ~15' ở tầng service, **không cần migration ngược** — giá trị enum thừa và cột NULL không làm gì cả. Đây cũng là món **cắt đầu tiên** của phase 5 nếu tới trưa 14/08 chưa xong.

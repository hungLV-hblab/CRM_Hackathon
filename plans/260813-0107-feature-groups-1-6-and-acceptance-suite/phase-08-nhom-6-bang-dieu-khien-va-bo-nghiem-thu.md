---
phase: 8
title: "Nhóm 6 — bảng điều khiển + đóng bộ nghiệm thu 10 điểm"
status: pending
priority: P1
dependencies: [5, 6, 7]
owner: cả đội
estimate: 4h
---

# Phase 8: Nhóm 6 — bảng điều khiển + đóng bộ nghiệm thu 10 điểm

## Overview

Hai việc, làm cùng lúc vì cả hai đều cần mọi nhóm khác đã đứng: **bảng điều khiển Quản trị** (đọc số, chỉnh tham số, một cái phanh) và **đóng nốt T-9, T-10** cho bộ nghiệm thu chạy đủ 10 điểm bằng một lệnh.

Cộng **một lỗ sản phẩm phải bịt** mà P6 để lại — ô sửa nhanh Việc tiếp theo, xem mục dưới.

Đây là phase cuối trước **freeze tối 14/08**.

## Lỗ P6 để lại — ô sửa nhanh Việc tiếp theo

**Sales không có chỗ nào tự gõ Việc tiếp theo trên web.** Phát hiện ở phiên 7 (grep `nextStepText` trong `apps/web/src` ra 2 file, **cả hai chỉ hiển thị**; form tạo cơ hội cũng không có ô), và P6 đóng xong thì **nặng thêm chứ không nhẹ đi**: bấm Hoàn tác trả ô về trống, và từ đó không có đường nào điền lại bằng tay. Ca I-7 của demo chạy được là nhờ **seed** đặt sẵn `next_step_source: 'human'`, không phải nhờ sản phẩm.

Vì sao nó thuộc P8 chứ không phải "nên có":

- **Luật 5 nói Việc tiếp theo là nhịp tim của deal.** Một CRM mà Sales không gõ được nhịp tim của chính deal mình thì vòng 2 hỏi đúng một câu là lộ.
- **Nó là nửa còn lại của vùng tự chủ 3.** Hoàn tác trả ô về trạng thái trước; nếu Sales không điền lại được thì "sửa lại phải dễ hơn cả lúc máy làm" chỉ đúng một nửa.
- **I-7 chỉ quan sát được nếu có đường người gõ thật.** Hiện chỉ chứng minh được bằng seed.

Phạm vi tối thiểu — **không** làm hơn:

- Một ô text + ô ngày trên thẻ cơ hội (hoặc trong màn chi tiết công ty), gọi `PATCH /opportunities/:id` đã có. **Không endpoint mới, không DTO mới**: `updateOpportunity` đã ghi `nextStepText` + `nextStepDueDate` và đã tự đặt `nextStepSource = 'human'` khi có text (`opportunity-service.ts:127-132`).
- Gõ đè ô do máy điền là **hợp lệ và có chủ ý** — nó trả quyền sở hữu ô về cho người (I-7 đọc `next_step_source` ở lần ghi sau). Đã có test ở P6 (test 11).
- Sau khi lưu phải `invalidateQueries` cả `['opportunities']` lẫn `['auto-next-steps']`, không thì dấu hiệu máy còn nằm lại trên ô người vừa gõ.

Ước lượng ~30'. **Cắt cuối cùng**, sau mọi món trong danh sách cắt của `plan.md` — nhưng cắt nó thì phải nói thẳng với BGK là Sales chưa gõ được Việc tiếp theo, không để họ tự phát hiện.

## Requirements

- Functional: một màn hình gom đủ chỉ số theo **đúng tên** ở [ontology mục 7](../../docs/ontology.md#7-chỉ-số-đo-từ-ngày-đầu); chỉnh `watch_cycle_seconds` (hiện đơn vị + mặc định + một câu giải thích đổi nó thì cái gì đổi theo), hiệu lực ngay; **một nút tắt toàn bộ AI**, hiệu lực ngay không cần chạy lại; Sales thấy banner khi AI tắt; mỗi lần bật/tắt ghi vết.
- Non-functional: `pnpm test` chạy đủ 10 điểm bằng một lệnh, kết quả in ra rõ ràng (hạng mục nộp bài số 4).

## Chỉ số — đúng tên, không để BGK tự suy

| Chỉ số | Công thức |
| --- | --- |
| **Auto-accept rate** | `accept / (accept + edit + reject)` |
| **Error-detection rate** | `(reject[wrong_info] + reject[misread_context] + số lần Hoàn tác + số lần xoá mục hệ thống) / tổng output AI` |
| Tỉ lệ sửa-rồi-duyệt | `edit / tổng` — **tách bạch** khỏi accept (I-12) |
| Phân bố lý do bỏ · phân bố mức chắc chắn | đếm theo `reject_reason` · theo `confidence` |
| Thời gian quyết trung bình | trung vị `seconds_to_decide` — hiện **cạnh** error-detection rate, vì thấp có thể là giao diện tốt mà cũng có thể là bấm mù |
| Tỉ lệ hoàn tác | `undone / tổng AutoNextStepEvent` |

**"Số lần xoá mục hệ thống" lấy ở đâu** — hợp đồng P7 chốt 14/08 02:35 và **đã chạy thật từ 14/08 03:38** (P7 đóng, có test cho cả bốn nhánh của I-13), đừng suy lại: `SELECT count(*) FROM audit_events WHERE action = 'delete_system_timeline_entry'`. Lý do xoá nằm ở `detail->>'reason'` (P7 bắt buộc Sales gõ), nên phân bố lý do xoá là số **có sẵn** nếu bảng điều khiển muốn hiện cạnh phân bố lý do Bỏ.

## Files

| Tạo/sửa | Vai trò |
| --- | --- |
| `apps/api/src/domain/metrics/*` | truy vấn chỉ số |
| `apps/api/src/settings/*` | mở rộng: bật/tắt AI ghi `AuditEvent` |
| `apps/web/src/app/quan-tri/page.tsx` | bảng điều khiển |
| `apps/web/src/components/ai-disabled-banner.tsx` | banner Sales thấy khi AI tắt |
| `apps/web/src/app/co-hoi/opportunity-card.tsx` *(file của B)* | ô sửa nhanh Việc tiếp theo + ngày hạn — dùng `PATCH /opportunities/:id` đã có, không thêm endpoint |
| `e2e/t9-ai-kill-switch.spec.ts`, `apps/api/src/__tests__/t10-*.test.ts` | T-9, T-10 đầy đủ |

## Implementation steps

1. Truy vấn chỉ số + màn hình Quản trị.
2. Nút tắt AI: hiệu lực ngay, ghi `AuditEvent` cả hai chiều. Phạm vi đúng [ADR-0009](../../docs/decisions/0009-pham-vi-nut-tat-ai-chi-dung-sinh-moi.md): chỉ dừng **sinh mới**; hàng đợi tồn vẫn duyệt được.
3. Banner cho Sales — nói rõ tính năng gợi ý đang tắt, **không im lặng biến mất**.
4. **T-9**: bấm tắt trong lúc vòng quét đang chạy → 2 chu kỳ sau không thêm mục nào, không sinh gợi ý, không tự đặt; dữ liệu đã sinh còn nguyên; Sales thấy banner; bật lại chạy tiếp; cả hai lần có ghi vết.
5. **T-10 đầy đủ**: mở rộng T-10 mini thành ba nhánh — đổi giai đoạn · đổi giá trị tiền · xoá công ty, dưới `actor = system`, **không đi qua UI**. Cả ba bị từ chối ở **hai lớp**. Thêm khẳng định thứ tư: **không tồn tại adapter gửi thư/tin nhắn nào trong mã nguồn** (ranh giới 3, ontology mục 5).
6. **Ô sửa nhanh Việc tiếp theo** trên thẻ cơ hội (xem mục "Lỗ P6 để lại"). Dùng `PATCH /opportunities/:id` sẵn có; invalidate cả `['opportunities']` và `['auto-next-steps']`.
7. Chạy `pnpm test` full + `pnpm lint` + `pnpm typecheck` + `pnpm build`, rồi nghiệm thu tay 6 điểm của plan skeleton một lần nữa trên stack mới.
8. Rà [Definition of Done](../../CLAUDE.md#7-definition-of-done) cho từng nhóm: có test · có provenance · proposal có accept/reject + metric · có ADR · **có người ngoài người viết giải thích lại được**.

## Validation

- [ ] 10/10 điểm nghiệm thu xanh bằng **một lệnh** `pnpm test`
- [ ] T-9 xanh trên stack production sau Caddy
- [ ] T-10 ba nhánh xanh, chặn ở **cả hai lớp** (bỏ lớp domain → vẫn đỏ nhờ lớp CSDL)
- [ ] Khẳng định "không có adapter gửi tin" xanh
- [ ] Đổi `watch_cycle_seconds` từ UI Quản trị → nhịp đổi, **không** restart
- [ ] Tắt AI → Sales thấy banner; dữ liệu đã sinh còn nguyên; hàng đợi tồn vẫn duyệt được
- [ ] Chỉ số hiện **đúng tên** ontology mục 7; `edit` không cộng vào `accept`
- [ ] `pnpm lint` · `pnpm typecheck` · `pnpm build` sạch
- [ ] 6 điểm nghiệm thu của plan skeleton chạy lại vẫn đạt
- [ ] Sales gõ được Việc tiếp theo + ngày hạn từ giao diện; ô lưu xong mang `next_step_source = 'human'`
- [ ] Gõ đè ô do máy điền → dấu hiệu máy và nút Hoàn tác **biến mất ngay**, không phải tải lại trang

## Risks

| Rủi ro | Xử lý |
| --- | --- |
| Dồn quá nhiều vào phase cuối → freeze trượt | T-1…T-8 đã viết ở phase của chúng (luật 4 của plan). P8 chỉ gom, T-9 và T-10 |
| Tắt AI nhưng vòng quét vẫn chạy dở một lượt | Kiểm `ai_enabled` **đầu mỗi lượt** và trước mỗi lần ghi, không chỉ lúc hẹn nhịp |
| Chỉ số tính sai vì đếm `edit` vào `accept` | I-12 đã có test ở P5; P8 chỉ đọc |
| Q-6 (Admin thao tác CRM) còn treo | Tạm: Admin xem tất cả, không sửa dữ liệu Sales. Ghi 1 dòng vào ADR nếu BGK hỏi |
| Ô sửa nhanh chạm `opportunity-card.tsx` — file B vừa đóng ở P3, P6 đã chèn một chỗ | Sửa nhỏ, pull trước khi push, không refactor. Không đụng `OpportunityDto`/`SELECTION`/`toDto` (ADR-0027 giữ nguyên) |

## Rollback

Bảng điều khiển là màn hình chỉ đọc + 2 tham số → bỏ biểu đồ, giữ số thô. Nút tắt AI **không được bỏ** (T-9 chấm trực tiếp). Ô sửa nhanh bỏ được không để lại dấu vết (không migration, không endpoint mới) — nhưng bỏ thì phải nói ra, xem mục "Lỗ P6 để lại".

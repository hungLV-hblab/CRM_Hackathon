---
title: "Phân quyền theo người phụ trách toàn hệ thống · /thong-bao trang riêng · Phân trang"
status: pending
created: 2026-08-15
revised: 2026-08-15
mode: tdd
scope: project
blockedBy: []
blocks: []
source: plans/2026-08-15-queue-authz-notification-redesign-pagination/brainstorm-report.md
redTeam: reports/from-code-reviewer-to-planner-red-team-four-lens-plan-review-report.md
---

# Plan — Phân quyền theo người phụ trách · Thiết kế lại /thong-bao · Phân trang

**Bản viết lại sau red team 4 lăng kính.** Bản đầu bị bác vì (a) đảo ngược ADR-0033 + ADR-0045 + `ontology.md:18` mà không supersede, (b) làm đỏ T-5/T-9, (c) dựng hàng rào nửa vời — chặn đọc gợi ý nhưng để ngỏ đường ghi chéo chủ sở hữu. Bản này sửa cả ba. Báo cáo: [red team](reports/from-code-reviewer-to-planner-red-team-four-lens-plan-review-report.md).

**Quyết định của người dùng (15/08):** làm đầy đủ, không lấy lát cắt tối thiểu; chấp nhận vượt mốc 15:00; vá lỗ `undo()` ngay.

## Nguyên tắc chi phối bản này

1. **Hàng rào kín hoặc không có hàng rào.** Một sale không được thấy dữ liệu của công ty ngoài phạm vi qua *bất kỳ* đường nào — hàng đợi, bằng chứng thô, dòng thời gian, danh sách công ty, cơ hội — và không được ghi vào deal của người khác. Chặn một nửa còn tệ hơn không chặn, vì nó tạo ra màn hình nói dối.
2. **Cổng phân quyền fail-closed.** `Actor.role` là optional (`actor-context.ts:22`). Mọi cổng viết theo chiều "thu hẹp trừ khi là admin", và actor người không có role thì **ném lỗi**, không rơi vào nhánh rộng.
3. **Logic vai ở controller, scope truyền xuống tường minh** — theo đúng tiền lệ `OverviewController` đã ship sáng nay và ADR-0045 ("logic vai nằm ở controller"). Service nhận `ownerId?`, không tự đọc role.
4. **Một tầng, và nói thật là một tầng.** `crm_app` giữ `GRANT ALL`, repo không có RLS. Luật này chỉ sống ở tầng domain. ADR phải ghi thẳng như vậy, không mượn uy tín hai-tầng của ADR-0010.
5. **Bài nghiệm thu được di trú TRƯỚC, không sửa vá sau.** T-5/T-9 phải xanh với cấu hình mới trước khi authz landing.

## Phases

| # | Phase | Status | Phụ thuộc |
| --- | --- | --- | --- |
| 1 | [ADR + contract + cổng build](phase-01-adr-contracts-and-build-gate.md) | pending | — |
| 2 | [Cổng phân quyền fail-closed](phase-02-fail-closed-owner-scope-gate.md) | pending | 1 |
| 3 | [Di trú bài nghiệm thu T-5 · T-9](phase-03-acceptance-suite-migration.md) | pending | — |
| 4 | [Phân quyền đường ĐỌC](phase-04-read-path-authorization.md) | pending | 2, 3 |
| 5 | [Phân quyền đường GHI (gồm lỗ undo)](phase-05-write-path-authorization.md) | pending | 2, 3 |
| 6 | [Thông báo — API](phase-06-notification-api.md) | pending | 1 |
| 7 | [/thong-bao — trang riêng](phase-07-notification-page-redesign.md) | pending | 6 |
| 8 | [/cong-ty — phân trang](phase-08-company-list-pagination.md) | pending | 1, 4 |
| 9 | [Hàng đợi — bộ lọc giao diện](phase-09-queue-ui-filters.md) | pending | 4 |

Phase 3 độc lập, chạy được ngay và **phải xong trước** 4 & 5. Phase 6→7 là một mạch (đổi shape response). Phase 8 sau phase 4 vì cả hai sửa `company-service.list`. Phase 9 cần `ownerId`/`ownerName` mà phase 4 thêm vào `ProposalDto`.

Ba nhánh độc lập nhau, chia được cho ba người sau khi phase 1 xong: **phân quyền** (2→3→4→5→9) · **thông báo** (6→7) · **phân trang công ty** (8).

## Acceptance criteria (toàn plan)

**Phân quyền — kín cả hai chiều:**
- Sale không thấy, qua *mọi* endpoint, dữ liệu công ty ngoài phạm vi: `/proposals`, `/proposals/pending-summary`, `/companies`, `/companies/:id`, `/companies/:id/reading-zone`, `/companies/:id/timeline`, `/opportunities`, `/opportunities/auto-next-steps`.
- Sale không ghi được vào phạm vi người khác: `POST /proposals/:id/decide`, `POST /auto-next-step-events/:id/undo`, `PATCH /companies/:id`, `DELETE /companies/:id`.
- Actor người **không có role** không thấy gì và không ghi được gì (fail-closed), có test riêng.
- Admin giữ nguyên toàn quyền như trước (ADR-0033 vẫn đúng phần "Admin = Sales về quyền CRM", chỉ thu hẹp phần "không có ma trận theo người sở hữu").
- Công ty chưa gán người phụ trách: theo **đúng pattern đã ship ở `/tong-quan`** — loại khỏi phạm vi của sale *và nói rõ đã loại bao nhiêu*, không im lặng giấu (luật 4).

**Thông báo:**
- `markRead`/`read-all` chỉ tác động thông báo của chính actor.
- `GET /notifications` phân trang envelope `{items,total,page,pageSize}` + `unreadOnly` parse đúng cả `"false"`.
- Query key mang tham số: `['notifications', {unreadOnly, page, pageSize}]`.
- `/thong-bao`: chưa đọc phân biệt đã đọc **bằng chữ, không chỉ bằng màu**; nút "Đánh dấu tất cả đã xem"; Hoàn tác trong hạn 7 ngày; chuyển trang; **không thông báo nào còn hạn hoàn tác mà không tới được từ UI**.

**Phân trang:**
- `/cong-ty` + `/thong-bao` phân trang server-side; sắp xếp có khoá phụ `id` để không trùng/sót dòng.
- Cả 5 nơi gọi `listCompanies` được xử lý tường minh, không nơi nào im lặng bị cắt còn 20 dòng.

**Toàn cục:** `pnpm test` + `pnpm typecheck` + `pnpm build` xanh. Toàn bộ T-1..T-10 xanh.

## Tài liệu phải sửa (không được quên)

Đây là phần bản đầu bỏ sót và là finding Critical của 4/4 reviewer:

- `docs/ontology.md:18` — câu "không làm phân quyền theo người sở hữu" thành sai sau plan này.
- `docs/ontology.md:326` — dòng tóm tắt ADR-0033.
- ADR-0033 — thêm trạng thái "bị thay thế một phần bởi ADR-0046"; điều kiện xem lại nó tự nêu ("seed có từ hai người sở hữu trở lên") **đã xảy ra**.
- ADR-0045 — phương án E bị lật; ghi rõ vì sao lật (BTC bổ sung yêu cầu lọc theo quyền sau khi ADR đó ký).
- `apps/api/src/domain/overview/overview-service.ts:16-20` — comment "The scoping is a VIEW, not authorization — every other screen still shows everything to everyone" thành sai.

## Rủi ro lớn nhất

| Rủi ro | Vì sao thật | Giảm thiểu |
| --- | --- | --- |
| T-5/T-9 đỏ ngày chấm | Kitefin + Ohara thuộc SALES2, mọi e2e đăng nhập SALES1 | Phase 3 làm trước, độc lập, xanh rồi mới cho phase 4/5 vào |
| T-6/T-7 đỏ vì refactor thông báo | T-7 assert bằng testid strip ngay trên `/thong-bao` | Phase 7 sửa spec **có chủ đích**, giữ testid ổn định + dấu hiệu bằng chữ |
| Hàng rào nửa vời lọt lưới | 5+ endpoint cùng phát một nội dung | Phase 4 liệt kê đủ endpoint; có test "quét" theo danh sách |
| Cổng fail-open | `role` optional | Phase 2 dựng cổng dùng chung + test actor không role |
| Vượt deadline, sản phẩm dở dang giữa chừng | Plan 8 phase trong ngày chấm | Phase 3, 6 là điểm dừng an toàn: đến đó suite vẫn xanh, chưa đổi hành vi phân quyền |

## Điểm dừng an toàn

Nếu hết thời gian, dừng ở ranh giới phase **không** để hệ thống ở trạng thái nửa vời:

- Sau **phase 3**: chưa đổi gì về quyền, chỉ e2e bền hơn. An toàn tuyệt đối.
- Sau **phase 5**: hàng rào kín cả đọc lẫn ghi. An toàn.
- Sau **phase 7**: thông báo xong.
- **Không được dừng giữa phase 4** (đọc đã chặn, ghi chưa) — đó đúng là trạng thái nửa vời mà red team cảnh báo.
- Phase **8** là phase đầu tiên nên cắt nếu hết giờ: giá trị thấp nhất (5 dòng dữ liệu), bán kính ảnh hưởng rộng nhất (6 nơi gọi + 2 test + T-8).

## Red Team Review

### Phiên — 2026-08-15
**Findings:** 35 thô → 17 sau gộp (17 chấp nhận, 0 bác — tất cả đều có trích dẫn `file:line` qua bộ lọc bằng chứng)
**Mức độ:** 9 Critical · 6 High · 2 Medium

| # | Finding | Mức | Xử lý | Áp vào |
| --- | --- | --- | --- | --- |
| 1 | Đảo ngược ADR-0033 + ADR-0045 + `ontology.md:18` không supersede | Critical | Chấp nhận | Phase 1 |
| 2 | T-5 · T-9 đỏ vì Kitefin/Ohara thuộc SALES2 | Critical | Chấp nhận | Phase 3 (phase riêng, làm trước) |
| 3 | Lỗ ghi chéo chủ sở hữu qua `undo()` + `listActive()` | Critical | Chấp nhận | Phase 4 + 5 |
| 4 | `reading-zone` / `timeline` phát nguyên bằng chứng, không scope | Critical | Chấp nhận | Phase 4 |
| 5 | Badge `pendingSummary` nói dối nếu chỉ scope một nửa | Critical | Chấp nhận | Phase 4 |
| 6 | Cổng phân quyền fail-OPEN vì `role` optional | Critical | Chấp nhận | Phase 2 (cổng dùng chung) |
| 7 | Đổi shape `listCompanies` gãy 5 nơi gọi (plan liệt kê 1) | Critical | Chấp nhận | Phase 8 |
| 8 | Hai test API tiêu thụ shape cũ, gãy typecheck | Critical | Chấp nhận | Phase 6 + 8 |
| 9 | Tiêu chí "T-6/T-7 không gãy" bất khả thi theo cấu trúc | Critical | Chấp nhận | Phase 7 (sửa T-7 có chủ đích) |
| 10 | `z.coerce.boolean()` → `"false"` thành `true` | High | Chấp nhận | Phase 1 (`booleanQuerySchema`) + 6 |
| 11 | Một cache key cho hai truy vấn khác nhau | High | Chấp nhận | Phase 6 (chốt key) + 8 (`company-facets`) |
| 12 | Không có tầng CSDL đỡ lưng, khác mọi ranh giới khác | High | Chấp nhận | Phase 1 (ADR nói thật) |
| 13 | Tiền đề "hai list tăng vô hạn" là sai sự thật | High | Chấp nhận | Phase 1 (ADR-0047 sửa lý do) + 8 |
| 14 | Trạng thái tạm phase 6 cắt `/thong-bao` còn 20 dòng | High | Chấp nhận | Phase 6 (`pageSize=100`) |
| 15 | `apps/web` không có test nào, không trong vitest workspace | High | Chấp nhận | Phase 6 (bỏ tiêu chí ảo) |
| 16 | Offset không khoá phụ, `total` lệch nhịp, không có fixture >20 | Medium | Chấp nhận | Phase 1 (ADR-0047) + 6 + 8 |
| 17 | Thiếu lọc `deletedAt` trong đúng `where` đang sửa | Medium | Chấp nhận | Phase 4 |

Sai sót sự thật đã sửa trong bản này: số ADR kế tiếp là **0039** (không phải sau 0036); convention tên file `NNNN-slug.md`; plan demo-login **đã ship** (không phải pending); `Select` nằm trong `input.tsx` (không có `select.tsx`); `dto/notification.ts` đã tồn tại; `domain/notification/__tests__` chưa tồn tại; `contracts/dist` bị gitignore nên cần cổng build.

### Whole-Plan Consistency Sweep

- Xoá 6 file phase của bản cũ (`phase-01-adr-and-pagination-contract` … `phase-06-company-list-pagination`) để thư mục không mang hai bộ phase mâu thuẫn.
- Bổ sung phase 9: yêu cầu số 2 của người dùng (bộ lọc `/hang-doi`) bị đánh rơi khi cấu trúc lại phase; nay đã có phase riêng phụ thuộc phase 4.
- Đối chiếu lại: mọi phase đều dùng cùng một cổng `ownerScopeFor` (phase 2), cùng một `booleanQuerySchema` (phase 1), cùng một quy ước cache key (phase 6), cùng một quy tắc khoá phụ khi sắp xếp (ADR-0047).
- **Không còn mâu thuẫn tồn đọng.**

## Rollback

Tập revert: {1,2,4,5} đi cùng nhau (phân quyền); {1,6,7} đi cùng nhau (thông báo); {1,8} (phân trang công ty). Phase 3 giữ lại được độc lập. Không migration → không rollback schema. Lưu ý `read-all` là ghi một chiều: revert commit không khôi phục `read_at` về NULL, đường reset duy nhất là `pnpm reset && pnpm seed`.

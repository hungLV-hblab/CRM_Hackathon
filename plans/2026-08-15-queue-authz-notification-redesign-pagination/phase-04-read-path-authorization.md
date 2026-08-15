---
phase: 4
title: "Phân quyền đường ĐỌC"
status: pending
priority: P1
dependencies: [2, 3]
---

# Phase 4: Phân quyền đường ĐỌC

## Overview

Đóng **mọi** đường một sale có thể đọc dữ liệu ngoài phạm vi. Không phải chỉ hàng đợi — red team chứng minh rằng chặn hàng đợi mà để hở `reading-zone` là chặn hình thức, vì với gợi ý loại `timeline_entry` thì `proposedValue` **chính là** `claim.statement` (`proposal-service.ts:288`), và `reading-zone` phát nguyên statement + quoteText + offset.

**Không được dừng giữa phase này.** Đọc đã chặn mà ghi chưa chặn (phase 5) là trạng thái nửa vời tệ hơn cả hai đầu.

## Requirements

- Functional: 8 endpoint dưới đây scope theo `ownerScopeFor(actor)`; admin không đổi hành vi.
- Non-functional: logic vai ở **controller**, service nhận `ownerId?: string | null`; công ty chưa gán người phụ trách bị loại **và được đếm rồi nói ra**.

## Bề mặt phải đóng (đủ, không thiếu)

| Endpoint | File | Hiện trạng |
| --- | --- | --- |
| `GET /proposals` | `proposal-service.ts:365-381` | join `companies` sẵn, thiếu owner **và thiếu `deletedAt`** |
| `GET /proposals/pending-summary` | `proposal-service.ts:388-396` | chưa join `companies` |
| `GET /companies` | `company-service.ts:51-70` | có `deletedAt`, thiếu owner |
| `GET /companies/:id` | `company-service.ts` (`byId`) | thiếu owner |
| `GET /companies/:companyId/reading-zone` | `observation-service.ts:372-385` | **không nhận actor** |
| `GET /companies/:companyId/timeline` | `timeline.controller.ts:26-29` | không scope |
| `GET /opportunities` | `opportunity-service.ts:356-375` | join `companies`, thiếu owner |
| `GET /opportunities/auto-next-steps` | `auto-next-step-service.ts:325-341` | **không nhận actor**, phát mọi `eventId` + `quoteText` |

`listActive()` nằm ở đây (đường đọc) nhưng nó là tiền đề của lỗ ghi ở phase 5: nó phát ra chính `eventId` mà `undo()` không kiểm tra chủ sở hữu.

## Quyết định phải chốt trong phase — badge gợi ý chờ

Scope `pendingSummary` mà không scope `GET /companies` sẽ tạo màn hình **nói dối**: sale2 thấy hàng Sakura (của sale1) nhưng `PendingProposalMarker` render `null` → người đọc hiểu "Sakura không có gì chờ", một câu sai. Luật 4 CLAUDE.md cấm đúng điều này.

Phase này scope **cả hai**, nên hàng Sakura biến mất khỏi `/cong-ty` của sale2 và mâu thuẫn tự tiêu. Nhưng phải kiểm 5 nơi tiêu thụ map để không nơi nào hiểu nhầm "vắng mặt" thành "bằng 0":

`nav-list.tsx:27` (badge sidebar) · `opportunity-card.tsx:102` · `cong-ty/page.tsx:55` · `cong-ty/[id]/page.tsx:56` · `pending-proposal-marker.tsx:21`

## Related Code Files

- Modify: `apps/api/src/domain/proposal/proposal-service.ts`, `proposal.controller.ts`
- Modify: `apps/api/src/domain/company/company-service.ts`, `company.controller.ts`
- Modify: `apps/api/src/domain/observation/observation-service.ts`, `observation.controller.ts`
- Modify: `apps/api/src/domain/timeline/timeline-service.ts`, `timeline.controller.ts`
- Modify: `apps/api/src/domain/opportunity/opportunity-service.ts`, `opportunity.controller.ts`
- Modify: `apps/api/src/domain/opportunity/auto-next-step-service.ts` (`listActive`), `auto-next-step.controller.ts`
- Modify: `apps/api/src/domain/overview/overview-service.ts:16-20` (comment "scoping is a VIEW, not authorization" thành sai)
- Create: `apps/api/src/domain/proposal/__tests__/owner-scoped-read-paths.test.ts`
- Modify: `packages/contracts/src/dto/proposal.ts` (thêm `ownerId`/`ownerName` cho dropdown phase sau)
- Modify: `apps/api/src/domain/company/__tests__/company-search-and-filter.test.ts` (nếu phase 8 đổi shape trước)

## Implementation Steps

1. **Test đỏ trước** — một file quét theo **danh sách endpoint**, không phải theo từng service, để không endpoint nào bị bỏ quên:
   - Với mỗi endpoint trong bảng trên: sale1 gọi trên dữ liệu của sale2 → rỗng hoặc 404; admin → đầy đủ.
   - Actor người **không role** → mọi endpoint từ chối (nối vào cổng phase 2).
   - Gợi ý của công ty **đã xoá mềm** không xuất hiện (`deletedAt` — lỗ sẵn có ngay trong mệnh đề `where` đang sửa).
   - `reading-zone` của công ty sale2: sale1 → 404/rỗng, và **không** rò `quoteText` trong body.
   - Công ty `ownerId = null`: sale không thấy, admin thấy, và số bị loại được trả ra để UI nói được.
   - Harness: copy mẫu `apps/api/src/domain/overview/__tests__/overview-owner-scoping.test.ts` (supertest + `seed()` + cookie login) — `domain/notification/` và `domain/proposal/` **chưa có** thư mục `__tests__` cho kiểu test này.
2. Sửa từng service theo thứ tự bảng; controller đọc `ownerScopeFor(actor)` rồi truyền xuống.
3. Thêm `ownerId`/`ownerName` vào `ProposalDto` (leftJoin `users`; `users` đã export từ `@crm/db`).
4. Sửa comment `overview-service.ts:16-20`.
5. Rà 5 nơi tiêu thụ `pendingSummary`.
6. Chạy: test mới → toàn bộ test API → `pnpm typecheck` → toàn bộ e2e.

## Success Criteria

- [ ] Cả 8 endpoint trong bảng có test chứng minh scope; không endpoint nào chỉ "được sửa" mà không có test
- [ ] Actor không role bị từ chối ở mọi endpoint
- [ ] Không còn khẳng định nào trong code/doc nói "scoping là view, không phải authorization"
- [ ] T-1..T-10 xanh

## Risk Assessment

- **Bỏ sót endpoint** là chế độ hỏng chính. Test viết theo danh sách bảng, và bảng phải được kiểm lại bằng grep các controller trước khi bắt đầu.
- Scope `GET /companies` đổi hành vi nhiều màn (`/dang-theo-doi`, command palette, `/co-hoi`) — chạy e2e đầy đủ, không chỉ test API.
- Nếu hết giờ giữa phase: **không dừng ở đây**, làm tiếp phase 5 hoặc revert cả hai.

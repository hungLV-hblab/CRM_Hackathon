---
phase: 3
title: "Di trú bài nghiệm thu T-5 · T-9"
status: pending
priority: P1
dependencies: []
---

# Phase 3: Di trú bài nghiệm thu T-5 · T-9

## Overview

Làm cho T-5 và T-9 sống sót qua phân quyền, **trước khi** phân quyền vào. Phase này không đổi một dòng hành vi sản phẩm nào — chỉ đổi bài test thao tác trên tài khoản nào — nên nó chạy được ngay và là điểm dừng an toàn tuyệt đối.

Đây là finding Critical mà 3/4 reviewer nêu độc lập, và là chỗ bản plan đầu sai nặng nhất: nó chỉ kiểm tra công ty có *thiếu* owner không, không hỏi owner *là ai*.

## Vấn đề chính xác

| Bài | Đăng nhập | Công ty thao tác | Owner thật |
| --- | --- | --- | --- |
| T-5 | `sales@hblab.vn` = SALES1 (`t5-proposal-queue-decisions.spec.ts:15`) | `Kitefin Analytics` (`:21`) | **SALES2** (`seed-data.ts:90`) |
| T-5 | cùng trên | `Sakura Manufacturing KK` (`:23`, `EDIT_COMPANY`) | **SALES1** (`seed-data.ts:56`) |
| T-9 | `sales@hblab.vn` = SALES1 (`t9-ai-kill-switch.spec.ts:39`) | `Ohara Retail Group` (`watch-cycle-scenario.ts:241`) | **SALES2** (`seed-data.ts:101`) |

T-5 chạm **cả hai** chủ sở hữu trong một spec, nên đổi tài khoản đăng nhập sang SALES2 chỉ chuyển vế bài toán chứ không giải.

## Requirements

- Functional: T-5, T-9 xanh cả trước và sau khi phase 4/5 vào.
- Non-functional: **không đổi `seed-data.ts`** nếu tránh được — thế chia 2/2/1 là nền của `overview-owner-scoping.test.ts` và `dashboard-role-view.spec.ts` mà ADR-0045 vừa chốt. Đổi owner của Kitefin/Ohara sẽ làm đỏ hai thứ đó.

## Architecture — hai phương án, chọn A

**A. Đăng nhập bằng `admin@hblab.vn` cho T-5 và T-9.** Tài khoản đã có trong `DEMO_ACCOUNTS` (`demo-accounts.ts:25`). Admin thấy mọi công ty nên cả `Kitefin` lẫn `Sakura` đều hiển thị, không cần đụng seed, không đụng thế chia 2/2/1.
- Đánh đổi: T-5 và T-9 không còn kể câu chuyện "một Sales duyệt gợi ý" mà là "một người có quyền duyệt gợi ý". Vai trò không phải điều T-5/T-9 chứng minh (chúng chứng minh cơ chế duyệt và kill-switch), nên chấp nhận được — **nhưng phải ghi vào ADR-0046 phần "Hệ quả"**, không lặng lẽ đổi.

**B. Đổi `SEEDED_PROPOSAL_COMPANY` và `COMPANY` sang công ty của SALES1.** Giữ được câu chuyện Sales, nhưng: Kitefin được chọn có lý do đã ghi trong spec (`t5:18` — website trống nên là bài "điền ô còn trống"; `:18` — "No other spec reads Kitefin, which keeps this one independent of run order"), Ohara cũng vậy (`watch-cycle-scenario.ts:236` — không watched, snapshot rỗng). Đổi sang công ty khác phải tìm công ty của SALES1 thoả cùng tính chất, mà SALES1 chỉ có Sakura (watched, đang dùng làm `EDIT_COMPANY`) và Nimbus (watched, dùng ở T-6/T-7). Không có ứng viên sạch.

→ **Chọn A.** Nếu khi làm phát hiện A vỡ ở chỗ nào chưa lường, quay lại B và ghi lý do.

## Related Code Files

- Modify: `e2e/t5-proposal-queue-decisions.spec.ts` (tài khoản đăng nhập)
- Modify: `e2e/t9-ai-kill-switch.spec.ts` (tài khoản đăng nhập ở bước hàng đợi)
- Modify (nếu cần): `e2e/watch-cycle-scenario.ts` (helper đăng nhập dùng chung)
- Đọc để đối chiếu, **không sửa**: `packages/db/src/seed/seed-data.ts`, `apps/api/src/domain/overview/__tests__/overview-owner-scoping.test.ts`, `e2e/dashboard-role-view.spec.ts`

## Implementation Steps

1. Đọc trọn `t5-proposal-queue-decisions.spec.ts` và `t9-ai-kill-switch.spec.ts` — liệt kê **mọi** công ty mỗi spec chạm và owner của nó. Không đoán.
2. Đổi tài khoản đăng nhập sang `admin@hblab.vn` (mật khẩu `DEMO_PASSWORD`).
3. Grep toàn bộ `e2e/` tìm spec khác chạm `/hang-doi`, `/proposals`, `reading-zone`, `auto-next-steps` dưới tài khoản sales — lập bảng owner tương tự. Ứng viên đã biết: `t9-ai-kill-switch.spec.ts:148-152`.
4. Chạy **toàn bộ** `pnpm test:e2e` (cần stack `:8080`) — phải xanh y như trước khi sửa, vì phase này chưa đổi hành vi sản phẩm.
5. Ghi bảng owner tìm được vào phase 4 để bước sau không phải dò lại.

## Success Criteria

- [ ] Bảng "spec → công ty → owner" đầy đủ cho mọi e2e chạm dữ liệu bị phân quyền
- [ ] `pnpm test:e2e` xanh **trước khi** phase 4/5 bắt đầu
- [ ] `seed-data.ts` không đổi (hoặc nếu buộc phải đổi, `overview-owner-scoping.test.ts` + `dashboard-role-view.spec.ts` vẫn xanh)

## Risk Assessment

- Có thể còn spec khác chạm dữ liệu chéo chủ sở hữu mà chưa ai liệt kê — bước 3 là để bắt, và nó phải làm bằng grep chứ không bằng trí nhớ.
- T-5 chạy dưới admin có thể làm lộ một khác biệt hành vi khác giữa admin và sales mà hiện chưa ai đo. Nếu spec đỏ vì lý do **không** liên quan owner, dừng lại và báo — đó là phát hiện riêng, không phải việc của phase này.

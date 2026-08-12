---
phase: 4
title: "Seed bản chụp trước/sau + T-1"
status: pending
priority: P1
dependencies: [1]
owner: C
estimate: 2h
---

# Phase 4: Seed bản chụp trước/sau + T-1

## Overview

Bộ dữ liệu demo và **bộ bản chụp web hai phiên bản "trước" / "sau"**. Không có bản "sau" thì **T-6 và T-8 không test được** — hai điểm nghiệm thu nặng nhất của đề bài. Cộng với T-1 chạy khi AI đang tắt.

Quyết định chi phối: [ADR-0013](../../docs/decisions/0013-seed-theo-du-lieu-tu-dat-chap-nhan-migrate-khi-btc-giao-du-lieu.md) — dữ liệu tự đặt, dataset tách khỏi loader, khi BTC giao dữ liệu chỉ thay `seed-data.ts`.

## Requirements

- Functional: `pnpm seed` nạp công ty/liên hệ/cơ hội + bản chụp "trước" cho mọi công ty; có lệnh/cờ đổi một công ty sang bản chụp "sau"; chạy `pnpm seed` lần nữa đưa **mọi thứ về bản "trước"** và xoá sạch O/C/P/thông báo/nhật ký sinh trong demo (I-14).
- Non-functional: bản chụp là **file HTML tĩnh trong repo**, đánh dấu rõ là seed; không crawl mạng.

## Bộ bản chụp phải có

Đủ để diễn mọi kịch bản nghiệm thu, không nhiều hơn:

| Công ty | Loại | Bản "trước" | Bản "sau" | Dùng cho |
| --- | --- | --- | --- | --- |
| 1 | `tech_startup` | trang giới thiệu bình thường | thêm đoạn **gọi vốn** | T-6, T-7 (I-6: `funding` + có cơ hội mở → tự đặt) |
| 2 | `it_product` | bình thường | thêm đoạn **nhân sự cấp cao** | T-8 (mục dòng thời gian tự thêm) |
| 3 | `it_solution` | bình thường | **giống hệt bản trước** | I-3: đọc lại không tạo bản lưu, không gọi LLM |
| 4 | `traditional` | bình thường | thêm đoạn **mở rộng** | Nhóm 3: `expansion` → vào hàng đợi chứ không tự đặt (I-6) |
| 5 | bất kỳ | nguồn lỗi | — | `fetch_status = failed`, không đoán |

Cùng một tin `funding` ở công ty 1 (`tech_startup`) và một công ty `it_product` phải cho **câu nhận định khác nhau** — đó là chỗ Specs nhóm 2 đòi "đọc dưới góc loại công ty". Chuẩn bị dữ liệu để demo được đúng cặp này.

## Files

| Tạo/sửa | Vai trò |
| --- | --- |
| `packages/db/src/seed/snapshots/` | HTML tĩnh, đặt tên `cong-ty-N-truoc.html` / `-sau.html` |
| `packages/db/src/seed/seed-data.ts` | mở rộng: contact, bản chụp, cơ hội mở cho công ty 1 |
| `packages/db/src/seed/index.ts` | loader: dọn sạch vùng AI theo I-14; **giữ nguyên tính idempotent đã có test** |
| `packages/db/src/seed/switch-snapshot.ts` | đổi một công ty sang bản "sau" — dùng trong e2e và demo |
| `e2e/t1-crm-without-ai.spec.ts` | T-1 |

## Implementation steps

1. Viết bản chụp HTML — văn bản thật, đọc lên như trang công ty thật, mỗi bản "sau" có **đúng một** đoạn tin mới để câu trích chỉ được vào một chỗ.
2. Mở rộng `seed-data.ts` + loader; **chạy lại `seed-idempotent.test.ts` sau mỗi lần sửa** — test này là bằng chứng cho hạng mục nộp bài số 5.
3. Bổ sung dọn dẹp I-14: seed lần hai xoá `observations`, `claims`, `proposals`, `proposal_decisions`, `auto_next_step_events`, `notifications`, `watch_cycle_runs` và đưa công ty về bản "trước".
4. `switch-snapshot.ts`: đổi nguồn của một công ty, để T-6/T-8 gọi được từ e2e mà không sửa mã.
5. **T-1 e2e**: đặt `ai_enabled = false`, đi hết luồng nhóm 1 (tạo công ty/liên hệ/cơ hội, kéo qua ba giai đoạn có Đủ điều kiện + bỏ hai ô dấu hiệu, ghi hoạt động, tìm/lọc, mở tổng quan). Chờ P3 xong mới chạy xanh được — viết trước, để đỏ.

## Validation

- [ ] `pnpm seed` hai lần → trạng thái giống hệt (test cũ vẫn xanh sau khi mở rộng)
- [ ] Seed lần hai sau khi đã chạy demo → sạch vùng AI, công ty về bản "trước" (I-14)
- [ ] 5 công ty có đủ bản "trước"; 4 công ty có bản "sau"; công ty 3 bản "sau" **byte-identical** với bản trước
- [ ] Công ty 5 nạp vào cho `fetch_status = failed`
- [ ] T-1 xanh với `ai_enabled = false`, **không** chức năng nhóm 1 nào hỏng
- [ ] Dữ liệu seed đánh dấu rõ là seed, không lẫn dữ liệu người dùng nhập

## Risks

| Rủi ro | Xử lý |
| --- | --- |
| Bản "sau" có nhiều hơn một đoạn tin mới → claim nhảy vào nhiều chỗ, test giòn | Mỗi bản "sau" đúng **một** đoạn mới |
| I-14 xoá thiếu bảng → giám khảo diễn lại lần hai thấy dữ liệu cũ | Liệt kê bảng theo danh sách, thêm bảng mới thì thêm vào đây; test dọn dẹp đếm 0 dòng từng bảng |
| Dữ liệu BTC về giữa ngày | ADR-0013: thay `seed-data.ts`, không sửa loader |

## Rollback

Seed là dữ liệu, không phải cấu trúc: `pnpm reset` rồi seed lại.

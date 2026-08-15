---
phase: 5
title: "ADR + tài liệu"
status: pending
priority: P2
dependencies: [1, 2, 3, 4]
---

# Phase 5: ADR + tài liệu

## Overview

Cửa chốt. Code chạy đúng mà tài liệu vẫn nói khác = đúng bẫy vòng 2 (CLAUDE.md mục 5: "Output AI vào sản phẩm → có người verify + ghi cách verify vào ADR"). Việc này KHÔNG được cắt dù gấp giờ (xem `plan.md` mục cắt scope).

## Requirements

- ADR mới giải thích: vì sao `AdminImportService` được đọc `DATABASE_URL_OWNER`/mở kết nối `crm_owner` ngắn hạn — dù `client.ts` có comment tường minh nói ngược lại ("crm_owner is deliberately absent here... belongs to migrate.ts and seed/").
- ADR mới cũng phải nêu rõ (quyết định validate session 1, câu hỏi 2): I-16 sau khi đổi nguồn dữ liệu chỉ bảo vệ đúng bộ công ty của file zip checked-in mặc định (`packages/db/seed-assets/hackathon-1-data.zip`) — KHÔNG bảo vệ nếu admin upload qua UI một file khác. Đây là phạm vi có chủ đích, không phải lỗ hổng bị bỏ sót.
- ADR-0013 và ADR-0021 đánh dấu **Superseded**, trỏ tới ADR mới, không xoá (lịch sử quyết định phải giữ).
- `docs/ontology.md`: xác nhận `snapshot_pages` không cần thêm dòng nào (đúng loại hạ tầng như `company_sources`/`snapshotVariant`, đã có tiền lệ không liệt kê vào mục 3) — nếu team quyết định khác thì thêm 1 dòng ở mục 3.4 (Vận hành).
- `README.md`: cập nhật mục "Nạp dữ liệu demo" — thêm đường upload qua giao diện là cách chính giám khảo dùng, `pnpm seed` là cách dev-only.

## Related Code Files

- Create: `docs/decisions/0042-quyen-crm-owner-ngan-han-cho-import-tu-giao-dien.md` (số thứ tự = số ADR cao nhất hiện có + 1, kiểm `ls docs/decisions/` trước khi đặt tên)
- Modify: `docs/decisions/0013-seed-theo-du-lieu-tu-dat-chap-nhan-migrate-khi-btc-giao-du-lieu.md` — thêm dòng trạng thái "Superseded bởi ADR-0042"
- Modify: `docs/decisions/0021-ban-chup-demo-giu-dang-hang-so-typescript-khong-tach-thanh-file-html.md` — thêm dòng trạng thái "Superseded bởi ADR-0042", lý do: điều kiện xem lại ADR tự nêu (>5 công ty) đã xảy ra
- Modify: `README.md` — mục nạp dữ liệu demo

## Implementation Steps

1. **Viết ADR theo đúng khuôn `docs/decisions/adr-template.md`** — bắt buộc có mục "Phương án bị loại" (DI token `DRIZZLE_OWNER` sống lâu — lý do loại: bề mặt tấn công lớn hơn, xem phase 3 architecture) và mục "Đội đã verify bằng cách nào" (trỏ đúng tên test grep của phase 3).
2. Cập nhật 2 ADR cũ — chỉ thêm dòng trạng thái ở đầu bảng, không sửa nội dung lịch sử (nguyên tắc "không xoá quyết định cũ, chỉ nói nó đã bị thay").
3. Cập nhật README — đoạn "Nạp dữ liệu demo" hiện nói `pnpm seed`, thêm đoạn: giám khảo dùng UI upload ở `/quan-tri`, `pnpm seed` vẫn còn cho dev/CI dùng `hackathon-1-data.zip` checked-in.
4. **Chạy toàn bộ Definition of Done của CLAUDE.md mục 7** cho cả plan: test xanh, provenance bấm ra được nguồn (bản chụp mới vẫn giữ được — xác nhận qua T-3), proposal có accept/reject nếu liên quan (không áp dụng phase này), giao diện qua checklist `design-guidelines.md` cho panel mới (phase 3), ADR đã lên, có người ngoài hiểu lại được (đọc plan + ADR, không cần đọc code).

## Success Criteria

- [ ] ADR mới tồn tại, có mục phương án bị loại + cách verify
- [ ] ADR-0013, ADR-0021 có dòng "Superseded"
- [ ] README phản ánh đúng cách nạp dữ liệu mới
- [ ] `pnpm test && pnpm typecheck && pnpm lint && pnpm build` xanh toàn bộ — chạy đúng 1 lần cuối cùng, từ sạch (`pnpm reset` trước nếu nghi ngờ trạng thái CSDL)

## Risk Assessment

| Rủi ro | Giảm thiểu |
| --- | --- |
| Hết giờ trước khi viết ADR | Đây là phase P2 duy nhất có thể trễ so với 15:00 nếu bắt buộc chọn — nhưng KHÔNG được bỏ hẳn, viết ADR ngắn (5 dòng: quyết định + lý do + cách verify) còn hơn không có |
| Quên chạy `pnpm build` production thật (không chỉ `pnpm test`) | Spec 7.3 đòi "bản dựng production, không dev server" — `pnpm start` (docker compose up --build) là bài test thật, `pnpm test:unit` không phát hiện lỗi build Docker |

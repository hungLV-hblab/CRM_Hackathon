---
description: Chốt một quyết định thành ADR từ hội thoại hiện tại, kèm phương án bị loại
argument-hint: <mô tả ngắn quyết định vừa chốt>
allowed-tools: Read, Grep, Glob, Write, Edit, Bash(date:*), Bash(ls:*)
---

# Ghi ADR

Quyết định cần ghi: **$ARGUMENTS**

## Việc phải làm

1. Đọc `docs/decisions/adr-template.md` và `ls docs/decisions/` để lấy số ADR tiếp theo (4 chữ số, tăng dần).
2. **Rút nội dung từ chính hội thoại này** — các phương án đã bàn, lý do loại, cách đội đã kiểm chứng. Không bịa. Chỗ nào hội thoại không có thông tin thì **hỏi lại người dùng**, không tự điền cho đủ form.
3. Nếu phiên này bắt nguồn từ một file trong `docs/ai-sessions/`, link vào trường **Prompt log**.
4. Ghi file `docs/decisions/NNNN-{slug-kebab-case}.md` theo template.
5. Thêm một dòng lên **đầu bảng chỉ mục** trong `docs/decisions/README.md`.

## Kiểm tra trước khi ghi — không đạt thì hỏi lại, không ghi bừa

- [ ] Có **≥ 2 phương án bị loại kèm lý do cụ thể**? ADR chỉ có phương án được chọn là ADR vô giá trị.
- [ ] Lý do chọn nêu được **tiêu chí đã dùng để so**, không phải "đơn giản hơn", "tốt hơn".
- [ ] Trường **"Đội đã verify bằng cách nào"** có nội dung thật — chạy thử, đối chiếu tài liệu, hỏi Sales, viết test. **Cấm ghi "đọc thấy hợp lý".** Đây là câu BGK hỏi ở vòng 2.
- [ ] Có ghi điều kiện nào sẽ khiến phải đảo quyết định.
- [ ] Nếu AI có đề xuất mà đội không nghe, hoặc AI sai chỗ nào — đã ghi lại chưa? Đây là bằng chứng error-detection rate, đừng bỏ trống cho nhanh.

## Kết thúc

In ra: đường dẫn ADR + một câu tóm tắt quyết định + cảnh báo nếu có checklist nào chưa đạt.

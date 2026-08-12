---
description: Cho AI đóng persona người dùng phản biện yêu cầu, tự tìm edge case, ghi prompt log
argument-hint: <đường dẫn Specs hoặc mô tả yêu cầu cần phản biện>
allowed-tools: Read, Grep, Glob, Write, Bash(date:*)
---

# Phản biện yêu cầu bằng persona

Yêu cầu cần phản biện: **$ARGUMENTS**

## Bối cảnh bắt buộc đọc trước

- `docs/sales-ito-crm-domain.md` — nghiệp vụ Sales B2B/ITO, buyer persona, nỗi đau 3 tầng, 5 nguyên tắc vàng
- `docs/ai-native-design-principles.md` — 4 đối tượng nguyên thuỷ, trần tự chủ AI
- `CLAUDE.md` — 7 luật bất di bất dịch

Nếu `$ARGUMENTS` là đường dẫn file thì đọc file đó. Nếu là mô tả thì dùng trực tiếp.

## Việc phải làm

Lần lượt đóng **4 persona**, mỗi persona phản biện độc lập và **gay gắt** — nhiệm vụ là tìm chỗ hỏng, không phải khen:

1. **BD/Sales trực chiến** — người mở CRM lúc 8h sáng. Hỏi: "cái này giúp tôi biết sáng nay phải làm gì cho deal nào không, hay lại là một chỗ để nhập liệu?" Bắt mọi chỗ tăng thao tác gõ.
2. **Sales Manager** — quan tâm pipeline, độ tin cậy số liệu, giải trình với BOD. Hỏi: "số này lấy từ đâu, tôi mang đi họp được không?"
3. **Tester/BA khó tính** — săn mơ hồ, mâu thuẫn, thiếu định nghĩa, thiếu acceptance criteria, luồng lỗi không ai nghĩ tới.
4. **Người bảo vệ dữ liệu** — áp *"một dòng sai tệ hơn một dòng trống"*. Hỏi: chỗ nào AI được ghi? Ai duyệt? Sai thì phát hiện bằng cách nào? Sửa lại có dễ hơn lúc máy làm không?

Sau đó tổng hợp.

## Output

Ghi ra file `docs/ai-sessions/{YYMMDD-HHMM}-req-{slug}.md` (lấy giờ bằng `date +%y%m%d-%H%M`), gồm:

1. **Tóm tắt yêu cầu** — 5 dòng, bằng lời của mình, không copy nguyên văn
2. **Phản biện theo từng persona** — mỗi persona ≥ 3 chất vấn cụ thể, không chung chung
3. **Điểm mơ hồ trong Specs** — bảng: chỗ mơ hồ · cách hiểu A · cách hiểu B · ảnh hưởng nếu chọn sai
4. **Edge case & rủi ro tự phát hiện** — đánh dấu cái nào chắc chắn phải xử lý trước feature freeze 14/08, cái nào bỏ được
5. **User stories + acceptance criteria** — chỉ cho phần lõi, mỗi story ghi rõ đối tượng nào (Observation/Claim/Proposal) bị chạm
6. **Câu hỏi cần BTC/end user trả lời** — thứ không thể tự quyết
7. **Đề xuất cắt scope** — nếu chỉ làm được 40% thì làm 40% nào, vì sao

## Kết thúc

Nhắc: *"Đã ghi log tại `<đường dẫn>`. Chốt các diễn giải Specs quan trọng thành ADR bằng `/hack:adr`."*

Không tự sửa Specs, không bắt tay code. Nhiệm vụ của lệnh này là **phản biện và ghi vết**.

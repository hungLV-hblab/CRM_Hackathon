# Prompt log & phiên phản biện AI

> Nơi lưu **quá trình** làm việc với AI dạng đọc được. Kết luận thì nằm ở [docs/decisions/](../decisions/).

## Vì sao có thư mục này

- **Bonus minh bạch:** quality gate "Bằng chứng" cho điểm khi có lưu prompt log / lịch sử tương tác AI.
- **Ôn vòng 2:** BGK hỏi random 3–5 câu dựa trên log. Grafana thì đội không đọc lại tiện; file ở đây là bản đọc được, tra trong 30 giây.
- **Nguyên liệu cho ADR:** phiên phản biện xong thì chốt luôn thành ADR.

## Quy ước tên file

```
YYMMDD-HHMM-{giai-doan}-{slug-ngan}.md
```

`{giai-doan}`: `req` · `design` · `dev` · `test` · `deploy`

Ví dụ: `260815-0945-req-phan-bien-specs-module-account.md`

## Lưu cái gì

| Nên lưu | Bỏ qua |
| --- | --- |
| Phiên cho AI đóng persona phản biện yêu cầu / thiết kế | Autocomplete lặt vặt |
| Prompt sinh nhiều phương án + bảng trade-off | Hỏi cú pháp, hỏi lỗi typo |
| Lần AI **sai** và đội phát hiện ra *(giá trị nhất — đây là error-detection rate)* | Sinh boilerplate |
| Prompt sinh test case và edge case AI tự tìm ra | |

Không biên tập cho đẹp. Log thô mới là bằng chứng.

## Cách tạo nhanh

```bash
/hack:req-challenge <đường dẫn Specs hoặc mô tả yêu cầu>
/hack:design-challenge <vấn đề thiết kế cần chốt>
```

Hai lệnh này tự ghi output vào đây theo đúng quy ước tên, rồi gợi ý chốt ADR.

## Quan hệ với telemetry Grafana

Không thay thế nhau. Telemetry là **điều kiện qua vòng 1** (tự động, bắt buộc, luôn phải bật). Thư mục này là bản đọc được cho người — dùng khi ôn Q&A và khi nộp bằng chứng.

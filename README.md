# CRM Hackathon — HBLAB AI Hackathon #01 (DEV Edition)

Một module của hệ thống **CRM nội bộ HBLAB**, xây theo Specs BTC. Phần mềm **AI-native**: AI nằm trong lõi luồng nghiệp vụ, không phải chatbot đính cạnh CRUD. End user thật: đội **Sales các thị trường** (họ chấm vòng 3).

Ngày thi **15/08/2026** · feature freeze **tối 14/08** · nộp vòng 1 **15:00 ngày 15/08**.

- **Module:** **"AI Native CRM"** — CRM B2B dùng tay được trọn vẹn + lớp AI đọc nguồn công khai đẩy thông tin vào đúng chỗ. Specs phát 12/08: [docs/hackathon-spec-ai-native-crm.md](docs/hackathon-spec-ai-native-crm.md). 6 nhóm tính năng · 4 ranh giới cứng · nghiệm thu T-1..T-10.
- **Stack:** *TBD — chốt ngay, kèm ADR*

## Lệnh

| Việc | Lệnh |
| --- | --- |
| install · dev · test · lint · build | *TBD — điền khi chốt stack* |
| Phản biện yêu cầu (persona) | `/hack:req-challenge <specs hoặc mô tả>` |
| Phản biện thiết kế (virtual architect) | `/hack:design-challenge <vấn đề cần chốt>` |
| Chốt một quyết định thành ADR | `/hack:adr <quyết định>` |

## Đọc theo thứ tự

1. **[CLAUDE.md](CLAUDE.md)** — 7 luật bất di bất dịch, từ vựng ontology, trần tự chủ AI, DoD. Bắt buộc, đọc trước tiên.
2. **[docs/hackathon-spec-ai-native-crm.md](docs/hackathon-spec-ai-native-crm.md)** — đề bài nguyên văn. Nguồn sự thật cho *cần cái gì*; index nhanh theo mục ở [llms.txt](llms.txt).
3. [docs/hackathon-context.md](docs/hackathon-context.md) — bối cảnh + chiến lược suy ra từ tài liệu BTC.
4. [docs/sales-ito-crm-domain.md](docs/sales-ito-crm-domain.md) — đọc trước **mọi quyết định sản phẩm** (hiển thị gì, ưu tiên gì).
5. [docs/ai-native-design-principles.md](docs/ai-native-design-principles.md) — đọc trước **mọi quyết định kiến trúc**.
6. [docs/hackathon-rules-and-scoring.md](docs/hackathon-rules-and-scoring.md) — rubric; quyết định *cách làm việc*, không chỉ *làm gì*.
7. **[docs/ontology.md](docs/ontology.md)** — nguồn sự thật về **đặt tên + ràng buộc**: thực thể, enum, quan hệ có tên, 14 bất biến code phải enforce, trần tự chủ 4 vùng. ⬜ chờ người ngoài người viết duyệt.

Lưu vết quyết định: [docs/decisions/](docs/decisions/) (kết luận + phương án bị loại) · [docs/ai-sessions/](docs/ai-sessions/) (prompt log thô).

## Telemetry — điều kiện qua vòng 1

**Không có log Claude Code trên Grafana = 0 điểm, không qua vòng 1.** Bật trước khi gõ dòng đầu tiên.

Collector: `https://otel.hblab.ai:4317` (gRPC, đã kiểm tra sống ngày 12/08). Cấu hình 6 biến trong `~/.claude/settings.json` — xin endpoint + token từ IT/BTC, **không commit token vào repo**.

| Người | Config trên máy | Thấy data trên Grafana |
| --- | --- | --- |
| HungLV | ✅ đủ 6 biến OTEL | ❓ chưa verify — thiếu URL + tài khoản Grafana, đang chờ BTC |
| *(thành viên 2)* | ❓ chưa biết | ❓ |
| *(thành viên 3)* | ❓ chưa biết | ❓ |

Verify: `claude --debug 2>&1 | grep -i otel` (không lỗi export) **và** thấy metric `claude_code.session.count` của chính mình trên dashboard. Chỉ "không lỗi" thì chưa tính là xong.

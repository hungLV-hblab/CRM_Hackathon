# Phase 03 — `CLAUDE.md` cấp app + hai ADR

## Bối cảnh

Repo nguồn có `CLAUDE.md` gốc đúng **một dòng** (`@AGENTS.md`), một `AGENTS.md` 300 dòng mở đầu bằng **bảng định tuyến** *"đang làm ở đâu → đọc file nào trước"*, và **`CLAUDE.md` cấp app** riêng cho `apps/app`.

CLAUDE.md gốc của ta đã có bảng định tuyến tương đương (§1). Thứ ta **thiếu** là bản cấp app: ba hợp đồng của `agent-runtime` hiện chỉ sống trong comment đầu `main.ts`, nên người sửa file khác trong thư mục này không nhất định đọc được.

## Yêu cầu — `apps/agent-runtime/CLAUDE.md`

Ngắn. Chỉ nói thứ **không suy ra được từ code**, và chỉ thứ dễ bị phá bởi một thay đổi trông vô hại:

1. Không bao giờ đặt cổng kiểm duyệt (gate) trong tiến trình này — gate ở đây là gate nhánh AI với tới được.
2. Skill là **dữ liệu** đọc lúc boot, không phải code. Sửa prompt = sửa file + restart container.
3. `policy.json` là vỏ an toàn; nới `allowedTools` là nới quyền một tiến trình con.
4. Tiến trình này **không giữ credential CSDL** và không được nhận (ADR-0038).
5. Trỏ về CLAUDE.md gốc, không chép lại luật chung.

## Hai ADR

| ADR | Nội dung | Vì sao viết được trong freeze |
| --- | --- | --- |
| **0040** | Ai chấm độ tin cậy: model tự khai `confidence` (hiện tại) **vs** model khai loại bằng chứng rồi code định giá (mẫu `evidence.ts` của repo nguồn) | ADR là văn bản, không phải code. Đây là ADR giá trị nhất của phase — nó chứng minh đội **đã cân nhắc và cố ý hoãn**, chứ không phải chưa nghĩ tới |
| **0041** | Thiếu cấu hình là **mất năng lực**, không phải chết — và vì sao **không** port hook audit ghi DB của repo nguồn | Nối tiếp ADR-0034 (thiếu `AGENT_TOKEN` là TẮT không phải chết), mở rộng thành nguyên tắc chung |

Cả hai bắt buộc ≥2 phương án bị loại kèm lý do, và mục *đội đã verify thế nào* không được rỗng (README của `docs/decisions/`).

## File

| File | Việc |
| --- | --- |
| `apps/agent-runtime/CLAUDE.md` | Tạo |
| `docs/decisions/0040-*.md` | Tạo |
| `docs/decisions/0041-*.md` | Tạo |
| `docs/decisions/README.md` | Sửa — thêm 2 dòng chỉ mục |

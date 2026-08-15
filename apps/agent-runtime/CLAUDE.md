# CLAUDE.md — `apps/agent-runtime`

> Luật chung của cả repo nằm ở [CLAUDE.md gốc](../../CLAUDE.md). File này chỉ ghi những gì **riêng của tiến trình này** và **không suy ra được từ code** — tức là những thứ một thay đổi trông vô hại có thể phá mà không làm hỏng test nào.
>
> Đọc [ADR-0038](../../docs/decisions/0038-agent-runtime-la-container-rieng-giu-credential-claude-khong-giu-csdl.md) trước khi sửa bất cứ file nào trong thư mục này.

## Tiến trình này tồn tại vì đúng một lý do

Nó giữ **credential Claude và không giữ credential CSDL**. `apps/api` giữ credential CSDL và không giữ credential Claude. Không bên nào gây được thiệt hại của bên kia.

Mọi tính chất khác đều là hệ quả của câu trên. Trước khi thêm bất cứ thứ gì vào đây, hỏi: *thứ này có buộc tiến trình phải cầm thêm một credential không?* Nếu có thì nó thuộc về `api`.

## Bốn luật

**1. Không đặt cổng kiểm duyệt ở đây.** Không kiểm câu trích nguyên văn, không lọc trường được phép sửa, không quyết định một phát hiện có đủ tốt để giữ. Toàn bộ gate sống ở `apps/api` cạnh domain sở hữu luật đó. Gate đặt trong tiến trình này là gate mà nhánh AI với tới được — luật 1 của CLAUDE.md gốc muốn nó đứng **trước** người ghi, không đứng cùng chỗ với người bị kiểm.

Tiến trình này trả **văn bản**. Nó không phân tích và không phán xét.

**2. Skill là dữ liệu, không phải code.** `SKILL.md` và `policy.json` đọc lúc boot từ thư mục `skills/`. Sửa luật cho model = sửa file + restart container; restart chính là dấu vết kiểm toán. Đừng biến prompt thành hằng số TypeScript — mất luôn khả năng để người không đọc code review nó, và mất luôn cái diff đọc được.

`_base.md` là luật nền ghép vào **mọi** skill. Xoá nó là lỗi boot, có chủ ý.

**3. `policy.json` là vỏ an toàn, không phải cấu hình.** `allowedTools` đi thẳng vào `--allowed-tools` của CLI. Thêm một tool vào đó là cấp cho một tiến trình con một quyền mà chưa ai quyết định cho nó có. Đặc biệt: **không thêm `WebFetch` vào `discover-sources`**. `packages/contracts/src/ports/source-discovery.ts` cấm rõ: port này được trả URL và đoạn trích quanh nó, **không bao giờ được trả nội dung trang**. `WebFetch` trả về trang đã đọc và tóm tắt hộ — mà ADR-0012 tính `content_hash` và mọi `quote_start`/`quote_end` trên **bytes của chính ta**, nên một trang codebase này chưa từng cầm thì I-2 không có gì để đối chiếu câu trích, và luật 1 đổ theo.

Mọi nới lỏng ở đây cần một ADR.

**4. Thất bại sinh ra số không, không sinh ra phỏng đoán.** Mọi kiểu hỏng đều có tên trong `errors.ts` và đều thành **danh sách rỗng** ở phía gọi. Đừng thêm giá trị mặc định, đừng retry để "có gì đó mà hiện". Luật 4 của CLAUDE.md gốc: một dòng sai tệ hơn một dòng trống.

Thiếu cấu hình cũng vậy — **mất năng lực, không phải chết**. Xem [ADR-0041](../../docs/decisions/0041-thieu-cau-hinh-la-mat-nang-luc-khong-phai-chet-va-vi-sao-khong-ghi-audit-tu-day.md).

## Trước khi sửa

| Sửa gì | Đọc trước |
| --- | --- |
| Cờ dòng lệnh, môi trường tiến trình con, sandbox | comment đầu `src/claude-cli.ts` |
| Hàng đợi, deadline, đồng hồ tiêm vào | comment đầu `src/job-queue.ts` |
| Nạp skill, ghép prompt, placeholder | comment đầu `src/skill-registry.ts` |
| Route, `/health`, bật tắt bằng token | comment đầu `src/main.ts` |

Những comment đó giải thích **vì sao**, không phải **làm gì**. Vòng 2 BGK hỏi random 3–5 câu dựa trên log và code — chúng là câu trả lời soạn sẵn, nên đừng xoá khi refactor.

## Lệnh

```bash
pnpm vitest run --project agent-runtime     # test riêng gói này
pnpm --filter @crm/agent-runtime typecheck
```

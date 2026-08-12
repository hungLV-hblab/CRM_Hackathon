# ADR-0016 — `Proposal.status` chỉ có hai giá trị `pending | decided`; mọi con số đo lấy từ `ProposalDecision`

| | |
| --- | --- |
| **Ngày** | 2026-08-13 01:27 |
| **Giai đoạn** | Design (mô hình dữ liệu, nhóm 3) |
| **Trạng thái** | Chấp nhận |
| **Người quyết định** | HungLV |
| **Prompt log** | phiên brainstorm phase 1 ngày 13/08 01:27 — [báo cáo](../../plans/reports/from-brainstorm-to-planner-260813-0127-phase-01-grant-insert-theo-cot-va-ba-quyet-dinh-report.md) |

## Bối cảnh

[ontology mục 3.2](../ontology.md#32-vùng-đọc--do-ai-sinh-nhóm-2-3) liệt kê `Proposal` có cột `status`, nhưng **mục 3.5 không định nghĩa enum nào cho nó** và `packages/contracts/src/enums.ts` cũng không có. Tức là tên cột đã chốt mà tập giá trị thì chưa.

Phải chốt ở phase 1 vì `status` là cột trong migration, và vì nếu để hở thì P5 (hàng đợi duyệt) và P8 (bảng điều khiển số liệu) sẽ tự đặt hai tập giá trị khác nhau — đúng lỗi mà [CLAUDE.md mục 3](../../CLAUDE.md) cấm ("không tự đặt từ đồng nghĩa").

Ràng buộc nghiệp vụ đang siết: **I-12** đòi `decision = edit` đếm riêng, không cộng vào `accept` (T-5 test đúng điều này), và mục 7 ontology đòi đo auto-accept rate + error-detection rate từ ngày đầu. Bảng `ProposalDecision` đã tồn tại và đã mang `decision`, `reject_reason`, `final_value`, `seconds_to_decide`.

## Phương án đã cân nhắc

Tiêu chí: *(1)* số nguồn sự thật cho con số mang ra trước BGK · *(2)* I-12 có tự đúng hay phải nhớ · *(3)* chi phí truy vấn hàng đợi duyệt · *(4)* khớp ontology 3.2 tới đâu.

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| **A.** `pending \| decided`; kết cục cụ thể đọc từ `proposal_decisions.decision` | **Một nguồn sự thật.** I-12 tự đúng vì metric chỉ đọc `decision`, không có chỗ nào khác chứa "accept" để cộng nhầm. Hàng đợi = `WHERE status='pending'`, index rẻ. Kết hợp [ADR-0015](0015-grant-insert-phai-theo-cot-khi-bang-co-cot-thuoc-quyet-dinh-cua-nguoi.md): `status` bị loại khỏi `GRANT INSERT` → `DEFAULT 'pending'` luôn áp dụng → AI **không thể** sinh gợi ý đã duyệt | Muốn xem kết cục một gợi ý phải join sang `proposal_decisions` | ✅ **Chọn** |
| **B.** `pending \| accepted \| edited \| rejected` (mirror enum `decision`) | Đọc một bảng ra kết cục, không join | **Hai nguồn sự thật.** `status` và `proposal_decisions.decision` có thể lệch mà không có gì chặn — và vòng 2 sẽ hỏi đúng câu "số này lấy ở đâu". I-12 phải enforce ở **cả hai** chỗ, tức là nhớ hai lần thay vì không phải nhớ | ❌ Loại — tiêu chí (1) và (2). Một cột tiện đọc không đổi được bằng nguy cơ hai con số lệch nhau trên bảng điều khiển |
| **C.** Bỏ hẳn cột `status`, suy ra từ việc có/không có dòng `proposal_decisions` | YAGNI thuần. Tuyệt đối không lệch được | Hàng đợi thành `NOT EXISTS` subquery — chấp nhận được. Nhưng lệch ontology 3.2 (đang liệt kê `status`) nên phải sửa ontology, và mất chỗ để `DEFAULT 'pending'` phát huy tác dụng bảo vệ của ADR-0015 | ❌ Loại — đúng về lý thuyết nhưng bỏ mất lớp chặn CSDL vừa mới dựng được ở ADR-0015 |

## Quyết định

Chọn **A**.

```ts
// packages/contracts/src/enums.ts
export const PROPOSAL_STATUS = {
  pending: 'Chờ duyệt',
  decided: 'Đã quyết',
} as const
// + thêm vào registry ENUMS với key `proposal_status`
```

```sql
proposals.status proposal_status NOT NULL DEFAULT 'pending'
```

Quy tắc đi kèm, là phần quan trọng hơn cả tập giá trị:

- **Hàng đợi duyệt** đọc `proposals WHERE status = 'pending'`.
- **Mọi con số** (auto-accept rate, error-detection rate, tỉ lệ `edit`, `seconds_to_decide`) đọc `proposal_decisions`. Không truy vấn nào được suy ra "đã duyệt" từ `status`.
- `status` chuyển sang `decided` **trong cùng transaction** với việc ghi dòng `proposal_decisions`, bằng `crm_app`. Không có đường nào khác đổi cột này.

Thêm enum này bắt buộc phải **thêm một dòng vào ontology mục 3.5** — `ontology-enum-parity.test.ts` sẽ đỏ tới khi làm. Đó là tính năng, không phải phiền toái: nó là cái giữ ontology khỏi thành trang trí ([CLAUDE.md mục 8](../../CLAUDE.md)).

## Hệ quả

- Bảng điều khiển của nhóm 6 chỉ có **một** chỗ để lấy số: `proposal_decisions`. Câu hỏi vòng 2 "số auto-accept này tính thế nào" có đúng một câu trả lời.
- I-12 không cần code canh: `accept` và `edit` là hai giá trị của `decision`, đếm riêng là mặc định, cộng chung mới là phải cố ý.
- `status` trở thành cột **được CSDL bảo vệ** theo ADR-0015 (vắng khỏi `GRANT INSERT` của `crm_system`) → T-4 ("sinh gợi ý rồi không làm gì, hồ sơ y nguyên sau ≥3 chu kỳ") có lớp chặn thứ hai chứ không chỉ dựa vào code AI cư xử tử tế.
- Trang chi tiết một gợi ý phải join `proposals ⋈ proposal_decisions`. Một join, có index trên `proposal_id`.
- **Sẽ phải xem lại nếu:** xuất hiện trạng thái thứ ba **không** sinh ra từ quyết định của người — ví dụ Specs bổ sung "gợi ý hết hiệu lực vì dữ liệu nguồn đã thay đổi". Lưu ý: trạng thái đó **không được** là "tự hết hạn thành hành động" (CLAUDE.md mục 4 cấm), chỉ có thể là hết hiệu lực thành không-làm-gì.

## AI đã tham gia thế nào

- **Vai trò AI:** phát hiện lỗ (cột có tên nhưng không có tập giá trị ở cả ontology 3.5 lẫn contracts), sinh 3 phương án, phân tích trade-off theo tiêu chí "số nguồn sự thật".
- **AI đề xuất gì mà đội không nghe:** phương án B (mirror 4 trạng thái) là phản xạ tự nhiên và AI nêu nó trước, với lý do "đọc một bảng ra kết cục". Bỏ vì nó tạo hai nguồn sự thật cho đúng những con số đội sẽ mang ra trước BGK.
- **AI sai ở đâu:** không có lỗi kỹ thuật ở quyết định này. Nhưng đáng ghi lại: chính AI viết ontology 3.2 với cột `status` **và** viết ontology 3.5 với 12 enum, mà không nối hai chỗ lại — lỗ này tồn tại từ 12/08 tới 13/08, chỉ lộ ra khi có người đọc phase file để đi code. Parity test không bắt được vì nó chỉ so ontology 3.5 ↔ contracts, **không** kiểm mọi cột enum trong 3.1–3.4 có mặt trong 3.5.

## Đội đã verify bằng cách nào

- **Đối chiếu ràng buộc nghiệp vụ, không suy diễn:** đọc lại I-12 và mục 7 ontology để xác định con số nào phải đếm riêng. Kết quả: cả 4 chỉ số của mục 7 đều lấy được từ `proposal_decisions` mà không cần `status` — đó là bằng chứng `status` không phải nguồn số liệu, chỉ là cờ hàng đợi.
- **Đo bằng test, ở P1a:** `INSERT INTO proposals` bằng `crm_system` không truyền `status` → đọc lại phải ra `pending`. Đây là khẳng định chứng minh `DEFAULT` cộng ADR-0015 thực sự khoá được trạng thái ban đầu.
- **Đo bằng test, ở P5:** `decision='edit'` không được cộng vào số `accept` (T-5). Với phương án A thì test này khó đỏ, và đó chính là lý do chọn A.
- **Parity test làm trọng tài:** thêm `proposal_status` vào contracts mà quên ontology 3.5 (hoặc ngược lại) → `ontology-enum-parity.test.ts` đỏ. Không phụ thuộc vào việc ai nhớ.

## Rollback

Đổi sang phương án B nếu bảng điều khiển thực sự cần đọc kết cục không join: `ALTER TYPE proposal_status ADD VALUE` ×3 + một `UPDATE` backfill từ `proposal_decisions` + sửa chỗ ghi. **~40'**. Nhưng lúc đó phải kèm một ràng buộc chống lệch (trigger hoặc test bất biến `status` khớp `decision`) — nếu không thì rollback này chính là tạo ra vấn đề mà ADR đang tránh.

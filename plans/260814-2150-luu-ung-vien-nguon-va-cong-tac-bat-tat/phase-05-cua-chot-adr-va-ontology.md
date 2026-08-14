---
phase: 5
title: "Cửa chốt ADR và ontology"
status: done
effort: small
priority: P1
dependencies: [1, 2, 3, 4]
---

# Phase 5: Cửa chốt ADR và ontology

## Overview

ADR-0037 supersede hai dòng của ADR-0036, và sửa 5 dòng `ontology.md` đã thành sai. **Không được cắt phase này** — code chạy mà tài liệu nói ngược là đúng cái bẫy vòng 2 hỏi.

## Requirements

- ADR-0037 có: phương án bị loại, tiêu chí so, **cách verify từng khẳng định**, rollback
- ADR-0036 được đánh dấu là bị supersede **ở đúng hai dòng**, không xoá cả file
- `ontology.md` mục 3.6 và mục 6 khớp với code thật
- Prompt log phiên brainstorm này lưu vào `docs/ai-sessions/`

## Architecture

**Vì sao ADR mới thay vì sửa ADR-0036 tại chỗ:** ADR-0036 ghi lại một quyết định **đã đúng vào thời điểm nó được ra**, kèm lập luận và phương án bị loại. Sửa tại chỗ là xoá dấu vết việc đội đã cân nhắc gì, mà đó chính là thứ rubric thưởng. ADR mới nói rõ *điều gì đã đổi và vì sao đổi được*: không phải "chúng tôi nghĩ lại", mà **"lưu ứng viên ở bảng AI không đọc được thì invariant vẫn nguyên, và chúng tôi mới thấy điều đó"**.

Tiêu chí so vẫn là tiêu chí của ADR-0036: **cách nào giữ được cửa I-2 và giữ được "AI không tự chọn nguồn nó rút phát hiện"**. Không đổi tiêu chí giữa đường.

## Related Code Files

- Create: `docs/decisions/0037-ung-vien-luu-o-bang-ai-khong-doc-duoc-va-cong-tac-tat-nguon.md`
- Create: `docs/ai-sessions/260814-2150-brainstorm-luu-ung-vien-nguon.md`
- Modify: `docs/decisions/0036-llm-tim-nguon-code-doc-bytes-va-ung-vien-phai-qua-nguoi.md` — 2 dòng
- Modify: `docs/ontology.md` — 5 dòng
- Modify: `docs/decisions/README.md` — thêm ADR-0037 vào mục lục

## Implementation Steps

### 1. ADR-0037

Dùng `/hack:adr` hoặc `docs/decisions/adr-template.md`. Nội dung lấy từ [brainstorm report](../reports/brainstorm-260814-2150-persist-source-candidates-and-widen-source-panel-report.md) mục 3 — 5 nhóm phương án đã có sẵn bảng ưu/nhược/kết luận, **copy sang chứ không viết lại từ đầu**.

Phần **"Đội đã verify bằng cách nào"** phải là kết quả chạy thật, không phải kế hoạch:

| Khẳng định | Verify bằng |
| --- | --- |
| AI không đọc/ghi nổi bảng ứng viên | Test 19–22, chạy bằng vai `DATABASE_URL_TEST_SYSTEM` |
| AI không thấy nguồn người ta đã tắt | Test 15 (bản mới) + 23 |
| Tìm không chạm danh sách đọc | Test 1 (bản mới) — ứng viên = N, `company_sources` = 0 |
| Tìm lại thay danh sách, nguồn đã lưu sống sót | Test 10, 11 |
| Nguồn đã tắt không được đọc | `disabled-source-not-read.test.ts` |
| Test có răng | 4 lần đảo code ở phase 1 step "Success Criteria", phase 2 step 4, phase 3 Success Criteria — ghi **đúng bao nhiêu test đỏ, lệch không** |
| Ứng viên sống qua reload | e2e `source-candidates-survive-reload.spec.ts` bước 3 |

Phần **"AI đã tham gia thế nào"** phải kể hai chuyện thật của phiên này:
1. AI khuyến nghị **bảng riêng** thay vì cột `status`, lập luận bằng "hàng tồn tại = đã duyệt là invariant mạnh hơn một cột". Người quyết định đồng ý.
2. AI khuyến nghị **view + REVOKE** thay vì `WHERE enabled` cho cột `enabled`, dù đắt hơn ~20 phút. Người quyết định chọn view.
3. **Nếu bỏ nút "Lưu theo lô"** (phase 4) — đây là quyết định phát sinh lúc thi công, ghi vào mục (g)/(h) theo khuôn ADR-0036.

### 2. Sửa hai dòng của ADR-0036

**Không xoá, đánh dấu.** Hai chỗ:

- Mục Hệ quả, dòng *"Đánh đổi đã nhận: refresh trang mất danh sách ứng viên…"* → thêm `**[Bị thay bởi ADR-0037]**` ở đầu dòng, giữ nguyên chữ cũ để đọc được lịch sử.
- Bảng verify, dòng *"Ứng viên không được persist | company-source-candidates.test.ts test 1 — … đếm hàng company_sources = 0"* → cùng cách: đánh dấu, và ghi khẳng định mới: *"ứng viên persist ở bảng AI không đọc được; danh sách đọc vẫn 0 hàng sau khi tìm"*.

Mục (b) của bảng phương án (dòng 30-33) **giữ nguyên** — phương án B "tìm xong tự lưu vào **danh sách đọc**" vẫn bị loại, ADR-0037 không đảo điều đó. Đây là chỗ dễ nhầm nhất: chúng ta lưu ứng viên, **không** lưu vào danh sách đọc.

### 3. Sửa 5 dòng ontology

| Dòng | Đang sai chỗ nào | Sửa thành |
| --- | --- | --- |
| 117 | Bảng thực thể chỉ có `CompanySource` | Thêm hàng `CompanySourceCandidate` — **ứng viên nguồn**, ai được tạo: "người bấm Tìm; `crm_system` **không có quyền nào**" |
| 122 | `POST :id/source-candidates → … KHÔNG ghi gì.` | `→ ghi ứng viên vào company_source_candidates, KHÔNG chạm company_sources` + liệt kê 3 route mới |
| 127 | *"Cái giá đã nhận: refresh trang mất danh sách ứng viên, vì không có chỗ nào lưu nó."* | Viết lại: giá đã trả xong bằng bảng riêng; lý do tách hai bước **vẫn đúng** và phải giữ |
| 129 | Thứ tự đọc không kể `enabled` | `company_sources` **đang bật** không rỗng → đọc list; tắt hết → rơi về `companies.website` |
| 226 | I-18 phát biểu cũ | I-18 mạnh lên: `crm_system` **không đọc được** `company_sources`, chỉ đọc `company_sources_enabled`; và không có quyền nào trên bảng ứng viên. Kèm số test |

Cập nhật dòng 4 (trạng thái duyệt) — thêm mốc `⏳ bản sửa 14/08/2026 khuya (ứng viên persist + công tắc nguồn, ADR-0037) chờ duyệt lại`.

### 4. Prompt log

Lưu phiên brainstorm này vào `docs/ai-sessions/260814-2150-brainstorm-luu-ung-vien-nguon.md`: yêu cầu gốc, 5 phương án AI đưa ra, 5 lựa chọn của người quyết định, và chỗ AI cảnh báo trước (cột `enabled` tái tạo đúng lỗ đã loại phương án B — bắt được **trước** khi code, không phải sau).

### 5. Quét toàn bộ tài liệu

`grep -rn "chưa lưu gì\|không được persist\|refresh trang mất" docs/ apps/ packages/` → phải sạch, trừ hai dòng đã đánh dấu bị-thay trong ADR-0036.

## Success Criteria

- [ ] ADR-0037 có đủ: phương án bị loại, tiêu chí so, bảng verify **là kết quả chạy thật**, rollback 3 mức
- [ ] ADR-0036 đánh dấu đúng 2 dòng, mục (b) không bị đảo
- [ ] `ontology.md` 5 dòng + dòng trạng thái duyệt đã sửa
- [ ] `docs/decisions/README.md` có ADR-0037
- [ ] Prompt log đã lưu
- [ ] Grep ở step 5 sạch
- [ ] Có ít nhất 1 người ngoài người viết đọc ADR-0037 và giải thích lại được (DoD mục 7 CLAUDE.md)

## Risk Assessment

| Rủi ro | Giảm thiểu |
| --- | --- |
| Viết ADR **sau** khi commit code ⇒ vênh trong git history | Viết ADR-0037 **trước** commit của phase 1, cập nhật bảng verify sau khi chạy xong. ADR trước, code sau — CLAUDE.md mục 5 |
| Bảng verify ghi kế hoạch thay vì kết quả | Mỗi dòng phải trỏ tới một số test cụ thể đã chạy. Dòng nào chưa chạy được thì **khai thẳng "chưa verify"**, giống ADR-0036 đã làm với `web_search_tool_result` |
| Nhầm "lưu ứng viên" thành "đảo phương án B của ADR-0036" | Ghi rõ một câu trong ADR-0037: danh sách **đọc** vẫn chỉ người ghi; ứng viên là danh sách **đề xuất**, hai thứ khác nhau ở hai bảng |

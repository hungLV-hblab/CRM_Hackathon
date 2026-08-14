---
phase: 4
title: "Cửa chốt — ADR, ontology, prompt log"
status: pending
priority: P1
dependencies: [1, 2, 3]
---

# Phase 4: Cửa chốt — ADR, ontology, prompt log

## Overview

Không phải phase "dọn dẹp". CLAUDE.md mục 5 nói thẳng: **"Không có ADR = quyết định đó không tồn tại với BGK"**, và DoD mục 7 đòi ADR cho mọi quyết định kiến trúc/nghiệp vụ phát sinh. Phase này biến những gì đã code thành thứ bảo vệ được ở vòng 2.

**Không được cắt.** Nếu chỉ còn 25 phút thì chạy đúng phase này.

## Requirements

- ADR-0036 ghi bốn quyết định của phiên brainstorm, **kèm phương án bị loại**.
- `docs/ontology.md` khớp với code thật; về trạng thái **chờ duyệt lại**.
- Prompt log phiên brainstorm lưu vào `docs/ai-sessions/`.
- Chốt câu hỏi mở về `fetch_error_reason` (xem [plan.md](./plan.md#câu-hỏi-chưa-giải-quyết)).

## Architecture

Không có kiến trúc — chỉ văn bản. Nhưng văn bản là bằng chứng của vòng 2, nên độ chính xác tính bằng `file:dòng`, không bằng cảm giác.

## Related Code Files

**Create**
- `docs/decisions/0036-llm-tim-nguon-code-doc-bytes-va-ung-vien-phai-qua-nguoi.md`
- `docs/ai-sessions/260814-1600-brainstorm-crawl-da-nguon.md`

**Modify**
- `docs/ontology.md` — mục 1, 3 (bảng thực thể + 3.5 + 3.6), 6 (bất biến), 9 (M-14 hoặc thêm dòng mới), 10 (checklist)
- `docs/decisions/README.md` — thêm ADR-0036 vào mục lục

## Implementation Steps

### Bước 1 — ADR-0036, bốn quyết định

Theo `docs/decisions/adr-template.md`. Bốn quyết định, mỗi cái kèm phương án bị loại:

| # | Quyết định | Phương án bị loại |
| --- | --- | --- |
| a | **`web_search` để tìm nguồn, code của mình fetch bytes.** Không dùng `web_fetch` của Anthropic cho nội dung công ty | (1) LLM tự nghĩ ra URL → bịa, vi phạm luật 1+4. (2) Search API riêng (Brave/Tavily) → thêm khoá, thêm vendor, 0 lợi ích. (3) `web_fetch` lấy luôn nội dung → mất byte gốc, cửa I-2 mất chỗ đứng ([ADR-0012](0012-ban-luu-giu-html-goc-va-text-trich-offset-tinh-tren-text.md)) |
| b | **URL ứng viên phải qua một cú bấm của người**; `crm_system` không có INSERT trên `company_sources` | Tự lưu danh sách đọc dưới `crm_system` → AI tự chọn nguồn nó đọc, phá đúng nguyên tắc đã enforce cho `snapshot_variant` (`companies.ts:39`), và là đường ghi thứ ba ngoài hai ngoại lệ Specs mở |
| c | **I-3 so hash theo `(company_id, source_url)`** | Giữ theo công ty → đa URL làm hash chéo nhau, mỗi lần đọc sinh N hàng + N lượt LLM. Thêm `UNIQUE` → đã bị loại từ [ADR-0017](0017-i3-enforce-o-tang-service-rang-buoc-csdl-chi-danh-cho-ranh-gioi.md) |
| d | **Mạng xã hội cho vào để hỏng trung thực** | `blocked_domains` chặn trước → demo đẹp hơn nhưng mất bằng chứng sống cho bảng phân loại lỗi, đúng thứ Sales Manager chất vấn ở [prompt log 260814-1124](../ai-sessions/260814-1124-req-crawl-web-that.md) mục 2 |
| e | **Nhóm 4 chạy chế độ chỉ-đề-xuất với `live_crawl`** (không ghi `AutoNextStepEvent`, đẩy hết sang `blockedNextSteps` → gợi ý `next_step`) | Bỏ hẳn nhóm 4 → hàm ý về Việc tiếp theo **biến mất không dấu vết**, cùng hình dạng cái hố [ADR-0028](0028-quyen-ghi-muc-dong-thoi-gian-den-tu-nhan-dang-theo-doi-khong-tu-trigger-context.md) ở một tầng khác. Bỏ hẳn nhưng đếm/log → khoảng trống đo được nhưng Sales vẫn không thấy gì. **Phát hiện trong phiên validation, không có trong bản plan đầu** |
| f | **`fetch_error_reason` giữ ngoài `ENUMS`** (bảng 3.5 chỉ thêm `source_kind`, parity 12→13) | Vào `ENUMS` + bảng 3.5 → nhất quán hơn và có lập luận thật (nó *có* nhãn hiển thị cho Sales, đúng tiêu chí của bảng 3.5), nhưng làm ontology dài thêm 9 giá trị chẩn đoán. **ADR phải ghi rằng đây là lựa chọn, không phải chân lý** |

Cộng hai mục bắt buộc của template:

- **Đội đã verify bằng cách nào** — dẫn `file:dòng` thật: `0001_grants.sql:23,29,38` · `0003_grants_ai_tables.sql` (table-level trên `observations`) · `observations.ts:35-38` · `companies.ts:39` · `ontology-enum-parity.test.ts:83` · `seed/index.ts:26`. Và số test thực tế của ba phase.
- **AI đã tham gia thế nào / AI sai ở đâu** — AI khuyến nghị **chặn** mạng xã hội và **chặn seed bằng quy tắc cấu trúc**; người quyết định chọn ngược cả hai và đúng cả hai lần. Ghi lý do thật, không tô.

**Sáu quyết định, không phải bốn** — (e) và (f) đến từ phiên validation. Xem `## Validation Log` của [plan.md](./plan.md) để lấy nguyên văn lý do.

<!-- Updated: Validation Session 1 - thêm quyết định (e) nhóm 4 chỉ-đề-xuất và (f) fetch_error_reason -->


### Bước 2 — ontology khớp code thật

| Mục | Sửa gì |
| --- | --- |
| 1 | Bỏ chữ "chưa mở"/"cửa gác" nếu công tắc đã có code; nói đúng trạng thái hiện tại |
| 3 (bảng thực thể) | `Observation`: `source_kind` và `fetch_error_reason` **đã có trong schema** — sửa câu "hai cột này chưa có trong schema hôm nay" |
| 3.5 | dòng `source_kind` (đã thêm ở P1); giá trị mới của `source_tier` |
| 3.6 | thêm `company_sources` và luật "ứng viên phải qua người"; cập nhật cột "Mặc định" |
| 6 | I-15/I-16/I-17: **bỏ câu "chưa có test"**, ghi tên file test. Thêm bất biến mới cho quyết định (b): *`crm_system` không có INSERT trên `company_sources`* |
| 9 | thêm dòng cho quyết định (a) — ranh giới "LLM tìm nguồn, code đọc bytes" |
| 10 | tick hai ô đang nợ |
| Câu hỏi mở | **Xoá câu hỏi mở số 2** ("Ai được bật nguồn thật cho một công ty — Admin hay Sales sở hữu?") — đã trả lời ở validation V3: bất kỳ người dùng đã đăng nhập, theo ADR-0033 |

Đầu file: chuyển trạng thái duyệt về **chờ duyệt lại** — chính mục 1 của ontology bắt thế.

### Bước 3 — prompt log

Lưu phiên brainstorm vào `docs/ai-sessions/260814-1600-brainstorm-crawl-da-nguon.md`: yêu cầu gốc, bốn câu hỏi + bốn lựa chọn của người quyết định, chỗ AI khuyến nghị ngược và bị bác, và những gì chưa verify được. Đây là **đề thi vòng 2**, viết cho người đọc lại sau ba tuần.

### Bước 4 — chạy đủ và commit

`pnpm test` · `lint` · `typecheck` · `docker compose build`. Cập nhật `docs/decisions/README.md`. Commit `docs(adr): ADR-0036 ...`.

## Success Criteria

- [ ] ADR-0036 tồn tại, có đủ **bốn** quyết định, mỗi cái **kèm phương án bị loại**
- [ ] ADR có mục "đội đã verify bằng cách nào" dẫn `file:dòng` thật, không phải mô tả chung
- [ ] ADR có mục "AI sai ở đâu" ghi đúng hai lần AI khuyến nghị ngược
- [ ] Câu hỏi `fetch_error_reason` **đã chốt** trong ADR, không để treo
- [ ] `docs/ontology.md` **không còn** câu nào mô tả trạng thái đã lỗi (nhất là "hai cột này chưa có trong schema hôm nay" và "I-15…I-17 chưa có test")
- [ ] Ontology về trạng thái **chờ duyệt lại**, có ngày
- [ ] Prompt log đã lưu, dẫn được từ ADR
- [ ] `docs/decisions/README.md` có ADR-0036
- [ ] Ít nhất **một người ngoài người viết** đọc và giải thích lại được (DoD mục 7)

## Risk Assessment

| Rủi ro | Đối sách |
| --- | --- |
| Hết giờ, bỏ phase này | **Không được bỏ.** Nếu phải chọn giữa P3 và P4 thì chọn P4: một tính năng không có ADR thì với BGK nó không tồn tại |
| ADR viết chung chung, không dẫn được bằng chứng | Danh sách `file:dòng` đã liệt ở Bước 1 — chép vào, đừng viết lại từ trí nhớ |
| Ontology sửa nửa vời, còn câu mô tả trạng thái cũ | Bảng bảy mục ở Bước 2 là checklist, đi hết từng dòng |
| Chỉ P1 chạy được, P2/P3 bị cắt | Vẫn viết ADR — ghi đúng phạm vi đã làm và phần còn nợ. **ADR ghi sự thật, không ghi kế hoạch** |

---
phase: 2
title: "Nhóm 2 — bản lưu, phát hiện, provenance"
status: pending
priority: P1
dependencies: [1]
owner: A
estimate: 3h
---

# Phase 2: Nhóm 2 — bản lưu, phát hiện, provenance

## Overview

Đường ống `Observation → Claim` với provenance bấm ra được nguồn. **Đây là nền của P5, P6, P7** — ba phase đó không bắt đầu được nếu `Claim` chưa đứng.

Quyết định chi phối: [ADR-0014](../../docs/decisions/0014-nhom-2-rut-phat-hien-bang-llm-that-code-kiem-cau-trich.md) (LLM sinh nhận định, **code** kiểm câu trích + tính offset) · [ADR-0012](../../docs/decisions/0012-ban-luu-giu-html-goc-va-text-trich-offset-tinh-tren-text.md) (giữ `raw_html`, offset trên `raw_content`) · [ADR-0003](../../docs/decisions/0003-chi-tao-ban-luu-khi-noi-dung-thay-doi.md) (chỉ tạo bản lưu khi hash khác).

**Nhóm 2 không được chạm dữ liệu chính thức.** Sinh claim xong là hết việc — không timeline, không hồ sơ, không cơ hội (I-4).

## Requirements

- Functional: đọc bản chụp của một công ty → tạo `Observation` (hoặc ghi "đã đọc, không đổi" nếu hash trùng) → rút `Claim` có câu trích + offset; khu vùng đọc trong màn hình công ty; bấm claim mở đúng đoạn có đánh dấu.
- Non-functional: test **không gọi mạng** (cắm `FixtureClaimExtractor` qua port `CLAIM_EXTRACTOR`); nguồn không đọc được → `fetch_status = failed`, không đoán.

## Files

| Tạo | Vai trò |
| --- | --- |
| `apps/api/src/ai/anthropic-claim-extractor.ts` | Adapter LLM thật. **Chỉ** trả `ClaimDraft`; không tính offset, không quyết lưu |
| `apps/api/src/ai/fixture-claim-extractor.ts` | Adapter tất định cho test + đường lùi demo (ADR-0014 mục Rollback) |
| `apps/api/src/domain/observation/observation-service.ts` | Chụp + hash + I-3 |
| `apps/api/src/domain/claim/claim-service.ts` | **Nơi enforce I-1, I-2** — kiểm chuỗi con, tính `quote_start`/`quote_end`, từ chối claim không khớp |
| `apps/web/src/app/cong-ty/[id]/page.tsx` | Màn hình công ty + khu vùng đọc (tách rõ khỏi hồ sơ và dòng thời gian) |
| `apps/web/src/components/provenance/*` | Mở rộng `quote-block.tsx` sẵn có: highlight theo offset, hai tab *Văn bản* / *Bản gốc* |

Sửa: `app.module.ts` (đăng ký provider theo env), `packages/contracts/src/dto/` nếu thiếu field.

## Implementation steps

1. **Test đỏ trước, ba cái, viết cùng lúc:**
   - claim thiếu `quote_text` → từ chối (T-2, cả đường service lẫn SQL thẳng);
   - `quote_text` là **paraphrase** không phải chuỗi con → từ chối cả claim (T-2b, I-2);
   - cùng nội dung đọc lại → **không** tạo `Observation` mới, **không** gọi extractor (I-3 — spy trên port phải 0 lần gọi).
2. `ObservationService`: chuẩn hoá `raw_html` → `raw_content`, `content_hash` trên `raw_content`, `fetch_status`.
3. `ClaimService`: nhận `ClaimDraft[]`, với mỗi draft `indexOf(quoteText)` trên `raw_content` → không thấy thì **bỏ draft đó và đếm vào chỉ số bị bỏ**; thấy thì tính offset và lưu.
4. `AnthropicClaimExtractor`: prompt đòi trích **nguyên văn**, kèm `company_type` để đọc đúng góc (Specs nhóm 2), model qua env, mặc định `claude-sonnet-5`.
5. Khu vùng đọc trên web: danh sách bản lưu theo `captured_at`, claim dưới mỗi bản lưu, ba mức `confidence` phân biệt **bằng ký hiệu/màu** không chỉ bằng chữ (Specs nhóm 2).
6. Bấm claim → mở bản lưu, cuộn tới `quote_start`, highlight (T-3). Đọc lại nguồn **không xoá claim cũ** — claim mới nằm cạnh, mỗi cái mang thời điểm riêng.
7. **Trả nợ verify ADR-0014**: chạy thật một lần với API key, đối chiếu tay từng câu trích, ghi tỉ lệ khớp vào mục "Đội đã verify" của ADR-0014 + ADR-0002/0003/0007 (một lần đo, các ADR dùng chung).

## Validation

- [ ] T-2 xanh: thiếu câu trích → từ chối, cả qua service lẫn `INSERT` thẳng
- [ ] T-2b xanh: câu trích paraphrase → từ chối cả claim
- [ ] **Phép đo đột biến:** xoá dòng kiểm chuỗi con → T-2b phải **đỏ**. Vẫn xanh = việc kiểm là trang trí
- [ ] I-3 xanh: đọc lại nội dung y nguyên → 0 bản lưu mới, 0 lần gọi extractor
- [ ] I-4 xanh: claim `trigger_context = manual_ingest` không sinh `TimelineEntry` nào
- [ ] T-3 chạy tay: bấm claim → mở đúng đoạn, có đánh dấu
- [ ] Nguồn lỗi → `fetch_status = failed`, không có claim nào được sinh
- [ ] Ba mức chắc chắn phân biệt được khi **chụp màn hình đen trắng** (không chỉ dựa màu)
- [ ] ADR-0014 mục verify đã có **ba con số thật**, không còn chữ "chưa chạy"

## Risks

| Rủi ro | Xử lý |
| --- | --- |
| LLM paraphrase → claim bị bỏ hàng loạt, P5/P6 không có nguyên liệu | Đo tỉ lệ khớp **trước** khi P5/P6 bắt đầu. Sửa prompt (đòi trích nguyên văn, cấm viết lại). **Không** hạ chuẩn kiểm |
| Offset lệch vì chuẩn hoá text hai lần khác nhau | Hàm chuẩn hoá **một chỗ duy nhất**, dùng cho cả lúc lưu và lúc highlight. Test round-trip |
| Gọi LLM trong test làm test chậm và không tất định | Port `CLAIM_EXTRACTOR` đã có sẵn từ skeleton — test **luôn** cắm fixture |

## Rollback

Đổi provider sang `FixtureClaimExtractor` bằng một biến môi trường: ~10'. Nhóm 2–5 vẫn chạy trên bộ bản chụp seed.

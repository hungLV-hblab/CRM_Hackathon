---
phase: 2
title: "Nhóm 2 — bản lưu, phát hiện, provenance"
status: done
priority: P1
dependencies: [1a]
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

Chạy 13/08 03:00–03:25. **113 unit + 6 e2e xanh** (từ 88 + 3), `pnpm typecheck` + `pnpm lint` sạch.

- [x] T-2 xanh: thiếu câu trích → từ chối, **cả hai đường** — service (khẳng định 1) và `INSERT` SQL thẳng bằng `crm_owner` (khẳng định 3)
- [x] T-2b xanh: câu trích paraphrase → **bỏ cả claim**, không nới, không hạ mức để giữ lại
- [x] **Phép đo đột biến:** đổi dòng kiểm thành `?? { quoteStart: 0, quoteEnd: length }` → khẳng định 1 **đỏ** (`expected 1 to be +0`); khôi phục → 15/15 xanh
- [x] I-3 xanh: đọc lại nội dung y nguyên → 0 bản lưu mới **và extractor được gọi đúng 1 lần** (spy đếm; đây là nửa đắt tiền của I-3)
- [x] I-4 xanh: claim `manual_ingest` → 0 `TimelineEntry`, 0 `Proposal`, ô `industry` không đổi
- [x] T-3 **tự động hoá thành e2e** thay vì chạy tay: bấm phát hiện → `<mark>` hiện ra, và đoạn được đánh dấu là chuỗi con thật của `data-testid="source-text"`
- [x] Nguồn lỗi → `fetch_status = failed`, `raw_html` NULL, 0 claim; giao diện nói "không đoán"
- [x] Ba mức chắc chắn phân biệt được khi chụp đen trắng: mỗi mức có **chữ + ký hiệu chấm** (`●●●` / `●●○` / `●○○`), màu không phải thứ duy nhất mang nghĩa
- [x] ADR-0014 mục verify có ba con số thật — **3/3**, trả 13/08 11:28 với `claude-haiku-4-5`: 11 draft, **0 bị bỏ vì không nguyên văn**, 7 bị hạ khỏi mức Chắc. Đối chiếu độc lập bằng SQL: 6/6 câu trích là chuỗi con thật **và** offset cắt lại ra đúng chuỗi đó

### Phát sinh ngoài phase file

- **Ba lỗi phép đo LLM thật bắt được ngày 13/08** (chi tiết trong [ADR-0014](../../docs/decisions/0014-nhom-2-rut-phat-hien-bang-llm-that-code-kiem-cau-trich.md) phép đo 3): (1) `docker-compose.yml` không truyền `ANTHROPIC_API_KEY` vào `api`/`worker` → có key vẫn chạy fixture, **đã sửa**; (2) statement trả về tiếng Anh, **đã sửa prompt**; (3) cửa kiểm mức Chắc hạ 5/6 claim chỉ vì tên công ty viết đủ — **chưa sửa, chờ quyết định** ở [ADR-0018](../../docs/decisions/0018-cua-kiem-muc-chac-bo-qua-ten-cua-chinh-cong-ty-dang-doc.md).
- **`pnpm test:unit` không khởi động được trên Node 22.11.** Vite 7 là ESM-only, `vitest.config.ts` bị nạp theo đường CJS, `ERR_REQUIRE_ESM` — không phải test đỏ mà là **cả bộ test không chạy**, và nó im lặng với người chỉ nhìn dòng cuối. Đổi 4 file config sang `.mts` → 113/113 xanh trên đúng Node đó. Sửa ở repo chứ không bắt mỗi người nâng Node, vì máy ai người nấy.

- **Lỗ ADR-0009 đã bịt.** Nút tắt AI dừng *mọi* việc sinh mới, mà ingest tay là một đường sinh mới — phase file không nhắc. Thêm cửa chặn đọc `system_settings` mỗi lần gọi (không cache, cùng lý do với worker) + khẳng định 10: tắt AI → `skippedReason = 'ai_disabled'`, không bản lưu mới, **dữ liệu cũ còn nguyên**.
- **Cửa kiểm mức `certain` của ADR-0007** chưa có trong phase file nhưng ADR đòi: `ClaimService.gateCertainty` — mọi số và chuỗi viết hoa trong `statement` phải có trong `quote_text`, không thoả thì hạ `likely`. Hai khẳng định (11, 12).
- **`e2e/global-setup.ts` seed lại trước mỗi lần chạy.** Vùng đọc *tích luỹ* bản lưu, nên e2e chạy trên trạng thái lần trước sẽ thấy màn hình khác mỗi lần — đã gặp thật: hai test đỏ vì *hành vi đúng* (hai thẻ bản lưu thay vì một, "đã đọc không đổi" ở lần bấm đầu). Đây là loại flake tệ nhất vì nó dụ người ta nới khẳng định thay vì sửa trạng thái. Đã kiểm tất định 3 lần chạy liên tiếp.
- **Chỉ số bị bỏ chưa có chỗ lưu.** `IngestResultDto` trả về `claimsDroppedNoVerbatimQuote` và `claimsDowngradedFromCertain`, giao diện hiện, log ghi — nhưng **không persist**. `WatchCycleRun` không có cột cho nó. P7/P8 phải quyết: thêm cột hay tính từ `claims`. Không tự thêm cột vì sẽ phá danh sách GRANT theo cột của ADR-0015.

## Risks

| Rủi ro | Xử lý |
| --- | --- |
| LLM paraphrase → claim bị bỏ hàng loạt, P5/P6 không có nguyên liệu | Đo tỉ lệ khớp **trước** khi P5/P6 bắt đầu. Sửa prompt (đòi trích nguyên văn, cấm viết lại). **Không** hạ chuẩn kiểm |
| Offset lệch vì chuẩn hoá text hai lần khác nhau | Hàm chuẩn hoá **một chỗ duy nhất**, dùng cho cả lúc lưu và lúc highlight. Test round-trip |
| Gọi LLM trong test làm test chậm và không tất định | Port `CLAIM_EXTRACTOR` đã có sẵn từ skeleton — test **luôn** cắm fixture |

## Rollback

Đổi provider sang `FixtureClaimExtractor` bằng một biến môi trường: ~10'. Nhóm 2–5 vẫn chạy trên bộ bản chụp seed.

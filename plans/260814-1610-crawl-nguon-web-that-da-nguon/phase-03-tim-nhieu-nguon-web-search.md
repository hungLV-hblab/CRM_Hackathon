---
phase: 3
title: "Tìm nhiều nguồn — web_search, ứng viên, phân cấp"
status: done
priority: P2
dependencies: [2]
---

# Phase 3: Tìm nhiều nguồn — web_search, ứng viên, phân cấp

## Overview

Đưa tầng tìm nguồn vào: LLM + `web_search` server tool của Anthropic trả về URL **thật từ chỉ mục tìm kiếm**, người dùng tick chọn, danh sách được lưu, rồi "Đọc lại nguồn" đọc hết danh sách — mỗi URL một `Observation`, có cấp nguồn riêng.

Đây là phase **cắt được**. Một nguồn đọc được (P2) đã là "đọc dữ liệu công khai thật"; đa nguồn là điểm cộng.

## Requirements

**Chức năng**
- `SourceDiscovery.discover(company)` → ≤6 URL ứng viên, mỗi ứng viên có `url` · `sourceTier` · `snippet` · lý do.
- Ứng viên **không được persist**. Người tick chọn → POST → mới ghi vào `company_sources` dưới `crm_app`, actor là người.
- Danh sách lưu ≤5 URL / công ty.
- "Đọc lại nguồn" đọc hết danh sách; mỗi URL một `Observation` với `source_tier` tương ứng.
- Mạng xã hội **được phép** vào kết quả tìm và **được phép hỏng** — không dùng `blocked_domains`.

**Phi chức năng**
- `crm_system` **không** có INSERT trên `company_sources` (đã grant ở P1, phase này chỉ không được nới).
- Adapter fixture cho test; **không test nào gọi `web_search` thật**.
- Xử lý `stop_reason: "pause_turn"` và lỗi server-tool trả **HTTP 200**.

## Architecture

### Vì sao ứng viên phải qua một cú bấm của người

`companies.ts:39` có một comment đắt giá về `snapshot_variant`:

> *"`crm_system` holds SELECT on this table and no UPDATE, **so the AI cannot switch the source it then draws conclusions from** — measured, not assumed."*

Đó là nguyên tắc đã được lập luận và enforce: **AI không được tự chọn nguồn nó sẽ đọc.** "Tìm nguồn rồi tự lưu vào danh sách đọc" đúng là AI tự chọn nguồn — một đường ghi mới, ngoài hai ngoại lệ Specs mở ⇒ **vi phạm CLAUDE.md mục 4**.

Nên:

```
POST /companies/:id/source-candidates   → chạy web_search, TRẢ VỀ ứng viên. KHÔNG ghi gì.
                                          (crm_system không có INSERT — đã enforce ở CSDL)
POST /companies/:id/sources             → người đã tick; ghi dưới crm_app, added_by = user.
GET  /companies/:id/sources             → danh sách đang dùng để đọc.
```

Đổi lại: refresh trang mất danh sách ứng viên. Chấp nhận — thao tác 20–40 giây, và nó làm ADR dễ bảo vệ hơn nhiều. Khớp đúng luật 3: *máy chuẩn bị sẵn, người quyết định ghi.*

### Port + hai adapter — đúng mẫu ADR-0014

Port đặt trong `packages/contracts/src/ports/` cho khớp `CLAIM_EXTRACTOR` — adapter nằm ở `apps/api/src/ai/`. Cùng hình dạng đã chạy thật ở ADR-0014, không phát minh cách thứ hai.

```ts
// packages/contracts/src/ports/source-discovery.ts
// String token, NOT a Symbol -- matches `CLAIM_EXTRACTOR` at ports/claim-extractor.ts:71.
export const SOURCE_DISCOVERY = 'SOURCE_DISCOVERY'
export interface SourceCandidate {
  url: string
  sourceTier: 'company_website' | 'news' | 'social'
  snippet: string        // đoạn trích lúc tìm — vì sao người này nên chọn
  reason: string         // câu tiếng Việt: vì sao URL này liên quan công ty
}
export interface SourceDiscovery {
  discover(input: { companyName: string; companyWebsite: string | null; companyType: string }):
    Promise<SourceCandidate[]>
}
```

`AnthropicSourceDiscovery` (thật) và `FixtureSourceDiscovery` (tất định, không mạng). Provider chọn theo `ANTHROPIC_API_KEY`, **log lúc boot** — đúng `claim-extractor.provider.ts`.

### Gọi `web_search` — ba bẫy phải xử lý

```ts
tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 3 }]
```

Model: `claude-sonnet-5` (khớp `anthropic-claim-extractor.ts:33`). Giá: **$10 / 1000 lượt tìm**. Dùng lại `ANTHROPIC_API_KEY` — không vendor mới, không key mới.

| Bẫy | Xử lý |
| --- | --- |
| Vòng lặp server dừng ở 10 vòng → `stop_reason: "pause_turn"` | Gửi lại request với assistant turn đã có, **không** thêm message "Continue". Giới hạn số lần nối tiếp (5) để không lặp vô hạn |
| Lỗi server-tool trả **HTTP 200**, không throw | Khối `web_search_tool_result` có `.content` là **list** khi thành công, là **object lỗi** khi lỗi (`max_uses_exceeded`…). Phải phân nhánh theo hình dạng **trước khi** index |
| Model trả JSON sai hình dạng | Zod parse; sai → trả `[]`. Rỗng là câu trả lời hợp lệ và tốt hơn bịa — cùng nguyên tắc `anthropic-claim-extractor.ts:143-148` |

**Không dùng `web_fetch`.** Xem [ranh giới kiến trúc](./plan.md#ranh-giới-kiến-trúc--dòng-quan-trọng-nhất-của-cả-plan). Adapter này chỉ được trả **URL + đoạn trích**, không bao giờ trả nội dung trang để làm `raw_content`.

### Giao diện

Trên trang công ty: nút **Tìm nguồn công khai** → danh sách ứng viên, mỗi dòng có URL, cấp nguồn, đoạn trích, lý do, một checkbox → nút **Lưu nguồn đã chọn**. Danh sách đang dùng hiện riêng, xoá được từng dòng.

Phản hồi tiến trình bắt buộc: tìm mất 10–20s. Nút im lặng 20 giây là nút người dùng tưởng treo.

## Related Code Files

**Create**
- `packages/contracts/src/ports/source-discovery.ts` (cùng chỗ với `CLAIM_EXTRACTOR`)
- `apps/api/src/ai/anthropic-source-discovery.ts`
- `apps/api/src/ai/fixture-source-discovery.ts`
- `apps/api/src/ai/source-discovery.provider.ts`
- `apps/api/src/domain/company/company-source.controller.ts` + service
- `apps/api/src/ai/__tests__/anthropic-source-discovery.test.ts`
- `apps/api/src/domain/company/__tests__/company-source-candidates.test.ts`
- `apps/web/src/app/(app)/cong-ty/[id]/source-discovery-section.tsx`

**Modify**
- `apps/api/src/domain/observation/observation-service.ts` (lấy danh sách URL từ `company_sources`, thay cho `companies.website` của P2)
- `packages/contracts/src/dto/*` · `packages/contracts/src/index.ts`
- `apps/web/src/lib/api-client.ts` · `apps/web/src/app/(app)/cong-ty/[id]/page.tsx`

## Implementation Steps

### Bước 0 — test trước, phải thấy đỏ

1. `anthropic-source-discovery.test.ts` — mock SDK, **không mạng**:
   - Phản hồi thành công → parse ra đúng ứng viên
   - `stop_reason: 'pause_turn'` → nối tiếp đúng một lần rồi hoàn tất; và **có giới hạn** số lần nối
   - `web_search_tool_result.content` là **object lỗi** → không throw, trả `[]` hoặc bỏ đúng khối đó
   - JSON sai hình dạng → `[]`, không throw
   - URL trùng nhau → dedupe; quá 6 → cắt còn 6
2. `company-source-candidates.test.ts`:
   - `POST /source-candidates` → trả ứng viên và **`company_sources` vẫn rỗng** (assert đếm hàng = 0 — đây là test của nguyên tắc "AI không tự chọn nguồn", không phải test của endpoint)
   - `POST /sources` → ghi đúng số dòng, `added_by` là user đang đăng nhập
   - Quá 5 URL → từ chối
   - URL trùng trong cùng công ty → `UNIQUE` chặn, trả lỗi rõ
3. Test tích hợp `ObservationService`: 3 URL trong `company_sources` với 3 cấp nguồn → **3 `Observation`**, mỗi bản đúng `source_tier`; một URL hỏng → 2 ok + 1 failed, và bản failed có 0 `Claim`.
3b. **Thứ tự ưu tiên (V4):** `company_sources` không rỗng → đọc đúng danh sách đó và **không** đọc `companies.website`; `company_sources` rỗng + `website` có → đọc `website`; cả hai rỗng → `invalid_url`.
4. Bổ sung vào bộ nghiệm thu: `OBSERVATION_SOURCE=live_crawl` + công ty seed → spy của `SourceDiscovery` đếm **0**.

### Bước 1 — port + fixture

`FixtureSourceDiscovery` trả tất định 3 ứng viên (một mỗi cấp nguồn) dẫn tới host cục bộ mà test kiểm soát. Đây là adapter mà **toàn bộ test tích hợp** dùng.

⚠️ `packages/contracts/src/index.ts:2` export **từng port một** (`export * from './ports/claim-extractor'`), không phải `export * from './ports'`. Thêm port mới **phải thêm một dòng export** — nếu không thì `@crm/contracts` không thấy nó và lỗi chỉ hiện lúc import ở `apps/api`.

### Bước 2 — adapter thật

`AnthropicSourceDiscovery` với `web_search_20260209`, `max_uses: 3`, xử lý ba bẫy ở mục Architecture. Prompt: yêu cầu model **chỉ trả URL từ kết quả tìm kiếm**, kèm cấp nguồn và một câu lý do tiếng Việt; **cấm bịa URL không có trong kết quả** (và Zod + việc URL phải xuất hiện trong khối `web_search_tool_result` là cửa kiểm bằng code, không tin lời).

### Bước 3 — endpoint + đổi nguồn URL của `ObservationService`

Ba endpoint ở mục Architecture. `ObservationService` đọc `company_sources` **trước**; danh sách rỗng → **rơi về `companies.website`** (quyết định validation V4); cả hai trống → `fetch_error_reason='invalid_url'`.

Lý do chọn rơi-về thay vì "chỉ đọc `company_sources`": nó **giữ nguyên hành vi P2**, nên P3 không làm đỏ test của P2, và người dùng bật công tắc rồi bấm đọc luôn vẫn được mà không bị bắt buộc phải Tìm nguồn trước. Đánh đổi đã nhận: có **hai** nguồn sự thật cho câu "đọc ở đâu", nên thứ tự ưu tiên phải có test riêng — `company_sources` **luôn** thắng khi không rỗng.

<!-- Updated: Validation Session 1 - V4 danh sách rỗng rơi về companies.website -->


### Bước 4 — giao diện

`source-discovery-section.tsx`. Phản hồi tiến trình. Checklist mục 7 design-guidelines. Thêm e2e cho luồng: tìm → tick → lưu → đọc. **Không đổi accessible name nào đang có.**

### Bước 5 — xanh lại

`pnpm test` đủ bộ · `lint` · `typecheck` · `docker compose build`. Thử tay một lần với công ty thật. Commit.

**Nếu đang dở lúc 22:30 → `git revert` phase này, giữ P1+P2.** Không commit trạng thái dở.

## Success Criteria

- [ ] Mọi test ở Bước 0 **đã từng đỏ**, giờ xanh
- [ ] `POST /source-candidates` chạy xong mà `company_sources` **vẫn rỗng** — nguyên tắc "AI không tự chọn nguồn" có test, không chỉ có GRANT
- [ ] `pause_turn` được nối tiếp đúng và **có giới hạn**
- [ ] Lỗi server-tool (HTTP 200 + object lỗi) không throw, không làm sập lượt đọc
- [ ] 3 URL ba cấp nguồn → 3 `Observation` đúng `source_tier`; một URL hỏng không làm hỏng hai URL kia
- [ ] Mạng xã hội vào được kết quả tìm, hỏng ra `http_4xx`/`js_required`, và giao diện nói lý do bằng tiếng Việt
- [ ] Công ty seed → `SourceDiscovery` gọi **0** lần
- [ ] `pnpm test` đủ bộ xanh gồm T-1…T-10; **không** test nào gọi mạng
- [ ] Đo được: số ứng viên trả về vs số được người chọn (log là đủ ở vòng này)

## Risk Assessment

| Rủi ro | Đối sách |
| --- | --- |
| **Chất lượng URL `web_search` trả về cho công ty B2B Nhật/ASEAN nhỏ** — ẩn số lớn nhất, không đo được trước khi chạy | Thử tay sớm ở Bước 2 với 2–3 công ty thật **trước khi** làm giao diện. Nếu tệ: giữ P1+P2, cắt P3, khai thẳng ở ADR |
| Model bịa URL không có trong kết quả tìm | Cửa kiểm bằng code: URL phải xuất hiện trong khối `web_search_tool_result` của cùng lượt gọi. Không tin prompt |
| `pause_turn` lặp vô hạn | Giới hạn 5 lần nối tiếp, có test |
| Hình dạng khối server-tool khác tài liệu | Đây là chỗ **chưa verify bằng một lượt chạy thật** (đã khai ở báo cáo brainstorm). Chạy thử một lần, log nguyên khối, rồi mới viết parser |
| Chi phí/độ trễ vượt kỳ vọng | `max_uses: 3`, ứng viên ≤6, danh sách lưu ≤5. Tách hành động tìm khỏi hành động đọc đã cắt phần lớn chi phí lặp |
| Nới GRANT cho tiện | **Cấm.** `crm_system` INSERT vào `company_sources` là mất nguyên tắc lớn nhất của phase này. Test quyền ở P1 canh chỗ đó |

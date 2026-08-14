---
title: "Nguồn web thật, đa nguồn có phân cấp — LLM tìm nguồn, code đọc bytes"
description: "Trả nợ ba cửa gác I-15/I-16/I-17 bằng test, rồi mở đường đọc nguồn web thật cho công ty ngoài seed: web_search của Anthropic tìm URL, code của mình fetch bytes, ClaimExtractor không đổi một dòng"
status: done
priority: P1
effort: large
branch: "feat/live-crawl-sources"
tags: [crawl, observation, provenance, autonomy-ceiling, web-search, ssrf]
blockedBy: []
blocks: []
created: "2026-08-14T16:10:00+07:00"
createdBy: "ck-plan --tdd"
mode: tdd
scope: "apps/api, packages/db, packages/contracts, apps/web"
source: plans/reports/brainstorm-260814-1600-crawl-nguon-web-that-da-nguon-report.md
---

# Nguồn web thật, đa nguồn có phân cấp

> **Đọc [báo cáo brainstorm](../reports/brainstorm-260814-1600-crawl-nguon-web-that-da-nguon-report.md) trước** — nó chứa lập luận, phương án bị loại, và bốn quyết định của người quyết định. Plan này chỉ thi công.
> Tiền đề đã chốt sáng nay: [ADR-0035](../../docs/decisions/0035-cho-phep-nguon-web-that-kem-dieu-kien-ban-chup-van-la-nguon-cua-bo-nghiem-thu.md) + [prompt log 260814-1124](../../docs/ai-sessions/260814-1124-req-crawl-web-that.md). **Không mở lại** câu "có được crawl không".
> **Chế độ TDD:** mỗi phase viết test **trước**, thấy đỏ, rồi mới code. Lý do ở mục [Vì sao TDD](#vì-sao-tdd-không-phải-nghi-lễ).

## Mục tiêu

Hai việc, và chúng khác nhau:

1. **Trả nợ.** `docs/ontology.md` mục 6 tự khai: *"I-15, I-16, I-17 chưa có test… công tắc không được bật trước khi cả ba xanh."* CLAUDE.md mục 8 gạch *"❌ Ontology viết trong file md nhưng code không đọc → trang trí"*. Đây là món nợ đã khai, có bằng chứng, phải trả.
2. **Bịt vùng trắng.** `SNAPSHOTS` chỉ có 5 công ty seed. Sales tạo công ty mới qua UI (`e2e/login-and-create-company.spec.ts` có thật) → `snapshots.read()` trả `null` → vùng đọc **vĩnh viễn** "không đọc được". Nguồn thật lấp đúng chỗ đó, và **không đi qua đường nào của bộ seed**.

**Nói thẳng cái giá:** crawl thật **không thêm điểm nghiệm thu nào**. Giám khảo chạy T-1…T-10 trên bộ seed, mà I-16 chặn nguồn thật khỏi seed. Giá trị nằm ở vòng 2 (giải thích được bằng hành vi, không bằng lời hứa) và vòng 3 (demo đọc thật). Ai kỳ vọng điểm tầng 1 từ plan này là kỳ vọng sai.

## Ranh giới kiến trúc — dòng quan trọng nhất của cả plan

**LLM quyết *đọc ở đâu*. Code quyết *cái gì được lưu và trích thế nào*.**

| Tầng | Ai làm | Ra cái gì |
| --- | --- | --- |
| 1 · Tìm nguồn | LLM + `web_search` server tool | URL ứng viên + cấp nguồn + đoạn trích. **Không rút phát hiện** |
| 2 · Đọc bytes | `LiveCrawlSource` — code của mình | 1 `Observation` / 1 URL, `raw_content` qua `normalizeSnapshotText` |
| 3 · Rút phát hiện | `ClaimExtractor` đang có — **không sửa một dòng** | `Claim` + câu trích, qua đúng cửa I-1/I-2 |

**Cấm dùng `web_fetch` của Anthropic để lấy nội dung công ty.** [ADR-0012](../../docs/decisions/0012-ban-luu-giu-html-goc-va-text-trich-offset-tinh-tren-text.md): `content_hash` và `quote_start`/`quote_end` tính trên `raw_content` **của mình**. Để model tải và tóm tắt trang thì mình không còn nắm byte gốc → cửa I-2 (câu trích là chuỗi con nguyên văn) mất chỗ đứng, provenance sụp. Đây không phải sở thích, đây là điều kiện để luật 1 còn đúng.

## Vì sao TDD, không phải nghi lễ

Plan này sửa **hai bất biến đã có test** và đi qua đường code của bộ nghiệm thu:

| Bất biến | Đang ở đâu | Sửa gì | Vì sao test phải đi trước |
| --- | --- | --- | --- |
| **I-3** | `observation-service.ts:238` — so hash với bản lưu mới nhất **của công ty** | so theo `(company_id, source_url)` | Đa URL làm hash của URL A bị so với bản lưu của URL B ⇒ mỗi lần đọc sinh N hàng **và N lượt gọi LLM**. Test cũ vẫn xanh khi hỏng, vì bản chụp mỗi công ty đúng 1 URL |
| **Cặp gương I-4/I-5** | `proposal-service.ts:245` ↔ `system-timeline-entry-service.ts:62` | thêm nhánh `live_crawl`, **lật chiều** ở vế gợi ý | Comment trong code nói rõ hai bộ lọc **cố ý trùng lặp** để một test chứng minh chúng phân hoạch sạch. Lệch một điều kiện = vừa ghi vừa xếp gợi ý, hoặc **không làm gì cả** — và loại thứ hai lọt âm thầm |

Cái hố mà [ADR-0028](../../docs/decisions/0028-quyen-ghi-muc-dong-thoi-gian-den-tu-nhan-dang-theo-doi-khong-tu-trigger-context.md) mô tả sống lại nguyên vẹn ở đây: quên lật chiều I-5 thì **I-15 chặn mục + I-5 chặn gợi ý ⇒ phát hiện không có đường nào ra**, rồi I-3 làm nó vĩnh viễn. Không có triệu chứng, không có log, không có exception. Chỉ có một phát hiện biến mất.

Đó là lý do TDD ở đây không phải nghi lễ: **bảng hai chiều phải đỏ trước khi nó xanh**, nếu không thì không biết nó có đo gì không.

## Phases

| # | Phase | Ước lượng | Phụ thuộc | Cắt được? | Để lại gì |
| --- | --- | --- | --- | --- | --- |
| 1 | [Cửa gác có test — I-15, I-16, I-17, I-3](./phase-01-cua-gac-co-test.md) | 2h | — | ❌ **phải có** | Ontology hết là trang trí. 0 rủi ro mạng |
| 2 | [Đọc một nguồn thật — SSRF, timeout, phân loại lỗi](./phase-02-doc-mot-nguon-that.md) | 1h30' | 1 | ⚠️ điểm dừng sạch | **Demo đọc thật chạy được** |
| 3 | [Tìm nhiều nguồn — web_search, ứng viên, phân cấp](./phase-03-tim-nhieu-nguon-web-search.md) | 2h | 2 | ✅ cắt được | Đa nguồn ba cấp |
| 4 | [Cửa chốt — ADR, ontology, prompt log](./phase-04-cua-chot-adr-ontology.md) | 25' | mọi phase đã chạy | ❌ **phải có** | Quyết định tồn tại với BGK |

```
P1 cửa gác ── P2 một nguồn thật ── P3 đa nguồn ── P4 cửa chốt
     │              │                              ▲
     └── dừng ok    └── dừng ok (demo được) ───────┘
```

Ba chặng **tuần tự**, không song song hoá được: P2 cần cột `source_kind` của P1, P3 cần đường đọc của P2. Không chia chủ quyền file cho nhiều người.

**Người quyết định đã chốt: làm cả 3, không cắt.** Mục [Mốc cắt cứng](#mốc-cắt-cứng) vẫn giữ — không để cắt, mà để mỗi chặng **commit được và test xanh trước khi sang chặng sau**. Rủi ro lớn nhất không phải "không xong" mà là "P3 xong nửa vời kéo P1–P2 theo".

## Mốc cắt cứng

Đồng hồ, không phải cảm giác. Bắt đầu tính từ 16:10.

| Đồng hồ | Nếu chưa xong cái này thì |
| --- | --- |
| **+2h** (~18:10, P1 xong) | Đây là **sàn**. Chưa tới đây thì nhảy thẳng P4, khai công tắc vẫn tắt, nợ vẫn còn nhưng ontology đã đúng |
| **+3h30'** (~19:40, P2 xong) | **Điểm dừng sạch nhất.** Demo đọc thật chạy được. Commit, chạy đủ `pnpm test`, rồi mới quyết có làm P3 |
| **P3 chưa bắt đầu lúc 21:00** | Cắt P3. Một nguồn đọc được vẫn là "đọc dữ liệu công khai thật"; đa nguồn là điểm cộng |
| **P3 đang dở lúc 22:30** | `git revert` P3, giữ P1+P2. **Không** commit trạng thái dở |
| **Còn ≤25'** | Chỉ chạy P4. ADR là **điều kiện**, không phải phần thưởng (CLAUDE.md mục 5) |

**Không cắt: P1, P4.**

## Luật áp cho mọi phase

- **Test đi trước code trong từng phase.** Viết test → chạy → **thấy đỏ** → mới code. Test xanh ngay từ đầu là test không đo gì; sửa test, đừng đi tiếp.
- **Không test nào được gọi internet.** Mọi phase: adapter fixture cho tầng LLM (mẫu [ADR-0014](../../docs/decisions/0014-nhom-2-rut-phat-hien-bang-llm-that-code-kiem-cau-trich.md)) · `fetchPage` test với http server cục bộ · `assertPublicUrl` test bằng bảng IP. Một test gọi internet thật là một test hỏng.
- **Chạy `pnpm test` sau mỗi phase, không dồn.** `test:e2e` cần stack ở `:8080`.
- **Không sửa `ClaimExtractor`** (`anthropic-claim-extractor.ts`, `fixture-claim-extractor.ts`, `claim-service.ts`). Nếu thấy cần sửa thì thiết kế sai chỗ khác, dừng lại và hỏi.
- **Không gộp cặp gương I-4/I-5 thành helper chung.** Comment ở `system-timeline-entry-service.ts:28-34` giải thích tại sao trùng lặp là cố ý: *"hiding them behind a shared helper would make an asymmetric change compile silently."*
- **`crm_system` không được có INSERT trên `company_sources`.** AI không tự chọn nguồn nó đọc — enforce bằng GRANT, không bằng lời dặn. Xem [P3](./phase-03-tim-nhieu-nguon-web-search.md).
- **Không thêm `db:push`** vào `package.json` (nó xoá GRANT theo cột của ADR-0010).
- Code + comment **tiếng Anh**; chỉ chuỗi hiển thị cho Sales giữ **tiếng Việt**. Tên file tiếng Anh không dấu.
- `apps/web` **không có unit test** — `vitest.config.mts` chỉ có `projects: ['packages/*','apps/api']`, repo không có `@testing-library/react`/`jsdom`. Bất biến giao diện khoá bằng **e2e Playwright**.
- Mỗi phase kết thúc bằng **một commit chạy được**. Conventional commit, không nhắc AI.

## Lược đồ CSDL — toàn bộ thay đổi

```
observations
  + source_kind        text NOT NULL DEFAULT 'demo_snapshot'
                       CHECK (source_kind IN ('demo_snapshot','live_crawl'))
  + fetch_error_reason text
                       CHECK (fetch_error_reason IS NULL OR fetch_status = 'failed')
    -- source_tier: KHÔNG đổi schema. Chỉ thêm giá trị 'news' | 'social'.
    --   observations.ts:35-38 đã dự tính sẵn: "A second tier (news, LinkedIn)
    --   is a new value, not an ALTER TYPE."

companies
  + live_source_enabled  boolean NOT NULL DEFAULT false

company_sources                                       (bảng mới)
  id · company_id → companies · url · source_tier
  discovered_via  text     -- 'web_search' | 'manual'
  search_snippet  text     -- vì sao người này chọn URL đó
  added_by        → users
  created_at
  UNIQUE (company_id, url)
```

### GRANT — hai chỗ được miễn, một chỗ phải thêm bằng tay

Đã đối chiếu `0001_grants.sql` và `0003_grants_ai_tables.sql`, **không suy diễn**:

| Thay đổi | Sửa GRANT? | Bằng chứng |
| --- | --- | --- |
| `observations.source_kind`, `fetch_error_reason` | **Không** | `0003:` `GRANT SELECT, INSERT ON observations` là **table-level** ⇒ cột mới tự có. Bẫy ADR-0015 (grant theo cột) **không cắn ở đây** — khác hẳn `proposals` / `timeline_entries` / `auto_next_step_events` / `notifications` |
| `companies.live_source_enabled` | **Không** | `0001:38` `crm_system` chỉ có `GRANT SELECT ON companies`, **không UPDATE nào** ⇒ AI **không thể** tự bật công tắc nguồn của chính nó. Cùng cơ chế đã bảo vệ `snapshot_variant` (`companies.ts:39`). `crm_app` có `GRANT ALL` (`0001:23`) ⇒ người bật được |
| Bảng mới `company_sources` | **Có — đúng một dòng** | `0001:13` `crm_system` cố ý **không** có `ALTER DEFAULT PRIVILEGES` ⇒ bảng mới bị cấm cho AI tới khi grant tay. Cần `GRANT SELECT ON company_sources TO crm_system` — **không INSERT, không UPDATE**. `crm_app` tự có qua `ALTER DEFAULT PRIVILEGES` (`0001:29`) |

Dòng thứ ba là dòng đáng giá nhất: **"AI không tự chọn nguồn nó đọc" thành ràng buộc CSDL**, không phải một câu trong doc.

## Tiêu chí nghiệm thu của cả plan

- [ ] `pnpm test` xanh — mọi unit + e2e cũ **không đỏ một cái nào**, cộng đúng số test mới có chủ đích
- [ ] `pnpm lint` · `pnpm typecheck` xanh · `docker compose build` xanh (đường build thật)
- [ ] **I-16:** bật nguồn thật cho công ty seed → **bị từ chối** + có `AuditEvent`
- [ ] **I-15 vế 1:** công ty ngoài seed, `is_watched = true`, nguồn `live_crawl` → **0 `TimelineEntry`, 0 `AutoNextStepEvent`, 0 hàng `opportunities` bị sửa**
- [ ] **I-15 vế 2:** cùng ca đó → **có `Proposal` loại `timeline_entry`** (cửa I-5 gạt sang chiều gợi ý) **và có `Proposal` loại `next_step`** (nhóm 4 chạy chế độ chỉ-đề-xuất — validation V1). Không có ô nào của bảng bốn ô ra "0 gợi ý + 0 mục + 0 việc tiếp theo"
- [ ] Với `live_crawl`, **cả hai** ca của I-7 (ô Việc tiếp theo trống / đang có chữ người gõ) đều ra gợi ý `next_step`
- [ ] **I-17:** `OBSERVATION_SOURCE` trống / gõ sai → rơi về `demo_snapshot`, **không** báo lỗi rồi dừng. `ai_enabled=false` dừng cả nguồn thật
- [ ] **Bộ nghiệm thu bất khả xâm phạm:** bật `OBSERVATION_SOURCE=live_crawl`, chạy đủ T-1…T-10 → xanh, mọi bản lưu có `source_kind='demo_snapshot'`, spy của crawler **và** của `web_search` đếm **0**
- [ ] **I-3:** cùng URL đọc hai lần nội dung không đổi → 1 bản lưu, extractor gọi **0** lần lượt hai. Hai URL khác nhau cùng nội dung → **2** bản lưu
- [ ] **SSRF:** URL trỏ private/loopback/link-local hoặc scheme lạ → từ chối **trước khi phát request**, `fetch_error_reason='blocked_url'`
- [ ] **Đọc hỏng ghi trung thực:** mỗi loại lỗi ra đúng một giá trị `fetch_error_reason`, **0 `Claim`** sinh ra từ bản lưu hỏng
- [ ] **`crm_system` không INSERT được vào `company_sources`** — test đo bằng cách nối **đúng vai** (`DATABASE_URL_TEST_SYSTEM`), giống các test quyền theo cột đang có
- [ ] **Không test nào gọi internet** — kiểm bằng cách chạy `pnpm test:unit` với mạng tắt
- [ ] Giao diện: phân biệt **bằng mắt** loại nguồn (bản chụp / nguồn thật) + cấp nguồn + lý do đọc hỏng bằng tiếng Việt. Qua checklist mục 7 [design-guidelines](../../docs/design-guidelines.md)
- [ ] **ADR mới** cho bốn quyết định của phiên brainstorm, kèm phương án bị loại
- [ ] `docs/ontology.md` cập nhật: `source_kind` vào bảng 3.5, giá trị mới của `source_tier`, `company_sources`, tick hai ô checklist mục 10. File về trạng thái **chờ duyệt lại**
- [ ] Prompt log phiên brainstorm lưu vào `docs/ai-sessions/`

## Chủ quyền file

Một người làm tuần tự. Nhánh `feat/live-crawl-sources` từ `origin/master`.

| Phase | File chạm |
| --- | --- |
| 1 | `packages/db/migrations/0008_live_source.sql` (mới) · `packages/db/src/schema/{observations,companies,company-sources}.ts` · `schema/{all-tables,index}.ts` · `packages/contracts/src/enums.ts` · `apps/api/src/ai/resolve-observation-source.ts` (mới — **hàm thuần, chưa phải provider**) · `apps/api/src/domain/observation/observation-service.ts` · `apps/api/src/domain/claim/claim-reaction-service.ts` · `apps/api/src/domain/proposal/proposal-service.ts` · `apps/api/src/watch/system-timeline-entry-service.ts` · `apps/api/src/domain/opportunity/auto-next-step-service.ts` · `apps/api/src/domain/company/company.controller.ts` + service · `docs/ontology.md` (bảng 3.5) |
| 2 | `apps/api/src/ai/assert-public-url.ts` · `apps/api/src/ai/fetch-page.ts` · `apps/api/src/ai/live-crawl-source.ts` · `apps/api/src/ai/observation-source.provider.ts` (đều mới — provider nằm ở P2 vì P1 chưa có nguồn thật nào để chọn) · `apps/web/src/components/provenance/reading-zone.tsx` · `packages/contracts/src/dto/*` · `.env.example` |
| 3 | `apps/api/src/ai/source-discovery.port.ts` · `anthropic-source-discovery.ts` · `fixture-source-discovery.ts` · `source-discovery.provider.ts` (đều mới) · `apps/api/src/domain/company/company-source.controller.ts` + service (mới) · `apps/web/src/app/(app)/cong-ty/[id]/` (UI chọn ứng viên) |
| 4 | `docs/decisions/0036-*.md` · `docs/ontology.md` · `docs/ai-sessions/` |

## Rủi ro

| Rủi ro | Xác suất | Đối sách |
| --- | --- | --- |
| **P3 dở dang lúc hết giờ** | **cao** | Commit riêng từng chặng. P2 là điểm dừng sạch. `git revert` P3 không ảnh hưởng P1–P2 |
| Quên lật chiều I-5 ⇒ phát hiện không có đường nào ra | **cao nếu không TDD** | Bảng hai chiều `(source_kind × is_watched)` phải **đỏ trước** khi xanh. Đây là lý do chọn `--tdd` |
| Test đi gọi internet thật | cao | Ba lớp: fixture adapter · http server cục bộ · `assertPublicUrl` là hàm thuần. Nghiệm thu có mục chạy với mạng tắt |
| Vỡ T-1…T-10 | trung bình | **Ba lớp chặn**: I-16 ở service · công tắc mặc định `false` · `OBSERVATION_SOURCE` mặc định `snapshot`. Cộng một test assert crawler + `web_search` gọi 0 lần trên bộ seed |
| Thêm dòng vào bảng 3.5 làm `ontology-enum-parity.test.ts` đỏ | **chắc chắn xảy ra** | Đó là **thiết kế**, không phải lỗi: test assert đúng số dòng (`:83`). Sửa số dòng **cùng commit** với migration, không sớm hơn |
| `FixtureClaimExtractor` ra 0 phát hiện trên trang thật | trung bình | Nói trước, không che: nguồn thật chỉ có nghĩa khi có `ANTHROPIC_API_KEY`. Không key → 0 phát hiện, **suy giảm trung thực** chứ không sai |
| Nội dung độc hại / trang bị deface vào sản phẩm | trung bình | Đúng chỗ I-15 gánh: nguồn thật **chỉ** vào hàng đợi duyệt |
| Demo có dòng đỏ từ mạng xã hội | trung bình | **Lựa chọn có chủ đích**, không phải lỗi. Giao diện phải nói lý do bằng tiếng Việt để nó đọc lên thành thông tin |
| Đọc chậm 20–40s, người dùng tưởng treo | trung bình | Phản hồi tiến trình; xử lý `pause_turn` đúng |
| Migration đêm freeze | thấp | Chỉ **cộng thêm**: 2 cột nullable/có default, 1 cột default `false`, 1 bảng mới, 1 dòng GRANT. Không sửa, không xoá cột nào |

## Câu hỏi chưa giải quyết

> Ba câu treo trong bản đầu **đã chốt** ở phiên validation — xem [Validation Log](#validation-log). Còn lại ba câu dưới đây, và cả ba đều **không chặn thi công**.

- **Có nên cache kết quả `web_search` theo công ty không?** Chưa cần: lựa chọn "tách hành động Tìm nguồn" đã làm cho mỗi công ty chỉ tìm một lần. Nếu sau này vòng quét tự tìm lại thì mới cần.
- **robots.txt và rate-limit theo host** — ngoài phạm vi vòng này vì vòng quét **không** crawl. Một cú fetch do người bấm vào URL người đó tự chọn thì không phải bot. Mở lại **ngay khi** vòng quét crawl.
- **Chất lượng URL `web_search` trả về cho công ty B2B Nhật/ASEAN quy mô nhỏ** là ẩn số lớn nhất của P3, và không đo được trước khi chạy. Nếu tệ, tỉ lệ ứng viên được người chọn sẽ nói ra ngay (mục đo ở P3).

## Validation Log

### Phiên 1 — 14/08/2026 16:35, `/ck:plan validate`

#### Verification Results

- Claims checked: **28** · Verified: **26** · Failed: **1** · Unverified: **1**
- Tier: **Standard** (4 phase → Fact Checker + Contract Verifier)
- **Failed:** `companies.ts:44` dẫn sai ở 4 chỗ (plan.md, phase-03, phase-04, báo cáo brainstorm) — dòng thật là **`:39`**. Đã sửa hết và xác nhận lại bằng `sed -n '39p'`.
- **Thiếu chính xác (không tính failed):** `observations.ts:36` → **`:35-38`**. Câu *"A second tier (news, LinkedIn)"* vắt qua hai dòng nên `grep` không khớp; nội dung đúng.
- **Phát hiện mới:** `packages/contracts/src/index.ts:2` export **từng port một** (`export * from './ports/claim-extractor'`), không phải `export * from './ports'`. Thêm port mới mà quên dòng export thì lỗi chỉ hiện lúc import ở `apps/api`. → đã thêm cảnh báo vào P3 Bước 1.
- **Unverified (đã khai từ báo cáo brainstorm):** hình dạng khối `web_search_tool_result` — lấy từ tài liệu, chưa có lượt chạy thật. P3 Bước 2 bắt log nguyên khối trước khi viết parser.
- Verified: `observation-service.ts:238` · `proposal-service.ts:245` · `system-timeline-entry-service.ts:62,28-34` · `demo-snapshots.ts:240-244,16-18` · `anthropic-claim-extractor.ts:18,33,143-148` · `ports/claim-extractor.ts:71` · `enums.ts:183-189` · `ontology-enum-parity.test.ts:83` · `0001_grants.sql:23,29,38` · `seed/index.ts:26` · `company.controller.ts:67` · `claim-reaction-service.ts:96-108` · `auto-next-step-service.ts` tồn tại · design-guidelines mục 7 = `:168` · migration kế tiếp `0008` · ontology `:24` và `:192` đúng là hai câu P4 phải sửa.

#### Quyết định

| # | Câu hỏi | Chốt | Lý do |
| --- | --- | --- | --- |
| **V1** | Nhóm 4 (tự đặt Việc tiếp theo) với `live_crawl`: bỏ hẳn hay chỉ-đề-xuất? | **Chạy chế độ chỉ-đề-xuất** | Đây là **lỗ tìm ra trong lúc verify, không có trong bản plan đầu**. `blockedNextSteps` là đường **duy nhất** để hàm ý Việc tiếp theo thành gợi ý `next_step`; bỏ hẳn nhóm 4 làm nó biến mất không dấu vết — cùng hình dạng cái hố ADR-0028 ở một tầng khác. I-15 nói nguồn thật *"chỉ sinh được `Proposal`"*, tức là **đòi** gợi ý này tồn tại |
| **V2** | `fetch_error_reason` vào `ENUMS` + bảng 3.5? | **Giữ ngoài `ENUMS`**, như `USER_ROLE` | Chi tiết chẩn đoán, không phải thuộc tính nghiệp vụ. Bảng 3.5 chỉ thêm `source_kind` ⇒ parity 12 → **13**. Lập luận ngược (nó *có* nhãn cho Sales) cũng đứng được — ADR phải ghi đây là **lựa chọn**, không phải chân lý |
| **V3** | Ai được bật `live_source_enabled`? | **Bất kỳ người dùng đã đăng nhập** | Theo [ADR-0033](../../docs/decisions/0033-vong-1-admin-co-quyen-crm-nhu-sales-ma-tran-quyen-chi-tiet-ngoai-pham-vi.md): vòng 1 không làm ma trận quyền. Chỉ `JwtGuard`, không thêm cửa kiểm vai trò; `AuditEvent` ghi actor nên vẫn truy được. **Trả lời câu hỏi mở số 2 của ontology** — P4 xoá nó |
| **V4** | `company_sources` rỗng thì đọc gì? | **Rơi về `companies.website`**; cả hai trống → `invalid_url` | Giữ nguyên hành vi P2 nên P3 không làm đỏ test của P2, và không bắt buộc phải Tìm nguồn trước khi đọc được. Đánh đổi đã nhận: **hai** nguồn sự thật cho "đọc ở đâu" ⇒ thứ tự ưu tiên phải có test riêng, `company_sources` **luôn** thắng khi không rỗng |

#### Propagation

| File | Sửa gì |
| --- | --- |
| `phase-01` | Bảng I-15 đổi hàng `AutoNextStepService` (không chạy → chỉ-đề-xuất) · bảng bốn ô thêm cột `next_step` · thêm hai ca I-7 · Bước 0 mục 2 assert ba con số/ô · Bước 2 chốt V2 · Bước 4 chốt V3 · thêm 2 tiêu chí nghiệm thu |
| `phase-03` | Bước 1 cảnh báo `contracts/src/index.ts` · Bước 3 chốt V4 + lý do + đánh đổi · thêm test 3b thứ tự ưu tiên |
| `phase-04` | Bảng quyết định ADR **4 → 6** dòng (thêm (e) nhóm 4 chỉ-đề-xuất, (f) `fetch_error_reason`) · thêm dòng "xoá câu hỏi mở số 2" vào checklist ontology |
| `plan.md` | Tiêu chí I-15 vế 1/2 · thêm tiêu chí I-7 hai ca · câu hỏi mở 6 → 3 · log này |
| báo cáo brainstorm | sửa `companies.ts:44` → `:39`, `observations.ts:36` → `:35-38` |

#### Whole-Plan Consistency Sweep

Đọc lại `plan.md` + cả 4 phase file sau propagation.

- ✅ "AutoNextStepService không chạy" **không còn** ở bất kỳ file nào — đã grep.
- ✅ Bảng bốn ô nhất quán giữa `plan.md` (tiêu chí nghiệm thu) và `phase-01` (Architecture + Bước 0 + Success Criteria).
- ✅ Parity 12 → **13** nhất quán ở `phase-01` Bước 2, rủi ro của `plan.md`, và quyết định (f) của `phase-04`. Không còn chỗ nào nói 14.
- ✅ V4 nhất quán: `phase-02` vẫn nói P2 dùng `companies.website` và P3 sẽ chuyển — đúng, vì V4 giữ `website` làm nhánh rơi-về chứ không xoá.
- ✅ Số quyết định ADR: `phase-04` nói "sáu quyết định", bảng có 6 dòng.
- ✅ Câu hỏi mở: 3 câu còn lại trong `plan.md` khớp với những gì `phase-03`/`phase-04` mô tả là chưa giải quyết.
- **0 mâu thuẫn chưa giải quyết.**

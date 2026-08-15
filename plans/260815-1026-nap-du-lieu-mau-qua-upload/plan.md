---
title: "Nạp dữ liệu mẫu BTC qua upload zip — xoá hẳn seed hư cấu"
description: "File zip là nguồn dữ liệu duy nhất của hệ thống; pnpm seed và upload trên giao diện dùng chung một hàm parse; xoá Sakura/Nimbus/Kitefin/Ohara/Marlin, viết lại bộ test T-1..T-10 trỏ vào công ty thật"
status: pending
priority: P1
branch: "feature/15-8"
tags: [import, seed, snapshot, database, admin, testing]
blockedBy: []
blocks: []
created: "2026-08-15"
source: plans/reports/brainstorm-260815-1026-nap-du-lieu-mau-qua-upload-report.md
---

# Nạp dữ liệu mẫu BTC qua upload zip — xoá hẳn seed hư cấu

> **Đọc [báo cáo brainstorm](../reports/brainstorm-260815-1026-nap-du-lieu-mau-qua-upload-report.md) trước** — nó chứa số liệu đã verify trên `hackathon-1-data.zip` thật (25 công ty, 38 liên hệ, 15 cơ hội thật sau khi lọc 8 dòng rác, 172 file HTML, độ phủ T-1..T-10) và lý do 3 phương án bị loại. Plan này chỉ thi công, **không mở lại** câu "giữ hay xoá seed hư cấu" — đã chốt: xoá.
> **Đang ở `feature/15-8`**, không tạo nhánh mới trừ khi team yêu cầu.
> **Ràng buộc thời gian:** vòng 1 chốt 15:00 hôm nay (2026-08-15). Chạy `pnpm test` sau MỖI phase, không dồn tới cuối.

## Mục tiêu

1. **File zip là nguồn dữ liệu duy nhất.** Không còn `seed-data.ts`/`demo-snapshots.ts` viết tay. `pnpm seed` (CLI) và endpoint upload (giao diện) gọi chung một hàm `parseZipDataset()`.
2. **Nạp lại cùng file → về đúng trạng thái ban đầu** (spec mục 7 điều kiện 5) — TRUNCATE CASCADE + INSERT, y cơ chế I-14 đang có, chỉ đổi nguồn dữ liệu.
3. **Bản chụp chở được 3-4 trang/công ty**, không phải 1 trang như `demo-snapshots.ts` hiện tại (ADR-0021 tự nêu điều kiện xem lại, đã vượt).
4. **Bộ test chấm điểm T-1..T-10 chạy xanh trên dữ liệu thật**, không còn Sakura/Nimbus/Kitefin/Ohara/Marlin.

## Cái plan này KHÔNG làm

Không đổi ontology (`docs/ontology.md` mục 3 giữ nguyên — `snapshot_pages` là hạ tầng đọc, cùng loại với `company_sources`/`snapshotVariant`, không phải thực thể mới). Không thêm `sales_owner` vào schema (chỉ 1 tài khoản sales, ADR-0033). Không đổi `ClaimExtractor`/`LiveCrawlSource`/cửa gác SSRF. Không sửa giao diện Sales-facing ngoài panel admin mới.

## Ranh giới phải giữ

| Việc | Rủi ro nếu làm sai | Chặn bằng |
| --- | --- | --- |
| Đọc file zip để nạp CSDL | Import chạy với quyền `crm_owner` (TRUNCATE) — nếu để lộ ra một route không phải admin, hoặc giữ pool mở cả vòng đời process, mở toang hàng rào phân quyền ADR-0010 đang bảo vệ | **Không dùng DI token sống lâu.** `AdminImportService` mở kết nối `crm_owner` **ngắn hạn, đúng lúc gọi**, bằng chính hàm `seed()` sẵn có (connectionString → transaction → close), không khác gì CLI đang làm. Route duy nhất `@Roles('admin')`. Test grep đảm bảo `DATABASE_URL_OWNER`/`crm_owner` chỉ được đọc ở đúng 1 file trong `apps/api` |
| `snapshot_pages` — nội dung AI đọc để rút phát hiện | Nếu `crm_system` có quyền ghi, AI tự chọn được bằng chứng nó báo cáo (đúng lỗi `snapshot_variant`/`company_sources` đã né) | `crm_system`: `SELECT` duy nhất, y khuôn `company_sources` (`0008_live_source.sql`). `crm_app`: full quyền qua `ALTER DEFAULT PRIVILEGES` sẵn có, không cần GRANT tay |
| ID công ty/liên hệ/cơ hội phải **ổn định qua mỗi lần nạp lại** | Nạp lại cùng file phải cho đúng cùng UUID — nếu dùng `defaultRandom()`, test/e2e hardcode ID sẽ vỡ ngẫu nhiên mỗi lần seed | UUID **suy ra tất định** từ `company_code`/`contact_code`/`opportunity_code` (hash ổn định), không phải random — xem phase 1 |

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Parse zip thành dataset](./phase-01-parse-zip-thanh-dataset.md) | Pending |
| 2 | [Schema snapshot_pages + tổng quát seed()/DemoSnapshotSource](./phase-02-schema-seed-demo-snapshot-source.md) | Pending |
| 3 | [Endpoint upload + giao diện admin](./phase-03-upload-endpoint-va-giao-dien.md) | Pending |
| 4 | [Viết lại bộ test cho dữ liệu thật](./phase-04-viet-lai-bo-test-cho-du-lieu-that.md) | Pending |
| 5 | [ADR + tài liệu](./phase-05-adr-va-tai-lieu.md) | Pending |

**Thứ tự bắt buộc:** 1 → 2 → 3 → 4 → 5. Phase 2 cần `parseZipDataset()` của phase 1. Phase 3 cần `seed(dataset)` tổng quát của phase 2. Phase 4 cần dữ liệu thật đã nạp được qua CLI (phase 2) để biết ID/nội dung thật mà trỏ test vào. Phase 5 chốt tài liệu sau khi mọi thứ chạy xanh.

## Nếu phải cắt scope (còn ít giờ tới 15:00)

| Cắt gì | Còn lại có nghĩa không |
| --- | --- |
| Bỏ phase 3 (upload UI), chỉ làm phase 1+2 | ⚠️ **Một nửa.** `pnpm seed` đã dùng dữ liệu thật, nhưng KHÔNG đạt spec mục 7 điều kiện 5 (đòi upload qua giao diện, không sửa mã) — chỉ hợp nếu chấp nhận nộp bài thiếu 1 hạng mục |
| Bỏ phase 4 (viết lại test), chỉ làm phase 1-3 | ❌ **Không được cắt nếu muốn nộp bộ test mục 6.** Test cũ sẽ đỏ ngay khi seed đổi nguồn dữ liệu (ID Sakura không còn tồn tại) |
| Bỏ phase 5 (ADR) | ⚠️ Chạy được, nhưng đúng bẫy vòng 2: `DATABASE_URL_OWNER` xuất hiện trong `apps/api` mà không ADR nào giải thích = câu hỏi chấm điểm không trả lời được |
| **Không được cắt:** phase 1, 2 | Là nền cho mọi thứ khác — không có dataset thì không có gì để nạp |

## Acceptance criteria

- [ ] `pnpm seed` chạy từ host, dùng `hackathon-1-data.zip` checked-in repo, nạp đúng 25 công ty / 38 liên hệ / 15 cơ hội (8 dòng rác bị lọc, log rõ)
- [ ] Chạy `pnpm seed` hai lần liên tiếp → checksum trạng thái giống hệt (test kiểu `seed-idempotent.test.ts`, viết lại cho dataset thật)
- [ ] Admin đăng nhập, vào `/quan-tri`, upload lại đúng file `hackathon-1-data.zip` → modal xác nhận → tóm tắt kết quả đúng số liệu → dữ liệu trong app khớp
- [ ] `snapshot_pages` chở đủ 172 bản chụp, `DemoSnapshotSource.readAll()` trả đúng N trang/công ty (không còn giới hạn 1 trang)
- [ ] `crm_system` bị từ chối mọi ghi trên `snapshot_pages` (SELECT-only) — test grant
- [ ] Không còn "Sakura"/"Nimbus"/"Kitefin"/"Ohara"/"Marlin" trong bất kỳ file `.ts` nào ngoài docs/ADR lịch sử (`grep -rn` xác nhận rỗng)
- [ ] `pnpm test` (unit + e2e) xanh toàn bộ, đặc biệt T-1, T-5, T-6/T-7, T-8, reading-zone-provenance trỏ vào công ty thật
- [ ] `pnpm typecheck` · `pnpm lint` · `pnpm build` xanh
- [ ] ADR mới cho quyền `crm_owner` ngắn hạn trong `AdminImportService`; ADR-0013 và ADR-0021 đánh dấu Superseded

## Lệch so với plan — ghi lại, không lặng lẽ

| Chỗ lệch | Vì sao |
| --- | --- |
| **`companies.company_type` đổi từ pg enum sang `text` tự do** (migration `0012_company_type_free_text.sql`), phát hiện lúc implement phase 1, không có trong plan gốc | Brainstorm report khẳng định "khớp 100% nhãn enum" — **sai**, chỉ kiểm vài dòng đầu chứ không đếm hết distinct values. Dữ liệu thật: 5/25 dòng khớp, phần còn lại là text tự do (SIer, Enduser, drug store, Payment platform, IT Consulting...), 6 dòng trống. `company_type` là `NOT NULL` nên không thể để trống — buộc chọn giữa "ép qua 5 giá trị bằng cách đoán" (vi phạm rule 4) hoặc "để tự do". Người quyết định chọn tự do. Kéo theo sửa: `packages/contracts/src/dto/company.ts` (zod), `apps/web/src/app/(app)/cong-ty/page.tsx` + `.../[id]/company-profile-section.tsx` (dropdown cố định → input tự do + datalist gợi ý), `company-service.ts` (bỏ cast `CompanyType`) |
| Migration `snapshot_pages` (phase 2) đổi số từ `0012` sang **`0013`** | `0012` đã dùng cho company_type ở trên |

## Dependencies

- Không có plan nào khác đang mở đụng `packages/db/src/seed/`, `apps/api/src/ai/demo-snapshots.ts`, hay các file test T-1..T-10 — quét `plans/*/plan.md` xác nhận cả 6 plan trước đều `status: done`, plan `260815-0901-lam-day-agent-runtime...` đụng `apps/agent-runtime`, không giao nhau.
- Input duy nhất từ bên ngoài: `/home/trungmd/projects/ai-hackathon/hackathon-1-data.zip` — phải copy vào repo ở phase 1 trước khi làm gì khác.

## Validation Log

### Session 1 — 2026-08-15

**Trigger:** `/ck:plan validate` sau khi viết plan lần đầu.
**Tier:** Full (5 phase) — Fact Checker + Contract Verifier áp dụng có trọng điểm (không chạy máy móc 15 claim/phase do ràng buộc thời gian tới 15:00; ưu tiên claim rủi ro cao nhất).

#### Verification Results

- Claims checked: ~14 (file path, symbol, caller-count, hành vi đồng bộ)
- Verified: 11 | Failed: 2 | Unverified: 1 (anchor company signal content — xem dưới)

#### Failures (đã sửa thẳng vào phase 1/2/4, không chờ hỏi)

1. **[Contract Verifier]** `seed()` có **3 caller**, không phải 2 như bản đầu: thiếu `apps/api/src/__tests__/login.test.ts:20`. Sửa: phase 2 thêm `loadDefaultDataset()` helper + cập nhật cả 3 caller.
2. **[Contract Verifier — nghiêm trọng hơn]** `apps/api/src/ai/resolve-observation-source.ts` dùng `SEED_COMPANIES` làm **gate I-16 đồng bộ, không phụ thuộc CSDL, có chủ đích theo thiết kế** — không phải test fixture. 2 chỗ sản xuất khác (`company-source-service.ts:101`, `company-service.ts:135`) gọi `isSeedCompany()` cũng đồng bộ. Đổi `parseZipDataset` sang async-only sẽ cascade vỡ 3 chỗ này. Sửa: phase 1 bắt buộc chọn thư viện CSV/zip có API đồng bộ (`csv-parse` sync + `adm-zip`, KHÔNG `unzipper`), phase 2 thêm mục Architecture giải thích `SEED_COMPANY_IDS` tính từ file zip checked-in lúc module load, giữ nguyên tính đồng bộ.

#### Unverified

- **Anchor company cho T-6/T-7** (phase 4): grep thử nội dung `after` của `C18-news-after.html`/`C16-news-after.html` tìm từ khoá tín hiệu (gọi vốn/bổ nhiệm/mở rộng...) — **không khớp**. Không kết luận được 2 công ty này có tín hiệu funding/leadership thật hay không chỉ bằng grep từ khoá — cần đọc/diff thật lúc implement (có thể nội dung tiếng Nhật, hoặc tín hiệu nằm ở trang khác không phải "news"). Phase 4 đã ghi rõ đây là việc chưa xong, không phải giả định đã khoá.

#### Whole-Plan Consistency Sweep

- Files reread sau khi sửa: `plan.md`, `phase-01-parse-zip-thanh-dataset.md`, `phase-02-schema-seed-demo-snapshot-source.md`, `phase-04-viet-lai-bo-test-cho-du-lieu-that.md`
- Decision deltas: đổi thư viện zip (`unzipper`→`adm-zip`), thêm 2 caller `seed()` + 1 file production (`resolve-observation-source.ts`) + 2 file gọi `isSeedCompany()` + 5 file phụ thuộc symbol `SEED_COMPANIES` vào phạm vi phase 2/4
- Unresolved contradictions: 0 — mọi chỗ sửa đã lan sang đúng phase liên quan, không còn phase nào nhắc `unzipper` hay số "2 caller"

#### Questions & Answers

1. **[Scope]** 2 tài khoản đăng nhập demo (`SEED_USERS`) không nằm trong zip BTC — giữ hardcode hay xử lý khác?
   - Options: Giữ hardcode (Recommended) | Đặt vào biến môi trường
   - **Answer:** Giữ hardcode
   - **Rationale:** Không phải dữ liệu BTC phát (công ty/liên hệ/cơ hội), mà là credential hệ thống — không vi phạm tinh thần "không gõ tay dữ liệu" đã chốt.

2. **[Risk]** I-16 sau khi sửa chỉ bảo vệ đúng bộ công ty của file zip checked-in mặc định, không bảo vệ file zip khác admin có thể upload qua UI — chấp nhận hay mở rộng?
   - Options: Chấp nhận (Recommended) | Bảo vệ rộng hơn (đọc từ DB hiện tại)
   - **Answer:** Chấp nhận
   - **Rationale:** I-16 giữ T-6/T-8 replay được trên đúng bộ dữ liệu chấm điểm chính thức, không phải bảo vệ mọi file bất kỳ ai upload. Thực tế chỉ 1 file chính thức được dùng. Mở rộng sẽ tái tạo đúng vấn đề đồng bộ/async đã né ở finding #2.

3. **[Assumption]** Anchor company T-6/T-7 (C18/C16) chưa xác minh có tín hiệu funding/leadership thật — xử lý sao?
   - Options: Để phase 4 tự xác minh lúc implement (Recommended) | Đọc thử ngay vài công ty trước khi cook
   - **Answer:** Để phase 4 tự xác minh lúc implement
   - **Rationale:** Không chặn plan lại để đọc tay 172 file HTML — phase 4 đã ghi rõ đây là việc cần verify trước khi khoá, không phải giả định đã chốt.

#### Confirmed Decisions
- `SEED_USERS`/`DEMO_PASSWORDS`: giữ hardcode trong `seed-dataset.ts`, ngoại lệ có chủ đích ngoài phạm vi "xoá dữ liệu viết tay"
- I-16: phạm vi bảo vệ giới hạn ở file zip checked-in mặc định, ghi rõ trong ADR-0042 (phase 5), không coi là lỗ hổng cần vá thêm
- Anchor company T-6/T-7/T-8: xác minh nội dung thật là việc của phase 4 lúc implement, không phải điều kiện chặn plan

#### Action Items
- [ ] Phase 5 (ADR-0042) phải nêu rõ phạm vi bảo vệ I-16 đã thu hẹp có chủ đích (quyết định #2), không phải thiếu sót bị bỏ qua

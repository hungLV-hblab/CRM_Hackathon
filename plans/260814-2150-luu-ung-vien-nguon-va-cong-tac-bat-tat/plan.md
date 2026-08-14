---
title: "Ứng viên nguồn sống qua reload, nguồn đọc có công tắc, panel hết chật"
description: "Ứng viên web_search vào bảng riêng mà crm_system không được grant gì; nguồn đã lưu có công tắc bật/tắt chặn bằng REVOKE + view; panel Nguồn đọc ra full-width"
status: done
priority: P1
effort: medium
branch: "feat/source-candidates-persistence"
tags: [company-source, autonomy-ceiling, grants, web-search, ui]
blockedBy: []
blocks: []
created: "2026-08-14T21:50:00+07:00"
createdBy: "ck-plan --tdd"
mode: tdd
scope: "packages/db, packages/contracts, apps/api, apps/web, docs"
source: plans/reports/brainstorm-260814-2150-persist-source-candidates-and-widen-source-panel-report.md
---

# Ứng viên nguồn sống qua reload, nguồn đọc có công tắc, panel hết chật

> **Đọc [báo cáo brainstorm](../reports/brainstorm-260814-2150-persist-source-candidates-and-widen-source-panel-report.md) trước** — nó chứa 5 nhóm phương án bị loại và 5 quyết định của người quyết định. Plan này chỉ thi công, **không mở lại** câu "lưu ở đâu" hay "chặn bằng gì".
> Tiền đề: [plan 260814-1610](../260814-1610-crawl-nguon-web-that-da-nguon/plan.md) đã `done`, [ADR-0035](../../docs/decisions/0035-cho-phep-nguon-web-that-kem-dieu-kien-ban-chup-van-la-nguon-cua-bo-nghiem-thu.md) + [ADR-0036](../../docs/decisions/0036-llm-tim-nguon-code-doc-bytes-va-ung-vien-phai-qua-nguoi.md) đã chốt ranh giới.
> **Đang ở `master` — tạo nhánh `feat/source-candidates-persistence` trước dòng code đầu tiên.**

## Mục tiêu

Ba việc, và việc thứ ba rẻ nhất nhưng thấy được ngay:

1. **Ứng viên `web_search` sống qua reload.** Hôm nay mất khi reload (không lưu ở đâu) và mất khi bấm Lưu (`source-discovery-section.tsx:63` `setCandidates(null)`). Mỗi lượt tìm mất 10–20 giây và tốn tiền.
2. **Nguồn đã lưu có công tắc bật/tắt**, không phải chỉ xoá được — giữ lại snippet và lý do khi tạm ngưng đọc một trang.
3. **Panel "Nguồn đọc" ra full-width.** Hiện nhét trong cột phải `24rem` (`page.tsx:97,131-135`) trong khi mỗi ứng viên cần 3–4 dòng.

## Cái plan này KHÔNG làm

Không đổi `ClaimExtractor`, không đổi `LiveCrawlSource`, không chạm cửa gác SSRF, không đổi đường đọc bản chụp, không mở thêm vùng nào cho AI tự ghi. `MAX_SOURCES_PER_COMPANY = 5` giữ nguyên.

## Ranh giới phải giữ — dòng quan trọng nhất

Hôm nay **hàng tồn tại trong `company_sources` = đã được người duyệt**, và `0008_live_source.sql` biến điều đó thành quyền CSDL (I-18). Plan này thêm hai thứ đều có nguy cơ phá nó, và mỗi thứ được chặn bằng một cơ chế khác nhau:

| Thêm gì | Nguy cơ | Chặn bằng |
| --- | --- | --- |
| Ứng viên persist | Lẫn với danh sách đọc ⇒ AI đọc trang chưa ai tick | **Bảng riêng, `crm_system` không được grant gì.** Không có `ALTER DEFAULT PRIVILEGES` cho `crm_system` (`0001_grants.sql:13`) nên bảng mới **tự động** bị cấm — ta chỉ cần không grant |
| Cột `enabled` | Quên `WHERE` ⇒ AI đọc trang vừa bị tắt | **`REVOKE SELECT` trên bảng + view `company_sources_enabled`.** Quên filter thành `permission denied` ồn ào, không phải đọc lén thành công |

**Không thêm cột "đã chọn" ở đâu cả.** "Ứng viên này vào danh sách đọc chưa" = có hàng `company_sources` cùng `(company_id, url)`. Một nguồn sự thật cho câu "đọc trang nào".

## Vì sao TDD — không phải nghi lễ

Ba lý do cụ thể, không phải "tốt cho sức khoẻ":

1. **Plan này đảo một test đang xanh.** Test 15 của `live-source-columns-and-grants.test.ts` hiện assert `crm_system` **được** `SELECT` trên `company_sources`. View + REVOKE làm nó đỏ **đúng như thiết kế**. Một thay đổi mà biết trước test nào sẽ đỏ và vì sao thì phải viết assertion mới **trước**, không thì lúc đỏ sẽ có người "sửa cho xanh" theo hướng dễ nhất.
2. **Đường đọc đang có 39 e2e phủ.** `enabled` chèn thêm một filter vào đúng hàm `liveSourceUrls`. Viết test lọc trước ⇒ biết filter thật sự cắt, không phải "code trông có filter".
3. **Cửa `actor.kind === 'system'` không tự chứng minh được bằng mắt.** Bốn route ghi mới, mỗi route một dòng gác. Bốn dòng giống nhau là bốn chỗ dễ copy thiếu.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Bảng ứng viên và quyền CSDL](./phase-01-bang-ung-vien-va-quyen-csdl.md) | Done |
| 2 | [Cột enabled và view chặn đường đọc](./phase-02-cot-enabled-va-view-chan-duong-doc.md) | Done |
| 3 | [Service và route ứng viên](./phase-03-service-va-route-ung-vien.md) | Done |
| 4 | [Giao diện panel full-width](./phase-04-giao-dien-panel-full-width.md) | Done |
| 5 | [Cửa chốt ADR và ontology](./phase-05-cua-chot-adr-va-ontology.md) | Done |

**Thứ tự bắt buộc:** 1 → 2 → 3 → 4 → 5. Phase 3 cần bảng của 1 và view của 2. Phase 4 cần route của 3.

**Phase 4 tách được ra làm trước:** phần *chỉ* kéo panel ra full-width + sửa chữ badge không cần phase nào, ~5 phút, rủi ro 0. Nếu freeze ép thì làm mảnh đó trước rồi quay lại phase 1.

## Nếu phải cắt scope (freeze tối 14/08)

| Cắt gì | Còn lại có nghĩa không |
| --- | --- |
| Bỏ phase 2 (`enabled` + view) | ✅ Có — ứng viên vẫn sống qua reload, vẫn select/unselect/xoá được. Mất công tắc tạm tắt |
| Bỏ phase 1+3 (ứng viên persist) | ❌ Không — `enabled` không giải quyết chuyện ứng viên biến mất, tức là không giải quyết yêu cầu gốc |
| Bỏ phase 5 (ADR + ontology) | ❌ **Không được cắt.** Code chạy mà ADR-0036 vẫn nói "ứng viên không được persist" là đúng cái bẫy vòng 2 |

## Acceptance criteria

- [x] Tìm nguồn → reload trang → ứng viên vẫn còn, kèm `reason` và `snippet` — e2e `source-candidates-survive-reload.spec.ts` bước 3
- [x] Tick một ứng viên → nó vào danh sách đọc, **không** biến mất khỏi danh sách ứng viên, và hiện "Đã trong danh sách đọc". **Nút Lưu theo lô: GIỮ** — người quyết định chọn phương án A của [mục (f) ADR-0037](../../docs/decisions/0037-ung-vien-luu-o-bang-ai-khong-doc-duoc-va-cong-tac-tat-nguon.md)
- [x] Tìm lần hai thay danh sách ứng viên, nguồn **đã lưu** không bị ảnh hưởng — test 10, 11
- [x] Xoá được một ứng viên; bật/tắt được một nguồn đã lưu; nguồn đang tắt không được đọc — test 13, 16 + `disabled-source-not-read.test.ts`
- [x] `crm_system` bị từ chối cả 4 phép trên bảng ứng viên, và bị từ chối `SELECT` thẳng trên `company_sources` — test 20, 21, 15
- [x] `pnpm test` xanh (**466 unit/tích hợp + 40 e2e**) · `pnpm lint` · `pnpm typecheck` xanh · `pnpm build`: compile + typecheck + 14 trang tĩnh xanh, **chặn ở bước copy standalone của Next trên Windows** (`EPERM: symlink`) — lỗi môi trường không liên quan thay đổi này; bản dựng thật chạy trong Docker và `docker compose up --build` xanh
- [x] Panel "Nguồn đọc" full-width, ứng viên 2 cột từ `xl`, vùng chạm ≥44px — `ui-invariants.spec.ts` xanh
- [x] ADR-0037 lên, ontology sửa 5 dòng + dòng trạng thái duyệt, `ALL_TABLES` có bảng mới

## Lệch so với plan — ghi lại, không lặng lẽ

| Chỗ lệch | Vì sao |
| --- | --- |
| Số test: phase 1 thành **19–23** (thêm test "ứng viên không có `reason` thì không lưu được"), nên view thành **24–25** thay vì 23–24 | Ràng buộc `NOT NULL` trên `reason` đáng có assertion riêng — nó là cột duy nhất chặn "một dòng để trống ở đúng chỗ quan trọng nhất" |
| Phase 3 có thêm test **16, 17** (bật/tắt giữ snippet · công ty seed trả `[]`) | Hai khẳng định của Requirements chưa có test nào trong danh sách 10–15 |
| `MAX_CANDIDATES_PER_COMPANY` = **6**, không phải 12 | Câu 1 mục 8 của brainstorm report: `anthropic-source-discovery.ts:41` đã cắt ở 6 kèm lý do. Lấy số đã có, adapter import từ contracts |
| Ứng viên hiển thị 2 cột từ **`xl`**, không phải `lg` | Panel đã nằm trong grid `lg:grid-cols-2` của chính section, nên chia đôi lần nữa ở `lg` cho mỗi ứng viên ~300px — hẹp hơn cả cột 24rem cũ |
| Nút Lưu theo lô **giữ**, `picked` ở lại | Nhánh đã có tính năng đọc-ngay-sau-khi-lưu mà plan chưa biết: tick từng cái = trả tiền từng lượt đọc. ADR-0037 mục (f) |
| Thêm file `use-source-panel-actions.ts` | Sau khi tách hai panel, phần còn lại vẫn 277 dòng. Query + mutation là seam thật: chỗ dễ sai âm thầm là invalidate cái gì sau lệnh ghi nào |

## Dependencies

- **Tiền đề đã xong:** [260814-1610-crawl-nguon-web-that-da-nguon](../260814-1610-crawl-nguon-web-that-da-nguon/plan.md) — `status: done`. Plan này sửa `company_sources`, `observation-service.ts` và `source-discovery-section.tsx` do plan đó tạo ra. Không có blocker sống.
- **Kéo theo tài liệu:** ADR-0037 supersede hai dòng của ADR-0036; `docs/ontology.md` mục 3.6 và mục 6 (đang `⏳ chờ duyệt lại`, thêm một mốc nữa).

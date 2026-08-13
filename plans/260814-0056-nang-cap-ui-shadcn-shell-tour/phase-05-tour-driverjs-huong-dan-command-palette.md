---
phase: 5
title: "Tour driver.js + trang hướng dẫn + Command palette"
status: done
priority: P3
effort: "2h"
dependencies: [2]
---

# Phase 5: Tour driver.js + trang hướng dẫn + Command palette

# Overview

Ba món độc lập nhau, gộp một phase vì cùng phục vụ việc "người mới hiểu được hệ thống". **Cả ba cắt được**, và thứ tự giữ lại khi hết giờ: `/huong-dan` (30') → tour (45') → ⌘K (45').

Lý do thứ tự đó: `/huong-dan` đánh vào [luật 7](../../CLAUDE.md#2-bảy-luật-bất-di-bất-dịch) "giải thích được" — thứ vòng 2 hỏi random 3–5 câu dựa trên log. Tour và ⌘K không có chỗ nào trong rubric.

## Requirements

- Functional: trang `/huong-dan` giải thích 4 vùng tự chủ, mỗi vùng dẫn sang màn thật · tour 6 bước bật lại được để diễn cho BGK · ⌘K nhảy sang công ty/cơ hội/màn hình.
- Non-functional: **tour không xuất hiện trong bất kỳ lần chạy e2e nào** · `pnpm test` khớp baseline · driver.js nạp bằng `dynamic import`, không vào bundle trang đầu.

## ⚠️ Tour KHÔNG tự chạy — quyết định sau verification 14/08

Phiên bản đầu của phase này định cho tour tự chạy lần đầu, chặn bằng cờ `localStorage['crm.tour.seen']` ghi từ `e2e/global-setup.ts`. **Cơ chế đó không tồn tại:**

- `e2e/global-setup.ts` **chỉ chạy `pnpm seed`** — nó không tạo storage state.
- `playwright.config.ts` **không có `storageState`**; mỗi spec tự đăng nhập qua UI.
- Nên `localStorage` **rỗng ở mọi spec** → tour "lần đầu" sẽ tự chạy trong **cả 5 spec**, đúng thảm hoạ định tránh, và **không có chỗ nào để ghi cờ vào**.

Quyết định: **tour chỉ mở khi người dùng bấm.** Hai đường vào, không có đường thứ ba:

1. Nút **"Xem hướng dẫn"** ở header.
2. `?tour=1` trên URL — để diễn cho BGK.

Không auto-run, nên **không cần `localStorage`, không cần sửa `e2e/global-setup.ts`, không cần C cho file đó.** Rủi ro e2e về gần 0 và code ít hơn.

Hai luật còn lại vẫn giữ:

- **Neo bước bằng `data-tour="..."`**, tuyệt đối không bằng class hay cấu trúc DOM. P4 restyle sẽ đổi class; tour neo theo class là tour trỏ trượt trong im lặng.
- **`dynamic import`** driver.js trong client component + CSS nạp cục bộ, để nó không vào bundle trang đầu.

**Đánh đổi đã nhận:** người dùng mới không được dẫn tự động. Bù lại bằng link `/huong-dan` ở footer + nút ở header — cả hai luôn thấy được, không phải overlay hiện một lần rồi mất.

## Architecture

### Tour — 6 bước, bám 4 vùng tự chủ

| # | Neo | Nói gì |
| --- | --- | --- |
| 1 | `data-tour="sidebar"` | 7 màn, đi đâu làm gì |
| 2 | `data-tour="queue"` (mục Hàng đợi) | Vùng 2: gợi ý chờ duyệt. **Không duyệt thì không có gì xảy ra** |
| 3 | `data-tour="proposal-card"` | Hai nút Duyệt/Bỏ đứng cạnh bằng chứng, không đứng một mình |
| 4 | `data-tour="next-step-cell"` | Vùng 3: máy tự điền, viền tím, **Hoàn tác một cú bấm trong 7 ngày** |
| 5 | `data-tour="quote-block"` | Provenance: mọi phát hiện bấm ra được câu trích nguyên văn |
| 6 | `data-tour="ai-status"` | Vùng 4 + nút tắt sạch AI. **Nói bằng lời, không link sang `/quan-tri`** — route đó do P8 tạo và P8 chạy sau plan này. Link sang route chưa tồn tại là dẫn BGK vào 404 ngay bước cuối của tour |

Sáu bước này **chính là** bài giải thích của vòng 2. Viết nội dung bước cho đúng, đừng viết cho đẹp.

> **⚠️ Bước 6 neo vào phần tử có thể không tồn tại.** P2 đã quyết định pill trạng thái AI **không render** khi `GET /settings` trả 403 — và nó trả 403 cho mọi user Sales, tức gần như luôn luôn trong lúc demo. Neo `data-tour="ai-status"` vào cái pill đó thì bước 6 **bị driver.js bỏ qua trong im lặng**, và tour 6 bước lặng lẽ thành 5 bước.
>
> **Đặt `data-tour="ai-status"` lên vùng header luôn hiện diện** (khối chứa pill), không lên chính cái pill. Vùng đó tồn tại bất kể pill có render hay không. Đây chính là lý do bước 6 của Implementation Steps bắt **đếm tay đủ 6 bước** — không có test tự động nào bắt được bước bị bỏ qua.

Bước 3, 4, 5 neo vào phần tử chỉ tồn tại ở một số màn. driver.js bỏ qua bước neo trượt — **nhưng bỏ qua trong im lặng**. Nên tour phải chạy trên màn có đủ, hoặc tự điều hướng giữa các bước. Đường đơn giản: tour chạy trên `/cong-ty/[id]` của một công ty có phát hiện + `/hang-doi`, và bước nào không có neo thì thay bằng bước mô tả kèm link.

### `/huong-dan`

Trang tĩnh, server component, không gọi API. 4 khối theo 4 vùng tự chủ, mỗi khối: AI được làm gì · cơ chế an toàn · **link sang màn thật để tự kiểm** · mã nghiệm thu tương ứng (T-2, T-4/T-5, T-6/T-7, T-8). Cộng một khối "✋ Cấm tuyệt đối" và một khối "nút tắt sạch AI".

**Khối "nút tắt sạch AI" không được link sang `/quan-tri`** — route đó do P8 tạo, chưa tồn tại khi plan này chạy. Mô tả cơ chế bằng lời (`system_settings.ai_enabled`, API và worker đọc lại mỗi lần gọi, không cache), và **thêm link khi P8 xong**. `guide-page.spec.ts` khẳng định link không 404, nên link sớm là spec đỏ ngay — đó là hàng rào, không phải phiền phức.

Nguồn nội dung: [CLAUDE.md mục 4](../../CLAUDE.md#4-trần-tự-chủ-của-ai-trong-sản-phẩm) + [ontology.md](../../docs/ontology.md). **Không viết lại bằng lời khác** — sai lệch giữa trang này và ontology là đúng cái bẫy vòng 2.

### ⌘K Command palette

`shadcn add command`. Nguồn: 8 route tĩnh (gồm `dang-theo-doi` + `quan-tri/nhat-ky-vong-quet` của P7) + danh sách công ty và cơ hội (dùng lại query `['companies']`, `['opportunities']` đã cache — **không thêm endpoint**). `Cmd/Ctrl+K` mở, Escape đóng.

## Related Code Files

- Create: `apps/web/src/components/tour/{product-tour,tour-steps}.tsx`
- Create: `apps/web/src/app/(app)/huong-dan/page.tsx`
- Create: `apps/web/src/components/shell/command-palette.tsx`
- Modify: `apps/web/src/components/shell/app-header.tsx` — nút "Xem hướng dẫn", nối trigger ⌘K
- Create: `e2e/tour-does-not-block.spec.ts` · `e2e/guide-page.spec.ts` — **thuộc chủ quyền C**, hỏi một lần cùng `ui-invariants.spec.ts` của P3
- **Không sửa `e2e/global-setup.ts`** — tour không auto-run nên không cần cờ. Đây là thay đổi so với bản đầu của phase
- Modify: thêm `data-tour` vào 6 chỗ neo — sửa thuộc tính, không sửa logic
- Modify: `apps/web/package.json` — `driver.js` đã cài ở P1

## Tests First

1. **`e2e/tour-does-not-block.spec.ts`** — viết **trước** khi thêm driver.js:
   - Mở `/cong-ty` bình thường (không tham số): khẳng định **không có** overlay driver.js trong DOM, và bấm được "Thêm công ty" ngay. Đây là khẳng định "tour không tự chạy" — thứ duy nhất ngăn ai đó sau này thêm auto-run mà không ai biết.
   - Với `?tour=1`: overlay **có** hiện, Escape tắt được, trang bấm được lại.
   - Bấm nút "Xem hướng dẫn" ở header: overlay hiện.

   Viết trước, không viết sau.
2. **`e2e/guide-page.spec.ts`**: `/huong-dan` render 4 khối vùng tự chủ, mỗi khối có ≥1 link tới màn thật, và các link đó không 404.
3. Sau khi thêm `data-tour`: chạy `pnpm test:e2e` đủ — thêm thuộc tính không được đổi hành vi, nếu đỏ thì đã sửa nhầm gì đó.

## Implementation Steps

1. Viết `tour-does-not-block.spec.ts` → nhánh "không tự chạy" **xanh ngay** (chưa có tour thì đúng là không có overlay), hai nhánh `?tour=1` và nút header **đỏ**.
2. Làm **`/huong-dan` trước tour** — món giá trị cao nhất và không rủi ro. Viết `guide-page.spec.ts`, rồi trang.
3. Thêm `data-tour` vào 6 neo. Chạy `pnpm test:e2e` — thêm thuộc tính không được đổi hành vi.
4. `product-tour.tsx`: `dynamic import` driver.js, đọc `?tour=1`, nút ở header. **Không có nhánh auto-run** — không đọc `localStorage`, không đọc "lần đầu".
5. Chạy `tour-does-not-block.spec.ts` (cả ba nhánh) + đủ bộ e2e.
6. Chạy tour tay đủ 6 bước một lần và **đếm** — driver.js bỏ qua bước neo trượt trong im lặng, không có test tự động cho việc này.
7. ⌘K cuối cùng — món cắt đầu tiên nếu hết giờ.

## Success Criteria

- [ ] `tour-does-not-block.spec.ts` xanh **cả ba nhánh** (không tự chạy · `?tour=1` · nút header)
- [ ] `pnpm test` khớp baseline P1 + 2 spec mới có chủ đích
- [ ] `grep -rn "localStorage\|tour.seen" apps/web/src/components/tour/` **rỗng** — không có nhánh auto-run nào lọt vào
- [ ] `e2e/global-setup.ts` **không bị sửa**
- [ ] 6 bước tour neo bằng `data-tour`, `grep -rn "driver" apps/web/src` không thấy selector theo class
- [ ] Nút "Xem hướng dẫn" ở header diễn lại được tour sau khi đã đánh dấu seen
- [ ] `/huong-dan` có 4 khối vùng tự chủ + khối cấm + khối nút tắt AI, nội dung **khớp từng chữ** với CLAUDE.md mục 4 và ontology
- [ ] driver.js không nằm trong bundle trang đầu (kiểm output `pnpm build`)
- [ ] ⌘K dùng lại query đã cache, không thêm endpoint

## Risk Assessment

| Rủi ro | Xác suất | Đối sách |
| --- | --- | --- |
| **Tour overlay chặn click Playwright** | **thấp sau khi bỏ auto-run** | Không có nhánh auto-run là không có gì chặn. `tour-does-not-block.spec.ts` khoá điều đó lại để người sau không thêm vào |
| Ai đó sau này thêm auto-run "cho thân thiện" | TB | Nhánh 1 của `tour-does-not-block.spec.ts` sẽ đỏ. Đó là lý do khẳng định phủ định đó tồn tại |
| driver.js bỏ qua bước neo trượt **trong im lặng** | **cao** | Neo bằng `data-tour`; bước 6 chạy tay và **đếm**. Không có test tự động cho việc này |
| **Bước 6 neo vào pill AI mà pill không render (403)** | **cao** | Neo lên vùng header chứa pill, không lên pill. Đếm tay đủ 6 bước sẽ bắt được |
| **Tour hoặc `/huong-dan` link sang `/quan-tri` chưa tồn tại** | TB | `guide-page.spec.ts` khẳng định link không 404. Bước 6 của tour nói bằng lời, không link |
| P4 restyle làm tour trỏ trượt | TB | `data-tour` là thuộc tính riêng, restyle không chạm. Đây là lý do không neo theo class |
| `/huong-dan` diễn giải sai ontology | TB | Trích thẳng, không viết lại bằng lời khác |
| Hai spec mới nằm trong chủ quyền C | TB | Hỏi C một lần cho cả ba file e2e của plan (kể cả `ui-invariants` của P3) |
| ⌘K ăn phím tắt của trình duyệt | thấp | `Cmd/Ctrl+K` là quy ước phổ biến; `preventDefault` đúng chỗ |

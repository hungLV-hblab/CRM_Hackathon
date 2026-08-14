---
phase: 6
title: "Cửa chốt — checklist giao diện + ADR"
status: done
priority: P1
effort: "30'"
dependencies: [4, 5]
---

# Phase 6: Cửa chốt — checklist giao diện + ADR

## Overview

Chạy checklist mục 7 của [design-guidelines](../../docs/design-guidelines.md) trên **phần đã làm được**, đối chiếu baseline, viết ADR. Phase này chạy dù P4/P5 có bị cắt hay không — chỉ phạm vi kiểm thu nhỏ lại.

**Sau khi đảo thứ tự (14/08), phase này còn một việc nữa:** bàn giao lại cho P8. Không phải "xong rồi báo một tiếng" — P8 sẽ viết vào đúng cây thư mục ta vừa dời và đúng file nav ta vừa dựng. Xem [Bàn giao cho P8](#bàn-giao-cho-p8).

Không có ADR = quyết định không tồn tại với BGK ([CLAUDE.md mục 5](../../CLAUDE.md#5-quy-trình-làm-việc-với-ai-áp-dụng-cho-cả-5-giai-đoạn)).

## Requirements

- Functional: ADR ghi lại việc đảo hướng sang shadcn **kèm phương án bị loại** · design-guidelines khớp với code thật.
- Non-functional: `pnpm test` khớp baseline P1 · `lint`/`typecheck`/`build` xanh · 375px và 1440px không tràn ngang.

## Checklist mục 7 — chạy từng dòng, không đọc trôi

| # | Kiểm | Cách kiểm |
| --- | --- | --- |
| 1 | Không còn class màu thô | Xem [mẫu grep đã sửa](#mẫu-grep-mục-1-đã-sửa-14-08) — mẫu cũ vừa bỏ sót vừa báo động giả |
| 2 | Chữ thân ≥14px, tương phản ≥4.5:1, thử 375px và 1440px | Tay. DevTools contrast checker cho mọi cặp màu **mới** phát sinh |
| 3 | Mọi nút có phản hồi khi bấm, vùng chạm ≥44px | `grep -rn "h-9\|h-8\|min-h-9" apps/web/src` → rỗng. **T-A trong `e2e/ui-invariants.spec.ts`** đo `boundingBox().height >= 44` trên stack thật |
| 4 | Nhận định AI nào cũng bấm ra được nguồn | Tay: mở `/cong-ty/[id]` của công ty có phát hiện, bấm từng câu trích |
| 5 | Máy tự ghi chỗ nào thì có nhãn + đường lùi | Tay: ô Việc tiếp theo do máy điền có viền tím + nhãn + **nút Hoàn tác cấp 1** (không nằm trong toast) |
| 6 | Không dùng màu làm kênh thông tin duy nhất | Tay: **in một màn ra PDF đen trắng**, còn phân biệt được ai viết gì không. Đây là phép thử design-guidelines mô tả, làm đúng nó |
| 7 | Tab được hết bằng bàn phím, thứ tự tab khớp thứ tự nhìn | Tay: Tab từ đầu trang qua shell → nội dung. Kiểm cả `Sheet` mobile |
| 8 | `pnpm build` xanh | Tailwind v4 lỗi token là lỗi lúc build |

Thêm ba mục riêng của plan này:

| # | Kiểm | Cách |
| --- | --- | --- |
| 9 | Không có nền tối lọt vào | `grep -rn "\.dark\|data-theme\|prefers-color-scheme" apps/web/src` → chỉ được thấy `prefers-reduced-motion`, không thấy `color-scheme` |
| 10 | Tour không tự chạy | `tour-does-not-block.spec.ts` xanh cả ba nhánh (nếu P5 làm) · `grep -rn "localStorage" apps/web/src/components/tour/` rỗng · `e2e/global-setup.ts` không bị sửa |
| 11 | Từ vựng alias shadcn không tràn ra app | `grep -rn "bg-background\|text-primary\|text-muted-foreground" apps/web/src/app` → **rỗng**. Chỉ `components/ui/` được dùng |
| 12 | Không mục nav nào 404, không link nào trỏ `/quan-tri` | `grep -rn "quan-tri" apps/web/src` → **rỗng** cho tới khi P8 tạo route. `app-shell-navigation.spec.ts` đi hết mọi mục nav |
| 13 | Không có dòng trạng thái AI bịa | Đăng nhập bằng tài khoản **Sales** → header **không** có pill nào. `grep -rn "AI đang bật" apps/web/src` không được ra chuỗi hằng nào render vô điều kiện |
| 14 | Ba bàn giao đã nói, không phải đã nghĩ | Có chỗ ghi lại (chat/issue): C nhận `app/(app)/quan-tri/` · C nhận ranh giới `e2e/` · B nhận việc rebase |

## Mẫu grep mục 1 — đã sửa 14/08

Mẫu cũ `"slate-|amber-|indigo-|bg-\[#"` **sai hai chiều cùng lúc**, và chỉ lộ ra khi chạy thật:

- **Bỏ sót.** Nó không kiểm `red-`, `blue-`, `green-`, `gray-`… Thực tế có **ba** vi phạm chứ không phải một như plan ghi: `input.tsx` dùng `text-red-600` (đã biết), cộng `cong-ty/[id]/page.tsx` và `dang-nhap/page.tsx` cùng dùng `bg-red-50` + `text-red-700` cho khối lỗi. Cả ba đã đổi sang `danger` / `danger-surface`.
- **Báo động giả.** Chuỗi `slate-` nằm trong tiện ích Tailwind hợp lệ `-translate-y-1/2`, nên mọi phần tử căn giữa đều bị báo. Một checklist kêu oan vài lần là một checklist người ta bắt đầu tick trôi.

Mẫu dùng từ nay — buộc class phải đứng đầu chuỗi hoặc sau dấu cách, và liệt kê đủ họ màu mặc định:

```bash
grep -rnE "(^|[\"' ])(bg|text|border|ring)-(slate|amber|indigo|red|blue|green|gray|zinc|neutral|stone)-[0-9]|bg-\[#" apps/web/src
```

Kết quả 14/08: **rỗng**.

Ba mục khác của checklist cũng cần đọc theo nghĩa, không đọc theo số dòng grep: `h-9`, `localStorage` và `quan-tri` đều còn xuất hiện trong **comment giải thích vì sao không dùng chúng**. Đó là bằng chứng của luật 7, không phải vi phạm — kiểm bằng mẫu bám `className=` hoặc `href=` như dưới đây thì hết nhiễu:

```bash
grep -rnE "className=[^>]*\b(h-9|h-8|min-h-9)\b" apps/web/src          # → rỗng
grep -rnE "className=[^>]*\b(bg-background|text-primary)\b" apps/web/src/app --include="*.tsx"   # → rỗng
grep -rnE "href=[\"'][^\"']*quan-tri" apps/web/src                      # → rỗng
```

## Bàn giao cho P8

Viết thành **một danh sách gửi C và B**, không phải một đoạn văn. Ba việc P8 phải làm mà trước khi đảo thứ tự thì không tồn tại:

1. **Màn quản trị vào `app/(app)/quan-tri/`**, không phải `app/quan-tri/`. URL vẫn `/quan-tri`. Sai chỗ = màn không có shell.
2. **Thêm một dòng vào `apps/web/src/components/shell/nav-items.tsx`** cho mục *Quản trị*. Không thêm thì màn quản trị không có đường tới từ giao diện.
3. **Thêm link "nút tắt sạch AI" vào `/huong-dan`** (nếu P5 đã làm) và link `/quan-tri` vào bước 6 của tour. Cả hai đang cố ý để trống vì route chưa tồn tại.

Cộng một việc P8 **được lợi**, nói ra để khỏi làm lại: pill trạng thái AI ở header đã dựng sẵn, chỉ 403 với Sales. Nếu P8 quyết định mở quyền đọc `GET /settings` cho mọi vai thì pill **tự sống lại**, không phải sửa gì ở web — nhưng đó là **quyết định về quyền hạn, cần ADR riêng**, không phải hệ quả của một phase UI.

## ADR — nội dung bắt buộc

**ADR-0030** (0028 và 0029 đã thuộc về vòng quét ghi dòng thời gian — đánh số nối tiếp sau khi rebase lên master). Phải có đủ:

- **Quyết định:** migrate 6 primitive sang shadcn (Radix + cva), giữ nguyên bề mặt API.
- **Đảo hướng gì:** `button.tsx` đang có comment *"Hand-written rather than pulled from shadcn/ui"*. ADR này đảo nó. Nói rõ vì sao đảo được: đường import đã chừa sẵn từ đầu (`@/components/ui/button`), nên đổi ruột không lan ra call site.
- **Phương án bị loại, kèm lý do:**
  - **A · shell-only** (2–3h, rủi ro e2e ~0) — bịt đúng lỗ thật, nhưng không đạt yêu cầu shadcn toàn diện.
  - **B · shadcn map-token chọn lọc** (5–7h) — **đây là phương án người brainstorm khuyến nghị**; giữ `Button`/`Badge`/`Table`/`Input` viết tay vì chúng cõng luật 1–3. Bị loại theo quyết định của người dùng.
- **Đảo thứ tự 14/08:** plan này chạy **trước** P8 của `260813-0107`, thay quyết định cũ. Ghi cái giá (7h20' trình bày đứng trước 4h chấm điểm nghiệm thu, trong ngày freeze) và đối sách (P4/P5 cắt được + mốc cắt cứng + P1–P3 không đụng file ai nên P8 chạy song song được). **Đừng viết như thể đây là lựa chọn không có nhược điểm** — BGK đọc ra ngay, và luật 7 chấm khả năng giải thích chứ không chấm sự tự tin.
- **Hai hệ quả phải khai:** sidebar tạm 6 mục (thiếu *Quản trị*) · pill trạng thái AI vắng mặt với Sales vì `GET /settings` là `@Roles('admin')` — **chọn để trống thay vì bịa "AI đang bật"**, đúng luật 4.
- **Năm quyết định phụ:** không oval hoá toàn cục (nâng `radius-card` + thêm `radius-pill`) · `driver.js` thay vì react-joyride (5KB, không peer dep React) · `shadcn add` thay vì `shadcn init` (init ghi đè `@theme` + thêm `.dark`) · **bất biến khoá bằng e2e computed-style, không bằng unit test** (`apps/web` không nằm trong `vitest.config.mts` projects, repo không có testing-library) · **tour không auto-run** (`playwright.config.ts` không có `storageState`, `global-setup.ts` chỉ `pnpm seed` → `localStorage` rỗng mọi spec nên cờ "lần đầu" không chặn được gì).
- **Cách verify:** `e2e/ui-invariants.spec.ts` T-A…T-F của P3 + `tour-does-not-block.spec.ts` ba nhánh của P5 + baseline P1. Nêu tên test cụ thể, không nói "đã test".
- **Tái khẳng định:** chỉ nền sáng, không đổi.

## Related Code Files

- Create: `docs/decisions/0030-migrate-primitive-sang-shadcn-giu-nguyen-be-mat-api.md`
- Modify: `docs/design-guidelines.md` — thang bo góc 3 giá trị (mục 4) · luật alias shadcn · chốt Lucide (xoá khỏi "Câu hỏi chưa giải quyết") · mục 6 ghi `Button` giờ dựa cva nhưng variant không đổi
- Modify: `plans/260814-0056-nang-cap-ui-shadcn-shell-tour/plan.md` — đánh dấu phase xong, ghi phần đã cắt
- Modify: `README.md` — chỉ khi có route mới cho người dùng (`/huong-dan`)

## Tests First

Không có code mới ở phase này. "Tests-first" ở đây là **chạy đủ trước khi kết luận**, đúng thứ tự:

```bash
pnpm lint && pnpm typecheck && pnpm build
pnpm test 2>&1 | tee plans/260814-0056-nang-cap-ui-shadcn-shell-tour/final-test-output.txt
diff <(grep -E "passed|failed" baseline-test-output.txt) <(grep -E "passed|failed" final-test-output.txt)
```

`diff` phải rỗng, hoặc lệch **đúng** 4 spec mới đã thêm có chủ đích (`ui-invariants`, `app-shell-navigation`, `tour-does-not-block`, `guide-page`) cộng dòng `Đăng xuất` đã thoả thuận. Lệch khác thế là chưa xong, không phải "gần xong".

## Success Criteria

- [ ] **14** mục checklist trên đều đã chạy, mỗi mục có kết quả ghi lại (không phải tick trôi)
- [ ] Danh sách [Bàn giao cho P8](#bàn-giao-cho-p8) đã gửi C và B, có chỗ ghi lại
- [ ] `diff` baseline vs final rỗng hoặc lệch đúng phần có chủ đích
- [ ] `pnpm lint` · `typecheck` · `build` xanh
- [ ] ADR có đủ: quyết định · đảo hướng gì · **hai phương án bị loại kèm lý do** · cách verify nêu tên test · tái khẳng định nền sáng
- [ ] design-guidelines không còn chỗ nào lệch code thật (thang bo góc, Lucide, luật alias)
- [ ] Đã in một màn ra đen trắng và còn phân biệt được ai viết gì
- [ ] `plan.md` ghi rõ **phần nào đã cắt**, để BGK không tự phát hiện
- [ ] Có ít nhất 1 người ngoài người viết hiểu và giải thích lại được ([DoD mục 7](../../CLAUDE.md#7-definition-of-done))

## Risk Assessment

| Rủi ro | Đối sách |
| --- | --- |
| Tick checklist trôi cho xong vì sắp hết giờ | Mỗi mục có lệnh `grep` hoặc bước tay cụ thể. Mục 6 (in đen trắng) là mục dễ bỏ nhất và cũng là mục rubric chấm — làm thật |
| Không kịp viết ADR | ADR là điều kiện, không phải phần thưởng. Nếu hết giờ thì **cắt P5 ⌘K** để có 20' viết ADR, đừng cắt ADR |
| Phần đã cắt không được ghi lại | Success criteria có dòng riêng cho nó. BGK tự phát hiện lỗ thì tệ hơn ta tự khai |
| `diff` lệch mà bỏ qua vì "chắc không sao" | Lệch nào cũng phải giải thích được bằng một dòng. Không giải thích được nghĩa là có hồi quy |

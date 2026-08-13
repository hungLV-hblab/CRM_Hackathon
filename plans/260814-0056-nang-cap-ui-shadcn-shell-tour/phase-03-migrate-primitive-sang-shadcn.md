---
phase: 3
title: "Migrate primitive sang shadcn"
status: pending
priority: P1
effort: "1h30'"
dependencies: [1]
---

# Phase 3: Migrate primitive sang shadcn

## Overview

Chuyển 6 primitive trong `components/ui/` sang nền shadcn (Radix + cva). **Đây là phase duy nhất trong plan có thể làm đỏ bộ nghiệm thu**, và là phase người brainstorm đã khuyến nghị bỏ — người dùng quyết làm, nên phase này thiết kế **cách giữ ngữ nghĩa** thay vì tránh.

Nguyên tắc: **đổi ruột, khoá vỏ.** Prop và accessible name đóng băng.

## Requirements

- Functional: 6 primitive dựng trên shadcn, gọi từ mọi call site hiện có **không sửa một dòng nào ở call site**.
- Non-functional: `pnpm test` khớp baseline P1 · vùng chạm ≥44px · `tone` của Badge còn phân biệt fact/suy luận · `role="dialog"` + Escape còn hoạt động.

## Vì sao phase này nguy hiểm — đọc trước khi gõ

Hai file đang **cõng luật nghiệp vụ**, không phải chỉ mang style:

- **`badge.tsx`** — `tone` (`fact` / `inference` / `system`) là chỗ [luật 2 của CLAUDE.md](../../CLAUDE.md#2-bảy-luật-bất-di-bất-dịch) được enforce ("fact và suy luận phải phân biệt được ngay bằng mắt"). Comment trong file nói rõ: *"there is no brand-amber tone… a badge is read, not clicked"*. Đổi `tone` sang `variant` của shadcn (`default`/`secondary`/`destructive`/`outline`) là **mất luôn phân biệt máy/người**.
- **`button.tsx`** — `min-h-11` là ngưỡng chạm 44px, có comment giải thích *"the Sales team opens this on a phone between meetings"*. **shadcn `Button` mặc định `h-9` = 36px** → nhận nguyên bản là trượt checklist mục 7 design-guidelines.

## Architecture — bảng hợp đồng, từng file

| Primitive | Làm gì | Bất biến phải giữ | Test khoá nó |
| --- | --- | --- | --- |
| `button.tsx` | cva, **giữ tên variant `primary`/`secondary`/`ghost`/`danger`**, không lấy `default`/`destructive`/`outline` | `min-h-11` · không có chữ cam trên trắng · `danger` không dùng `brand-*` | T-A, T-B |
| `badge.tsx` | cva, **giữ API `tone`** 6 giá trị | `inference` + `system` phải ra lớp `machine-*` · không có tone màu thương hiệu | T-C |
| `input.tsx` | nền shadcn, **giữ prop `label` bắt buộc**, thêm `aria-invalid` + `aria-describedby`; sửa `text-red-600` → `text-danger` | label nhìn thấy được và bind bằng `id` (chính nó làm `getByLabel` chạy) · lỗi nằm **dưới** ô | T-D |
| `dialog.tsx` | native `<dialog>` → Radix Dialog; `title` render qua `DialogTitle` | `role="dialog"` · Escape đóng · focus trap · accessible name = `title` | T-E |
| `table.tsx` | **chỉ restyle**, API `headers[]` + `Cell` không đổi | `getByRole('cell',{name})` · `tabular` · header dính | e2e sẵn có |
| `warning-flag.tsx` | chỉ restyle | ký hiệu + chữ, không chỉ màu | T-F |

**Thứ tự làm bắt buộc:** `table` → `warning-flag` → `badge` → `button` → `input` → **`dialog` cuối cùng, một mình**.

Lý do `dialog` đi cuối và đi một mình: native `<dialog>` render **tại chỗ**, Radix Dialog **portal ra `body`**. Đây là thay đổi cấu trúc DOM nặng nhất của cả plan. Gộp nó với bước khác thì lúc e2e đỏ không biết thủ phạm là ai. Call site: `stage-transition-dialog.tsx` + form thêm công ty / người liên hệ / cơ hội.

## Tests First

> **Đã sửa sau verification 14/08.** Phiên bản đầu của phase này định đặt T-A…T-F thành unit test Vitest ở `components/ui/__tests__/`. **Không chạy được:** `vitest.config.mts` có `projects: ['packages/*', 'apps/api']` — `apps/web` không nằm trong danh sách, và repo không có `@testing-library/react`, `jsdom`, hay `@vitejs/plugin-react`. `apps/web` hiện **không có một test nào**. Dựng hạ tầng test component mới vào đêm trước freeze là việc không đáng, nên **các khẳng định chuyển sang e2e Playwright** — hạ tầng đã chạy được, và kiểm **kết quả render thật** trên stack production nên mạnh hơn unit test class name.

Một spec mới: **`e2e/ui-invariants.spec.ts`**, viết **trước** khi sửa primitive đầu tiên. Nó đọc computed style trên stack thật, không đọc chuỗi class.

| ID | Khẳng định | Cách đo | Khoá gì |
| --- | --- | --- | --- |
| **T-A** | Mọi `button` thấy được trên `/cong-ty` và `/hang-doi` có `boundingBox().height >= 44` | `boundingBox()` | 44px — shadcn mặc định `h-9` = 36px |
| **T-B** | Nút chính ("Thêm công ty") có nền `rgb(255,194,15)` và chữ tối; nút `danger` **không** mang nền đó | `getComputedStyle` | cam = người bấm; danger không dùng màu thương hiệu |
| **T-C** | Badge cạnh phát hiện AI có `color` **hoặc** `background-color` thuộc dải machine (`#6d28d9`/`#ede9fe`); badge dữ liệu người nhập thì không | `getComputedStyle` | **luật 2** — fact ≠ suy luận |
| **T-D** | `getByLabel('Tên công ty')` còn tìm ra input sau migrate; nhập sai → text lỗi có `color` = `rgb(180,35,24)` (`danger`, **không** `text-red-600`) | selector + computed | label bind bằng `id`; màu lỗi đúng token |
| **T-E** | Mở form thêm công ty → `getByRole('dialog')` có accessible name; Escape đóng nó | role + keyboard | Radix Dialog giữ hợp đồng của native `<dialog>` |
| **T-F** | Cờ cảnh báo trên bảng cơ hội có **chuỗi chữ đọc được**, không chỉ nền màu | `textContent` | màu không phải kênh duy nhất |

**T-A và T-C là hai khẳng định quan trọng nhất của cả plan.** Chúng ngăn "migrate sang shadcn" biến thành "nhận nguyên `h-9` và `variant` của shadcn rồi mất 44px + mất luật 2".

Vòng chạy đúng:

```
viết ui-invariants.spec.ts → chạy trên code CHƯA migrate → phải XANH (nó khoá hành vi hiện tại)
  → migrate 1 primitive → chạy lại ui-invariants + đủ bộ e2e → commit
  → primitive tiếp theo
```

**Khác với TDD thường:** spec này phải **xanh trước khi sửa**, không đỏ trước khi sửa — vì nó khoá hành vi *đang đúng*, không mô tả hành vi *chưa có*. Đỏ lúc mới viết nghĩa là viết sai khẳng định, không phải phát hiện lỗi. Đây là hình dạng đúng của tests-first cho một refactor bảo toàn hành vi.

Commit từng primitive một, không gộp 6 file. Đây là điều kiện để `git revert` được đúng thủ phạm.

> Đánh đổi đã nhận: vòng lặp chậm vì mỗi lần chạy cần `pnpm start` sẵn. Chấp nhận được — e2e phải chạy sau mỗi primitive dù sao.

## Related Code Files

- Modify: `apps/web/src/components/ui/{table,warning-flag,badge,button,input,dialog}.tsx`
- Create: `e2e/ui-invariants.spec.ts` — T-A…T-F. **File trong `e2e/` thuộc chủ quyền C**, phải hỏi trước
- **Không** tạo `apps/web/src/components/ui/__tests__/` — `apps/web` không nằm trong `vitest.config.mts` projects và repo không có testing-library. Xem ghi chú ở Tests First
- Đọc, **không sửa**: `apps/web/src/components/next-step/auto-next-step-cell.tsx` · `components/provenance/*` · `components/proposal/pending-proposal-marker.tsx` — chúng gọi primitive nhưng không được đổi
- Không sửa: mọi file trong `app/**` (call site). Sửa call site nghĩa là đã phá "khoá vỏ"

## Implementation Steps

1. Viết `e2e/ui-invariants.spec.ts` (T-A…T-F) **trên code chưa migrate**, chạy → phải **xanh**. Đỏ nghĩa là khẳng định viết sai, sửa khẳng định.
2. `shadcn add button badge input dialog table` — **rồi đọc từng file CLI vừa ghi trước khi tin nó**. shadcn ghi thẳng vào `components/ui/`, tức nó **đè** file đang có. Nên: `git stash` file cũ hoặc `add` vào thư mục tạm rồi merge tay. Đây là bước dễ mất code nhất.
3. Với mỗi primitive theo thứ tự ở mục Architecture: migrate → `ui-invariants` xanh → `pnpm test:e2e` đủ → commit.
4. `dialog` làm **cuối, một mình**, và chạy đủ bộ e2e riêng cho nó.
5. Sau cả 6: `pnpm lint` + `typecheck` + `build` + `pnpm test` đủ, so với baseline P1.

## Success Criteria

- [ ] `e2e/ui-invariants.spec.ts` xanh **trước** khi migrate (khoá hành vi hiện tại) **và** xanh sau cả 6 primitive
- [ ] `pnpm test` khớp **đúng** baseline ghi ở P1 + đúng 1 spec mới (`ui-invariants`) — không phải "gần đúng"
- [ ] `grep -r "text-red-600\|h-9\b" apps/web/src/components/ui/` rỗng
- [ ] Không có file nào trong `app/**` bị sửa trong 6 commit của phase này
- [ ] `Badge` vẫn nhận `tone`, `Button` vẫn nhận `variant="primary"` — call site không đổi một chữ
- [ ] 6 commit riêng, revert được từng cái

## Risk Assessment

| Rủi ro | Xác suất | Đối sách |
| --- | --- | --- |
| **`shadcn add` đè mất file cũ kèm toàn bộ comment giải thích luật** | **cao** | Bước 1: `add` vào thư mục tạm hoặc stash trước. Comment trong `button.tsx`/`badge.tsx` là bằng chứng luật 7, mất là mất điểm |
| Radix Dialog portal ra body làm vỡ assertion e2e | TB | `dialog` đi cuối và đi một mình. Đỏ thì revert đúng 1 commit |
| Nhận nguyên `variant` của shadcn, mất `tone` | TB | T-C đỏ ngay. Đó là lý do T-C viết trước |
| `h-9` lọt lưới | TB | T-A đỏ ngay |
| **`ui-invariants.spec.ts` đo computed style nên nhạy với thay đổi vô hại** | TB | Đo ngưỡng (`height >= 44`) và dải màu, **không** so chuỗi class hay pixel chính xác. Khẳng định nào phải sửa vì restyle hợp lệ thì khẳng định đó viết quá chặt |
| `e2e/ui-invariants.spec.ts` nằm trong chủ quyền C | TB | Hỏi C cùng lúc với hai file e2e khác của plan này, một lần |
| Hết giờ giữa phase | TB | Commit từng file nên dừng ở đâu cũng là trạng thái xanh. Không có nửa vời |
| Radix `DialogTitle` bắt buộc phải có, thiếu là warning + mất accessible name | TB | T-E khẳng định accessible name, không chỉ khẳng định `role` |

**Đường lùi của cả phase:** nếu sau 30' gỡ không xong, `git revert` toàn bộ 6 commit. P1 + P2 vẫn đứng, giao diện vẫn đổi đời rõ rệt, chỉ là primitive còn viết tay. Nói thẳng điều đó với đội trước khi bắt đầu, để lúc 12:00 không ai cố cứu.

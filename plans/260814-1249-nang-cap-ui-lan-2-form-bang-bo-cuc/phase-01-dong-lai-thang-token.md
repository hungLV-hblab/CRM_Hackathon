# P1 · Đóng lại thang token — 40' — ❌ không cắt được

> Phase này gần như không đổi diện mạo. Nó tồn tại vì **checklist mục 7 của design-guidelines đang bị vi phạm trên nhánh đã merge**, và vì nếu không bịt cái grep thì bốn phase sau sẽ đẻ thêm drift mới mà không ai thấy.

## Bối cảnh

- [docs/design-guidelines.md §4](../../docs/design-guidelines.md) — bo góc đúng ba giá trị, bóng đúng hai mức
- [docs/design-guidelines.md §6](../../docs/design-guidelines.md) — alias shadcn chỉ sống trong `components/ui/`
- [apps/web/src/app/globals.css](../../apps/web/src/app/globals.css) — nguồn sự thật của giá trị

## Yêu cầu

Bốn vi phạm nhóm A của [plan.md](./plan.md#nhóm-a--thang-đã-chốt-bị-vi-phạm-đang-chạy-production), cộng một cửa chặn để nó không tái diễn.

## File chạm

| File | Việc |
| --- | --- |
| `apps/web/src/components/ui/skeleton.tsx` | sửa (A2) |
| `apps/web/src/app/(app)/hang-doi/proposal-card.tsx` | sửa dòng 139 (A1) |
| `apps/web/src/components/ui/card.tsx` | **xoá** (A4) |
| `apps/web/src/app/(app)/**` — 17 chỗ `bg-card` | đổi sang token thật (A3) |
| `apps/web/src/app/globals.css` | thêm khai báo miễn trừ dạng comment |
| `e2e/ui-invariants.spec.ts` | **thêm** assertion, không sửa cái cũ |

## Các bước

### 1. A2 — `Skeleton` về đúng thang (5')

`skeleton.tsx:9` đang là `rounded-md bg-accent`.

- `rounded-md` → `rounded-control`. Đây là bo góc **thứ tư** trong một hệ khai đúng ba.
- `bg-accent` → `bg-ink-200`. Hai lý do: `bg-accent` là alias (`ink-100`) và ink-100 trên nền ink-50 gần như không thấy nhịp đập; ink-200 mới nhìn ra là đang tải.
- Giữ `animate-pulse` — nó animate `opacity`, hợp luật.

Skeleton nào ở call site truyền `rounded-card` thì giữ nguyên, đó là chủ ý (khối skeleton to bằng cả thẻ).

### 2. A1 — bóng thứ ba (3')

`proposal-card.tsx:139` — popover lý do từ chối đang dùng `shadow-lg`.

→ `shadow-float`. Đúng nghĩa: đây là thứ **nổi lên trên** trang. Đồng thời đổi `z-10` thô sang `z-[var(--z-dropdown)]` — nó là dropdown, và thang z đã khai một lần ở `globals.css`.

### 3. A4 — xoá `card.tsx` (2')

```bash
grep -rn "components/ui/card\|from './card'" apps/web/src
```

Xác nhận **0 kết quả** rồi mới xoá. Lý do xoá thay vì sửa: nó là mã chết từ vòng 1 (P4 đã cắt việc bọc `Card`), và `border` trần của nó trong Tailwind v4 lấy `currentColor` → viền gần đen cho người dùng đầu tiên. Một component chưa ai dùng mà đã có bẫy thì xoá rẻ hơn giữ.

Nếu grep ra kết quả: **không xoá**, sửa `border` → `border-ink-200` và ghi lại ở P7.

### 4. A3 — bịt chỗ alias rò (15')

17 chỗ trong `app/` viết `bg-card`. Đây là **nền trắng của thẻ**, alias trỏ về `#ffffff`.

Vấn đề không phải màu sai — màu đúng. Vấn đề là `bg-card` **lọt qua đúng cái grep** ở checklist mục 7, nên nó là drift vô hình đúng như doc dự đoán.

Đối sách: thêm token **có tên theo vai trò** vào `globals.css` khối `@theme`:

```css
/* Nền của mọi bề mặt nổi trên nền trang: thẻ, hộp thoại, hàng bảng. Trắng, và có tên
   riêng để code màn hình không phải mượn từ vựng alias của shadcn — `bg-card` lọt qua
   mọi lần grep trong khi không nói cho người đọc biết đó là màu gì. */
--color-surface: #ffffff;
```

Rồi thay `bg-card` → `bg-surface` ở **17 chỗ trong `app/` only**. **Không** đụng `components/ui/` — trong đó `bg-card` là hợp lệ theo §6.

Khối `@theme inline` giữ `--color-card: #ffffff` như cũ để component vendored không đổi gì.

```bash
# sau khi sửa, phải rỗng:
grep -rE "bg-card|bg-background|text-primary\b|text-muted-foreground|border-border" apps/web/src/app/
```

### 4b. A5 — màu thô đang chạy production (5')

`app/(app)/dang-theo-doi/page.tsx` dùng `bg-red-50` và `text-red-700`. Màu thô Tailwind, guidelines §2 cấm thẳng.

→ `bg-danger-surface text-danger`, đúng token khối lỗi mà 7 màn còn lại đang dùng. Nếu P3 chạy trước thì chỗ này thành `<ErrorState>` luôn.

**Vì sao nó ship được** là phần đáng ghi hơn cả bản sửa: checklist mục 7 grep `slate-|amber-|indigo-|bg-\[#` — không phủ `red-*`. Bước 5 bịt gốc.

### 5. Cửa chặn — sửa lại grep, rồi giao cho test giữ (7')

Năm vi phạm trên đều ship được vì cái cửa hỏng **hai chiều**:

```bash
$ grep -rE "slate-|amber-|indigo-|bg-\[#" apps/web/src
apps/web/src/components/shell/nav-list.tsx: … -translate-y-1/2 rounded-pill bg-brand-400
apps/web/src/components/ui/dialog.tsx:      … -translate-x-1/2 -translate-y-1/2 …
```

- **Báo nhầm:** cả hai kết quả là `-tran`**`slate-`**`y-1/2`. Ai chạy cũng thấy rác, kết luận "lại translate", rồi thôi không đọc kỹ nữa.
- **Sót:** `bg-red-50` ở `dang-theo-doi` **không** nằm trong kết quả, vì regex không phủ `red-*`.

Cửa vừa sót vừa báo nhầm tệ hơn không có cửa — nó tạo cảm giác đã kiểm. Sửa: **neo theo tiền tố utility**, không khớp giữa từ.

```
(bg|text|border|ring|fill|stroke|from|to|via|divide|accent|outline|shadow|caret)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]
```

`-[0-9]` ở cuối là chốt thứ hai: `bg-brand-400` không khớp vì `brand` không nằm trong danh sách bảng màu Tailwind, còn `text-danger` không khớp vì không có số.

Rồi **để test giữ nó** chứ không để người nhớ.

Thêm vào `e2e/ui-invariants.spec.ts` một test **không mở trình duyệt** — đọc file bằng `fs`, không phải Playwright page:

```ts
test('thang bo góc, bóng, và từ vựng alias không rò ra ngoài components/ui', async () => {
  // Ba thứ đã ship sai vì checklist chỉ grep màu: bo góc thứ tư, bóng thứ ba, và alias
  // shadcn dùng ngoài components/ui/. Cả ba lọt qua mọi lần grep cũ.
  // dropdown-menu.tsx là component Radix vendored 257 dòng — miễn trừ có chủ đích, ghi ở ADR-0034.
})
```

**Bốn** luật, mỗi luật một expect, thông báo lỗi **nói cách sửa** chứ không chỉ "fail":

| Luật | Regex | Phạm vi | Miễn trừ |
| --- | --- | --- | --- |
| **màu thô** | bản neo tiền tố ở trên, cộng `bg-\[#` | `apps/web/src` | không |
| bo góc | `rounded-(sm\|md\|lg\|xl\|2xl\|3xl\|full)` | `apps/web/src` | `dropdown-menu.tsx` |
| bóng | `shadow-(sm\|md\|lg\|xl\|2xl)` | `apps/web/src` | `dropdown-menu.tsx` |
| alias | `bg-card\|bg-background\|text-primary\b\|text-muted-foreground\|border-border` | `apps/web/src/app` | không |

Lưu ý `rounded-full` — repo dùng `rounded-pill`, `rounded-full` là tên thứ hai cho cùng một giá trị.

**Bỏ qua comment.** `ui/input.tsx` có chữ `text-red-600` **trong một dòng comment** kể lại vi phạm cũ đã sửa. Test phải lọc dòng bắt đầu bằng `*` / `//`, không thì nó đỏ vì một câu văn — và cái đỏ sai đầu tiên là lúc người ta bắt đầu nới regex.

### 6. Chạy (5')

```
pnpm lint && pnpm typecheck && pnpm test
```

## Tiêu chí xong

- [ ] `pnpm test` xanh: 281 unit + 32 e2e + **1 test mới** trong `ui-invariants`
- [ ] **Bốn** grep ở bước 5 rỗng (trừ miễn trừ đã khai)
- [ ] `bg-red-50` / `text-red-700` ở `dang-theo-doi` đã thành token
- [ ] Grep màu thô **không còn báo nhầm trên `-translate-`** — chạy thử, phải ra 0 dòng chứ không phải 2 dòng rác
- [ ] `card.tsx` đã xoá, `pnpm build` xanh
- [ ] `--color-surface` có trong `globals.css` kèm comment giải thích **vì sao** cần tên riêng
- [ ] Không màn nào đổi diện mạo ngoài skeleton đậm hơn một bậc

## Rủi ro & đường lùi

| Rủi ro | Đối sách |
| --- | --- |
| Test grep mới đỏ vì chỗ chưa biết | Đọc kết quả, sửa chỗ đó. **Không** nới regex để test xanh — đó là bỏ luật, không phải sửa lỗi |
| `bg-surface` chưa có lúc build Tailwind v4 | Tailwind v4 lỗi token là lỗi **lúc build**, không phải lúc chạy. `pnpm build` bắt ngay |
| Xoá `card.tsx` gãy import | grep trước, 0 kết quả mới xoá |

Đường lùi: `git revert` một commit. P1 hoàn toàn độc lập.

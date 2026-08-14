# P5 · Bảng — dính thật, sắp xếp được, mật độ — 1h — ✅ cắt được

> `table.tsx` có comment nói *"`sticky` header, so scrolling a long list never leaves a reader guessing which column is which"*. **Hành vi đó không tồn tại.**
> Phase rủi ro nhất cả plan: 5 spec tìm dòng bằng `getByRole('cell', { name })`. Chạy riêng một commit, chạy e2e riêng một lần.

## Bối cảnh

- [design-guidelines §6](../../docs/design-guidelines.md) — *"Bảng: header dính, cột số căn phải + `tabular`, hàng hover đổi nền. Danh sách trên 50 dòng thì phân trang hoặc ảo hoá"*
- [apps/web/src/components/ui/table.tsx](../../apps/web/src/components/ui/table.tsx)
- Phát hiện D1–D3 ở [plan.md](./plan.md#nhóm-d--bảng-bố-cục-nhịp-chữ)

## D1 — vì sao header không dính

```tsx
<div className="overflow-x-auto rounded-card …">   ← không có ràng buộc chiều cao
  <table>
    <thead className="sticky top-0 z-[1] …">
```

Hai lỗi chồng nhau:

1. **Hộp bọc không bao giờ cuộn dọc.** Nó chỉ khai `overflow-x-auto` và không có `max-h`, nên chiều cao của nó luôn bằng chiều cao bảng. `sticky top-0` dính vào **đỉnh của hộp đó**, mà đỉnh hộp không bao giờ trôi qua → không có gì để dính.
2. **Kể cả sửa (1), nó vẫn sai.** Trang cuộn bằng cửa sổ, và header ứng dụng dính ở `top-0` cao **56px** (`h-14`). `thead` dính `top-0` sẽ chui **dưới** header ứng dụng.

Nên hiện tại: cuộn danh sách công ty dài xuống, **tiêu đề cột biến mất**, và mọi con số bị đọc dưới tiêu đề sai. Hỏng kiểu im lặng — không có gì trông như lỗi.

## Yêu cầu

1. Header dính **thật**, ngay dưới header ứng dụng
2. Cột số: **header căn phải** khớp với ô căn phải
3. Sắp xếp được, có `aria-sort`
4. Bề rộng cột điều khiển được — chữ dài thôi xuống dòng lởm chởm
5. Bảng nói được nó có bao nhiêu dòng

## Ràng buộc — đọc trước khi gõ

- **Không đổi cấu trúc DOM.** `<table>/<thead>/<tbody>/<tr>/<td>` giữ nguyên vai trò. `getByRole('cell')` đọc chính nó
- **Bề mặt API `headers: string[]` + `<Cell>` giữ nguyên** — 4 màn đang gọi thế
- Sắp xếp là **tuỳ chọn opt-in**, mặc định tắt. Bật đại trà = đổi hành vi 4 màn cùng lúc trước freeze

## File chạm

| File | Việc |
| --- | --- |
| `components/ui/table.tsx` | sửa |
| `tong-quan/page.tsx` · `cong-ty/page.tsx` · `dang-theo-doi/page.tsx` · `nhat-ky-vong-quet/page.tsx` | truyền `align`/`sortable` |
| `e2e/ui-invariants.spec.ts` | thêm assertion header dính |

## Các bước

### 1. Header dính thật (15')

```tsx
<div className="max-h-[calc(100vh-14rem)] overflow-auto rounded-card border border-ink-200 bg-surface shadow-card">
  <table className="w-full text-left text-body">
    <thead className="sticky top-0 z-(--z-sticky) bg-ink-100">
```

Ba đổi:
- `max-h-[calc(100vh-14rem)]` — **hộp mới thật sự cuộn dọc**. 14rem = header 3.5rem + gutter + tiêu đề trang, ước lượng thô có chủ đích: hụt vài chục px thì bảng cuộn sớm một chút, thừa thì trang cuộn thay — cả hai đều không hỏng
- `overflow-auto` thay `overflow-x-auto`
- `top-0` **đúng** ở đây, vì giờ nó dính vào hộp cuộn **của chính bảng**, không phải vào cửa sổ. Không cần bù 56px nữa — đó là chỗ dễ tính sai nhất

`z-(--z-sticky)` thay `z-[1]`: thang z đã khai một lần, đừng tự chế số.

Thêm nền đặc cho `thead` (`bg-ink-100`, đã có) — thiếu nền đặc thì hàng cuộn qua sẽ hiện xuyên qua tiêu đề.

### 2. Header căn phải cho cột số (10')

`Cell` đã có prop `numeric` → `text-right`. **Header thì không**, nên cột "Số cơ hội" có tiêu đề bên trái và số bên phải. Mắt mất chỗ căn.

Nâng `headers` từ `string[]` lên nhận **cả hai kiểu**:

```ts
type Header = string | { label: string; align?: 'right'; width?: string; sortKey?: string }
```

`string` giữ nguyên nghĩa → **4 màn hiện tại không phải sửa gì để chạy**. Màn nào cần thì nâng cấp từng cột.

`aria`/accessible name của `<th>` **không đổi** dù dùng kiểu nào.

### 3. Sắp xếp (20')

Chỉ khi cột khai `sortKey`:

- `<th>` bọc `<button>` full-width, `min-h-11`, có icon `ArrowUpDown`/`ArrowUp`/`ArrowDown` Lucide `aria-hidden`
- `<th aria-sort="ascending|descending|none">` — WCAG đòi, và nó là cách trình đọc màn hình biết
- **`Table` không tự sắp xếp dữ liệu.** Nó bắn `onSort(key, direction)`; màn gọi tự sắp xếp. Component không được sở hữu thứ tự dữ liệu — đó là chỗ nó sẽ lệch với thứ tự server trả về
- Bật ở **đúng một màn**: `/cong-ty` (cột Tên, Ngành). Đó là bảng dài nhất. Bốn màn kia giữ nguyên

**Sắp xếp là tuỳ chọn** vì mỗi màn có một nguồn thứ tự khác nhau, và cắt bước này vẫn để lại bước 1–2 chạy được.

### 4. Bề rộng cột + xuống dòng (10')

- `width` trên header → `style={{ width }}` trên `<th>`
- `/cong-ty`: Tên `28%`, còn lại tự chia
- Bỏ `whitespace-nowrap` khỏi `<th>` — nó ép header không xuống dòng, đẩy bảng tràn ngang ở 375px. Thay bằng `whitespace-nowrap` chỉ trên cột có `align: 'right'` (số không nên xuống dòng)
- `Cell` thêm `break-words` — hiện chữ dài đẩy cột

### 5. Bảng nói nó có bao nhiêu dòng (5')

`<caption className="sr-only">` — nhận prop `caption`, tuỳ chọn. Người dùng bàn phím và trình đọc màn hình biết mình đang ở bảng nào và bao nhiêu dòng, mà không thêm một chữ nào lên màn.

**Không** thêm text hiển thị: chuỗi mới trên màn là chuỗi mới cho spec.

### 6. Chạy riêng (10')

```
pnpm test:e2e        # riêng một lần, không gộp
pnpm test
```

Nếu đỏ: đọc lỗi. `getByRole('cell')` chỉ đỏ nếu `<td>` đổi vai trò — mà bước 1–5 **không đổi vai trò nào**. Đỏ mà không sửa được trong **15'** → `git revert` P5.

Thêm vào `ui-invariants`:

```ts
// Comment cũ trong table.tsx hứa header dính, nhưng hộp bọc không bao giờ cuộn dọc nên
// không có gì để dính. Đo vị trí thead sau khi cuộn, đừng tin comment.
```

## Tiêu chí xong

- [ ] Cuộn bảng dài: tiêu đề cột **vẫn thấy được**, có test đo
- [ ] Header cột số căn phải khớp ô
- [ ] `/cong-ty` sắp xếp được theo Tên, có `aria-sort`
- [ ] 375px: bảng không đẩy trang tràn ngang
- [ ] `pnpm test` xanh, 32 e2e cũ **không đỏ cái nào**
- [ ] `headers: string[]` cũ vẫn chạy — không màn nào **buộc** phải sửa

## Rủi ro & đường lùi

| Rủi ro | Xác suất | Đối sách |
| --- | --- | --- |
| 5 spec đọc `getByRole('cell')` đỏ | trung bình | Commit riêng, e2e riêng. Đỏ >15' → `git revert` |
| `max-h` cắt cụt bảng ngắn, để khoảng trắng thừa | thấp | `max-h` là **trần**, không phải chiều cao. Bảng ngắn hơn thì hộp co theo |
| Bảng lồng trong hai cột của P4 tính `100vh` sai | trung bình | P4 nửa B chạy trước thì kiểm lại `/cong-ty/[id]`; màn đó không có bảng, an toàn |
| Nút sắp xếp trong `<th>` phá `getByRole('columnheader', {name})` | thấp | Nút chứa **đúng chuỗi nhãn**, accessible name của `<th>` không đổi |

Đường lùi: một commit. Đây là phase **cắt được** — hết giờ thì bỏ cả, plan vẫn đứng.

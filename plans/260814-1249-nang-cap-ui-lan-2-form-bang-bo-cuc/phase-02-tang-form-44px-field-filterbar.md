# P2 · Tầng form — 44px, Field, Checkbox, FilterBar — 1h10' — ❌ không cắt được

> Tầng nhỏ nhất là tầng yếu nhất. Ô nhập xuất hiện trên **mọi** màn, và hiện nó thấp hơn nút đứng cạnh nó 6px, mũi chevron do hệ điều hành vẽ, checkbox là control trần của trình duyệt.
> Đây là phase đổi diện mạo **nhiều nhất trên mỗi phút bỏ ra**.

## Bối cảnh

- [design-guidelines §6](../../docs/design-guidelines.md) — luôn có label nhìn thấy được; lỗi ngay dưới ô sai; vùng chạm ≥44px
- [apps/web/src/components/ui/input.tsx](../../apps/web/src/components/ui/input.tsx) — hiện trạng
- [apps/web/src/components/ui/button.tsx](../../apps/web/src/components/ui/button.tsx) — `min-h-11` là chuẩn phải khớp
- Phát hiện C1–C5 ở [plan.md](./plan.md#nhóm-c--tầng-nhỏ-nhất-là-tầng-yếu-nhất)

## Yêu cầu

1. `Input` và `Select` cao **≥44px**, khớp `Button` đứng cạnh
2. `Select` không còn dùng chevron của HĐH
3. Có component `Checkbox` — thôi dùng control trần
4. Ô nhập có **dòng gợi ý** và **dấu bắt buộc** (guidelines §6 và luật 4: ô rỗng phải nói vì sao rỗng)
5. Hàng lọc thành `FilterBar` có **chip lọc đang bật** + nút xoá **luôn hiện khi có lọc**, không phải chỉ khi rỗng

## Ràng buộc — đọc trước khi gõ

- **`label` là prop bắt buộc, giữ nguyên.** `getByLabel('Mật khẩu')`, `getByLabel('Tên công ty')`… là cách e2e tìm ô. Đổi chuỗi = đỏ.
- **Không đổi tên prop.** `label`, `error`, và mọi prop HTML truyền thẳng.
- Ô nhập giữ **cạnh thẳng ở bảng**, nhưng bản thân `Input` dùng `rounded-control` như hiện tại — guidelines §4 ghi `rounded-control` cho *nút, ô nhập*.

## File chạm

| File | Việc |
| --- | --- |
| `components/ui/input.tsx` | sửa lớn, giữ bề mặt API |
| `components/ui/checkbox.tsx` | **mới** |
| `components/ui/filter-bar.tsx` | **mới** |
| `app/(app)/cong-ty/page.tsx` | dùng `FilterBar` |
| `app/(app)/co-hoi/page.tsx` | dùng `FilterBar` + `Checkbox` |
| `app/globals.css` | thêm token mật độ ô nhập |
| `e2e/ui-invariants.spec.ts` | thêm assertion đo chiều cao |

## Các bước

### 1. Token mật độ (5')

Chiều cao ô nhập là **quyết định**, không phải class rải rác. Vào `globals.css` khối `@theme`:

```css
/* Ô nhập và nút phải cao BẰNG NHAU khi đứng cạnh nhau trên một hàng lọc — lệch 6px là
   thứ không ai báo lỗi nhưng ai cũng thấy. 44px là vùng chạm tối thiểu của guidelines §6,
   nên một con số phục vụ cả hai việc. */
--size-control: 2.75rem; /* 44px */
```

`Button` giữ `min-h-11` (bằng đúng giá trị này) — không sửa `button.tsx`, tránh chạm file mà `ui-invariants` đang đo.

### 2. `Field` — vỏ dùng chung cho mọi control (15')

Hiện `Input` và `Select` **lặp lại** khối `<div><label/>…<p error/></div>`. Rút vào một `Field` nội bộ trong `input.tsx` (không tách file — dưới 200 dòng và cùng một mối quan tâm):

Trách nhiệm của `Field`:
- sinh `id`, nối `htmlFor`
- label nhìn thấy được, `text-sm font-medium text-ink-700` (giữ nguyên)
- **dấu bắt buộc**: khi `required`, thêm `<span aria-hidden className="text-danger">*</span>` sau nhãn và `aria-required` trên control. `aria-hidden` để trình đọc màn hình không đọc "sao" — nó đã có `aria-required`
- **dòng gợi ý** `hint`: `text-xs text-ink-600` **dưới** ô, nối bằng `aria-describedby`. Ẩn khi có `error` (một dòng phụ tại một thời điểm)
- lỗi: giữ nguyên cơ chế `aria-invalid` + `aria-describedby` đang có

**Không** đổi thứ tự DOM của label và input — `getByLabel` không quan tâm nhưng thứ tự tab thì có.

### 3. `Input` (10')

```
FIELD = 'w-full min-h-(--size-control) rounded-control border border-ink-300 bg-surface px-3
         text-sm text-ink-900 placeholder:text-ink-400 outline-none
         transition-colors duration-(--duration-state)
         hover:border-ink-400 focus:border-ink-900
         disabled:bg-ink-100 disabled:text-ink-400 disabled:cursor-not-allowed
         aria-[invalid=true]:border-danger'
```

Đổi so với hiện tại:
- `min-h-(--size-control)` thay `py-2` → 44px thật
- `hover:border-ink-400` — hiện **không có phản hồi hover nào** trên ô nhập
- `disabled:` — hiện không có trạng thái tắt, ô tắt trông y hệt ô bật
- `placeholder:text-ink-400` — ink-400 là màu **duy nhất** guidelines cho phép làm placeholder
- `bg-surface` (token của P1), không phải `bg-card`

**Không** thêm `focus:ring` — focus ring đã khai toàn cục ở `globals.css`, thêm nữa là hai vòng.

### 4. `Select` — bỏ chevron của HĐH (15')

Giữ `<select>` thật (không chuyển sang Radix Select: đổi sang listbox tuỳ biến là đổi cả cách e2e chọn option, quá đắt trước freeze). Chỉ bỏ mũi tên mặc định và tự vẽ:

- `appearance-none` + `pr-10` trên control
- `<ChevronDown className="size-4 text-ink-600" aria-hidden />` đặt tuyệt đối bên phải, `pointer-events-none` (bấm xuyên qua vào `<select>`)
- bọc trong `relative`

Icon **Lucide**, cùng họ với shell — không tự vẽ SVG.

Chevron `pointer-events-none` là bắt buộc: thiếu nó, bấm đúng vào mũi tên thì không mở được dropdown, và đó là chỗ người ta bấm nhiều nhất.

### 5. `Checkbox` mới (10')

`co-hoi/page.tsx:94` đang là `<input type="checkbox" className="size-4 accent-brand-500">` — control trần, 16px, không nhuộm token được ngoài `accent`.

`components/ui/checkbox.tsx`, dùng `radix-ui` đã có trong deps:

- vùng chạm **toàn bộ nhãn** ≥44px (`<label className="flex min-h-11 items-center gap-2 cursor-pointer">`)
- ô 20px, `rounded-control`, viền `ink-300`
- khi chọn: **nền `brand-400` + dấu tick `ink-900`** — cam nghĩa là *người vừa bấm*, đúng luật màu §1. Tick màu ink chứ không trắng (trắng trên brand-400 là 1.7:1)
- `hover:border-ink-400`, focus dùng ring toàn cục

Chuỗi nhãn `Chỉ hiện quá hạn` **giữ nguyên từng ký tự**.

### 6. `FilterBar` (15')

Hàng lọc ở `cong-ty` (5 control) và `co-hoi` (2 control) hiện là lưới trần. Thiếu ba thứ:

1. **không nhóm** — 5 ô lọc trôi nổi ngang hàng với nội dung trang
2. **không biết đang lọc gì** nếu cuộn xuống
3. **nút xoá lọc chỉ hiện khi kết quả rỗng** — lọc ra 2 dòng thì không có đường về

`components/ui/filter-bar.tsx`:

```tsx
<FilterBar
  activeCount={n}
  onReset={() => setFilters(EMPTY_FILTERS)}
  chips={[{ label: 'Ngành: Bán lẻ', onRemove }, …]}
>
  {/* các Input/Select */}
</FilterBar>
```

- vỏ: `SectionCard` của P3 nếu P3 đã xong, không thì `rounded-card border border-ink-200 bg-surface p-4` (P3 sẽ thay sau)
- lưới control: `grid gap-3 sm:grid-cols-2 lg:grid-cols-4` — **giảm từ 5 cột xuống 4**. Năm ô 44px trên một hàng 1024px là mỗi ô ~180px, không đọc được nhãn dài như "Lọc theo loại hình"
- **chip lọc đang bật**: hàng dưới, mỗi chip `rounded-pill bg-ink-100 text-ink-700` + nút `×` vùng chạm 44px. Màu **ink, không cam, không tím** — bộ lọc không phải hành động chính và cũng không do máy sinh
- **nút xoá lọc**: `variant="secondary"`, hiện khi `activeCount > 0`, nhãn `Xoá bộ lọc` **trùng đúng chuỗi** đang có ở empty state của `cong-ty/page.tsx`

Nút xoá ở empty state **giữ nguyên**, không bỏ — hai chỗ, hai ngữ cảnh, cùng một chuỗi.

### 7. Đo bằng test, không bằng mắt (5')

Thêm vào `e2e/ui-invariants.spec.ts`:

```ts
// 38px và 44px trông giống nhau trên ảnh chụp và khác hẳn dưới ngón tay. Đo, đừng nhìn.
for (const nhan of ['Tìm theo tên', 'Lọc theo ngành']) {
  const box = await page.getByLabel(nhan).boundingBox()
  expect(box!.height).toBeGreaterThanOrEqual(44)
}
```

Cộng một assertion cho `Chỉ hiện quá hạn` ở màn cơ hội.

### 8. Kiểm 375px (5')

Mở `/cong-ty` ở 375px: hàng lọc phải **xếp dọc**, không tràn ngang, mỗi ô còn đủ 44px.

## Tiêu chí xong

- [ ] `pnpm test` xanh, không spec cũ nào đỏ
- [ ] Ô nhập / ô chọn / checkbox đo được ≥44px — có test khẳng định
- [ ] `Select` không còn chevron của HĐH; bấm vào mũi tên vẫn mở được
- [ ] Không còn `<input type="checkbox">` trần trong `app/`
- [ ] Hàng lọc có chip + nút xoá, xoá được về rỗng
- [ ] Chuỗi nhãn không đổi một ký tự nào
- [ ] 375px: không tràn ngang

## Rủi ro & đường lùi

| Rủi ro | Đối sách |
| --- | --- |
| `appearance-none` làm mất chevron mà icon không hiện đúng chỗ | Kiểm trên Chrome + Firefox trước khi commit. Hỏng thì bỏ bước 4, giữ chevron HĐH |
| Radix Checkbox đổi cách e2e tick | e2e dùng `getByLabel(...).check()` — Radix render `<button role="checkbox">`, `.check()` **vẫn chạy**. Nếu đỏ: giữ `<input>` thật ẩn dưới, tự vẽ ô trên |
| Lưới 5→4 cột làm màn cong-ty cao thêm một hàng | Chấp nhận. Đọc được quan trọng hơn cao bằng |

Đường lùi: P2 nằm gọn trong `ui/input.tsx` + 2 file mới + 2 call site. `git revert` một commit.

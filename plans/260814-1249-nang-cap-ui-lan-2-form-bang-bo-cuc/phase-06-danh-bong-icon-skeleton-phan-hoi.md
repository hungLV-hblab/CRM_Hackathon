# P6 · Đánh bóng — icon, skeleton đúng hình, phản hồi bấm — 30' — ✅ cắt trước tiên

> Phase này **cắt đầu tiên, luôn luôn**. Nó không sửa lỗi nào và không bịt luật nào — nó chỉ làm sản phẩm trông như có người chăm.
> Ba việc nhỏ, độc lập nhau, làm được bao nhiêu tính bấy nhiêu.

## Bối cảnh

- [design-guidelines §6](../../docs/design-guidelines.md) — icon dùng SVG (Lucide), **cấm emoji**
- Phát hiện B4, D7 ở [plan.md](./plan.md)

## Việc 1 · Một bộ icon, và dùng nó (10')

**Hiện trạng:** `lucide-react` cài rồi, dùng ở `shell/` + `ui/`. Nhưng:

- `ui/warning-flag.tsx` **tự vẽ SVG tam giác** — `strokeWidth="1.6"`, trong khi Lucide mặc định `2`. Hai độ dày nét cạnh nhau là thứ mục "Stroke Consistency" gọi là mất độ hoàn thiện
- **Toàn bộ `app/` import 0 icon.** Bảng, trạng thái rỗng, nút hành động đều là chữ trơn

Việc:

1. `warning-flag.tsx`: SVG tay → `<TriangleAlert className="size-3.5 shrink-0" aria-hidden />`. **Giữ nguyên chuỗi nhãn** — `OPPORTUNITY_WARNING[warning]` và `Quá hạn từ {dueDate}` không đổi một ký tự
2. Icon dẫn cho nút hành động chính, `aria-hidden`, chữ giữ nguyên:
   - `Thêm công ty` · `Thêm cơ hội` → `Plus`
   - `Xoá bộ lọc` → `X`
   - `Hoàn tác` (`auto-next-step-cell.tsx`) → `Undo2` — **nút quan trọng nhất của vùng 3**, luật 3 đòi nó dễ bấm hơn cả lúc máy làm
3. Kích cỡ icon **hai giá trị, không có giá trị thứ ba**: `size-4` trong nút và chữ, `size-5` trong điều hướng và nút icon

**Cấm:** đổi nhãn nút thành chỉ-icon. Guidelines đã loại icon rail vì đúng lý do đó.

## Việc 2 · Skeleton đúng hình (10')

**Hiện trạng:** 8/10 skeleton là `h-40 w-full` — một khối xám không giống thứ sắp tới. Dữ liệu về là trang nhảy.

`tong-quan` làm đúng rồi (4 khối bằng 4 block) và có comment giải thích. Lan cách đó ra:

| Màn | Trước | Sau |
| --- | --- | --- |
| `/cong-ty` | `h-64 w-full` | **hình bảng**: 1 dải header + 6 dải dòng, `gap-px`, trong vỏ `rounded-card border` |
| `/co-hoi` | `h-40 w-full` | **hình bảng kanban**: 4 cột `w-72`, mỗi cột 2 thẻ |
| `/hang-doi` | `h-40 w-full` | **hình thẻ gợi ý**: 2 khối `h-32 rounded-card` |
| `cong-ty/[id]` × 3 | `h-40 w-full` | giữ — mỗi cái đã nằm trong một section, hình vuông là đúng |

Rút một `TableSkeleton` nội bộ (`rows` prop) để không viết ba lần.

**Không** thêm hiệu ứng shimmer chạy ngang: `animate-pulse` animate `opacity`, hợp luật; shimmer thường animate `background-position` — buộc trình duyệt vẽ lại mỗi khung hình, và guidelines §4 cấm.

## Việc 3 · Phản hồi bấm và hover (10')

Kiểm và bịt, theo mục "Touch & Interaction" — CRITICAL:

| Chỗ | Hiện trạng | Sửa |
| --- | --- | --- |
| Hàng bảng | `hover:bg-ink-50` có | ✅ giữ |
| Nút | `hover:` + `active:` có | ✅ giữ |
| **Link trong ô bảng** | `underline` + `hover:text-ink-600` | ✅ giữ |
| **Thẻ cơ hội (kéo được)** | không có phản hồi hover | thêm `hover:border-ink-300`. **Không** dùng `transform` — dnd-kit đã sở hữu `transform` của node đó |
| **Thẻ gợi ý ở hàng đợi** | không có | thêm `hover:border-ink-300` |
| **Mục dòng thời gian** | không có | thêm `hover:border-ink-300`, **giữ nguyên** viền `machine-200` của mục hệ thống — đó là luật màu vùng 4, không phải trang trí |

Luật: **chỉ đổi `border-color` và `background`**, không đổi `transform`/`box-shadow`. Đổi bóng khi hover là tầng bóng thứ ba trá hình; đổi transform đụng dnd-kit.

## Tiêu chí xong

- [ ] `grep -rn "<svg" apps/web/src` **rỗng** — mọi icon là Lucide
- [ ] Không emoji làm icon ở đâu
- [ ] Icon chỉ có `size-4` và `size-5`
- [ ] Skeleton của `/cong-ty`, `/co-hoi`, `/hang-doi` giống hình nội dung sắp tới
- [ ] Mọi bề mặt bấm được có phản hồi hover
- [ ] `pnpm test` xanh; **không đổi chuỗi hiển thị nào**

## Rủi ro & đường lùi

| Rủi ro | Đối sách |
| --- | --- |
| Thêm icon vào nút làm đỏ `getByRole('button', {name})` | Icon `aria-hidden` → **không vào accessible name**. Nếu vẫn đỏ: bỏ icon ở nút đó |
| Hover trên thẻ cơ hội đụng dnd-kit | Chỉ `border-color`, không `transform`. Kiểm kéo thả bằng chuột **và** bàn phím sau khi sửa |
| Skeleton mới phức tạp hơn nội dung nó thay | Trần: 3 phần tử cho mỗi skeleton. Quá thì làm đơn giản lại |

Đường lùi: ba việc **độc lập**, ba commit. Cắt việc nào cũng được.

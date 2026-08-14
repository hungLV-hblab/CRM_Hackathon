# P3 · Ba component trạng thái dùng chung — 45' — ❌ không cắt được

> **10 trạng thái rỗng viết tay. ~8 khối lỗi copy-paste. 17 chỗ tự vẽ lại thẻ section.**
> Không phải chuyện đẹp/xấu: thiếu ba component nghĩa là **không có chỗ nào để sửa một lần**, và mỗi màn mới lại phát minh lại một bản hơi khác.

## Bối cảnh

- [design-guidelines §6](../../docs/design-guidelines.md) — *"Trạng thái rỗng luôn có câu giải thích + một hành động, không để trang trắng"*
- [CLAUDE.md luật 4](../../CLAUDE.md) — *"Một dòng dữ liệu sai tệ hơn một dòng để trống. Không chắc thì để trống + nói rõ vì sao trống"*
- Phát hiện B1–B3 ở [plan.md](./plan.md#nhóm-b--thiếu-tầng-trừu-tượng-drift-thành-10-bản-sao)

## Drift đo được

| Chỗ | Bo góc | Padding | Cỡ chữ | Màu chữ |
| --- | --- | --- | --- | --- |
| `co-hoi/stage-board.tsx:115` | `rounded-control` | `p-3` | `text-xs` | `ink-500` |
| `cong-ty/page.tsx:166` | `rounded-card` | `p-6` | `text-sm` | `ink-600` |
| `cong-ty/[id]/contact-section.tsx:75` | `rounded-control` | `p-3` | `text-sm` | `ink-600` |
| `cong-ty/[id]/timeline-section.tsx:143` | `rounded-control` | `p-3` | `text-sm` | `ink-600` |
| `dang-theo-doi/page.tsx:101,124` | `rounded-control` | `p-3` | `text-sm` | `ink-600` |
| `quan-tri/nhat-ky-vong-quet:59` | `rounded-control` | `p-4` | `text-sm` | `ink-600` |
| `tong-quan/page.tsx:72,173` | `rounded-card` | `p-4` | `text-sm` | `ink-600` |
| `provenance/reading-zone.tsx:23` | `rounded-control` | `p-4` | `text-sm` | `ink-500` |

**Hai bo góc, bốn padding, hai cỡ, hai màu — cho một khái niệm.**

## Yêu cầu

Ba component mới, rồi thay hết chỗ gọi. **Không component nào nhận `className` để tuỳ biến bừa** — điểm của phase này là bỏ chỗ để drift.

## File chạm

| File | Việc |
| --- | --- |
| `components/ui/section-card.tsx` | **mới** |
| `components/ui/empty-state.tsx` | **mới** |
| `components/ui/error-state.tsx` | **mới** |
| 10 file ở bảng trên + ~8 chỗ `role="alert"` | thay thế |

## Các bước

### 1. `SectionCard` (10')

17 chỗ đang viết tay `rounded-card border border-ink-200 bg-card p-4|p-5 shadow-card`. Chốt **`p-5`** (con số nhiều hơn) và một `SectionCard` duy nhất.

```tsx
<SectionCard title="Dòng thời gian" actions={<Button…/>}>…</SectionCard>
```

- `title` render `<h2>` — **giữ nguyên mọi chuỗi tiêu đề hiện có**, vì `getByRole('heading', {name})` và `getByRole('region', {name})` đang đọc chúng
- **`title` không bắt buộc** — vài chỗ (thẻ chỉ số ở `quan-tri`) không có tiêu đề
- Thẻ có tiêu đề render `<section aria-labelledby>`; không tiêu đề render `<div>`. Đừng bịa `aria-label` mới, nó tạo accessible name mà không spec nào biết
- `title` dùng cỡ của tầng chữ P4 (`text-lg`) — **P3 tạm để `text-base font-semibold`**, P4 nâng. Ghi lại để P4 không quên

**Chỗ phải cẩn thận:** `cong-ty/[id]/timeline-section.tsx:186` có thẻ đổi màu theo nguồn (`isSystem ? 'border-machine-200 bg-machine-50' : …`). Đó là **mục dòng thời gian**, không phải section — **không** đổi nó sang `SectionCard`. Nó mang luật màu vùng 4 và đúng như đang có.

### 2. `EmptyState` (15')

```tsx
<EmptyState
  icon={Inbox}                          // Lucide, aria-hidden
  message="Chưa có cơ hội nào ở giai đoạn này"
  action={<Button variant="secondary">Xoá bộ lọc</Button>}   // tuỳ chọn
  compact                                // cho ô nhỏ như cột kanban
/>
```

Một hình dạng, hai mật độ:
- mặc định: `rounded-card border border-dashed border-ink-300 p-6 text-center`, chữ `text-sm text-ink-600`, icon `size-6 text-ink-400`
- `compact`: `rounded-control p-3 text-left`, chữ `text-xs text-ink-600`, không icon — dùng cho cột kanban và ô hẹp

Ba luật ép trong component:
1. **`message` là prop bắt buộc và phải là câu.** Luật 4 cấm ô rỗng trơ trọi. Không có nhánh render nào vẽ ra hộp rỗng không chữ
2. **Không dùng emoji.** `icon` chỉ nhận component Lucide
3. **Không nhận `className`** — muốn khác thì thêm biến thể, không vá tại chỗ

Thay **toàn bộ 10 chỗ** ở bảng drift. `text-ink-500` ở 2 chỗ lên `ink-600` (ink-500 = 5.6:1 vẫn đạt, nhưng một màu cho một vai trò).

### 3. `ErrorState` (10')

~8 chỗ copy-paste đúng khối này:

```tsx
<p role="alert" className="rounded-control bg-danger-surface px-3 py-2 text-sm text-danger">
  {error instanceof ApiError ? error.message : 'Không tải được …'}
</p>
```

Rút thành:

```tsx
<ErrorState error={companies.error} fallback="Không tải được danh sách công ty" />
```

- **giữ nguyên `role="alert"`** — trình đọc màn hình đọc nó, và spec có thể đang bắt
- **giữ nguyên chuỗi fallback từng ký tự** ở mỗi chỗ gọi
- logic `error instanceof ApiError ? error.message : fallback` vào trong component — nó lặp lại 8 lần, và mỗi lần lặp là một cơ hội viết sai
- thêm icon `TriangleAlert` Lucide `aria-hidden` + `shrink-0`
- **không** tự thêm nút "Thử lại": các call site dùng React Query với `refetch` khác nhau, gắn nút chung là bịa hành vi. Nhận `action` tuỳ chọn, chưa dùng ngay

### 4. Chạy (10')

```
pnpm lint && pnpm typecheck && pnpm test
```

Nếu spec đỏ vì `getByText` không tìm ra: **so từng ký tự chuỗi**, gần như chắc chắn lỗi copy sót dấu.

## Tiêu chí xong

- [ ] `grep -rn "border-dashed" apps/web/src/app` **rỗng** — chỉ còn trong `empty-state.tsx`
- [ ] `grep -rn 'role="alert"' apps/web/src/app` chỉ còn ở chỗ **không phải** lỗi tải (form lỗi tại chỗ giữ nguyên)
- [ ] Không còn chỗ nào tự viết `rounded-card border border-ink-200 bg-surface p-4|p-5 shadow-card` trong `app/`
- [ ] `pnpm test` xanh, **không đổi một chuỗi hiển thị nào**
- [ ] Mọi trạng thái rỗng có câu giải thích; không hộp rỗng nào không chữ

## Rủi ro & đường lùi

| Rủi ro | Đối sách |
| --- | --- |
| Bọc `SectionCard` chèn tầng DOM giữa dnd-kit và node kéo | **Không bọc gì trong `stage-board.tsx` và `opportunity-card.tsx`.** Vòng 1 đã cắt việc này vì đúng lý do đó — chỉ thay `EmptyState compact` ở cột rỗng, không đụng thẻ kéo được |
| `<section>` mới đẻ ra `role="region"` mà spec chưa biết | Chỉ gắn `aria-labelledby` khi có `title`, và mọi `title` là chuỗi **đang tồn tại** |
| Sót một chỗ, còn drift | Grep ở tiêu chí xong là cửa, không phải trí nhớ |

Đường lùi: ba file mới + thay thế cơ học. `git revert` một commit.

# P4 · Nhịp chữ + một thang container — 1h — ⚠️ cắt được một nửa

> **Đây là phase trả lời trực tiếp câu "UI chưa đủ xuất sắc".**
> 194 trên 210 lần dùng cỡ chữ trong app là `text-sm` hoặc `text-xs`. Không có cấp bậc cỡ chữ thì mắt không có chỗ bám, và mọi màn đọc lên như nhau: xám, đều, phẳng. Guidelines §3 khai thang `12·14·16·18·24·32` nhưng code chỉ dùng 12 và 14.
> Cắt được: **nửa đầu (nhịp chữ, 30') không cắt** — nó là phần đổi diện mạo nhiều nhất cả plan. **Nửa sau (bố cục 2 cột + ô chỉ số, 30') cắt được.**

## Bối cảnh

- [design-guidelines §3](../../docs/design-guidelines.md) — thang cỡ, cấp bậc bằng **cỡ + độ đậm + khoảng trắng**, không bằng màu
- [CLAUDE.md luật 5](../../CLAUDE.md) — *"Next step là nhịp tim của deal. Màn hình chính phải trả lời được sáng nay tôi phải làm gì"*
- Phát hiện D4–D6 ở [plan.md](./plan.md#nhóm-d--bảng-bố-cục-nhịp-chữ)

## Đo hiện trạng

```
text-sm   136        ← 65%
text-xs    58        ← 28%
text-lg     5
text-base   5
text-2xl    3
text-3xl    2
text-xl     1
```

Và bề rộng container:

| Màn | `max-w` |
| --- | --- |
| `huong-dan` | `3xl` (768px) |
| `cong-ty/[id]` · `dang-theo-doi` · `hang-doi` · `thong-bao` · `nhat-ky-vong-quet` | `4xl` (896px) |
| `cong-ty` · `tong-quan` | `5xl` (1024px) |
| `quan-tri` | `6xl` (1152px) |
| `co-hoi` | `[100rem]` (1600px) |

**Năm giá trị cho một khái niệm.** Trên màn 1440px của giám khảo, `/hang-doi` — màn hàng đợi duyệt, tâm điểm demo — chỉ dùng **62%** chiều ngang, phần còn lại là nền xám.

## Nửa A · Nhịp chữ — 30' — ❌ không cắt

### A1. Khai thang thành token (5')

Vào `globals.css` khối `@theme`:

```css
/* Guidelines §3 khai thang 12·14·16·18·24·32 nhưng code chỉ dùng 12 và 14, nên mọi màn
   đọc lên như nhau. Đặt tên theo VAI TRÒ chứ không theo cỡ: chỗ gọi viết `text-section`
   thì không cãi nhau được là 16 hay 18. */
--text-caption: 0.75rem;   /* 12 — chú thích, nhãn chip */
--text-body: 0.875rem;     /* 14 — thân, ô bảng */
--text-body-lg: 1rem;      /* 16 — đoạn văn đọc dài, mục dòng thời gian */
--text-section: 1.125rem;  /* 18 — TIÊU ĐỀ SECTION, tầng đang thiếu hoàn toàn */
--text-page: 1.5rem;       /* 24 — h1 */
```

**Tầng 18px là tầng đang thiếu.** Hiện tiêu đề section dùng `text-sm uppercase tracking-wide text-ink-500` — chữ **nhỏ hơn** nội dung nó đứng đầu, và phân biệt bằng **màu**, đúng thứ §3 cấm.

### A2. Áp ba cấp lên mọi màn (20')

Luật, áp cơ học:

| Vai trò | Trước | Sau |
| --- | --- | --- |
| `h1` màn | `text-2xl font-semibold` | giữ — đang đúng |
| **`h2` section** | `text-sm uppercase tracking-wide text-ink-500` | **`text-section font-semibold text-ink-900`**, bỏ `uppercase`, bỏ `tracking-wide` |
| `h3` trong thẻ | lẫn lộn | `text-body font-semibold text-ink-900` |
| Thân | `text-sm` | giữ `text-body` |
| Đoạn văn đọc dài (mục dòng thời gian, câu trích, `/huong-dan`) | `text-sm` | **`text-body-lg`** |
| Chú thích, chip, đếm | `text-xs` | giữ `text-caption` |

Bỏ `uppercase` là chủ ý, không phải sở thích: tiếng Việt viết hoa toàn bộ **mất dấu phụ về mặt nhận dạng** (`ĐANG THEO DÕI` khó quét hơn `Đang theo dõi`), và guidelines §3 chọn Be Vietnam Pro chính vì dấu.

Chỗ áp: `tong-quan` (4 `h2`), `cong-ty/[id]` (3 section), `hang-doi`, `dang-theo-doi`, `quan-tri` (3 panel), `huong-dan`.

**Không đổi chuỗi.** Chỉ đổi class.

### A3. Câu trích và vùng đọc (5')

`provenance/quote-block.tsx` và `reading-zone.tsx` là chỗ giám khảo **đọc thật** trong demo (luật 1: bấm ra được nguồn). Nâng `text-body-lg`, thân dòng `leading-relaxed`. Guidelines §5 mục "line-length": giới hạn `max-w-[65ch]` cho đoạn văn — hiện chưa có chỗ nào giới hạn.

## Nửa B · Một thang container — 30' — ✅ cắt được

### B1. Ba tầng, khai một lần (10')

Ba tầng đúng vì có **ba loại màn thật**, không phải vì ba là số đẹp:

| Tầng | Bề rộng | Cho màn | Vì sao |
| --- | --- | --- | --- |
| `reading` | `max-w-3xl` (768px) | `/huong-dan`, `/dang-nhap` | đoạn văn dài — quá 75 ký tự/dòng là mỏi mắt |
| `standard` | `max-w-7xl` (1280px) | 8 màn còn lại | màn CRM dày dữ liệu; 896px là đang phí |
| `wide` | `max-w-[100rem]` | `/co-hoi` | bảng 7 cột kéo thả, cần hết chiều ngang |

`components/shell/page-body.tsx`:

```tsx
<PageBody width="standard">…</PageBody>
// → mx-auto flex w-full flex-col gap-6 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 + max-w theo tầng
```

**Gutter co theo khổ** — `p-6` cứng hiện tại là 24px trên máy 375px, chiếm 13% chiều ngang. `px-4` ở mobile, `px-6` từ `sm`, `px-8` từ `lg`.

Thay 10 chỗ `<main className="mx-auto flex max-w-… p-6">` → `<PageBody>`. **`<main>` giữ nguyên là `<main>`** — `id="noi-dung-chinh"` của skip link và cấu trúc landmark phụ thuộc vào nó.

### B2. Màn chi tiết công ty — hai cột (15')

`/cong-ty/[id]` hiện là **một cột `max-w-4xl`**: hồ sơ → liên hệ → vùng đọc → dòng thời gian xếp dọc mãi, trong khi 40% màn 1440px bỏ trống. Đây là màn demo lâu nhất (provenance + hàng đợi + vùng 4).

Ở `lg` trở lên:

```
┌─────────────────────────┬──────────────────┐
│ Dòng thời gian (chính)  │ Hồ sơ công ty    │
│                         │ Liên hệ          │
│                         │ Vùng đọc         │
└─────────────────────────┴──────────────────┘
      lg:grid-cols-[minmax(0,1fr)_22rem]
```

Dưới `lg`: **xếp dọc đúng thứ tự DOM hiện tại**, không đổi gì.

Hai ràng buộc:
- **Thứ tự DOM không đổi.** Dùng `grid` + `lg:col-start-*`, không dùng `order-*` — đổi thứ tự đọc của trình đọc màn hình khác thứ tự nhìn là vi phạm checklist mục 7
- Cột phải `lg:sticky lg:top-[calc(3.5rem+1rem)]` — 3.5rem là header dính. Chỉ dính khi cột đủ ngắn hơn viewport, không thì bỏ

### B3. Tổng quan — ô chỉ số (15')

`/tong-quan` hiện là **4 bảng xếp dọc**. Đó là một *bản báo cáo*, không phải một *bảng điều khiển*. Luật 5 nói việc quá hạn là nhịp tim, nhưng nó đang xuất hiện dưới dạng một cái bảng không có con số nào nổi lên.

Thêm **một hàng 3 ô chỉ số** trên cùng, **trước** khối quá hạn:

| Ô | Số | Nguồn | Màu |
| --- | --- | --- | --- |
| Việc quá hạn | `overdueNextSteps.length` | có sẵn | `warning` khi >0, `ink` khi =0 |
| Pipeline đang chạy | `runningTotal` | đang tính sẵn ở `PipelineBlock` | `ink` |
| Tạm dừng (không cộng vào trên) | `onHold.count` + giá trị | có sẵn | `ink` |

Luật cho ô chỉ số:
- số dùng `text-3xl font-semibold tabular` — **đây là chỗ duy nhất trong app được dùng 32px**, và nó xứng đáng: đó là con số người ta mang đi họp
- nhãn `text-caption text-ink-600` **trên** số, không phải dưới
- **không màu cam, không màu tím.** Không có AI trên màn này (comment ở đầu file đã ghi), và cam là chỗ người bấm — ô chỉ số không bấm được
- ô "Tạm dừng" giữ nguyên câu giải thích hiện có ở `PipelineBlock`, **không xoá** — nó là chỗ ngăn người ta cộng nhầm
- **Không thêm biểu đồ.** Không có thư viện chart trong deps, và thêm một cái trước freeze là rủi ro không đổi lấy điểm nào

**Không tính lại số nào.** Mọi con số lấy từ `OverviewDto` đang có. Một phép tính mới ở tầng trình bày là một chỗ để nó lệch với API.

## Tiêu chí xong

Nửa A (không cắt):
- [ ] `--text-*` có trong `globals.css` kèm lý do
- [ ] Không còn `uppercase tracking-wide` trên tiêu đề section
- [ ] Mỗi màn có **≥3 cấp cỡ chữ** phân biệt được bằng mắt
- [ ] Đoạn văn dài có `max-w-[65ch]`

Nửa B (cắt được):
- [ ] Một `PageBody`, ba tầng, không còn `max-w-` rải rác trong `app/`
- [ ] Gutter co theo khổ; 375px không tràn ngang
- [ ] `/cong-ty/[id]` hai cột từ `lg`, thứ tự DOM không đổi
- [ ] `/tong-quan` có hàng chỉ số, mọi số lấy từ `OverviewDto`

Cả hai:
- [ ] `pnpm test` xanh; không đổi chuỗi hiển thị nào
- [ ] Thử 375px và 1440px

## Rủi ro & đường lùi

| Rủi ro | Đối sách |
| --- | --- |
| `max-w-7xl` làm bảng 6 cột ở `/cong-ty` thưa quá | Bảng `w-full` sẽ giãn cột. P5 thêm bề rộng cột; chưa chạy P5 thì chấp nhận — thưa vẫn hơn chật |
| Hai cột làm đỏ spec đọc `getByRole('region')` ở màn chi tiết | Chỉ đổi **class của vỏ ngoài**, không đổi cấu trúc section bên trong |
| `co-hoi` bị ép về `standard` làm vỡ 7 cột | Khai `wide` cho đúng màn đó — lý do thang có 3 tầng |
| Ô chỉ số lệch số với bảng dưới | Lấy đúng field của `OverviewDto`, **không tính lại**. `runningTotal` đã tính sẵn — nâng lên phạm vi cha, đừng viết công thức thứ hai |

Đường lùi: nửa A và nửa B là **hai commit riêng**. Nửa B đỏ thì revert nửa B, giữ nhịp chữ.

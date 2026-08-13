# Nâng cấp UI toàn diện — shadcn + app shell + tour

> Phiên brainstorm 14/08/2026 01:00. Skill kèm: `ck:ui-ux-pro-max`.
> Nhánh lúc bàn: `feat/phase-6`. Plan đang chạy: [260813-0107](../260813-0107-feature-groups-1-6-and-acceptance-suite/plan.md) (P7, P8 còn `pending`).
> Modes: không dùng `--html`, không dùng `--wiki`.

## 1. Vấn đề thật, không phải vấn đề được nêu

Yêu cầu vào cửa dưới dạng giải pháp ("dùng shadcn, oval, tour"). Đảo lại thành vấn đề thì ra ba thứ khác nhau, độ nghiêm trọng rất lệch:

| # | Vấn đề | Bằng chứng | Mức |
| --- | --- | --- | --- |
| 1 | **Không có đường đi giữa các màn** | `layout.tsx` chỉ có font + `QueryProvider`. 7 route, mỗi trang tự dựng `<main className="mx-auto max-w-5xl p-6">` + link `← Công ty` tự phát. Không nav, không active state, không breadcrumb | **Lỗ sản phẩm thật.** Sales chấm vòng 3; BGK phải gõ URL để đi giữa 8 màn |
| 2 | Diện mạo chưa "hiện đại" | 6 primitive viết tay, thang bo góc 2 giá trị, không có Card/Skeleton/Toast | Thẩm mỹ. Có giá trị, không phải chỗ rubric chấm |
| 3 | Người mới không biết bắt đầu từ đâu | Không onboarding, 4 vùng tự chủ AI không tự giải thích | Nối với luật 7 ("giải thích được") — vòng 2 hỏi random 3–5 câu |

Vấn đề 1 là thứ đáng làm nhất và **rẻ nhất**. Vấn đề 3 đáng làm vì lý do rubric, không vì lý do UX thông thường.

## 2. Yêu cầu chốt được

- **Đầu ra kỳ vọng:** app shell (header + sidebar + footer + drawer mobile) trong route group `(app)`; 6 primitive `components/ui/` chuyển sang shadcn giữ nguyên bề mặt API; tầng token mở rộng (bo góc + alias shadcn); các màn bọc `Card`/`Skeleton`; tour driver.js 6 bước; trang `/huong-dan`; ⌘K command palette; pill trạng thái AI trên header.
- **Tiêu chí nghiệm thu:** `pnpm test` (unit + e2e) **xanh y như trước khi sửa** · `pnpm lint` + `typecheck` + `build` xanh · qua checklist mục 7 của [design-guidelines](../../docs/design-guidelines.md) · thử ở 375px và 1440px · tour không hiện trong e2e · nút Hoàn tác 7 ngày còn nguyên.
- **Ngoài phạm vi:** nền tối (đã chốt loại ở design-guidelines "Phạm vi đã chốt") · đổi API/prop của primitive · đổi accessible name của bất kỳ control nào e2e đang chọn · thêm nhóm tính năng mới · sửa API.
- **Ràng buộc không thương lượng:** Tailwind v4 CSS-first (`@theme`) · chỉ `ink-*`/`brand-*`/`machine-*` + 4 màu trạng thái, cấm `slate-*`/`amber-*`/`indigo-*`/hex thô · vùng chạm ≥44px · cam = người bấm, tím = máy sinh · không animation >300ms · `prefers-reduced-motion` xử lý toàn cục, component không được ghi đè · tên file tiếng Anh, chỉ thư mục route giữ tiếng Việt.
- **Điểm chạm:** `apps/web/src/app/globals.css` · `app/layout.tsx` + route group mới `app/(app)/` · `components/ui/{button,badge,input,dialog,table,warning-flag}.tsx` · `components/shell/*` (mới) · `components/next-step/auto-next-step-cell.tsx` (chỉ đọc — không được thay Hoàn tác) · `e2e/global-setup.ts` (cổng chặn tour) · `e2e/login-and-create-company.spec.ts` (nút Đăng xuất).

## 3. Hiện trạng scout được

- **Chưa có** shadcn, radix, lucide, cva, clsx, tailwind-merge. `components/ui/` = 6 file, ~247 dòng. `button.tsx` ghi rõ *"deliberately kept at the SAME import path shadcn would use"* → đường vào đã chừa sẵn.
- `dialog.tsx` dựng trên **native `<dialog>`** + `showModal()`, không portal.
- Design system đã ở mức ADR: 2 nghĩa màu, số tương phản đo thật, đúng 2 bo góc, đúng 2 bóng, nền tối cố ý loại.
- **e2e chọn phần tử gần như hoàn toàn bằng accessible name** — `getByRole('button',{name:...})`, `getByLabel(...)`, `getByRole('cell',{name})`, `getByRole('region',{name})`, chỉ 1 chỗ `getByTestId`. Đây là ràng buộc thật của mọi refactor.
- Vi phạm token có sẵn: `input.tsx` dùng `text-red-600`, phải là `text-danger`.

## 4. Phương án đã cân — và vì sao loại

| | Phương án | Ước lượng | Rủi ro e2e | Kết luận |
| --- | --- | --- | --- | --- |
| A | **Shell-only** — thêm shell + lucide, giữ nguyên primitive viết tay | 2–3h | ~0 | **Loại.** Bịt đúng lỗ thật và vừa lịch nhất, nhưng không đạt yêu cầu "shadcn toàn diện" |
| B | **shadcn map-token chọn lọc** — chỉ lấy Sheet/DropdownMenu/Tooltip/Tabs/Sonner/Skeleton/Command, giữ `Button`/`Badge`/`Table`/`Input` viết tay | 5–7h | thấp–TB | **Loại (đây là phương án người brainstorm khuyến nghị).** Giữ nguyên phần component đang cõng luật 1–3, mua đúng năng lực còn thiếu |
| **C** | **Migrate toàn bộ sang shadcn** + oval + tour | 7.5h (đã kể 3 món thêm) | **cao** | ✅ **Chọn.** Quyết định của người dùng sau khi đã nghe lo ngại về `Button`/`Badge` và rủi ro e2e |

Lý do lo ngại với C, ghi lại để không mất: `Badge.tone` (`fact`/`inference`/`system`) là chỗ luật 2 được enforce, và `Button` mang `min-h-11` cho ngưỡng 44px trong khi shadcn mặc định `h-9` = 36px. Đổi hai file này là chạm trực tiếp phần rubric chấm. Đối sách chọn thay vì tránh: **khoá bề mặt API, chỉ đổi ruột** (mục 5, S2).

Ba quyết định phụ, đã chốt:

- **"Oval" → không oval hoá toàn cục.** Nâng `--radius-card` 0.75rem → 1rem, thêm `--radius-pill` cho nav item / filter chip / nút icon / avatar. Bảng và ô nhập giữ cạnh thẳng: trên màn CRM dày dữ liệu, cạnh thẳng chính là thứ mắt dùng để căn cột.
- **Tour → `driver.js`, không react-joyride.** ~5KB, DOM-first, **không có peer dep React** nên React 19 không có cửa nào vỡ; react-joyride v3 có báo cáo bản next chạy không ổn định và nặng ~34KB gzip.
- **Cài bằng `shadcn add`, không `shadcn init`.** `init` tự ghi theme riêng (`--background`, `--primary`, palette oklch) + block `.dark` + `tw-animate-css` vào `globals.css` — đụng trực diện `@theme` hiện có và danh sách cấm. Tự viết `components.json`, cài deps tay, rồi `add` từng component (`add` không chạm theme).

## 5. Giải pháp chốt

### S0 · Tầng token (30') — làm trước mọi thứ

```
--radius-control: 0.5rem   (giữ)
--radius-card:    1rem     (từ 0.75rem)
--radius-pill:    9999px   (mới)
```

Thêm lớp alias `@theme inline` trỏ hết về token có sẵn: `background→ink-50` · `foreground→ink-900` · `card→#fff` · `primary→brand-400` · `primary-foreground→ink-900` · `destructive→danger` · `muted→ink-100` · `muted-foreground→ink-600` · `border→ink-200` · `input→ink-300` · `ring→ink-900` · `accent→ink-100`.

**Luật kèm theo, phải ghi vào design-guidelines:** tên semantic của shadcn là **lớp dịch cho component vendored, không phải từ vựng của app**. Code màn hình vẫn viết `ink-*`/`brand-*`/`machine-*`. Thiếu luật này thì repo có hai bộ từ vựng màu và điều cấm `slate-*` mất hiệu lực vì ai cũng viết `bg-background` được.

**Không có block `.dark`.** Nếu CLI sinh ra thì xoá ngay, không để "cho sau này".

Deps: `radix-ui`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `sonner`, `driver.js`. **Bỏ `tw-animate-css`** — animation của nó dài hơn trần 300ms; tự viết 2 keyframe. Thêm `lib/utils.ts` với `cn()`.

### S1 · App shell (1h + 20' pill AI)

Route group **không đổi URL** nên e2e không hay biết:

```
app/(app)/     ← layout.tsx render AppShell: cong-ty, co-hoi, hang-doi, tong-quan, thong-bao, quan-tri, huong-dan
app/dang-nhap/ ← ngoài group, không shell
```

| Vùng | Nội dung |
| --- | --- |
| Header `h-14` sticky | dải cam thương hiệu · breadcrumb (thay hết link `← Công ty` tự phát) · trigger ⌘K · **pill trạng thái AI** bật/tắt · chuông thông báo có số · user menu |
| Sidebar | 7 mục icon Lucide **kèm nhãn chữ**, active bằng `usePathname` + `aria-current="page"`, badge số gợi ý chờ trên *Hàng đợi* (dùng lại `usePendingProposalCounts`), thu về icon rail ≥1024, `rounded-pill` |
| Mobile <1024 | hamburger → `Sheet`. **Không bottom nav** — 7 mục vượt trần 5, và trộn bottom nav với sidebar vi phạm `avoid-mixed-patterns` |
| Footer | một dòng: phiên bản · trạng thái AI · link `/huong-dan` |

### S2 · Migrate primitive (1.5h) — đổi ruột, khoá vỏ

**Nguyên tắc chi phối cả bước: prop và accessible name đóng băng; chỉ nội thất và class đổi.** Đổi tên prop là quyết định riêng, không nằm trong phạm vi này.

| Primitive | Làm gì | Bất biến phải giữ |
| --- | --- | --- |
| `Button` | cva, **giữ tên variant `primary/secondary/ghost/danger`**, không lấy `default/destructive/outline` | `min-h-11` (shadcn mặc định `h-9`=36px, **trượt 44px**) · không có chữ cam trên trắng · `danger` tách nhóm |
| `Badge` | cva, **giữ API `tone`**, không lấy `variant` của shadcn | `tone` cõng luật 2 — đổi sang `variant` là mất phân biệt fact/suy luận |
| `Input`/`Select` | nền shadcn nhưng **giữ prop `label` bắt buộc** (chính nó làm `getByLabel` chạy); thêm `aria-invalid` + `aria-describedby`; sửa `text-red-600` → `text-danger` | label nhìn thấy được · lỗi nằm dưới ô |
| `Dialog` | native `<dialog>` → Radix Dialog; `title` render qua `DialogTitle` để giữ accessible name | `role="dialog"` · Escape đóng · focus trap. **Radix portal ra body** → chạy 5 spec **ngay sau riêng bước này**, không gộp |
| `Table` | **chỉ restyle**, không đổi API `headers[]` + `Cell` | `getByRole('cell',{name})` · `tabular` · header dính |
| `warning-flag` | chỉ restyle | ký hiệu + chữ, không chỉ màu |

### S3 · Màn hình (1.5h)

`PageHeader` (tiêu đề + mô tả + slot hành động) · `Card` cho khối tổng quan / thẻ cơ hội / thẻ gợi ý (thẻ gợi ý mang `ring-machine-200`) · `Skeleton` thay chuỗi "Đang tải…" · `Sonner` cho Hoàn tác.

> **Sonner là thêm, không thay.** `auto-next-step-cell.tsx` có nút Hoàn tác tồn **7 ngày**; toast sống 5 giây. Thay bằng toast là phá luật 3 ("sửa lại phải dễ hơn cả lúc máy làm") và làm hỏng T-7.

### S4 · Tour driver.js (45') + `/huong-dan` (30') + ⌘K (45')

Tour 6 bước: sidebar → hàng đợi (hai nút + bằng chứng) → ô Việc tiếp theo viền tím + Hoàn tác → vùng đọc/câu trích → banner AI tắt → `/quan-tri`.

Ba luật bắt buộc, thiếu một cái là e2e đỏ hàng loạt:

1. **Neo bước bằng `data-tour="..."`**, không bằng class — restyle không được làm tour trỏ trượt.
2. **Cổng chặn `localStorage['crm.tour.seen']`**; `e2e/global-setup.ts` ghi sẵn `'1'` vào storage state nó vốn đã tạo.
3. `dynamic import` trong client component + nút "Xem hướng dẫn" ở header (diễn lại được cho BGK) + `?tour=1`.

`/huong-dan`: giải thích 4 vùng tự chủ, mỗi vùng một ví dụ bấm được dẫn sang màn thật. Đánh vào luật 7 — thứ vòng 2 sẽ hỏi.

### S5 · Cửa chốt (30')

Checklist mục 7 design-guidelines · 375px + 1440px · `pnpm lint` + `typecheck` + `build` + `pnpm test` đủ.

## 6. Rủi ro

| Rủi ro | Xác suất | Đối sách |
| --- | --- | --- |
| **Nút Đăng xuất vào `DropdownMenu` → `getByRole('button',{name:'Đăng xuất'})` đỏ** | **chắc chắn xảy ra** | Sửa 1 dòng spec (mở menu trước), **hoặc** giữ Đăng xuất hiện sẵn ở header desktop. `e2e/` thuộc chủ quyền C — phải nói với C trước |
| Radix Dialog portal ra body làm vỡ assertion chứa trong section | TB | Chạy 5 spec **riêng** ngay sau bước Dialog, không gộp với S3 |
| Tour overlay chặn click Playwright | cao nếu quên | Cổng `localStorage` + ghi vào `global-setup.ts`. Không có cách khác |
| `shadcn init` ghi đè `@theme` + thêm `.dark` | cao nếu dùng `init` | Không dùng `init`. Tự viết `components.json`, `add` từng component. Commit trước khi cài |
| shadcn `Button h-9` lọt lưới → trượt 44px | TB | Test đơn khẳng định class ngưỡng chạm trên `Button` |
| `Badge.tone` bị đổi sang `variant` khi rewrite | TB | Nguyên tắc "khoá vỏ" + test đơn: `tone="inference"` phải ra lớp `machine-*` |
| **Trượt giờ: 7.5h việc vào sáng 15/08, hạn 15:00** | **cao** | S0+S1+S2 là phải có; S3/S4/S5 + 3 món thêm cắt được. Nếu S2 đỏ lúc 12:00 thì `git revert` S2, giữ S0+S1 |

## 7. Đo được gì

- `pnpm test` xanh y như baseline trước khi sửa (số spec pass không đổi).
- 0 class màu thô trong `apps/web/src` (`grep -r "slate-\|amber-\|indigo-\|bg-\[#"` rỗng) — hiện đang có 1 vi phạm `text-red-600`.
- Mọi route tới được bằng ≤1 cú bấm từ sidebar (hiện: phải gõ URL).
- Vùng chạm mọi nút ≥44px; tương phản chữ thân ≥4.5:1.
- Tour: 0 lần xuất hiện trong log e2e.

## 8. Việc tiếp theo

1. **Xong P7 + P8 trước** — đây là tiền đề bạn đã chốt. UI không được lấy giờ của T-9/T-10 và nhóm 6.
2. Viết **1 ADR**: đảo hướng "hand-written rather than pulled from shadcn" ghi trong `button.tsx` · đổi `--radius-card` · tái khẳng định light-only · **kèm phương án bị loại** (A shell-only, B map-token chọn lọc).
3. Nói với C về dòng `Đăng xuất` trong `e2e/login-and-create-company.spec.ts` trước khi S1 chạm header.
4. Cập nhật `docs/design-guidelines.md`: thang bo góc 3 giá trị · luật "alias shadcn không phải từ vựng app" · chốt Lucide (đang là câu hỏi mở ở cuối file đó).
5. Tạo plan thực thi từ báo cáo này.

## Câu hỏi chưa giải quyết

- **Ai làm?** Plan hiện chia chủ quyền A/B/C. UI chạm `globals.css` + `layout.tsx` + `components/ui/` — `components/ui/` không có tên chủ trong bảng chủ quyền, và `apps/web/src/app/{cong-ty,co-hoi,tong-quan,hang-doi}/` là của B. S3 sẽ đụng file của B.
- **Nút Đăng xuất:** sửa spec hay giữ hiện sẵn ở header? Cần C quyết vì `e2e/` là của C.
- Vàng thuần `#FFFF00` trong logo vẫn chưa có vai trò (câu hỏi mở có từ trước ở design-guidelines) — shell mới có dải thương hiệu, đây là lúc phải chốt dùng hay không.
- Có nên coi UI overhaul là "hardening" để hợp lệ với luật *"15/08 chỉ hardening + test + demo"*, hay cần BTC/đội xác nhận? Nó không phải nhóm tính năng mới, nhưng cũng không phải sửa lỗi.

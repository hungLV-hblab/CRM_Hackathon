---
status_note: "done 14/08 — 7/7 phase, 281 unit + 39 e2e xanh, ADR-0034"
title: "Nâng cấp UI lần 2 — form, bảng, bố cục, nhịp chữ"
description: "Bịt drift đã ship (bo góc thứ 4, bóng thứ 3, alias rò ra app/), dựng ba component trạng thái dùng chung, đưa ô nhập lên 44px, làm bảng dính thật + sắp xếp được, thống nhất một thang container và khôi phục nhịp chữ"
status: done
priority: P2
effort: medium
branch: "feat/ui-pass-2"
tags: [ui, design-system, forms, table, layout, typography]
blockedBy: []
blocks: []
created: "2026-08-14T12:49:00+07:00"
createdBy: "ui-ux-pro-max"
mode: standard
scope: apps/web
---

# Nâng cấp UI lần 2 — form, bảng, bố cục, nhịp chữ

> **Đọc [docs/design-guidelines.md](../../docs/design-guidelines.md) trước.** Plan này không đổi một luật nào trong đó — nó đi **ép** những luật đã viết mà code chưa theo, cộng ba chỗ doc còn thiếu (nhịp chữ, thang container, mật độ ô nhập).
> Vòng 1 là [`260814-0056`](../260814-0056-nang-cap-ui-shadcn-shell-tour/plan.md): shadcn + app shell + tour. Vòng đó dựng **giàn**. Vòng này làm **nội thất**.
> **Không thêm tính năng. Không API mới. Không bảng mới. Chỉ tầng trình bày.**

## Bối cảnh — cái giá phải nói thẳng

Code đã đóng: PR #11 merged, **10/10 điểm nghiệm thu**, 281 unit + 32 e2e xanh. Ba việc còn lại của dự án ([báo cáo PM 14/08 12:45](../reports/pm-status-260814-1245-viec-con-lai-truoc-freeze-va-nop-bai-report.md)) đều **ngoài code**: tài liệu trình bày & demo (chưa bắt đầu, **hạng mục nộp bắt buộc**), telemetry hai thành viên (**cửa loại vòng 1**), tập demo.

Plan này **5h25'** và ăn vào cùng buổi chiều/tối 14/08 với tài liệu trình bày. Nói thẳng cái giá: nếu chỉ một trong hai kịp, **thứ phải kịp là tài liệu trình bày** — thiếu nó là thiếu hạng mục nộp, còn UI đẹp thêm một bậc chỉ là điểm cộng ở mục trình bày.

Vì vậy plan này viết theo **đồng hồ, không theo cảm giác** — xem [Mốc cắt cứng](#mốc-cắt-cứng). Mỗi phase để lại sản phẩm chạy được; không phase nào để dở nửa màn.

## Nguyên tắc chi phối — giống vòng 1, không đổi

**Đổi ruột, khoá vỏ.** 32 e2e chọn phần tử gần như hoàn toàn bằng accessible name (`getByRole('button',{name})`, `getByLabel`, `getByRole('cell',{name})`, `getByRole('region',{name})`). **Bề mặt API và accessible name chính là hợp đồng test.** Đổi class, đổi nội thất — tự do. Đổi tên prop, đổi chuỗi nhãn, đổi vai trò ARIA — **cấm**, trừ khi phase đó ghi rõ và có lý do.

Bốn hệ quả:

- **Không đổi một chuỗi tiếng Việt nào** đang là accessible name. Thêm chữ vào nhãn = làm đỏ spec.
- **Không đổi cấu trúc DOM của bảng.** `<tr>`/`<td>` giữ nguyên vai trò — `getByRole('cell')` đọc chính nó.
- **Không chạm `apps/api/`, `packages/`, schema, `e2e/` cũ.** Chỉ `apps/web/src`, `docs/`, và **thêm** vào `e2e/ui-invariants.spec.ts`.
- **Không nền tối.** Phạm vi đã chốt ở design-guidelines, không mở lại.

## Chẩn đoán — 13 phát hiện có bằng chứng

Đây là lý do plan tồn tại. Không có mục nào là ý kiến; mỗi mục có file:dòng.

### Nhóm A — thang đã chốt bị vi phạm, đang chạy production

| # | Phát hiện | Bằng chứng | Luật bị vi phạm |
| --- | --- | --- | --- |
| A1 | `shadow-lg` — **tầng bóng thứ 3** | `app/(app)/hang-doi/proposal-card.tsx:139` | guidelines §4: đúng hai mức |
| A2 | `rounded-md` — **bo góc thứ 4** | `components/ui/skeleton.tsx:9` | guidelines §4: đúng ba giá trị |
| A3 | Từ vựng alias **rò ra ngoài `components/ui/`** — `bg-card` dùng **17 lần** trong `app/` | `app/(app)/**` 17 chỗ | guidelines §6: alias chỉ sống trong `components/ui/` |
| A4 | `card.tsx` vendored, **dùng 0 lần**; `border` trần trong Tailwind v4 = `currentColor` → viền gần đen nếu ai đó dùng | 0 import | mã chết + bẫy |
| A5 | **Màu thô Tailwind đang chạy production**: `bg-red-50` + `text-red-700` | `app/(app)/dang-theo-doi/page.tsx` | guidelines §2: cấm màu thô — đã có `danger-surface` / `danger` |

**A5 là phát hiện quan trọng nhất của cả chẩn đoán, vì nó tố cáo cái cửa chứ không chỉ cái lỗi.** Grep của checklist mục 7 là `slate-|amber-|indigo-|bg-\[#`, và nó hỏng **hai chiều cùng lúc**:

- **Sót** — không phủ `red-*`, `gray-*`, `green-*`, `blue-*`… nên `bg-red-50` ship thẳng qua cửa.
- **Báo nhầm** — `slate-` khớp bên trong `-translate-y-1/2` (3 chỗ). Người chạy grep thấy hai kết quả rác, kết luận "lại translate", rồi bỏ qua cả danh sách — kể cả khi có vi phạm thật nằm trong đó.

Một cửa vừa sót vừa báo nhầm **tệ hơn không có cửa**: nó tạo cảm giác đã kiểm. Đối sách ở [P1](./phase-01-dong-lai-thang-token.md): regex **neo theo tiền tố utility**, và chuyển vào `ui-invariants` để test giữ chứ không để trí nhớ giữ.

A3 cùng gốc bệnh: `bg-card` lọt qua đúng cái grep đó. Doc đã dự đoán chính xác: *"bg-background lọt qua mọi lần grep trong khi không nói cho người đọc biết đó là màu gì"*.

### Nhóm B — thiếu tầng trừu tượng, drift thành 10 bản sao

| # | Phát hiện | Bằng chứng |
| --- | --- | --- |
| B1 | **10 trạng thái rỗng viết tay**, 4 padding (`p-3/p-4/p-5/p-6`), 3 bo góc, 3 màu chữ, 2 cỡ | `border-dashed` ở 10 file |
| B2 | **~8 khối lỗi `role="alert"` copy-paste**, cùng class, khác nhau vài chỗ | grep `role="alert"` |
| B3 | **17 chỗ tự vẽ lại "thẻ section"** `rounded-card border border-ink-200 bg-card p-4\|p-5 shadow-card` | drift `p-4` vs `p-5` |
| B4 | **8/10 skeleton là khối xám `h-40 w-full`** không giống layout sắp tới → nhảy trang khi dữ liệu về | grep `<Skeleton` |

Không phải chuyện đẹp/xấu: ba component thiếu (`SectionCard`, `EmptyState`, `ErrorState`) làm mỗi màn tự phát minh lại, và **không có chỗ nào để sửa một lần**.

### Nhóm C — tầng nhỏ nhất là tầng yếu nhất

| # | Phát hiện | Bằng chứng |
| --- | --- | --- |
| C1 | Ô nhập **~38px**, dưới luật 44px mà chính `Button` ép và `ui-invariants` đo | `ui/input.tsx` `px-3 py-2 text-sm` |
| C2 | `Select` là `<select>` trần — mũi chevron của HĐH, cao khác `Input`, không nhuộm token được | `ui/input.tsx` |
| C3 | **Checkbox là control trần của trình duyệt**, không có component nào | `co-hoi/page.tsx:94` `accent-brand-500` |
| C4 | Ô nhập **không có** dòng gợi ý, dấu bắt buộc, icon dẫn, hay biến thể cỡ | `ui/input.tsx` |
| C5 | Hàng lọc = 5 control xếp lưới trần: không nhóm, **không chip lọc đang bật**, không nút xoá lọc cho tới khi rỗng | `cong-ty/page.tsx:87–153` |

### Nhóm D — bảng, bố cục, nhịp chữ

| # | Phát hiện | Bằng chứng |
| --- | --- | --- |
| D1 | **Header dính không dính thật.** `sticky top-0` trên `<thead>` trong `overflow-x-auto` không có ràng buộc chiều cao → hộp không bao giờ cuộn dọc; mà có dính cũng chui **dưới** header 56px | `ui/table.tsx` |
| D2 | Bảng **không sắp xếp được**, header cột số **không căn phải** dù ô căn phải, không có bề rộng cột → chữ dài xuống dòng lởm chởm | `ui/table.tsx` |
| D3 | **Không màn nào phân trang/ảo hoá** dù guidelines §6 ghi >50 dòng phải làm | 0 chỗ |
| D4 | **5 giá trị `max-w` trên 10 màn** (3xl/4xl/5xl/6xl/100rem) | 10 file `<main>` |
| D5 | `p-6` **cứng ở mọi khổ** — 24px gutter trên máy 375px | 10 file `<main>` |
| D6 | **Thang chữ sập còn 2 cỡ: 194/210** lần dùng là `text-sm`/`text-xs`. `text-base` 5, `text-lg` 5, `text-xl` 1, `text-2xl` 3 | grep toàn repo |
| D7 | **Bộ icon lệch** — Lucide ở `shell/`+`ui/`, `warning-flag.tsx` tự vẽ SVG; toàn bộ `app/` import **0 icon** | grep |

**D6 là lý do lớn nhất khiến màn hình "chưa xuất sắc".** Guidelines §3 khai thang `12·14·16·18·24·32`, nhưng thực tế app chỉ dùng 12 và 14 cộng một `h1` 24. Không có cấp bậc cỡ chữ thì mắt không có chỗ bám, và mọi màn đọc lên như nhau — xám, đều, phẳng. Màu không cứu được: guidelines §3 cấm dùng màu làm cấp bậc.

## Phases

| # | Phase | Ước lượng | Phụ thuộc | Cắt được? | Đổi diện mạo |
| --- | --- | --- | --- | --- | --- |
| 1 | [Đóng lại thang token](./phase-01-dong-lai-thang-token.md) | **done** · 40' | — | ❌ **phải có** | thấp (nhưng là checklist) |
| 2 | [Tầng form — 44px, Field, Checkbox, FilterBar](./phase-02-tang-form-44px-field-filterbar.md) | **done** · 1h10' | 1 | ❌ **phải có** | **cao** |
| 3 | [Ba component trạng thái dùng chung](./phase-03-section-card-empty-state-error-state.md) | **done** · 45' | 1 | ❌ **phải có** | **cao** |
| 4 | [Nhịp chữ + một thang container](./phase-04-nhip-chu-va-thang-container.md) | **done** · 1h | 1, 3 | ⚠️ cắt được một nửa | **cao nhất** |
| 5 | [Bảng — dính thật, sắp xếp, mật độ](./phase-05-bang-dinh-that-sap-xep-mat-do.md) | **done** · 1h | 1 | ✅ cắt được | trung bình |
| 6 | [Đánh bóng — icon, skeleton đúng hình, phản hồi bấm](./phase-06-danh-bong-icon-skeleton-phan-hoi.md) | **done** · 30' | 2–5 | ✅ cắt được | trung bình |
| 7 | [Cửa chốt — checklist, ADR, doc](./phase-07-cua-chot-checklist-adr-doc.md) | **done** · 20' | mọi phase đã chạy | ❌ **phải có** | — |

```
P1 token ──┬── P2 form ──────┐
           ├── P3 trạng thái ─┼── P4 chữ + container ──┬── P6 đánh bóng ── P7 cửa chốt
           └── P5 bảng ───────┘                        │
                                                       └──────────────────┘
```

P2, P3, P5 **độc lập nhau**, chỉ cần P1. Ba người làm song song được: P2 sống trong `ui/input.tsx` + hàng lọc, P3 tạo file mới rồi thay thế, P5 sống trong `ui/table.tsx`. **Đụng nhau đúng một chỗ**: cả P3 và P5 đều sửa `cong-ty/page.tsx` — P3 vào trước.

## Mốc cắt cứng

Đồng hồ, không phải cảm giác. Mốc tính từ lúc bắt đầu P1.

| Đồng hồ | Nếu chưa xong cái này thì |
| --- | --- |
| **+2h35'** (P1+P2+P3 xong) | Đây là **sàn**. Chưa tới đây thì bỏ mọi thứ còn lại, nhảy thẳng P7 |
| **+3h35'** (P4 xong) | P4 cắt được **một nửa**: giữ nhịp chữ (30'), bỏ hai cột màn chi tiết + ô chỉ số tổng quan |
| **P5 chưa bắt đầu lúc 18:00** | **Cắt P5.** Bảng xấu mà đúng vẫn hơn bảng đang sửa dở |
| **P6** | Cắt trước tiên, luôn luôn. Đánh bóng là thứ đầu tiên bỏ |
| **Còn ≤20'** | Chỉ chạy P7. `pnpm test` + ADR. **ADR là điều kiện, không phải phần thưởng** |

**Không cắt:** P1, P2, P3, P7.

Thứ tự cắt, cắt từ dưới lên: P6 → P5 → nửa sau P4 → (hết chỗ cắt).

## Đã chạy — 14/08

**Bảy phase chạy hết, không phase nào bị cắt.** Người dùng chốt chạy hết và đẩy tài liệu trình bày sang 15/08.

| | Trước | Sau |
| --- | --- | --- |
| Unit | 281 | **281** — không đổi |
| e2e | 32 | **39** — đúng 7 test mới có chủ đích |
| `pnpm lint` · `typecheck` | xanh | **xanh** |
| `docker compose build web` | xanh | **xanh** (7 lần rebuild) |
| Cỡ chữ dùng thật | 2 tầng (194/210 là `text-sm`/`text-xs`) | **6 tầng theo vai trò** |
| Giá trị `max-w` | 5 | **1 thang, 3 tầng** |
| Trạng thái rỗng viết tay | 10 | **0** |
| Khối lỗi copy tay | 13 | **0** |
| Thẻ panel viết tay | 11 | **0** |
| Chiều cao ô nhập | 38px | **44px, có test đo** |
| Tràn ngang ở 375px và 1440px | chưa ai đo | **0px trên 7 màn, có test** |
| SVG tự vẽ | 1 | **0** |

### Phát hiện thêm trong lúc chạy — không có trong chẩn đoán ban đầu

| | Phát hiện | Xử lý |
| --- | --- | --- |
| A6 | `rounded-full` ở `pending-proposal-marker.tsx:33` — tên thứ hai cho `rounded-pill` | **cửa gác mới bắt được**, đã sửa. Bằng chứng cửa hoạt động: nó bắt thứ người viết nó không biết |
| A7 | `bg-white` thô ở 3 chỗ | đổi sang `bg-surface` |
| — | **Quyết định trong plan sai:** plan viết *"nút xoá lọc ở trạng thái rỗng giữ nguyên, hai chỗ hai ngữ cảnh"*. T-1 đỏ ngay — hai nút trùng accessible name thì cả trình đọc màn hình và `getByRole` đều không biết chọn cái nào | bỏ nút ở trạng thái rỗng, giữ một nút trong `FilterBar` |
| — | **Flake có sẵn trong bộ nghiệm thu**, không do vòng này: `reading-zone-provenance` T-3 đỏ một lần. Vùng đọc mount một `SourceViewer` cho **mỗi** bản chụp nên `.first()` là bản đứng đầu chứ không phải bản vừa bấm, và số bản chụp phụ thuộc vòng quét chạy mấy nhịp | chạy lại đủ bộ trên code trước **và** sau P4 (34/34 cả hai) rồi neo cả hai locator vào đúng thẻ đang mở |
| — | **`pnpm build` đỏ và không phải do vòng này:** `next build` compile + sinh 14/14 trang xanh, chỉ copy trace `standalone` đỏ vì Windows không cho symlink (`EPERM`). Chạy đúng lệnh đó trên `origin/master` → đỏ y hệt | lỗi môi trường sẵn có. Đường build thật (`docker compose build web`, chạy Linux) xanh |

### Đã cắt có chủ đích

| Việc | Lý do |
| --- | --- |
| **Phân trang bảng** | guidelines §6 đòi >50 dòng phải phân trang, hiện 0 màn làm. Seed dưới ngưỡng. Đã ghi vào [câu hỏi mở của guidelines](../../docs/design-guidelines.md#câu-hỏi-chưa-giải-quyết) và ADR-0034 |
| **Viết lại `dropdown-menu.tsx`** | 257 dòng Radix vendored, còn `rounded-md`/`shadow-lg`/nhánh `dark:`. **Miễn trừ khai tường minh** trong test, không phải bỏ sót |
| **Chuyển `Select` sang Radix** | đổi cách e2e chọn option, 32 spec là điều kiện của 10/10 điểm. Giữ `<select>` thật, chỉ bỏ chevron của HĐH |

## Tiêu chí nghiệm thu của cả plan

- [ ] `pnpm test` xanh — **281 unit + 32 e2e**, cộng **đúng số assertion mới có chủ đích** thêm vào `ui-invariants.spec.ts`. Không spec cũ nào đỏ
- [ ] `pnpm lint` · `pnpm typecheck` · `pnpm build` xanh
- [ ] **Grep màu thô đã neo lại** rỗng — `(bg|text|border|ring|fill|stroke|from|to|via|divide|accent)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]` cộng `bg-\[#`. Bản cũ trong doc vừa sót `red-*` vừa báo nhầm trên `-translate-`
- [ ] **Grep mở rộng rỗng**: `rounded-(md|lg|xl|sm|2xl)` và `shadow-(sm|md|lg|xl)` không còn ngoài `components/ui/dropdown-menu.tsx` (vendored, khai miễn trừ ở P1)
- [ ] **Alias không rò**: `bg-card|bg-background|text-primary|text-muted-foreground|border-border` **rỗng** trong `apps/web/src/app/`
- [ ] Mọi ô nhập, ô chọn, checkbox có chiều cao đo được **≥44px** — `ui-invariants` đo, không tin bằng mắt
- [ ] Không còn khối `border-dashed` viết tay ngoài `EmptyState`
- [ ] Một thang container duy nhất; gutter co theo khổ; thử ở **375px và 1440px**, tràn ngang **0px**
- [ ] Mỗi màn có ít nhất **ba cấp cỡ chữ** phân biệt được
- [ ] Qua checklist mục 7 [design-guidelines](../../docs/design-guidelines.md)
- [ ] **ADR-0034** cho quyết định mở thang token (nhịp chữ + container + mật độ), kèm phương án bị loại
- [ ] design-guidelines cập nhật đúng ba mục mới, có ngày

## Luật áp cho mọi phase

- **Chạy `pnpm test:e2e` sau mỗi phase, không dồn.** Riêng P5 (bảng) chạy riêng một lần — 5 spec đọc `getByRole('cell')`.
- **Không đổi accessible name.** Không đổi chuỗi tiếng Việt đang hiển thị. Thêm icon thì icon `aria-hidden`, chữ giữ nguyên.
- **Mọi bất biến khoá bằng e2e Playwright, không bằng unit test.** `vitest.config.mts` có `projects: ['packages/*','apps/api']` — `apps/web` **không** nằm trong đó, repo không có `@testing-library/react`/`jsdom`. Đừng viết unit test component rồi tưởng nó chạy.
- **Token mới thì thêm vào `globals.css`**, không vá tại chỗ. Thêm token là quyết định → vào ADR-0034.
- Không animation >300ms. Chỉ animate `transform`/`opacity`. Không ghi đè `prefers-reduced-motion`.
- Vùng chạm ≥44px. Focus ring toàn cục — **cấm `outline: none`**.
- Mỗi phase kết thúc bằng một commit chạy được. Không commit trạng thái dở.

## Chủ quyền file

Code đã merge hết vào `master`, không còn chia chủ quyền A/B/C. Nhánh mới `feat/ui-pass-2` từ `origin/master`.

| Phase | File chạm |
| --- | --- |
| 1 | `app/globals.css` · `ui/skeleton.tsx` · `ui/card.tsx` (xoá) · `hang-doi/proposal-card.tsx` · `e2e/ui-invariants.spec.ts` |
| 2 | `ui/input.tsx` · `ui/checkbox.tsx` (mới) · `ui/field.tsx` (mới) · `ui/filter-bar.tsx` (mới) · `cong-ty/page.tsx` · `co-hoi/page.tsx` |
| 3 | `ui/section-card.tsx` · `ui/empty-state.tsx` · `ui/error-state.tsx` (đều mới) · 10 file gọi |
| 4 | `globals.css` · `shell/page-header.tsx` · `shell/page-body.tsx` (mới) · 10 file `<main>` · `cong-ty/[id]/page.tsx` · `tong-quan/page.tsx` |
| 5 | `ui/table.tsx` · 4 file gọi bảng |
| 6 | `ui/warning-flag.tsx` · các chỗ `<Skeleton` · empty state |
| 7 | `docs/design-guidelines.md` · `docs/decisions/0034-*.md` |

## Rủi ro

| Rủi ro | Xác suất | Đối sách |
| --- | --- | --- |
| Sửa `table.tsx` làm đỏ 5 spec đọc `getByRole('cell')` | trung bình | P5 chạy e2e riêng, một commit riêng. Đỏ mà không sửa được trong 15' → `git revert` P5, giữ phần còn lại |
| Nâng ô nhập lên 44px làm hàng lọc 5 cột tràn ở 375px | thấp | P2 đổi hàng lọc sang xếp dọc dưới `sm`, có bước đo ở 375px |
| Xoá `card.tsx` làm đỏ import ẩn | rất thấp | grep xác nhận 0 import trước khi xoá |
| Đổi container làm vỡ bảng cơ hội 7 cột (`max-w-[100rem]`) | trung bình | P4 giữ màn cơ hội ở tầng **rộng**, không ép về tầng chuẩn — thang container có 3 tầng đúng vì lý do này |
| Hết giờ, tài liệu trình bày không kịp | **cao** | [Mốc cắt cứng](#mốc-cắt-cứng). Sàn là P1+P2+P3 = 2h35' |

## Câu hỏi chưa giải quyết

- **Có nên làm plan này trước tài liệu trình bày không?** Đây là câu duy nhất cần người quyết, và plan không tự trả lời được. Khuyến nghị: **chạy sàn P1+P2+P3 (2h35') rồi dừng**, viết tài liệu, quay lại P4–P6 nếu còn giờ sáng 15/08 (15/08 chỉ hardening — nâng cấp trình bày nằm trong nghĩa đó).
- **Phân trang bảng (D3)** — guidelines §6 ghi >50 dòng phải phân trang, hiện 0 màn làm. Seed hiện dưới 50 dòng nên **chưa vỡ**. Plan này **không** làm phân trang (không đủ giờ, và không màn nào chạm ngưỡng trong demo). Nếu BGK nạp bộ dữ liệu lớn thì đây là chỗ vỡ đầu tiên — nói thẳng nếu bị hỏi.
- **`dropdown-menu.tsx` vendored còn `rounded-md`/`shadow-lg`/nhánh `dark:`.** P1 khai miễn trừ thay vì sửa: viết lại một component Radix 257 dòng trước freeze là đánh cược không cần thiết. Đúng hay nên sửa — cần người chốt.
- **Vàng thuần `#FFFF00`** trong logo vẫn chưa có vai trò (câu hỏi mở có từ design-guidelines). Plan này không mở lại.

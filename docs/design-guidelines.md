# Luật giao diện & design token

> **Đọc file này trước khi gõ dòng JSX đầu tiên.** Mọi việc chạm tới giao diện — thêm màn hình, sửa component, chọn màu, chọn khoảng cách, thêm animation — đều phải theo file này.
> Token thật nằm ở [`apps/web/src/app/globals.css`](../apps/web/src/app/globals.css). File md này giải thích **vì sao** và **dùng lúc nào**; file css là nguồn sự thật của **giá trị**.
> Cập nhật lần cuối: 2026-08-14 (vòng nâng cấp thứ hai — [ADR-0034](decisions/0034-mo-thang-token-nhip-chu-container-mat-do-va-dua-cua-gac-vao-test.md): mở thang chữ, thang container, mật độ control, và chuyển cửa gác thang vào bộ test).

## 1. Hai nghĩa giữ toàn bộ hệ thống

Cả bảng màu rút gọn về đúng hai câu. Nhớ hai câu này là đủ để tự quyết 90% tình huống:

| | Nghĩa | Dùng ở đâu |
| --- | --- | --- |
| 🟡 **Cam HBLAB** | **Người sắp làm gì đó** | Nút hành động chính, vòng focus, đánh dấu câu trích Sales vừa bấm, dải thương hiệu |
| 🟣 **Tím** | **Máy sinh ra cái này** | Phát hiện, gợi ý, mục do vòng quét thêm, mọi ô AI tự điền |

Vì sao tách như vậy: màu logo là thứ mắt bắt đầu tiên. Nếu cam vừa là thương hiệu vừa là "AI nói", thì mỗi lần Sales thấy cam họ phải dừng lại **đoán** đang nhìn cái gì — đúng thứ luật 2 của [CLAUDE.md](../CLAUDE.md) cấm. Cam dành cho chỗ người **bấm**, tím dành cho chỗ máy **viết**.

**Màu không bao giờ là kênh duy nhất.** Mọi bề mặt tím phải kèm nhãn chữ ("do AI sinh", "do hệ thống thêm"); ba mức chắc chắn phải kèm ký hiệu chấm (`●●●` / `●●○` / `●○○`). Giám khảo in màn hình ra giấy đen trắng vẫn phải phân biệt được ai viết cái gì.

## 2. Màu — con số thật, không phải cảm giác

Lấy trực tiếp từ file logo, không phải ước lượng bằng mắt: cam `#FFC20F`, đen `#424244`.

| Token | Hex | Tương phản | Được dùng làm gì |
| --- | --- | --- | --- |
| `brand-400` | `#FFC20F` | **1.62:1 trên trắng** · ink trên nó **11.36:1** | **Nền**, không bao giờ là chữ trên nền trắng. Nút chính = nền cam + chữ `ink-900` |
| `brand-600` | `#B87F00` | 3.46:1 | Icon, viền, chữ **cỡ lớn** (≥18.66px bold / 24px) |
| `brand-700` | `#8A5E00` | 5.7:1 | Cam duy nhất được làm **chữ thường** trên nền trắng |
| `brand-100/200` | `#FFF3CC` / `#FFE28A` | ink trên nó 16.59:1 | Nền đánh dấu câu trích (`<mark>`), nền nhấn nhẹ |
| `ink-900` | `#141417` | 18.39:1 | Chữ chính |
| `ink-600` | `#5B5B61` | 6.74:1 | Chữ phụ, nhãn |
| `ink-400` | `#8A8A92` | 3.43:1 | **Chỉ** placeholder và trạng thái tắt — không dùng cho chữ cần đọc |
| `machine-600` | `#6D28D9` | 7.1:1 | Chữ và icon của mọi thứ do máy sinh |
| `machine-50/100` | `#F5F3FF` / `#EDE9FE` | machine-700 trên nó 8.19:1 | Nền vùng đọc, thẻ phát hiện, hàng đợi gợi ý |
| `danger` | `#B42318` | 6.57:1 | Xoá, huỷ, cảnh báo nặng |
| `success` | `#0E7C4A` | 5.25:1 | Đã duyệt, đã lưu |
| `warning` | `#B54708` | 5.43:1 | Cờ thiếu dữ liệu, quá hạn |

**Ba điều cấm về màu:**

- ❌ Chữ cam trên nền trắng (`text-brand-400`) — 1.62:1, mù luôn với mắt thường chứ không riêng gì người kém thị lực.
- ❌ Hex thô trong component (`bg-[#FFC20F]`). Có token thì dùng token; thiếu token thì thêm vào `globals.css`, đừng vá tại chỗ.
- ❌ Dùng `slate-*`, `amber-*`, `indigo-*` mặc định của Tailwind. Chúng không mang nghĩa gì trong hệ này. Chỉ dùng `ink-*`, `brand-*`, `machine-*` và bốn màu trạng thái.

## 3. Chữ

- **Be Vietnam Pro**, nạp qua `next/font` (tự host lúc build, chạy không gọi mạng). Lý do chọn: nó vẽ riêng cho tiếng Việt — chồng dấu (`ế`, `ộ`, `ữ`) không dính vào thân chữ ở cỡ 14px như font Latin thuần.
- Cỡ nền **16px**, thân dòng **1.5**. Không có chữ nào dưới **12px**.
- Thang cỡ: `12 · 14 · 16 · 18 · 24 · 32`. Không chen cỡ lẻ.
- Cấp bậc bằng **cỡ + độ đậm + khoảng trắng**, không bằng màu. Đậm: tiêu đề 600, nhãn 500, thân 400.

**Token đặt tên theo vai trò, không theo cỡ.** Lý do: nếu chỗ gọi viết `text-lg` thì "tiêu đề section 16 hay 18" là câu hỏi mở lại ở mỗi file; viết `text-section` thì nó đã được trả lời một lần.

| Token | Cỡ | Dùng cho |
| --- | --- | --- |
| `text-caption` | 12 | chú thích, nhãn chip, nhãn ô chỉ số |
| `text-body` | 14 | thân, ô bảng — cỡ mặc định của màn CRM |
| `text-body-lg` | 16 | thứ **đọc thật**: câu trích, vùng đọc, trang hướng dẫn |
| `text-section` | 18 | **tiêu đề section** |
| `text-page` | 24 | `h1` của màn |
| `text-metric` | 32 | chỉ ô chỉ số ở Tổng quan — con số mang đi họp |

**Hai luật của tiêu đề section:**

- **18px, đậm, màu `ink-900`.** Trước 14/08 nó là `text-sm text-ink-500` — **nhỏ hơn** nội dung nó mở đầu và phân biệt bằng **màu**, đúng thứ dòng trên cấm. Kết quả đo được lúc đó: 194 trong 210 lần dùng cỡ chữ là `text-sm` hoặc `text-xs`, tức app chỉ có hai cỡ và mọi màn đọc lên như nhau.
- **Không `uppercase`.** Tiếng Việt viết hoa toàn bộ khó quét hơn: `ĐANG THEO DÕI` bắt mắt đọc từng chữ, `Đang theo dõi` đọc bằng hình dạng — dấu thôi làm đúng việc mà Be Vietnam Pro được chọn để làm.

- Đoạn văn dài giới hạn `max-w-[65ch]`. Quá ~75 ký tự một dòng thì mắt mất chỗ về khi xuống dòng.
- **Cột số phải dùng `tabular`** (utility có sẵn): tiền, số đếm, ngày. Không thì con số nhảy cột mỗi lần đổi giá trị.

## 4. Khoảng cách, bo góc, đổ bóng, thời gian

- Nhịp **4/8px**. Khoảng cách trong section: `16 · 24 · 32 · 48`.
- **`--size-control` = 44px, một con số cho hai việc.** Nó vừa là vùng chạm tối thiểu (mục 6) vừa là chiều cao ô nhập. Ô nhập và nút **phải cao bằng nhau** khi đứng cạnh nhau trên một hàng lọc: trước 14/08 ô nhập 38px cạnh nút 44px, lệch 6px trên mọi hàng lọc — thứ không ai báo lỗi nhưng ai cũng thấy.
- Bo góc **đúng ba giá trị, không có giá trị thứ tư**:

  | Token | Giá trị | Dùng cho |
  | --- | --- | --- |
  | `rounded-control` | `0.5rem` | nút, ô nhập |
  | `rounded-card` | `1rem` | thẻ, hộp thoại |
  | `rounded-pill` | `9999px` | mục nav, chip lọc, nút icon, avatar |

  **Bảng và ô nhập giữ cạnh thẳng.** Trên màn CRM dày dữ liệu, cạnh thẳng chính là thứ mắt dùng để căn cột — bo nó đi thì mất nhiều hơn được. Dùng `rounded-card` / `shadow-card` chứ **không** dùng `rounded-xl` / `shadow-sm` của Tailwind: chúng là một thang bo góc và đổ bóng thứ hai nằm cạnh thang của dự án, và một thẻ bo 0.75rem đứng cạnh một thẻ bo 1rem là thứ không ai báo lỗi nhưng ai cũng thấy.
- Bóng chỉ hai mức: `shadow-card` cho thẻ nằm trên trang, `shadow-float` cho thứ nổi lên trên (hộp thoại, dropdown). Không có mức thứ ba — màn CRM dày đặc thẻ, thêm một tầng bóng nữa là thành nhiễu.
- Thời gian: `--duration-state` (150ms) cho đổi trạng thái, `--duration-motion` (250ms) cho thứ di chuyển. **Không có gì chậm hơn 300ms.**
- Chỉ animate `transform` và `opacity`. Animate `width`/`height`/`top` là ép trình duyệt tính lại layout mỗi khung hình.
- `prefers-reduced-motion` đã xử lý **toàn cục** trong `globals.css`. Không component nào phải nhớ, và cũng không component nào được phép ghi đè.
- Tầng `z-index` lấy từ biến `--z-*`. Không tự chế số.

## 5. Luật riêng của sản phẩm này — chỗ giao diện gánh luật nghiệp vụ

Đây là phần khác mọi design system khác, và là phần rubric chấm. Bảy luật của CLAUDE.md rơi vào tay tầng component:

| Luật | Giao diện phải làm gì | Ép ở đâu |
| --- | --- | --- |
| **1 · Không provenance thì không hiển thị** | Mỗi phát hiện **luôn** kèm nút mở nguồn. Không có nhánh render nào vẽ `statement` mà thiếu nút đó | Ép trong chính component, không ép bằng thiện chí người viết |
| **2 · Fact ≠ suy luận** | Nền tím + nhãn chữ cho mọi thứ máy sinh; dữ liệu người nhập nền trắng/xám | `Badge tone="inference"`, `tone="system"` |
| **3 · Máy chuẩn bị, người quyết** | Nút Duyệt/Bỏ đứng cạnh **bằng chứng**, không đứng một mình. Vùng 3–4 (AI tự ghi) phải có nhãn "do hệ thống thêm" + nút Hoàn tác **dễ bấm hơn cả lúc máy làm** | Hoàn tác là nút cấp 1, không giấu trong menu ⋯ |
| **4 · Một dòng sai tệ hơn một dòng trống** | Không có dữ liệu thì để trống + nói vì sao trống. **Cấm** hiện `—` trơ trọi mà không giải thích | Ô rỗng luôn kèm câu ngắn |
| **5 · Next step là nhịp tim** | Việc tiếp theo + ngày hạn là thứ đập vào mắt đầu tiên ở màn chính; quá hạn mang `warning` | |
| **6 · Đo được từ ngày đầu** | Mọi nút Duyệt/Sửa/Bỏ đều bắn số liệu. Nút không ghi nhận = nút chưa xong | |
| **7 · Giải thích được** | Không copy component ở đâu về mà không hiểu từng dòng | |

**Bốn vùng tự chủ hiện lên giao diện thế nào:**

| Vùng | Dấu hiệu bắt buộc trên màn hình |
| --- | --- |
| 1 · Tự do (bản lưu, phát hiện) | Nền `machine-50`, nhãn "do AI sinh", câu trích bấm ra được |
| 2 · Chờ duyệt (gợi ý) | Thẻ tím + **hai nút** Duyệt / Bỏ + bằng chứng ngay trong thẻ. Không duyệt thì **không có gì xảy ra**, giao diện không được hối |
| 3 · Tự ghi hoàn tác được (Việc tiếp theo) | Ô mang viền tím + nhãn "do hệ thống điền" + **Hoàn tác một cú bấm**, hiện suốt 7 ngày |
| 4 · Tự ghi không hỏi (mục dòng thời gian) | Nhãn "do hệ thống thêm" + câu trích + nút xoá của Sales |
| ✋ Cấm | Không có nút nào cho AI đổi giai đoạn / đánh Thắng-Thua / sửa tiền / xoá dữ liệu người tạo. **Không vẽ ra thì không ai bấm nhầm** |

Khi **tắt AI**: banner đứng đầu mọi màn có AI, dữ liệu cũ **vẫn hiển thị nguyên** (không xoá, không ẩn), chỉ dừng sinh mới.

## 6. Component

- Nút: `Button` với 4 biến thể. **Một màn chỉ có đúng một nút `primary`.** Hai nút cam trên một màn nghĩa là màn đó không có hành động chính.
- Hành động phá huỷ dùng `variant="danger"`, đặt **tách khỏi** nhóm nút thường, và hỏi lại trước khi chạy.
- Vùng bấm tối thiểu **44×44px** (`min-h-11` đã có sẵn trong `Button`). Icon nhỏ hơn thì nới vùng bấm, không nới icon.
- Icon dùng **SVG** (Lucide). **Cấm dùng emoji làm icon** — nó đổi hình theo hệ điều hành và không nhuộm màu theo token được.
- Ô nhập: **luôn có label nhìn thấy được**, không dùng placeholder thay label. Lỗi hiện **ngay dưới ô sai**, kèm cách sửa chứ không chỉ "Dữ liệu không hợp lệ".
- Bảng: header dính, cột số căn phải + `tabular`, hàng hover đổi nền. Danh sách trên 50 dòng thì phân trang hoặc ảo hoá — **chưa màn nào làm**, xem [câu hỏi chưa giải quyết](#câu-hỏi-chưa-giải-quyết).
  - **Header cột số cũng căn phải**, không chỉ ô. Đó là chỗ duy nhất trong bảng mà canh lề là *thông tin* chứ không phải sở thích: header lệch thì cột không có gì để mắt căn vào.
  - Header dính cần hộp bọc **có trần chiều cao và tự cuộn**. `sticky top-0` trong một hộp không giới hạn chiều cao thì không có cuộn nào để dính vào — nó **im lặng không làm gì**, và mọi con số bị đọc dưới một tiêu đề đã trôi khỏi màn hình.
  - `Table` **không tự sắp xếp dữ liệu**. Nó bắn `onSort`, màn hình quyết định. Component sở hữu thứ tự dữ liệu là nguồn sự thật thứ hai về trình tự.
- Trạng thái rỗng luôn có câu giải thích + một hành động, không để trang trắng.

### Ba component trạng thái — không viết tay lại

`EmptyState` · `ErrorState` · `SectionCard`. Chúng tồn tại vì ba khái niệm này từng được viết tay ở **31 chỗ** và đã trôi khác nhau: 10 trạng thái rỗng với hai bo góc, bốn padding, hai cỡ chữ và hai màu xám; 13 khối lỗi cùng một phép ba ngôi copy tay; 11 thẻ panel chia thành `p-4` và `p-5`.

Không bản nào trong số đó là *quyết định*. Chúng là hệ quả của việc **không có chỗ nào để đặt quyết định** — nên thứ được thêm là chỗ đặt, không phải thêm giá trị.

| Component | Ép được gì |
| --- | --- |
| `EmptyState` | `message` **bắt buộc và phải là câu**. Không nhánh render nào vẽ ra hộp rỗng không chữ → luật 4 thôi phụ thuộc thiện chí |
| `ErrorState` | `role="alert"` + phép chọn giữa `ApiError.message` (câu viết cho Sales) và câu dự phòng, ở **một** chỗ |
| `SectionCard` | một padding, một cỡ tiêu đề. Thẻ có tiêu đề thành `<section>` có tên; thẻ không tiêu đề là `<div>` — **không bịa `aria-label`** |

**Cấm** nhận `className` để tuỳ biến màu/padding. Muốn khác thì thêm biến thể, không vá tại chỗ.

### Thang container — ba tầng, khai một lần

`PageBody` là chỗ duy nhất quyết định bề rộng và gutter. Trước 14/08 mười màn đã trôi thành **năm** giá trị `max-w` (3xl/4xl/5xl/6xl/100rem), và màn hàng đợi duyệt — tâm điểm demo — dùng 62% màn 1440px.

| Tầng | Bề rộng | Cho màn | Vì sao |
| --- | --- | --- | --- |
| `reading` | 768px | `/huong-dan` | đoạn văn dài, quá ~75 ký tự/dòng là mỏi mắt |
| `standard` | 1280px | 8 màn CRM | hàng dày dữ liệu cần chiều ngang |
| `wide` | 1600px | `/co-hoi` | bảng 7 cột kéo thả |

Ba tầng vì có **đúng ba loại màn**, không phải vì ba là số đẹp. Gutter co theo khổ (`px-4` → `sm:px-6` → `lg:px-8`): `p-6` cứng tiêu 13% chiều ngang một màn 375px.
- Focus ring đã khai báo toàn cục. **Cấm `outline: none`** ở bất cứ đâu.

### Từ vựng alias của shadcn — chỉ sống trong `components/ui/`

`globals.css` có một khối `@theme inline` ánh xạ tên semantic của shadcn (`background`, `primary`, `muted-foreground`, …) về token của dự án. Nó tồn tại để component copy từ shadcn về chạy được **mà không phải sửa từng dòng class**, không phải để trở thành cách gọi màu thứ hai.

**Luật:** `bg-background`, `text-primary`, `text-muted-foreground` và họ hàng chỉ được dùng **trong `src/components/ui/`**. Code màn hình viết `ink-*` / `brand-*` / `machine-*`, và dùng **`bg-surface`** cho nền thẻ — token có tên theo vai trò, thay cho `bg-card` của lớp alias.

Chuyện đã xảy ra đúng như đoạn dưới dự đoán: `bg-card` được dùng **17 lần** trong `app/` và **lọt qua đúng cái grep** ở checklist mục 7. Vì vậy luật này giờ có test chặn, không chỉ có lời dặn.

Vì sao chặt thế: nếu `bg-background` viết được ở mọi nơi thì repo có hai từ vựng cho một màu, và điều cấm "không dùng class màu thô" **mất hiệu lực trong im lặng** — `bg-background` lọt qua mọi lần grep trong khi không nói cho người đọc biết đó là màu gì. Mục 7 của checklist có một dòng kiểm việc này.

Một chỗ lớp alias **cố ý cãi lại upstream**: `--color-primary-foreground` là **ink, không phải trắng**. Trắng trên `brand-400` là 1.7:1 và không đọc được; ink trên `brand-400` là 11.36:1. Component nào của shadcn giả định trắng-trên-primary thì phải sửa, không phải nhận nguyên.

## 7. Trước khi merge một thay đổi giao diện

- [ ] `pnpm test` xanh — **bốn luật thang token nằm trong `e2e/ui-invariants.spec.ts`**, không phải trong một lệnh grep ai đó phải nhớ chạy: màu thô · bo góc ngoài ba giá trị · bóng ngoài hai mức · alias shadcn rò ra ngoài `components/ui/`
- [ ] Nếu cần grep tay, dùng bản **neo theo tiền tố utility**, không dùng bản cũ:

  ```bash
  grep -rEn "(bg|text|border|ring|fill|stroke|from|to|via|divide|accent|outline|caret)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]|bg-\[#" apps/web/src
  ```

  Bản cũ (`slate-|amber-|indigo-|bg-\[#`) hỏng **hai chiều**: nó **sót** `red-*` — nên `bg-red-50` ship thẳng vào production — và **báo nhầm** vì `slate-` khớp bên trong `-tran`**`slate-`**`y-1/2`, nên người chạy học cách bỏ qua kết quả. *Một cửa vừa sót vừa báo nhầm tệ hơn không có cửa: nó tạo cảm giác đã kiểm.*
- [ ] Chữ thân ≥14px, tương phản ≥4.5:1; đã thử ở 375px và 1440px
- [ ] Mọi nút bấm được có phản hồi khi bấm và vùng chạm ≥44px
- [ ] Nhận định AI nào cũng bấm ra được nguồn
- [ ] Máy tự ghi chỗ nào thì chỗ đó có nhãn + đường lùi
- [ ] Không dùng màu làm kênh thông tin duy nhất
- [ ] Tab được hết bằng bàn phím, thứ tự tab khớp thứ tự nhìn
- [ ] `pnpm build` xanh (Tailwind v4 lỗi token là lỗi lúc build, không phải lúc chạy)

## Phạm vi đã chốt

**Chỉ làm nền sáng.** Token đặt tên theo vai trò nên thêm nền tối sau này là thêm một khối biến, không phải sửa component — nhưng trong phạm vi hackathon thì không làm, và không nửa vời: **không** có component nào tự chế màu nền tối riêng.

## Câu hỏi chưa giải quyết

- **Phân trang bảng.** Mục 6 đòi danh sách >50 dòng phải phân trang hoặc ảo hoá; **hiện 0 màn làm**. Seed dưới ngưỡng nên chưa vỡ. Nếu BTC nạp bộ dữ liệu lớn thì đây là chỗ vỡ đầu tiên — nói thẳng nếu bị hỏi. Cố ý không làm trong vòng 14/08 vì không màn nào chạm ngưỡng trong demo.
- **`dropdown-menu.tsx`** (Radix vendored, 257 dòng) vẫn mang thang bo góc/bóng riêng và nhánh `dark:` là mã chết. Có **miễn trừ khai tường minh** trong `ui-invariants`, không phải bỏ sót. Sửa hay giữ: cần người chốt.

- Vàng thuần `#FFFF00` trong logo chưa có vai trò nào trong giao diện. Đang cố ý để trống — nó chói và gần như không thể đạt tương phản. Nếu cần dải thương hiệu đậm hơn thì bàn trước khi dùng.

*(Đã chốt 14/08: **bộ icon là Lucide**, cài `lucide-react` trong `apps/web`. Câu hỏi mở cũ — "màn hình đầu tiên cần icon là chỗ phải chốt Lucide" — đã được app shell trả lời. Mục 6 vốn đã ghi Lucide làm ví dụ; giờ nó là quyết định có gói cài kèm.)*

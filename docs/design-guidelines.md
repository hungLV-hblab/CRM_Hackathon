# Luật giao diện & design token

> **Đọc file này trước khi gõ dòng JSX đầu tiên.** Mọi việc chạm tới giao diện — thêm màn hình, sửa component, chọn màu, chọn khoảng cách, thêm animation — đều phải theo file này.
> Token thật nằm ở [`apps/web/src/app/globals.css`](../apps/web/src/app/globals.css). File md này giải thích **vì sao** và **dùng lúc nào**; file css là nguồn sự thật của **giá trị**.
> Cập nhật lần cuối: 2026-08-13.

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
- **Cột số phải dùng `tabular`** (utility có sẵn): tiền, số đếm, ngày. Không thì con số nhảy cột mỗi lần đổi giá trị.

## 4. Khoảng cách, bo góc, đổ bóng, thời gian

- Nhịp **4/8px**. Khoảng cách trong section: `16 · 24 · 32 · 48`.
- Bo góc chỉ hai giá trị: `rounded-control` (nút, ô nhập) và `rounded-card` (thẻ, bảng, hộp thoại).
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
- Bảng: header dính, cột số căn phải + `tabular`, hàng hover đổi nền. Danh sách trên 50 dòng thì phân trang hoặc ảo hoá.
- Trạng thái rỗng luôn có câu giải thích + một hành động, không để trang trắng.
- Focus ring đã khai báo toàn cục. **Cấm `outline: none`** ở bất cứ đâu.

## 7. Trước khi merge một thay đổi giao diện

- [ ] Không còn class màu thô (`slate-*`, `amber-*`, `bg-[#...]`) — chỉ token
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

- Vàng thuần `#FFFF00` trong logo chưa có vai trò nào trong giao diện. Đang cố ý để trống — nó chói và gần như không thể đạt tương phản. Nếu cần dải thương hiệu đậm hơn thì bàn trước khi dùng.
- Chưa có bộ icon thống nhất trong repo. Màn hình đầu tiên cần icon là chỗ phải chốt Lucide và cài một lần.

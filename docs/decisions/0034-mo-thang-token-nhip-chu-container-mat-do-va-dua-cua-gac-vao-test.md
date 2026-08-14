# ADR-0034 — Mở thang token ba hướng (nhịp chữ · container · mật độ control) và chuyển cửa gác thang từ lệnh grep trong doc sang bộ test

| | |
| --- | --- |
| **Ngày** | 2026-08-14 15:10 |
| **Giai đoạn** | Development |
| **Trạng thái** | Chấp nhận |
| **Người quyết định** | HungLV |
| **Prompt log** | *không có* — phiên làm việc trực tiếp, chẩn đoán bằng grep trên mã nguồn chứ bằng phản biện persona |

## Bối cảnh

Vòng nâng cấp UI trước ([ADR-0030](./0030-doi-huong-sang-shadcn-cho-sau-primitive.md)) dựng **giàn**: shadcn, app shell, tour. Vòng này làm **nội thất**, và việc đo mã nguồn tìm ra 13 phát hiện, trong đó ba thứ buộc phải mở thang token và một thứ buộc phải sửa cái cửa:

- **Nhịp chữ sập còn hai cỡ.** 194 trong 210 lần dùng cỡ chữ là `text-sm` hoặc `text-xs`. Tài liệu khai thang `12·14·16·18·24·32` nhưng tầng 18px **không tồn tại trong code**: tiêu đề section là `text-sm uppercase text-ink-500` — nhỏ hơn nội dung nó mở đầu và phân biệt bằng **màu**, đúng thứ design-guidelines §3 loại làm công cụ phân cấp.
- **Năm giá trị `max-w` trên mười màn** (3xl/4xl/5xl/6xl/100rem), không giá trị nào được chọn so với các giá trị kia. Màn hàng đợi duyệt — tâm điểm demo — dùng 62% màn 1440px.
- **Ô nhập 38px cạnh nút 44px.** Lệch 6px trên mọi hàng lọc, và dưới ngưỡng vùng chạm mà chính `Button` ép.
- **Cửa gác thang hỏng hai chiều.** Checklist mục 7 chạy `grep -rE "slate-|amber-|indigo-|bg-\[#"`. Nó **sót** `red-*` nên `bg-red-50` ship thẳng vào production ở màn Đang theo dõi; và nó **báo nhầm** vì `slate-` khớp bên trong `-tran`**`slate-`**`y-1/2`, nên ai chạy cũng thấy hai dòng rác rồi kết luận "lại translate" và thôi đọc kỹ.

Ràng buộc: **feature freeze tối 14/08**, và quỹ giờ chia với tài liệu trình bày (hạng mục nộp bắt buộc). Người dùng chốt chạy hết bảy phase, tài liệu sang 15/08.

## Phương án đã cân nhắc

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| **A. Mở thang bằng token đặt tên theo vai trò + chuyển bốn luật grep vào `ui-invariants`** | Chỗ gọi không phải cãi nhau 16 hay 18 · cửa gác do máy giữ, không do người nhớ · thông báo lỗi của test nói **cách sửa** | Thêm 6 token chữ + 1 token mật độ + 1 token nền vào `globals.css` | ✅ **Chọn** |
| B. Giữ nguyên, sửa từng chỗ lệch | Không thêm khái niệm nào | Đúng cách đã đẻ ra 5 giá trị `max-w` và 10 trạng thái rỗng. Sửa tại chỗ **không có chỗ nào để sửa một lần** | ❌ Loại |
| C. Dùng thẳng thang `text-*` của Tailwind, không token vai trò | Không thêm gì vào `globals.css` | `text-base` hay `text-lg` cho tiêu đề section là câu hỏi mở lại ở **mỗi** chỗ gọi. Tên theo vai trò (`text-section`) chấm dứt tranh luận | ❌ Loại |
| D. Chuyển hẳn sang shadcn Form + Radix Select | Bề mặt chuẩn hoá | 4–5h, và **đổi cách e2e chọn option** — 32 spec đang là điều kiện của 10/10 điểm nghiệm thu. Không đổi lấy điểm rubric nào | ❌ Loại |
| E. Nới regex khi test đỏ | Test xanh ngay | Là **bỏ luật**, không phải sửa lỗi. Ghi ra đây để lần sau ai định làm thì đọc thấy nó đã bị loại | ❌ Loại |
| F. Viết lại `dropdown-menu.tsx` cho hết `rounded-md`/`shadow-lg`/nhánh `dark:` | Thang sạch tuyệt đối | 257 dòng Radix vendored viết cho từ vựng alias, sửa trước freeze là đánh cược không đổi lấy gì mắt thấy được | ❌ Loại — **khai miễn trừ** trong test |

## Quyết định

Chọn **A**. Tiêu chí so là **chỗ để đặt quyết định**: mọi phát hiện nhóm B (10 trạng thái rỗng, 13 khối lỗi, 11 thẻ panel viết tay) đều không phải do ai chọn sai giá trị — chúng là hệ quả của việc **không có chỗ nào để chọn**. Nên thứ được thêm là chỗ đặt quyết định (token theo vai trò, ba component dùng chung), không phải thêm giá trị.

Bốn token mới và ba component mới:

| Thêm | Vì sao cần tên riêng |
| --- | --- |
| `--text-caption\|body\|body-lg\|section\|page\|metric` | tầng 18px thiếu hẳn; tên theo vai trò để chỗ gọi không chọn lại cỡ |
| `--size-control: 44px` | một con số phục vụ **cả** vùng chạm **và** chiều cao hàng lọc |
| `--color-surface` | code màn hình thôi mượn `bg-card` của lớp alias — thứ lọt qua mọi lần grep màu |
| `PageBody` ba tầng `reading\|standard\|wide` | ba loại màn thật, không phải ba vì ba là số đẹp |
| `SectionCard` · `EmptyState` · `ErrorState` | `EmptyState` **bắt buộc** `message` là một câu, nên luật 4 không còn phụ thuộc thiện chí |

## Hệ quả

- Kéo theo: `bg-card` trở thành **bất hợp pháp** ngoài `components/ui/`, có test chặn. Trạng thái rỗng viết tay cũng vậy.
- Kéo theo: bảng có API `TableHeader = string | TableColumn`, nên **bốn màn hiện tại không phải sửa gì** để chạy tiếp.
- Đánh đổi chấp nhận: `dropdown-menu.tsx` vẫn còn thang bo góc/bóng riêng và nhánh `dark:` là mã chết. Có miễn trừ khai trong test, không phải bỏ sót.
- Đánh đổi chấp nhận: **không làm phân trang bảng**, dù design-guidelines §6 đòi >50 dòng phải phân trang. Seed dưới ngưỡng nên chưa vỡ; nếu BTC nạp bộ dữ liệu lớn thì đây là chỗ vỡ đầu tiên.
- Sẽ phải xem lại nếu: có nền tối (thang chữ và `--color-surface` chịu được, `EmptyState`/`SectionCard` phải kiểm lại tương phản), hoặc nếu bảng phải chứa >50 dòng thật.

## AI đã tham gia thế nào

- Vai trò AI: **chẩn đoán bằng đo, không bằng cảm giác.** Mọi phát hiện đều là kết quả grep có số kèm `file:dòng` — 194/210 cỡ chữ, 10 trạng thái rỗng, 17 chỗ `bg-card`, 5 giá trị `max-w`. Sau đó sinh phương án và tự chạy bộ test sau mỗi phase.
- AI đề xuất gì mà đội **không** nghe:
  - **Giữ cả hai nút "Xoá bộ lọc"** (một trong thanh lọc, một ở trạng thái rỗng) với lý do "hai ngữ cảnh khác nhau". Sai: T-1 đỏ ngay vì `getByRole('button', {name:'Xoá bộ lọc'})` khớp **2 phần tử**. Hai nút trùng accessible name thì cả trình đọc màn hình và spec đều không biết chọn cái nào. Đã bỏ nút ở trạng thái rỗng.
  - **Bọc `Card` của shadcn quanh mọi section** (đề xuất từ vòng trước, đã loại ở ADR-0030) — không mở lại.
- AI sai ở đâu:
  - Viết `\b` trong template literal của JS, thành ký tự backspace → regex không biên dịch được. Bắt được ngay lần chạy đầu.
  - Dùng script tự động thụt lề lại một vùng JSX và **nhắm sai vùng**, làm hỏng thụt lề cả file. Phải `git checkout` file rồi làm lại bằng tay. Bài học: sửa cấu trúc JSX bằng regex là việc nên làm bằng tay.
  - Kết luận sớm rằng một lần e2e đỏ là **flake có sẵn**. Đúng là flake, nhưng lúc kết luận thì chưa có bằng chứng — phải chạy lại đủ bộ trên cả hai nhánh mới biết.

## Đội đã verify bằng cách nào

**Không có khẳng định nào ở trên dựa vào việc nhìn màn hình.**

1. **Chẩn đoán**: mỗi phát hiện là một lệnh grep có số và `file:dòng` chạy lại được. `bg-red-50` ở `dang-theo-doi/page.tsx` là bằng chứng cửa gác hỏng, không phải suy đoán.
2. **Cửa gác chứng minh chính nó**: sau khi neo lại regex, test **đỏ ngay** và bắt thêm một vi phạm thứ sáu chưa ai biết — `rounded-full` ở `pending-proposal-marker.tsx:33`, một tên thứ hai cho `rounded-pill`. Một cửa bắt được thứ người viết nó không biết là cửa hoạt động.
3. **Mật độ đo bằng pixel, không bằng ảnh chụp**: `boundingBox().height >= 44` cho ô nhập, ô chọn, checkbox. 38px và 44px trông **giống nhau** trên ảnh và khác hẳn dưới ngón tay.
4. **Header dính đo bằng computed style của hộp bọc** (`overflow-y: auto`, `max-height ≠ none`, `thead position: sticky`, nền đặc) chứ không bằng một cú cuộn — seed chỉ có 5 công ty nên một assert cuộn sẽ **xanh trên một cử chỉ rỗng** và không chứng minh gì về danh sách dài. Cái hỏng là hộp bọc, nên hộp bọc là thứ được đo.
5. **Không làm đỏ điểm nghiệm thu**: chạy `pnpm test` sau **mỗi** phase, và rebuild ảnh docker trước mỗi lần chạy e2e. Kết quả cuối: **281 unit + 36 e2e** (32 gốc + 4 mới có chủ đích).
6. **Một lần e2e đỏ đã truy đến gốc, không bỏ qua**: T-3 đỏ một lần. Chạy lại đủ bộ trên code trước P4 (34/34 xanh) **và** trên code sau P4 (34/34 xanh) → không phải hồi quy. Nguyên nhân thật: vùng đọc mount một `SourceViewer` cho **mỗi** bản chụp, nên `getByTestId('source-text').first()` là bản chụp đứng đầu chứ không phải bản vừa bấm, và số bản chụp của Sakura phụ thuộc vòng quét chạy được mấy nhịp trong các spec trước — **câu assert phụ thuộc thời gian thực**. Đã neo cả hai locator vào đúng thẻ đang mở.
7. **`pnpm build` đỏ, và đã kiểm là không phải do vòng này**: `next build` compile và sinh 14/14 trang xanh, chỉ bước copy trace của `standalone` đỏ vì Windows không cho tạo symlink (`EPERM`). Chạy lại đúng lệnh đó trên code `origin/master` → **đỏ y hệt**. Là lỗi môi trường sẵn có. Đường build thật của sản phẩm (`docker compose build web`, chạy trong Linux) **xanh** ở cả bảy lần rebuild.

## Rollback

Bảy commit, mỗi phase một commit, mỗi commit chạy được:

| Đảo cái gì | Lệnh | Mất gì |
| --- | --- | --- |
| Bảng (rủi ro cao nhất) | `git revert` commit P5 | giữ toàn bộ phần còn lại |
| Bố cục + nhịp chữ | `git revert` commit P4 | giữ form, ba component trạng thái, thang token |
| Cả vòng | `git revert` 6 commit theo thứ tự ngược | về `origin/master`, 10/10 điểm không đổi |

Tốn **dưới 5 phút** cho bất kỳ mức nào, vì không commit nào chạm `apps/api/`, `packages/`, schema, hay migration. Vòng này **chỉ** là tầng trình bày.

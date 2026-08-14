# P7 · Cửa chốt — checklist, ADR, doc — 20' — ❌ không cắt được

> Chạy phase này **kể cả khi chỉ P1 kịp**. ADR là điều kiện, không phải phần thưởng: [CLAUDE.md mục 5](../../CLAUDE.md) — *"Không có ADR = quyết định đó không tồn tại với BGK"*.

## Bước 1 · Bộ kiểm đầy đủ (5')

```
pnpm lint && pnpm typecheck && pnpm build && pnpm test
```

Con số phải khớp: **281 unit + 32 e2e**, cộng đúng số assertion mới đã cố ý thêm vào `ui-invariants.spec.ts`. Lệch một test không giải thích được = chưa xong.

## Bước 2 · Grep gác cửa (3')

```bash
# Màu thô — bản NEO THEO TIỀN TỐ. Bản cũ trong doc (`slate-|amber-|indigo-|bg-\[#`) vừa sót
# `red-*` (nên `bg-red-50` ship được) vừa báo nhầm trên `-translate-`. Đừng dùng lại bản cũ.
grep -rE "(bg|text|border|ring|fill|stroke|from|to|via|divide|accent|outline|caret)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]|bg-\[#" apps/web/src

# P1 mở ra, phải rỗng (trừ dropdown-menu.tsx vendored)
grep -rE "rounded-(sm|md|lg|xl|2xl|3xl|full)|shadow-(sm|md|lg|xl)" apps/web/src

# alias không được rò ra ngoài components/ui/
grep -rE "bg-card|bg-background|text-primary\b|text-muted-foreground|border-border" apps/web/src/app/

# P3: không còn trạng thái rỗng viết tay
grep -rn "border-dashed" apps/web/src/app/

# P6: không còn SVG tự vẽ
grep -rn "<svg" apps/web/src/
```

Phase nào bị cắt thì grep tương ứng **được phép có kết quả** — nhưng phải ghi rõ ở bước 4, không im lặng.

## Bước 3 · Checklist mục 7 design-guidelines, thử tay (7')

Ở **375px và 1440px**, trên `/cong-ty`, `/co-hoi`, `/cong-ty/[id]`, `/hang-doi`:

- [ ] Không class màu thô — chỉ token
- [ ] Chữ thân ≥14px, tương phản ≥4.5:1
- [ ] Mọi nút bấm được có phản hồi, vùng chạm ≥44px (**đo bằng test, không bằng mắt**)
- [ ] Nhận định AI nào cũng bấm ra được nguồn — **kiểm lại sau khi đổi bố cục**, P4 nửa B dời vùng đọc sang cột phải
- [ ] Máy tự ghi chỗ nào thì chỗ đó có nhãn + đường lùi — **nút Hoàn tác 7 ngày còn nguyên hành vi và vẫn là nút cấp 1**
- [ ] Không dùng màu làm kênh thông tin duy nhất
- [ ] Tab hết được bằng bàn phím, thứ tự tab khớp thứ tự nhìn — **kiểm kỹ ở `/cong-ty/[id]` hai cột**
- [ ] Kéo thả `/co-hoi` chạy bằng **cả chuột và bàn phím** (Tab → Space → mũi tên → Space)
- [ ] `pnpm build` xanh

Hai dòng in đậm là chỗ plan này có thể phá mà test không bắt: bố cục hai cột đổi thứ tự tab, và mọi thứ chạm `auto-next-step-cell.tsx` đụng vùng 3.

## Bước 4 · ADR-0034 (5')

`docs/decisions/0034-mo-thang-token-nhip-chu-container-mat-do.md`, theo [adr-template](../../docs/decisions/adr-template.md).

**Quyết định:** mở thang token ba hướng — nhịp chữ (`--text-*`), thang container ba tầng, mật độ control (`--size-control`) — cộng token `--color-surface` để code màn hình thôi mượn từ vựng alias của shadcn.

**Bối cảnh phải ghi:** 194/210 lần dùng cỡ chữ là `text-sm`/`text-xs`; 5 giá trị `max-w` trên 10 màn; ô nhập 38px cạnh nút 44px; `bg-card` dùng 17 lần ngoài `components/ui/`; và **grep gác cửa của checklist hỏng hai chiều** — sót `red-*` (nên `bg-red-50` ship được) và báo nhầm trên `-translate-` (nên người chạy học cách bỏ qua kết quả).

Ghi riêng một mục cho cái cửa: **một cửa vừa sót vừa báo nhầm tệ hơn không có cửa, vì nó tạo cảm giác đã kiểm.** Đó là lý do bốn luật grep chuyển vào `ui-invariants` — test giữ, không phải trí nhớ giữ.

**Phương án bị loại — bắt buộc có, [CLAUDE.md mục 5](../../CLAUDE.md):**

| Phương án | Vì sao loại |
| --- | --- |
| Giữ nguyên, chỉ sửa từng chỗ | Đúng thứ đã đẻ ra 5 giá trị `max-w` và 10 trạng thái rỗng. Sửa tại chỗ không có chỗ nào để sửa một lần |
| Dùng thẳng thang `text-*` của Tailwind, không token vai trò | Chỗ gọi lại cãi nhau 16 hay 18. Tên theo vai trò (`text-section`) chấm dứt tranh luận |
| Đổi hẳn sang shadcn Form + Radix Select | 4–5h, đổi cách e2e chọn option, trước freeze. Không đổi lấy điểm rubric nào |
| Nới regex ở `ui-invariants` cho test xanh | Là bỏ luật, không phải sửa lỗi |
| Bỏ luôn từ vựng alias, sửa hết component vendored | `dropdown-menu.tsx` 257 dòng viết cho từ vựng alias. Miễn trừ có ghi rẻ hơn viết lại |

**Cách verify** (luật 5 mục 5): mọi khẳng định về mật độ và thang đo bằng `e2e/ui-invariants.spec.ts` trên stack thật, không bằng ảnh chụp — 38px và 44px trông giống nhau trên ảnh và khác hẳn dưới ngón tay.

**Khai phần bị cắt.** Phase nào không kịp thì ADR ghi thẳng, kèm lý do "hết giờ trước freeze". Cắt có ghi là quyết định; cắt im lặng là nợ.

## Bước 5 · Cập nhật design-guidelines (5')

Sửa [docs/design-guidelines.md](../../docs/design-guidelines.md), **đổi ngày ở đầu file thành 14/08**:

| Mục | Thêm gì |
| --- | --- |
| §3 Chữ | Bảng token `--text-*` theo vai trò + luật *"tiêu đề section 18px, không `uppercase`"* + lý do tiếng Việt mất dấu khi viết hoa |
| §4 Khoảng cách | `--size-control: 44px` là **một số cho cả hai việc** — vùng chạm và chiều cao hàng lọc |
| §5 (mới) Thang container | Ba tầng `reading`/`standard`/`wide`, màn nào dùng tầng nào, và **vì sao ba** |
| §6 Component | `SectionCard` · `EmptyState` · `ErrorState` — *"trạng thái rỗng viết tay là drift, dùng component"* |
| §6 Từ vựng alias | `--color-surface` là token màn hình dùng; `bg-card` **chỉ** trong `components/ui/`; grep mới nằm ở `ui-invariants` chứ không ở trí nhớ |
| §7 Checklist | **Thay grep màu thô bằng bản neo tiền tố** — bản cũ vừa sót `red-*` vừa báo nhầm trên `-translate-`, và đó là cách `bg-red-50` ship được. Cộng ba dòng grep mới của P1 |

**Không viết vào doc thứ chưa làm.** Phase bị cắt → mục đó không vào guidelines, chỉ vào ADR ở dạng "đã cân nhắc, cắt vì hết giờ".

## Tiêu chí xong

- [ ] Bốn lệnh bước 1 xanh, số test khớp và giải thích được
- [ ] Grep bước 2 rỗng, hoặc mỗi kết quả còn lại có một dòng lý do ở ADR
- [ ] Checklist bước 3 tick hết ở 375px và 1440px
- [ ] ADR-0034 tồn tại, **có bảng phương án bị loại và cách verify**
- [ ] design-guidelines cập nhật đúng phần đã làm, ngày sửa đúng
- [ ] Nhánh `feat/ui-pass-2` sạch, commit theo conventional commit, **không nhắc AI trong message**

## Câu hỏi để lại cho người sau

- **Phân trang bảng** — guidelines §6 đòi >50 dòng phải phân trang/ảo hoá, hiện **0 màn** làm. Seed dưới ngưỡng nên chưa vỡ. Chỗ vỡ đầu tiên nếu BGK nạp bộ dữ liệu lớn
- **`dropdown-menu.tsx` vendored** vẫn còn `rounded-md`/`shadow-lg`/nhánh `dark:` — miễn trừ có chủ đích. Đúng hay nên sửa: cần người chốt
- **Nền tối** — nhánh `dark:` trong component vendored là mã chết cho tới khi có quyết định. Phạm vi đã chốt là **không làm**

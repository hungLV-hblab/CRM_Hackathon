# ADR-0027 — Nút Hoàn tác nằm trên thẻ cơ hội; dữ liệu đi qua endpoint riêng, không mở rộng `OpportunityDto`

| | |
| --- | --- |
| **Ngày** | 2026-08-14 00:20 |
| **Giai đoạn** | Design (nhóm 4, mặt giao diện) |
| **Trạng thái** | Chấp nhận |
| **Người quyết định** | HungLV |
| **Prompt log** | *không có* — phiên phản biện thiết kế Phase 6, [báo cáo](../../plans/reports/from-brainstorm-to-planner-260813-2354-phase-06-nhom-4-tu-dat-viec-tiep-theo-report.md) |

> ### Làm rõ 15/08 — ranh giới giữa "hai hiện thực" và "hai bố cục"
>
> ADR này (và comment trong `thong-bao/page.tsx`) từng nói: dựng một danh sách thứ hai ở `/thong-bao` sẽ cho luật *"thông báo không tự biến mất trước khi được đọc"* **hai hiện thực, và chỉ một cái giữ được đúng**. Câu đó đúng về ý, nhưng cần chỉ rõ nó nói về cái gì.
>
> Luật đó sống ở **tầng dữ liệu**, không ở bố cục: `read_at` chỉ được ghi khi người bấm, và `crm_system` không có quyền nào trên cột đó ([ADR-0015](0015-grant-insert-phai-theo-cot-khi-bang-co-cot-thuoc-quyet-dinh-cua-nguoi.md) · migration `0003`). Không có màn hình nào có thể lách nó, dù vẽ kiểu gì.
>
> Nên từ 15/08, `/thong-bao` có **màn riêng** — vì strip có việc là *nhắc cái chưa đọc*, còn trang có việc là *chứng minh không mất gì*, và hai việc đó đòi bố cục ngược nhau (một bên gộp trùng và giấu cái đã đọc, một bên liệt kê đủ theo thứ tự kèm trạng thái). Thứ **thật sự** dùng chung là cách vẽ một dòng, nay nằm ở `components/notification/notification-row.tsx`. Hai bản sao của **markup đó** mới là trùng lặp nguy hiểm: nút "Đã xem" và nút Hoàn tác sẽ trôi khỏi nhau, mà Hoàn tác là nửa cơ chế an toàn của vùng tự chủ 3.
>
> Kéo theo: prop `show` của `NotificationStrip` bị bỏ (chỉ còn một giá trị thật); T-7 đổi `notification-strip` → `notification-history` khi kiểm `/thong-bao`, các assertion khác giữ nguyên.

## Bối cảnh

Vùng tự chủ 3 đổi quyền tự ghi lấy ba thứ, trong đó có **Hoàn tác một cú bấm**. CLAUDE.md mục 4 nói rõ hơn: *chỗ nào máy tự làm thì sửa lại phải dễ hơn cả lúc máy làm*.

Trạng thái web lúc quyết: **không có nav dùng chung** (tìm `*nav*`/`*header*` trong `apps/web/src` ra 0 file), **không có màn thông báo**, thẻ cơ hội chỉ hiển thị Việc tiếp theo (`co-hoi/opportunity-card.tsx:82-90`). Còn ~1 ngày tới feature freeze, và mọi phương án tốn số giờ khác nhau đáng kể.

Gộp hai câu vào một ADR — *nút đặt ở đâu* và *dữ liệu tới đó bằng đường nào* — vì câu sau là hệ quả trực tiếp của câu trước; tách ra thì mỗi cái đọc lên đều thiếu ngữ cảnh của cái kia.

## Phương án đã cân nhắc

Tiêu chí: *(1)* khoảng cách từ chỗ Sales **thấy** máy làm sai tới chỗ **sửa** được · *(2)* số file của người khác phải sửa trước freeze · *(3)* rủi ro với 203 test + 9 e2e đang xanh · *(4)* Specs bắt buộc cái gì.

### 1 · Nút Hoàn tác đặt ở đâu

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| **A2. Trên thẻ cơ hội** (màn thông báo vẫn làm, nhưng chỉ báo tin) | Sales thấy ô lạ và sửa ngay tại chỗ đang nhìn — đúng câu "sửa lại phải dễ hơn lúc máy làm" | Đắt nhất: phải sửa `opportunity-card.tsx` của B **và** vẫn phải dựng mặt thông báo | ✅ **Chọn** |
| A1. Chỉ trong màn thông báo | Rẻ nhất. `NotificationDto` đã mang sẵn `autoEventId`/`undoDeadline`/`canUndo` nên **0 thay đổi contract**; đóng đủ T-6 + T-7 | Sales đang xem bảng deal, thấy ô lạ, phải **rời màn hình** mới sửa được. Thông báo đã bấm "Đã xem" thì đường vào biến mất trong khi cửa sổ 7 ngày vẫn còn | ❌ Loại |
| A3. Nút ở cả hai chỗ | Không bỏ sót lối vào nào | Hai chỗ cùng phải xử lý hết-hạn / đã-hoàn-tác / lỗi tranh chấp. Không mua thêm gì vì dải thông báo nằm **ngay trên** chính thẻ đó trong cùng một màn hình | ❌ Loại |

### 2 · Dữ liệu `autoNextStep` tới thẻ bằng đường nào

Thẻ cần: `eventId` · câu trích + `observationId` (provenance bấm ra nguồn, luật 1) · lý do ngày hạn (I-9) · `undoDeadline` + `canUndo`.

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| **B1. Endpoint riêng `GET /opportunities/auto-next-steps` + gộp ở client** | `OpportunityDto`, `OPPORTUNITY_SELECTION`, `toDto` **không đổi một dòng** ⇒ không đụng file dùng chung của B, không chạm đường `/tong-quan` đọc, rủi ro với bộ test đang xanh gần bằng 0 | Bảng deal có hai nguồn dữ liệu; thêm một request | ✅ **Chọn** |
| B2. Mở rộng `OpportunityDto` + lateral join lấy event mới nhất | Một request, dữ liệu đi liền khối | Sửa `SELECTION` + `toDto` trong `opportunity-service.ts` — file dùng chung của B, và là đường **màn tổng quan** cũng đọc (`:355-356`). Bắt 5 màn không dùng tới phải gánh join. Đúng ngày trước freeze | ❌ Loại |
| B3. Nhét vào `NotificationDto`, thẻ đọc ké | Không thêm endpoint | Nút trên thẻ phụ thuộc vòng đời **thông báo**: bấm "Đã xem" hoặc lọc danh sách là thẻ mất nút, trong khi cửa sổ 7 ngày độc lập hoàn toàn với việc đã xem hay chưa | ❌ Loại |

## Quyết định

**A2 + B1.** Tiêu chí quyết định của mỗi nửa khác nhau, và đó là lý do gộp:

- Nửa nút chọn theo tiêu chí *(1)*: đội **chấp nhận trả đắt hơn** để khoảng cách thấy-sai → sửa-được bằng không. AI khuyến nghị A1 vì rẻ; đội bác, vì nếu vùng 3 chỉ biện minh được bằng "hoàn tác dễ" thì tiết kiệm đúng ở chỗ đó là tiết kiệm sai chỗ.
- Nửa dữ liệu chọn theo *(2)* và *(3)*: đã trả đắt ở nửa trên thì nửa dưới lấy đường ít rủi ro nhất. B1 giữ file của B gần như nguyên vẹn — thẻ chỉ nhận thêm một prop tuỳ chọn.

Chốt kèm: **thông báo hiện ở hai chỗ** — dải đầu bảng deal (giải bài toán không có nav) và route `/thong-bao` (lịch sử đầy đủ), dùng chung một component. `read_at` chỉ ghi khi Sales bấm **"Đã xem"**, không tự đánh dấu khi cuộn qua, để *"thông báo không tự biến mất trước khi `read_at` có giá trị"* là hành vi quan sát được chứ không phải lời hứa.

## Hệ quả

- Kéo theo: ước lượng Phase 6 **3h → 4h**, nằm trên đường găng của A (đường găng plan 11.5h → 12.5h). Món cắt đầu tiên nếu trượt là **route `/thong-bao`** — dải ở bảng deal đủ đóng T-6. Không cắt: nút Hoàn tác, dấu hiệu ô máy, hai phép đo đột biến.
- Kéo theo: `dueDateFor()` rút từ `proposal-decision-service.ts:183` ra `domain/opportunity/next-step-due-date.ts` dùng chung — endpoint mới phải trả lý do ngày hạn, và hai bản sao thì "đổi bảng độ gấp → ngày hạn đổi theo" chỉ đúng một nửa hệ thống. **Không** tạo `urgency-table.ts` như phase file cũ viết.
- Đánh đổi chấp nhận: bảng deal gọi hai endpoint và gộp ở client. Gộp lại thành B2 được sau vòng 1 nếu thấy phiền.
- **Sẽ phải xem lại nếu:** bảng deal đông tới mức hai request gây nhấp nháy thấy được, hoặc màn tổng quan cũng cần hiện dấu hiệu ô máy — lúc đó B2 mới đáng giá.

## AI đã tham gia thế nào

- Vai trò AI: đọc mã nguồn để đo trạng thái web thật, dựng ba phương án cho mỗi nửa, xếp theo tiêu chí.
- **AI đề xuất gì mà đội không nghe:** AI khuyến nghị **A1** (nút chỉ trong màn thông báo) và **chỉ dải thông báo, không làm route riêng** — cả hai đều là phương án rẻ nhất. Đội bác cả hai: A1 vì nó đặt tiết kiệm vào đúng chỗ vùng 3 lấy làm biện minh; "chỉ dải" vì mất lịch sử thông báo cũ.
- **AI sai ở đâu:** bản phase-06 do AI soạn hôm 13/08 mô tả một nền móng trống — đòi tạo `urgency-table.ts` (đã có ở contracts), coi GRANT là nợ (đã có từ `0003`), và **bỏ sót toàn bộ mặt web của thông báo** dù Specs bắt buộc. Ước lượng 3h thiếu 1h vì đúng chỗ bỏ sót đó. Cùng kiểu lỗi với P4 và P5: phase file viết trước khi phase phụ thuộc xong, rồi không ai đọc lại repo trước khi bắt tay.

## Đội đã verify bằng cách nào

**Đã làm:**

1. **Đo trạng thái web bằng grep, không bằng trí nhớ.** `nextStepText` trong `apps/web/src` ra **2 file, cả hai chỉ hiển thị** ⇒ khẳng định "Sales chưa có chỗ nào tự gõ Việc tiếp theo" là số đo. Tìm `*nav*`/`*header*` ra **0 file** ⇒ route `/thong-bao` đứng một mình sẽ không có đường vào, đó là lý do có dải ở bảng deal chứ không phải muốn thêm cho đẹp.
2. **Truy đường lan của B2 trước khi loại.** Đọc `opportunity-service.ts:355-356`: `toDto` và `SELECTION` được export cho **màn tổng quan**. Mở rộng DTO là chạm cả `/co-hoi` lẫn `/tong-quan`, tức chạm phần B vừa đóng xong ở P3 và P5.
3. **Kiểm A1 rẻ thật, rồi mới bác.** Đọc `dto/notification.ts`: `autoEventId`, `undoDeadline`, `canUndo` đã có sẵn ⇒ A1 đúng là 0 thay đổi contract. Bác nó là bác một phương án đã xác nhận rẻ, không phải dựng bù nhìn.

**Chưa làm — điểm yếu thật của ADR này:** chưa hỏi Sales chỗ nào họ muốn bấm Hoàn tác; cả hai phương án đều là suy luận của đội từ luật CLAUDE.md mục 4. Và **4h là ước lượng, chưa phải số đo** — phần web chưa từng được bấm giờ trong dự án này. Nếu tới trưa 14/08 mà mặt web chưa xong thì cắt theo thứ tự đã ghi ở mục Hệ quả, không kéo dài.

## Rollback

- A2 → A1: rẻ, vài phút. `AutoNextStepCell` là component riêng; bỏ nút khỏi thẻ và render nó trong hàng thông báo.
- B1 → B2: tốn hơn (sửa `SELECTION`/`toDto` + join), nhưng không có migration và không đụng dữ liệu. Chỉ làm sau vòng 1.
- Route `/thong-bao`: xoá được không để lại dấu vết, dải ở bảng deal vẫn đủ đóng T-6.

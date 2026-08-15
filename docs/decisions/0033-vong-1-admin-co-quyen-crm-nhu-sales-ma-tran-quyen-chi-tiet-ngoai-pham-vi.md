# ADR-0033 — Vòng 1 Admin có quyền CRM y hệt Sales; ma trận quyền chi tiết nằm ngoài phạm vi

| | |
| --- | --- |
| **Ngày** | 2026-08-14 10:12 |
| **Giai đoạn** | Requirement (diễn giải chỗ Specs không nói — Q-6) |
| **Trạng thái** | **Bị thay thế MỘT PHẦN 15/08** bởi [ADR-0046](0046-phan-quyen-theo-nguoi-phu-trach-toan-he-thong.md) — xem hộp dưới |

> ### Bị thay thế một phần — 2026-08-15
>
> Mục Hệ quả của chính ADR này nêu điều kiện xem lại: *"seed có từ hai người sở hữu trở lên. Điều kiện thứ hai quan trọng hơn: ngay khi hai Sales cùng tồn tại, 'Admin sửa dữ liệu của ai' đổi từ câu hỏi lý thuyết thành lỗ thật."*
>
> [ADR-0045](0045-dang-nhap-demo-tai-dung-luong-mat-khau-va-dashboard-scope-theo-vai.md) đổi seed thành nhiều Sales (nay là 5, nhập từ cột `sales_owner`) sáng 15/08 → **điều kiện đã xảy ra**. [ADR-0046](0046-phan-quyen-theo-nguoi-phu-trach-toan-he-thong.md) dựng ma trận quyền theo người phụ trách.
>
> - **Bị thay:** mệnh đề *"Ma trận quyền theo người sở hữu chưa có, và đó là quyết định về phạm vi"*.
> - **Vẫn giữ:** hai vai khác nhau ở chỗ Admin nhìn thấy được (`GET /settings`, bảng điều khiển, nhật ký vòng quét); Admin vẫn có quyền CRM đầy đủ, nay là vai duy nhất thấy dữ liệu của mọi Sales.
> - **Vẫn giữ:** phân tích ở mục "Phương án đã cân nhắc" — phương án B bị loại ngày 14/08 vì **thời điểm** (buổi cuối trước freeze), không phải vì sai về nguyên tắc.
>
> Nội dung gốc bên dưới giữ nguyên, không sửa: nó là bằng chứng đội đã quyết định đúng với thông tin có lúc 14/08.
| **Người quyết định** | HungLV |
| **Prompt log** | phiên phản biện phase 8 ngày 14/08 10:12 — [báo cáo](../../plans/reports/from-brainstorm-to-planner-260814-1012-phase-08-nhom-6-bang-dieu-khien-va-bo-nghiem-thu-report.md) |

## Bối cảnh

**Q-6 — "Admin có được thao tác CRM không" — treo từ 12/08**, không có trong Specs, chưa hỏi được BTC. Nó nằm trong danh sách câu hỏi chưa giải quyết của cả plan skeleton lẫn plan sáu nhóm.

Nhóm 6 là chỗ câu hỏi này đáng ra phải trả lời, vì nó là màn hình của vai Admin.

Vấn đề thật không phải "chưa quyết", mà là **phase file đã ghi một câu mô tả hành vi không tồn tại**: *"Tạm: Admin xem tất cả, không sửa dữ liệu Sales"*. Đọc câu đó, cả người lẫn AI đều tưởng đã có chỗ chặn. Trong code, ba controller CRM chỉ có `@UseGuards(JwtGuard)` — **admin ghi được y hệt Sales**. `roles.guard.ts:20-23` thậm chí đã ghi sẵn lời dặn *"do not guess it here"*.

Còn 1 buổi tới freeze tối 14/08.

## Phương án đã cân nhắc

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| **A. Ghi ADR nói đúng hiện trạng: vòng 1 Admin = Sales về quyền CRM; ma trận chi tiết ngoài phạm vi** | ~10 phút. Tài liệu khớp code ⇒ vòng 2 hỏi "Admin sửa được dữ liệu Sales không" thì trả lời được ngay và **trả lời đúng**. Không đụng đường ghi nào trước freeze | Sản phẩm không có phân quyền tinh — nhưng đó là sự thật đang có, ADR chỉ ngừng che nó | ✅ **Chọn** |
| B. Ép Admin read-only trên CRM (guard chặn ghi ở 3 controller) | Khớp với câu đã ghi trong phase file; nghe "chặt chẽ" hơn | Chạm `company` · `opportunity` · `proposal` controller + guard mới, **vào buổi cuối trước freeze**, đổi lấy một dòng rubric không chấm. Rủi ro cao nhất: 16 e2e đang xanh, spec nào lỡ thao tác dưới vai admin sẽ đỏ và không ai còn thời gian phân biệt lỗi thật với lỗi harness | ❌ Loại |
| C. Để trống, không ghi gì, coi như câu hỏi vẫn treo | Không tốn phút nào | Giữ nguyên **câu mô tả sai** trong phase file — đúng thứ [luật 4](../../CLAUDE.md#2-bảy-luật-bất-di-bất-dịch) cấm: một dòng sai tệ hơn một dòng để trống. Vòng 2 hỏi vào đây thì đội trả lời theo tài liệu và **trả lời sai về chính sản phẩm mình viết** | ❌ Loại |

## Quyết định

Chọn **A**.

Tiêu chí so là **"trả bằng gì để được gì"**: B mua một dòng phân quyền mà rubric không chấm, trả bằng rủi ro làm đỏ bộ e2e vào buổi cuối. C không trả gì nhưng để lại một câu sai trong tài liệu — mà tài liệu chính là thứ vòng 2 dùng để hỏi.

Nội dung chốt, phát biểu thành câu để dùng lại nguyên văn khi bị hỏi:

> **Vòng 1: hai vai khác nhau ở chỗ nào Admin nhìn thấy được (`GET /settings`, `PATCH /settings`, bảng điều khiển, nhật ký vòng quét), không khác nhau ở quyền ghi dữ liệu CRM. Ma trận quyền theo người sở hữu chưa có, và đó là quyết định về phạm vi, không phải sơ suất.**

Hai câu này **không** bị ADR làm lung lay, vì chúng được chặn ở tầng khác:

- Ranh giới cấm của AI (`actor = system`) không liên quan gì tới vai người dùng — chặn ở tầng domain + tầng CSDL ([ADR-0004](0004-chan-ranh-gioi-o-tang-domain-va-tang-csdl.md), [ADR-0010](0010-chan-tang-csdl-bang-hai-role-va-quyen-theo-cot.md)).
- Endpoint quản trị vẫn admin-only; Sales vẫn 403 trên `GET /settings` — điểm nghiệm thu số 2 của plan skeleton còn nguyên ([ADR-0032](0032-trang-thai-nut-tat-ai-di-qua-endpoint-rieng-cho-moi-vai-banner-dat-toan-cuc.md) chọn endpoint riêng chính là để không đụng vào nó).

## Hệ quả

- Kéo theo: **sửa lại chữ trong `phase-08` và dòng Q-6 của `plan.md`** — đã làm cùng phiên này. Câu "Admin xem tất cả, không sửa dữ liệu Sales" bị bỏ vì nó mô tả một thứ không được viết ra.
- Kéo theo: "phân quyền theo người sở hữu" vẫn nằm ở mục **Ngoài phạm vi** của plan, giờ có ADR đỡ lưng thay vì chỉ là một dòng liệt kê.
- Đánh đổi chấp nhận: một tài khoản Admin thao tác nhầm vào dữ liệu Sales thì không có gì chặn. Chấp nhận được vì hệ thống hiện có **một tài khoản Sales sở hữu mọi công ty** (ontology mục 1) — chưa có ranh giới sở hữu nào để mà xâm phạm.
- Sẽ phải xem lại nếu: BTC trả lời Q-6, **hoặc** seed có từ hai người sở hữu trở lên. Điều kiện thứ hai quan trọng hơn: ngay khi hai Sales cùng tồn tại, "Admin sửa dữ liệu của ai" đổi từ câu hỏi lý thuyết thành lỗ thật.

## AI đã tham gia thế nào

- Vai trò AI: phát hiện lệch giữa tài liệu và code + sinh phương án + phân tích trade-off.
- **AI sai ở đâu:** phase file 13/08 (AI viết) đặt câu *"Tạm: Admin xem tất cả, không sửa dữ liệu Sales"* vào cột **Xử lý** của bảng Rủi ro — tức là trình bày nó như **biện pháp đã áp dụng**, trong khi không ai viết dòng code nào cho nó. Đây là dạng lỗi nguy hiểm hơn bỏ trống: nó *đóng* một câu hỏi đang mở bằng một câu nghe như đã giải quyết. Cùng họ với lỗi ADR-0011 (dòng "worker không có pool `crm_app`" sai từ trước P7) và lỗ mẫu số của [ADR-0031](0031-mau-so-error-detection-rate-la-ba-tap-ai-dua-ra-truoc-mat-nguoi.md).
- **AI làm đúng ở đâu:** comment `roles.guard.ts:20-23` (viết ở plan skeleton) đã dặn thẳng *"the question 'may Admin operate the CRM' (Q-6) is still awaiting an answer from the organisers. Do not guess it here."* — lời dặn đó giữ cho guard không bị đoán bừa suốt bốn ngày, và là chỗ phiên này đối chiếu để biết câu trong phase file là bịa.

## Đội đã verify bằng cách nào

1. **Đọc ba controller và ghi số dòng**, thay vì tin câu trong phase file: `company.controller.ts:29` · `opportunity.controller.ts:35` · `proposal.controller.ts:30` — cả ba chỉ có `@UseGuards(JwtGuard)`, **không có `RolesGuard`, không có `@Roles`**. Kết luận "admin ghi được y hệt Sales" đọc thẳng ra từ đó.
2. **Kiểm cơ chế trước khi kết luận**, để chắc không có chặn ngầm ở chỗ khác: `roles.guard.ts:33` — không có `@Roles` thì `return true`. Nghĩa là kể cả nếu ai đó gắn `RolesGuard` vào ba controller kia, **không có `@Roles` thì vẫn không chặn gì**. Hai lớp cùng nói một câu.
3. **Đối chiếu với ranh giới thật sự phải chặn**, để biết quyết định này không mở lỗ nào: ranh giới cấm của Specs là `actor = system`, không phải vai người dùng, và nó được chặn ở domain + CSDL — T-10 của P8 chấm đúng chỗ đó ở **hai lớp**, ba nhánh.
4. **Không có phép đo nào cho ADR này, và đó là đúng bản chất của nó**: đây là ADR *diễn giải phạm vi*, không phải ADR cơ chế. Thứ verify được là "code hiện làm gì" (đã đọc, có số dòng) và "quyết định này không đụng ranh giới nào đang được test bảo vệ" (T-10 + điểm nghiệm thu số 2 vẫn nguyên).

## Rollback

Đảo quyết định = thêm `RolesGuard` + `@Roles('sales')` vào các đường ghi của ba controller, ~30 phút cộng thời gian chạy lại 16 e2e. **Không làm trước freeze.** Nếu BTC trả lời Q-6 ở vòng 2 thì đây là việc của bản sau, không phải việc vá gấp.

# Prompt log — 15/08/2026 10:45 · Phản biện: nút đăng nhập demo (BTC 3.2) và dashboard lọc theo Sales (BTC 3.3)

> **Đây là đề thi vòng 2.** Viết cho người đọc lại sau ba tuần, không phải cho người vừa ngồi trong phiên.
> Kết quả: [ADR-0045](../decisions/0045-dang-nhap-demo-tai-dung-luong-mat-khau-va-dashboard-scope-theo-vai.md) · [plan bốn chặng](../../plans/2026-08-15-demo-login-dashboard-sales-view/plan.md) · [brainstorm report](../../plans/2026-08-15-demo-login-dashboard-sales-view/brainstorm-report.md)
> Bối cảnh thời gian: **sau feature freeze tối 14/08**. Hai yêu cầu này do BTC bổ sung nên được phép làm, nhưng phạm vi phải nhỏ nhất có thể.

## Yêu cầu gốc của BTC

> **3.2** Trên màn hình đăng nhập có nút vào thẳng bằng từng user Sales trong danh sách đã phát — chọn user là đăng nhập ngay, không cần mật khẩu. Tính năng đăng nhập bằng mật khẩu vẫn giữ nguyên theo mục 7. Mật khẩu mặc định: `hackathon#1`.
> **3.3** Dashboard today phải có sẵn view lọc theo từng Sales: chọn một Sales thì các con số và danh sách trên màn hình chỉ tính dữ liệu thuộc người đó.

## Điều AI nói thẳng ngay từ đầu, trước khi bàn giải pháp

**Việc nặng nhất của cả hai yêu cầu không phải cái nút, cũng không phải cái filter — mà là seed.** Hệ thống lúc đó có đúng **một** user sales và cả 5 công ty đều gán về người đó. Filter 3.3 làm xong mà không chia lại seed thì demo ra màn trống: chọn Sales A thấy tất cả, chọn Sales B thấy 0. Câu chốt của phiên: *giá trị demo của 3.3 được quyết định bởi cách chia dữ liệu, không phải bởi cái filter.*

Tin tốt đi kèm: `companies.ownerId` đã có sẵn và mọi query của màn Tổng quan đều đã `innerJoin(companies)` — nên **3.3 không cần migration nào**, chỉ thêm một điều kiện WHERE.

## Bốn câu hỏi, và người quyết định chọn gì

### 1. "Không cần mật khẩu" nên hiện thực thế nào?

**AI khuyến nghị: đừng xây cơ chế đăng nhập không mật khẩu — xây cái nút tự gõ mật khẩu hộ.** Nút gọi đúng `POST /auth/login` với mật khẩu BTC đã công bố.

Phương án bị loại: `POST /auth/demo-login {userId}` bỏ qua mật khẩu. Đó là auth-bypass thật trong code, phải gate bằng env, phải test riêng, và là đúng loại lỗ hổng vòng 2 hỏi "vì sao cái này an toàn" sẽ khó bảo vệ — trong khi kết quả người dùng thấy y hệt phương án được chọn.

Đánh đổi đã nhận: mật khẩu nằm trong bundle JS. Chấp nhận vì **BTC đã phát công khai mật khẩu này**, không có bí mật nào bị lộ thêm.

**Người quyết định chốt thêm hình thức:** hai tab — tab "Mật khẩu" (form cũ, giữ nguyên mục 7 đề bài) và tab "Tài khoản demo". Gỡ sau hackathon = xoá một tab.

### 2. Danh sách tài khoản cho các nút lấy từ đâu?

Đây là chỗ **AI cảnh báo trước, không phải sau**: [`auth-service.ts`](../../apps/api/src/auth/auth-service.ts) cố tình trả **cùng một lỗi** cho "email không tồn tại" và "sai mật khẩu", để màn login không thành oracle dò email nào có trong hệ thống. Thêm một endpoint public `GET /demo-users` liệt kê email là **tự tay phá tính chất đó**.

Chọn: **shared constant trong `packages/contracts`** — seed, trang login và dropdown admin cùng import. DB và UI không thể lệch nhau, không endpoint mới, tính chất anti-oracle còn nguyên. Đổi theo danh sách BTC phát chỉ sửa một file.

### 3. Sales thấy dữ liệu của ai trên dashboard?

BTC chỉ nói "có filter". Câu hỏi AI đặt ra mà đề bài không trả lời: **role sales không có filter thì thấy gì?**

Hai cách đọc: (a) sales thấy tất cả, chỉ admin có filter — ít thay đổi nhất; (b) sales mặc định thấy **dữ liệu của chính mình**.

**AI khuyến nghị (b), người quyết định chọn (b)** — vì dashboard là màn trả lời "sáng nay TÔI phải làm gì", scope về "tôi" mới đúng nghiệp vụ.

**Ranh giới quan trọng nhất của cả phiên:** đây là **mặc định của VIEW, không phải authorization**. Ontology mục 1 đã chốt hệ thống này *không làm per-owner authorization*; các màn khác (công ty, cơ hội) vẫn thấy hết. Ai trong đội trượt sang làm RBAC "cho chắc" là vừa scope creep sau freeze vừa mâu thuẫn quyết định đã ghi.

Hệ quả kỹ thuật đẹp: API chỉ cần **một** tham số `ownerId`. Sales → server ép `ownerId = actor.userId`; admin → tuỳ chọn. Một đường code, hai hành vi.

Câu hỏi kiểm tra ở vòng 2: *sales không xem được view của người khác — vậy đây chẳng phải phân quyền là gì?* Trả lời được bằng "các màn khác vẫn thấy hết, chỉ dashboard scope" hoặc chưa hiểu quyết định này.

### 4. Chiều sở hữu chạy qua đâu?

`companies.ownerId`, opportunity thừa kế qua company. Quan hệ đọc lên thành câu: *Company **thuộc về** Sales; Opportunity **thuộc về** Company*.

Phương án bị loại: thêm cột owner cho `opportunities`. Cần migration ngày chốt, tạo được trạng thái mâu thuẫn "deal của A nằm trong company của B", và `auto-next-step-service` vốn đã route thông báo theo owner của company — thêm chiều thứ hai là tự tạo hai nguồn sự thật.

## Người quyết định hỏi ngược: dashboard nên show thêm gì?

Câu hỏi nguyên văn: *cần show thêm thông tin nào để sale take care sát sao công việc của mình và admin view được tiến độ của các sale?*

**AI trả lời theo nguyên tắc: mỗi khối phải trả lời một hành động, không thêm số để trang trí.**

Cho Sales — khoảng trống lớn nhất là màn cũ chỉ show việc **đã quá hạn**, tức chỉ báo khi đã muộn:
1. **Đến hạn hôm nay → +3 ngày.** Quá hạn là chữa cháy; đến-hạn-hôm-nay mới là điều hành công việc. Cửa sổ 3 ngày để sáng thứ Sáu còn thấy việc thứ Hai; 7 ngày thì danh sách dài, loãng tính khẩn cấp.
2. **Cơ hội mở KHÔNG có Việc tiếp theo** — luật 5 gọi next step là nhịp tim, deal thiếu next step là deal ngừng tim, nguy hơn deal trễ hạn. `on_hold` đứng ngoài: dừng có chủ đích không phải ngừng tim.
3. Gợi ý đang chờ tôi duyệt (vùng 2 chờ vô thời hạn — không ai nhắc thì chờ mãi).

Cho Admin — **bảng mỗi-Sales-một-dòng**, thay vì bắt bấm filter N lần để so sánh. Hai cột quan trọng nhất là **việc quá hạn** và **thiếu next step**: chúng phản ánh *hành vi*, không phải *kết quả* — đúng thứ rubric thưởng.

**AI từ chối một thứ:** không đưa metric chất lượng AI (auto-accept rate, error-detection rate) lên dashboard — đã có ở màn Quản trị, một con số hai chỗ là hai chỗ để lệch nhau.

Bị cắt có chủ đích (YAGNI ngày freeze): deal lâu không hoạt động, biểu đồ xu hướng, feed hoạt động.

## AI sai ở đâu

Bản plan đầu **không lường** việc `t1-crm-without-ai.spec.ts` đang assert khối "lý do thua" bằng dữ liệu mà sau khi chia 2/2/1 sẽ **thuộc về sales khác**. Phát hiện khi rà toàn bộ e2e trước lúc đổi seed, xử lý trước khi code: bước đó chuyển sang assert theo vai, hai nửa khối lý-do-thua chuyển sang spec mới kiểm bằng admin.

Lỗi thứ hai, nhỏ hơn, lộ ra lúc chạy e2e: khối "Cơ hội thiếu Việc tiếp theo" render cả tên giai đoạn, làm hai assert cũ (`Thương lượng`, tên ngành) khớp hai phần tử. Sửa bằng cách scope locator vào đúng bảng — không nới lỏng assert.

**Hai lỗi lớn hơn do vòng review đối kháng bắt được, khi toàn bộ 483 unit + 47 e2e đang xanh** — đây là phần đáng đọc nhất của log này, vì nó cho thấy test xanh không đồng nghĩa đúng:

1. `unassignedCompanies` đếm `owner_id IS NULL`. Nhưng tạo công ty đóng dấu người tạo làm owner, và route tạo công ty **chỉ có `JwtGuard`, không chặn admin**. Giám khảo bấm nút demo "Quản trị" rồi tạo công ty (đúng luồng T-1) → công ty đó không thuộc dòng per-sales nào, không thuộc view sales nào, mà dòng "Không gồm N công ty…" vẫn đọc 0. Bảng per-sales không cộng ra tổng của admin và **không có gì trên màn hình nói vì sao**. Đây đúng là khoảng lặng mà chính con số đó được thêm vào để ngăn.
   Sửa: đếm công ty **không sales nào sở hữu** (`owner_id IS NULL OR owner_id NOT IN (sales)`), nhãn đổi thành "chưa gán cho Sales nào".
2. `next_step_text` và `next_step_due_date` **null độc lập** — không có CHECK constraint nào buộc chúng đi cùng nhau. Một cơ hội mang hạn cũ mà trống việc (hạn còn sót sau khi xoá text) lọt vào **cả** khối "quá hạn" **lẫn** khối "thiếu Việc tiếp theo", và làm tăng **cả hai** cột trên một dòng của bảng admin. Một deal đọc thành hai vấn đề — trong khi ba chỗ trong code, kể cả empty state người dùng đọc, đều khẳng định hai khối rời nhau.
   Sửa: `next_step_text IS NOT NULL` vào truy vấn quá hạn, đến-hạn, và cột đếm quá hạn. Không đụng `isOverdue()` — bảng cơ hội dùng chung hàm đó.

**Vì sao bộ test không bắt được:** seed không có dữ liệu ở hai hình dạng đó (không công ty nào của admin, không cơ hội nào có hạn mà trống việc). Test chỉ chứng minh được điều gì có dữ liệu để chứng minh. Đã bổ sung test cho cả hai, và test thứ hai khoá bất biến mạnh hơn dạng "bằng 0": **`overdueCount` của bảng per-sales phải bằng đúng độ dài danh sách quá hạn của chính sales đó** — số và danh sách là hai cách vẽ của một định nghĩa.

Ghi nhận thêm cho vòng 2: bản assert đầu tiên của test thứ hai viết `expect(overdueCount).toBe(0)` và **fail** — vì sales1 đã có một deal quá hạn hợp lệ từ test trước. Assert sai chứ không phải code sai; sửa assert thành bất biến khớp-danh-sách nói trên, mạnh hơn cái ban đầu.

## Đội đã verify bằng cách nào

- **8 test HTTP** trong `overview-owner-scoping.test.ts`, chạy qua HTTP chứ không qua service, **vì luật ép-scope nằm ở controller** (ADR-0004 giữ service không đọc ambient actor) — test ở tầng service sẽ không chứng minh được gì về luật đó.
- Test nặng nhất: sales1 truyền `?ownerId=` của sales2 → so sánh **deep-equal** response với response không tham số. Không phải kiểm "có lỗi", mà kiểm "tham số không có tác dụng nào".
- Cửa sổ đến-hạn kiểm bằng ngày **tương đối** (hôm nay +2 / +5 / −1), không hardcode ngày — test hardcode ngày sẽ thối sau demo.
- 5 test overview cũ chạy lại **không sửa một assertion nào** → hành vi không-lọc giữ nguyên.
- Toàn bộ: unit 483/483, e2e 47/47 trên stack production `:8080`.

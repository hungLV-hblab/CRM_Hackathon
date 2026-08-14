# ADR-0032 — Trạng thái nút tắt AI đi qua endpoint riêng cho mọi vai, banner đặt toàn cục

| | |
| --- | --- |
| **Ngày** | 2026-08-14 10:12 |
| **Giai đoạn** | Design (nhóm 6, T-9) |
| **Trạng thái** | Chấp nhận — **kiểm bằng đọc mã nguồn ba file, số dòng ghi ở mục verify; đóng bằng T-9 trong P8** |
| **Người quyết định** | HungLV |
| **Prompt log** | phiên phản biện phase 8 ngày 14/08 10:12 — [báo cáo](../../plans/reports/from-brainstorm-to-planner-260814-1012-phase-08-nhom-6-bang-dieu-khien-va-bo-nghiem-thu-report.md) |

## Bối cảnh

T-9 đòi: tắt AI giữa lúc vòng quét chạy → không sinh gì nữa, **và "Sales thấy banner"**. [Ontology mục 6](../ontology.md) cũng viết "Sales thấy dòng thông báo AI đang tắt".

Nhưng `GET /settings` — đường duy nhất đọc `ai_enabled` từ web — là `@Roles('admin')`, và **đó là điểm nghiệm thu số 2 của plan skeleton** ("Sales 403 trên một endpoint admin-only", đã ghi trong [báo cáo nghiệm thu 12/08](../../plans/reports/walking-skeleton-acceptance-260812-2210-sau-diem-nghiem-thu-va-hai-loi-that-report.md)). Sales — người dùng sản phẩm cả ngày — **không có đường nào biết AI đang tắt**.

Phase 8 bản cũ liệt kê `ai-disabled-banner.tsx` trong bảng Files mà không ai hỏi banner lấy dữ liệu ở đâu.

## Phương án đã cân nhắc

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| **A. `GET /settings/ai-status` — chỉ `JwtGuard`, trả đúng `{ aiEnabled }`** | Giữ nguyên `GET /settings` là admin-only ⇒ **điểm nghiệm thu số 2 không suy chuyển**. Không lộ `watch_cycle_seconds` (tham số vận hành, Sales không cần). Do `RolesGuard` cho qua khi handler không có `@Roles`, route **nằm luôn trong `SettingsController`** ⇒ 0 module mới | Hai route đọc cùng một bảng, người đọc code phải biết vì sao có hai | ✅ **Chọn** |
| B. Bỏ `@Roles('admin')` khỏi `GET /settings` | Rẻ nhất, 1 dòng xoá | **Phá đúng điểm nghiệm thu số 2** và kéo theo sửa `login.test.ts:77`. Đổi một khẳng định đã nộp lấy 15 dòng code — sai hướng vào ngày freeze. Còn để lộ `watch_cycle_seconds` cho mọi vai mà không ai cần | ❌ Loại |
| C. Suy trạng thái AI từ nhật ký vòng quét (`GET /watch-cycle-runs`, đọc `skipped_reason='ai_disabled'`) | Không thêm endpoint nào | Suy gián tiếp một cờ **có sẵn dạng boolean**, và trễ tới một chu kỳ (60s mặc định) ⇒ banner nói dối đúng lúc nguy hiểm nhất. Nhật ký cũng là màn admin | ❌ Loại |
| D. Banner đặt riêng trên 4 màn có output AI (hàng đợi · công ty · cơ hội · đang theo dõi) | Đúng chữ trong comment của `ai-status-pill.tsx`; không chạm layout dùng chung | Sót một màn là **T-9 đỏ vì chỗ sót, không vì sản phẩm** — và ngày mai thêm màn thứ 5 thì không ai nhớ. Bốn chỗ phải sửa thay vì một | ❌ Loại (chọn banner toàn cục) |

## Quyết định

Chọn **A**, banner đặt **toàn cục** trong `apps/web/src/app/(app)/layout.tsx`.

Tiêu chí so là **"đổi lấy cái gì"**: B rẻ hơn A đúng 15 dòng code nhưng trả bằng một điểm nghiệm thu đã nộp; C không thêm dòng nào nhưng trả bằng độ trễ một chu kỳ trên đúng thông tin mà độ trễ làm hỏng. Giữa A và D, tiêu chí là **"quên thì hỏng ở đâu"**: một chỗ duy nhất thì không quên được, bốn chỗ thì lỗi trông giống lỗi sản phẩm.

Banner giữ nguyên luật hiển thị của `ai-status-pill`: **đọc được → hiện; không đọc được → không hiện gì**. Không "không rõ", không mặc định "đang bật". Và chỉ render khi `aiEnabled === false` — banner thường trực nói "AI đang bật" là nhiễu, không phải thông tin.

Màu **`warning`**, không `machine`. Đây là trạng thái của hệ thống, không phải nội dung máy sinh ra; dùng tím là phá luật "tím = máy sinh ra" của [design-guidelines](../design-guidelines.md).

## Hệ quả

- Kéo theo: `SettingsController` có hai route đọc với hai mức quyền. Comment tại chỗ phải nói rõ vì sao, không thì người sau sẽ "dọn dẹp" bằng cách gộp lại và phá điểm nghiệm thu số 2.
- Kéo theo: T-9 phải chứng minh bằng **context trình duyệt thứ hai đăng nhập vai Sales**, không phải bằng tài khoản admin. Đây là điều kiện nghiệm thu mới, đã thêm vào phase 8.
- Kéo theo: banner ở layout dùng chung ⇒ chạm file thuộc [plan UI](../../plans/260814-0056-nang-cap-ui-shadcn-shell-tour/plan.md). Sửa nhỏ, pull trước khi push.
- Đánh đổi chấp nhận: `ai-status-pill` vẫn chỉ hiện cho admin và vẫn gọi `GET /settings`. Không gộp pill vào endpoint mới — pill hiển thị **cả hai** tham số cho admin, banner chỉ cần một cờ cho mọi người. Gộp lại là làm cả hai kém đi.
- Sẽ phải xem lại nếu: xuất hiện tham số thứ ba mà Sales cần thấy. Khi đó `/settings/ai-status` đổi tên thành một endpoint "trạng thái hệ thống cho mọi vai", không phải nới `/settings`.

## AI đã tham gia thế nào

- Vai trò AI: phát hiện lỗ hổng + sinh bốn phương án + phân tích trade-off.
- **AI sai ở đâu:** phase file 13/08 (AI viết) liệt kê `apps/web/src/components/ai-disabled-banner.tsx` trong bảng Files như một việc đã rõ đường đi, trong khi **không có nguồn dữ liệu nào cho nó**. Nếu code theo bảng đó thì banner hoặc không bao giờ hiện, hoặc phải hard-code — cả hai đều làm T-9 trông xanh mà thực chất hỏng.
- **AI làm đúng ở đâu, và đó là thứ cứu tình huống:** comment trong `ai-status-pill.tsx` (viết ở plan UI) đã tự ghi *"This pill is a convenience, not a guarantee. Acceptance check 9 is served by the banner on the screens that generate AI output, which does not depend on this component at all"* và ghi rõ Sales nhận 403. **Chính comment đó là chỗ lỗ hổng lộ ra** khi phiên này đọc lại repo. Bài học mang sang: comment giải thích *vì sao không làm* có giá trị bắt lỗi cao hơn comment mô tả *đang làm gì*.

## Đội đã verify bằng cách nào

1. **Đọc ba file, ghi số dòng, dựng lại đường đi của dữ liệu:** `settings.controller.ts:18` (`@Roles('admin')` trên `read()`) → `ai-status-pill.tsx:31` (`enabled: isAdmin`, request **không bao giờ được bắn** cho Sales) → kết luận: hiện không tồn tại đường nào để giao diện Sales biết `ai_enabled`. Đây là lần theo mã nguồn, không phải "thấy hợp lý".
2. **Kiểm điều kiện làm phương án A rẻ**, vì cả phương án phụ thuộc vào nó: `roles.guard.ts:33` — `if (!allowedRoles?.length) return true` ⇒ handler không có `@Roles` thì đi qua với mỗi `JwtGuard`. Nhờ đó route mới **không cần module mới**, và đó là điều đáng kiểm nhất: P7 vừa mất một lần sập container vì module khai báo controller có guard mà quên `imports: [AuthModule]`, triệu chứng là 502 ở trang đăng nhập **trong khi toàn bộ test đơn vị vẫn xanh**.
3. **Kiểm rủi ro T-9 làm hỏng spec khác trước khi nhận thiết kế:** `playwright.config.ts:20-22` là `fullyParallel: false` + `workers: 1` ⇒ tắt AI toàn cục an toàn miễn `afterAll` bật lại — đúng khuôn T-1 đã chạy xanh 7 spec liên tiếp.
4. **Nợ đo, đóng trong P8:** T-9 trên stack production sau Caddy, với một context Sales quan sát banner. Chưa chạy T-9 thì ADR này ở trạng thái "chấp nhận, chưa đo".

## Rollback

Bỏ banner là xoá một component + một dòng trong layout; endpoint thừa không hại ai. ~5 phút. Nhưng **không được rollback thành "không có banner"** — T-9 chấm trực tiếp mục này. Đường lùi duy nhất còn giữ điểm là phương án D (banner trên từng màn), tốn thêm ~20 phút và mang nguyên rủi ro sót màn.

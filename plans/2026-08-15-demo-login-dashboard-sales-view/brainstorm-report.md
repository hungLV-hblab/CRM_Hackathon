# Brainstorm — Demo login 2 tab + Dashboard theo role Sales/Admin

- Ngày: 2026-08-15 (ngày hardening, vòng 1 chốt 15:00 — scope tối thiểu tuyệt đối)
- Nguồn yêu cầu: BTC bổ sung mục 3.2 (nút đăng nhập demo) và 3.3 (dashboard lọc theo Sales)
- Trạng thái: đã chốt thiết kế, chờ plan

## 1. Bài toán

1. Màn đăng nhập cần cách vào thẳng bằng từng tài khoản đã phát (1 admin + N sales), không gõ mật khẩu, phục vụ chấm/demo. Luồng mật khẩu theo mục 7 đề bài giữ nguyên. Mật khẩu mặc định `hackathon#1`.
2. Dashboard (màn Tổng quan `tong-quan` — được coi là "dashboard today" của BTC) phải lọc được theo từng Sales. Bổ sung theo thảo luận: sales tự thấy dữ liệu của mình, admin thấy tất cả + filter + bảng tiến độ từng sales.

## 2. Quyết định đã chốt (kèm phương án bị loại)

| # | Quyết định | Phương án bị loại | Lý do loại |
| --- | --- | --- | --- |
| 1 | Nút demo = tự gõ hộ mật khẩu, gọi `POST /auth/login` hiện có với `hackathon#1` | Endpoint `POST /auth/demo-login` bỏ qua mật khẩu | Auth-bypass thật trong code, phải gate env, khó bảo vệ ở vòng 2; phương án chọn được cùng kết quả với 0 surface mới |
| 2 | Màn login 2 tab: "Đăng nhập" (form cũ, không đổi) + "Tài khoản demo" (danh sách nút). Segmented control cục bộ trong trang, không xây component Tabs chung | Component Tabs tổng quát trong `components/ui/` | YAGNI — chỉ một chỗ dùng |
| 3 | Danh sách tài khoản demo = shared constant trong `packages/contracts`, seed + login page + dropdown admin cùng import | Endpoint public `GET /demo-users` | Tự phá tính chất anti-oracle của `auth-service` (lỗi login cố tình không phân biệt email tồn tại/sai mật khẩu); constant giữ DB–UI không lệch |
| 4 | Chiều sở hữu: `companies.ownerId` (có sẵn), opportunity thừa kế qua company. **Không migration** | Thêm cột owner cho opportunities | YAGNI; tạo mâu thuẫn "opportunity của A trong company của B"; auto-next-step đã route thông báo theo company owner |
| 5 | Sales tự scope (server ép `ownerId = actor.userId`), không filter; admin thấy tất cả + filter. Là **mặc định của view, không phải authorization** (ontology mục 1 giữ nguyên: không per-owner authorization) | Sales cũng có filter xem người khác / làm RBAC | Sai tinh thần "sáng nay TÔI phải làm gì"; RBAC là scope creep vi phạm freeze và mâu thuẫn ontology đã chốt |
| 6 | Một endpoint duy nhất: `GET /overview?ownerId=` mở rộng `OverviewDto` — thêm `dueSoon`, `missingNextStep`; field `perSales` chỉ có giá trị khi actor là admin | Endpoint riêng `GET /overview/per-sales` | Thêm surface + hook + loading state thứ hai trên cùng màn; service đã gom query bằng `Promise.all`, thêm cùng khuôn rẻ hơn |
| 7 | Seed: **3 sales + 1 admin**, chia 5 công ty 2/2/1, hash `hackathon#1` | 5 sales (mỗi người 1 công ty — filter demo nghèo) · chờ danh sách BTC (block sát deadline) | Email/tên là constant, đổi theo danh sách BTC sau chỉ sửa 1 chỗ |
| 8 | Cửa sổ "đến hạn sắp tới" = hôm nay + 3 ngày | Chỉ hôm nay (thứ Sáu không thấy việc thứ Hai) · +7 ngày (loãng khẩn cấp) | Cân giữa nghĩa "today" và nhìn trước cuối tuần |

## 3. Thiết kế chốt

### 3.1 Login 2 tab
- Tab 1 "Đăng nhập": form email/mật khẩu hiện tại, không đổi logic.
- Tab 2 "Tài khoản demo": nút theo từng account trong `DEMO_ACCOUNTS` (contracts) — bấm gọi `api.login(email, 'hackathon#1')`, sau đó `router.push('/cong-ty')` + `refresh()` như luồng cũ.
- Không endpoint mới, cookie/JWT/middleware nguyên vẹn.

### 3.2 Dashboard theo role
- `GET /overview?ownerId=`:
  - actor sales → server bỏ qua param, ép `ownerId = actor.userId`;
  - actor admin → param tuỳ chọn, trống = tất cả.
- Filter WHERE `companies.ownerId = ?` thread qua các query có sẵn (đều đã join `companies`).
- `OverviewDto` thêm:
  - `dueSoon`: việc tiếp theo đến hạn hôm nay→+3 ngày (loại quá hạn — đã có khối riêng);
  - `missingNextStep`: cơ hội mở không có Việc tiếp theo ("deal ngừng tim", luật 5);
  - `unassignedCompanies`: số công ty `ownerId IS NULL` bị loại khỏi con số khi lọc (luật 4 — nói rõ không gồm gì);
  - `perSales?`: mỗi-sales-một-dòng {pipeline đang chạy, cơ hội mở, việc quá hạn, thiếu next step, proposal chờ duyệt + tuổi cũ nhất} — chỉ khi admin.
- UI `tong-quan`: sales thấy dòng "Đang xem: dữ liệu của bạn"; admin thấy filter (pattern `filter-bar.tsx`) + bảng per-sales. Khối proposal dính máy → màu tím theo design-guidelines. Không đổi triết lý màn: mọi con số nói rõ nó không gồm cái gì.
- Metric chất lượng AI (auto-accept…) ở màn Quản trị, KHÔNG nhân đôi sang dashboard.

### 3.3 Seed + docs
- `SEED_USERS`: 1 admin + 3 sales, hash `hackathon#1` (thay hash `sales123` hiện tại), tên/email placeholder VN — đổi theo danh sách BTC khi có.
- Chia 5 công ty seed 2/2/1; đảm bảo mỗi sales có ≥1 cơ hội quá hạn hoặc đến hạn để demo luật 5.
- Cập nhật README (đang ghi `sales123` ở dòng 87) + hướng dẫn demo.

## 4. Điểm chạm (touchpoints)

| Vùng | File |
| --- | --- |
| Contracts | `packages/contracts/src/dto/overview.ts` (DTO mở rộng) · `dto/company.ts` hoặc file mới cho `DEMO_ACCOUNTS` + schema query ownerId |
| DB seed | `packages/db/src/seed/seed-data.ts` (users, ownerId 2/2/1) |
| API | `apps/api/src/domain/overview/overview-service.ts` + `overview.controller.ts` (param + role logic + 3 query mới). Auth **không đổi** |
| Web | `apps/web/src/app/dang-nhap/page.tsx` (2 tab) · `apps/web/src/app/(app)/tong-quan/page.tsx` (khối mới, filter, bảng per-sales) |
| Docs | README mật khẩu · 1 ADR gộp cho các quyết định trên |

## 5. Kiểm chứng / Definition of Done

- Test API: login từng account seed với `hackathon#1`; overview có `ownerId` → mọi con số chỉ gồm data owner đó + `unassignedCompanies` đúng; actor sales bị ép self-scope kể cả khi truyền `ownerId` người khác; `perSales` vắng mặt với actor sales.
- E2E: tab demo → bấm 1 sales → vào app đúng identity; admin chọn filter → con số đổi.
- Checklist design-guidelines mục 7 cho phần UI (không class màu thô, vùng chạm ≥44px).
- Không chạm 4 vùng tự chủ AI — không cần test T-x mới.

## 6. Rủi ro

- Sau feature freeze — nhưng là yêu cầu BTC bổ sung; giữ scope đúng bảng trên, không mở rộng.
- Đổi hành vi màn Tổng quan với role sales (từ thấy-tất-cả sang tự-scope) — đã được chốt tường minh; nếu BGK hỏi, câu trả lời: view mặc định, không phải phân quyền.
- Danh sách BTC chưa có — placeholder trong constant, đổi 1 chỗ khi có.

## 7. Bước tiếp theo

1. `/ck:plan` với báo cáo này làm đầu vào.
2. Ghi ADR gộp (có thể là một phase của plan).
3. Implement theo thứ tự: seed → login 2 tab → API overview → UI dashboard → bảng per-sales (nếu còn giờ trước 15:00).

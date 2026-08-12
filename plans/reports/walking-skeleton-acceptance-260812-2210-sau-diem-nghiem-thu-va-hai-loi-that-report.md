# Nghiệm thu walking skeleton — 6/6 điểm đạt, 2 lỗi thật bị bắt

**Ngày:** 12/08/2026 22:10 · **Plan:** [260812-1912-base-project-walking-skeleton](../260812-1912-base-project-walking-skeleton/plan.md) · **Chạy trên:** stack compose thật (`pnpm start`), Windows 11 + Docker Desktop

## Kết quả 6 điểm

| # | Kiểm chứng | Kết quả | Bằng chứng |
| --- | --- | --- | --- |
| 1 | `down -v` → `pnpm start` → `:8080` lên, không dev server | ✅ | `GET /` → 307 → `/dang-nhap`; `/dang-nhap` → 200; CSS `/_next/static/css/a65b4d70780b68c3.css` → 200. Grep toàn bộ log: **không có** `hot reload`, `webpack-hmr`, `nest start --watch`, `next dev` |
| 2 | Login 2 vai, cookie httpOnly, RolesGuard phân biệt | ✅ | `sales@` 200 · `admin@` 200 · sai mật khẩu 401 · cookie có cờ `HttpOnly`, `path=/` · `GET /api/settings`: Sales **403**, Admin **200** `{"aiEnabled":true,"watchCycleSeconds":60}` |
| 3 | Tạo công ty qua UI → sống sót restart | ✅ | `Cty Kiem Thu` (do e2e tạo qua giao diện) còn nguyên sau `docker compose restart` |
| 4 | Worker 60s; đổi nhịp bằng CSDL, không restart | ✅ | 60s: `15:03:21 · 15:04:21 · 15:05:21`. UPDATE `='10'` lúc `15:05:38` → `15:06:21` (còn lịch cũ) rồi `:31 :41 :51 15:07:01`. **Không** thêm dòng `Starting Nest application` |
| 5 | `pnpm test` xanh đủ 3 tầng, có T-10 mini | ✅ | **52 unit/integration** (contracts 22 · db 11 · api 19) + **3 e2e** = 55, một lệnh `pnpm test` |
| 6 | `pnpm seed` lần 2 → đúng trạng thái đầu | ✅ | Hai lần seed cho cùng chuỗi trạng thái: `2/4/3/2/2/0/0 \| md5=2dd301579b48842b49fd7e7824c1d2de \| ai_enabled=true,watch_cycle_seconds=60`. Xoá sạch cả `Cty Kiem Thu` lẫn giá trị `10` vừa sửa tay |

## Hai lỗi thật, cả hai chỉ lộ khi chạy — không lộ khi đọc

### 1. `timer.unref()` biến vòng quét thành vòng restart

`WatchCycleService.scheduleNextTick` gọi `this.timer.unref?.()`. Trong tiến trình `api` vô hại vì HTTP server giữ event loop sống. Trong **worker** thì timer là handle duy nhất → Node thoát ngay sau tick đầu → Docker restart → lặp lại.

Đo được: **~11s một vòng restart** thay vì 60s một tick.

Nguy ở chỗ log trông *gần đúng*: vẫn đều đặn `WatchCycleRun`. Chỉ khác là mỗi dòng thuộc một tiến trình khác nhau, nhìn ra được nhờ dòng `Starting Nest application` xen giữa. Đếm số dòng log là xanh nhầm.

Sửa: bỏ `unref()`. Dọn tài nguyên vẫn đúng nhờ `onModuleDestroy` — đã có test số 6 giữ, nên bỏ `unref()` không làm treo test nào.

### 2. ADR-0004 tuyên bố hai lớp, thực tế `updateStage` chỉ có một

Phép đo đột biến (nợ (a) của plan): xoá dòng kiểm `actor` trong `updateStage` rồi chạy lại T-10 mini.

| Lần đo | Mã nguồn | Kết quả |
| --- | --- | --- |
| 1 | ghi cứng `this.dbApp` | Lệnh **chạy lọt**, không ném lỗi, `stage` = `won`. Tầng CSDL không chặn gì |
| 2 | chọn pool theo `actor` | `permission denied for table opportunities` |

Nguyên nhân: quyền theo cột chỉ cắn được role **thật sự phát câu lệnh**. Ghi cứng `dbApp` nghĩa là lệnh của `actor=system` vẫn đi bằng `crm_app` — role có quyền đổi `stage`. Lớp thứ hai của ADR-0010 chưa bao giờ được chạm tới, **mà bộ test vẫn xanh**.

Sửa: `updateStage` chọn pool theo `actor` giống `updateNextStep`. Ghi vào [ADR-0004](../../docs/decisions/0004-chan-ranh-gioi-o-tang-domain-va-tang-csdl.md) mục verify.

Luật rút ra, áp cho mọi đường ghi nhóm 4/5 thêm sau này: **chọn pool theo `actor` là một phần của cơ chế chặn, không phải chi tiết hiện thực.** Hàm nào nhận `actor` mà ghi cứng một pool thì hàm đó chỉ có một lớp — và phép đo đột biến là cách duy nhất phát hiện.

## Thay đổi ngoài dự kiến của plan

| Thay đổi | Lý do |
| --- | --- |
| `pnpm-lock.yaml` **bỏ khỏi** `.gitignore` | Image build bằng `--frozen-lockfile`; giám khảo clone repo phải nhận đúng cây phụ thuộc đã test |
| Thêm `--env-file .env` vào script compose | Compose đọc `.env` cạnh **file compose** (`infra/`), không phải gốc repo → thiếu biến, `pnpm start` gãy ngay |
| Thêm service `migrate` chạy một lần | Tránh api và worker cùng chạy migration; `service_completed_successfully` khử hẳn tranh chấp thay vì thu hẹp |
| Thêm script `pnpm stop` · `pnpm reset` | `down -v` là thao tác bắt buộc khi volume cũ thiếu 3 role, cần một lệnh gọn để ghi vào README |
| shadcn/ui → primitives tự viết | Giữ nguyên đường import `@/components/ui/*`, đổi sang shadcn thật sau là thay file. Tránh `shadcn init` tương tác + xung đột token Tailwind v4 |
| e2e không có `webServer` | Chỉ chấm stack production sau Caddy. Cho Playwright tự bật `next dev` là xanh trên môi trường không ai ship |

## Còn nợ

- **Chưa commit lần nào** — `apps/`, `packages/`, `infra/` còn untracked. Đã kiểm `git check-ignore`: không bị `.gitignore` chặn (các dòng `/apps/*/node_modules`, `/apps/*/dist` chỉ chặn thư mục build).
- `next build` **trên Windows** gãy ở bước tạo symlink của `standalone` (`EPERM`) — cần Developer Mode hoặc quyền admin. Không ảnh hưởng sản phẩm: bước này chạy trong Docker (Linux) và đã xanh. Chỉ ảnh hưởng ai muốn build web ngay trên máy Windows.
- Phép đo đột biến mới chạy cho `updateStage` và `updateNextStep`. Mỗi đường ghi mới phải chạy lại, không suy diễn.
- Q-3 (bản chụp HTML hay text) vẫn chưa có câu trả lời của BTC → chặn nhóm 2, không chặn skeleton.

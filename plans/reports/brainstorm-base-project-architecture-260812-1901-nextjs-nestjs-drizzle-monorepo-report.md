# Brainstorm — Base project: Next.js + NestJS + Drizzle + Postgres

| | |
| --- | --- |
| **Ngày** | 2026-08-12 19:01 |
| **Giai đoạn** | System Design (hạ tầng dự án, trước khi code tính năng) |
| **Trạng thái** | Đã duyệt — chờ lập kế hoạch thực thi |
| **Người quyết định** | HungLV |
| **Đầu vào** | [Specs BTC](../../docs/hackathon-spec-ai-native-crm.md) mục 6+7 · [ontology.md](../../docs/ontology.md) · [ADR-0004](../../docs/decisions/0004-chan-ranh-gioi-o-tang-domain-va-tang-csdl.md) |
| **ADR sinh ra** | [0010](../../docs/decisions/0010-chan-tang-csdl-bang-hai-role-va-quyen-theo-cot.md) (đã verify thực nghiệm) · [0011](../../docs/decisions/0011-worker-cung-image-va-vong-quet-tu-hen-nhip.md) (verify còn nợ) |

## 1. Vấn đề

Repo hiện chưa có dòng code nào. Cần base project dựng xong trong **≤4h** để 3 người code song song 6 nhóm tính năng, còn ~48h tới feature freeze (tối 14/08).

Base project không tự do thiết kế — bị ràng buộc bởi **spec mục 7 (nộp bài)** và **ADR-0004 (chặn 2 lớp)**:

| Ràng buộc | Nguồn | Hệ quả lên hạ tầng |
| --- | --- | --- |
| Production build, không dev server / hot reload / debug mode | spec 7.3 | compose phải chạy bản build, không phải `next dev` |
| Khởi động 1 lệnh · test 1 lệnh · seed 1 lệnh | spec 7.3–7.5 | scripts gốc workspace |
| Seed chạy lại về đúng trạng thái đầu | spec 7.5, I-14 | seed idempotent, không append |
| Config ở env, **nhưng** `ai_enabled` + `watch_cycle_seconds` giá trị hiệu lực nằm ở CSDL | spec 7.3 + ontology 3.4 | env là giá trị khởi tạo; vòng quét đọc DB mỗi nhịp |
| Đăng nhập thật 2 tài khoản Sales/Admin | spec 7.3 | auth thật, không hardcode |
| Test unit + integration + e2e, 1 lệnh | spec mục 6, rubric Testing mức 4 | 3 tầng ngay từ skeleton |
| `actor=system` bị chặn ở **cả** tầng domain lẫn tầng CSDL | ADR-0004 | mọi đường ghi mang actor từ ngày 1 |

**Rủi ro chính:** ADR-0004 nói thẳng — "phải truyền `actor` qua mọi đường ghi ngay từ đầu, sửa muộn thì đắt". Base project sai chỗ này = viết lại mọi service lúc nửa đêm 14/08.

## 2. Yêu cầu chính xác (đã chốt)

- **Đầu ra:** monorepo pnpm chạy được, walking skeleton 1 lát cắt dọc (mục 7).
- **Nghiệm thu:** 6 điểm kiểm chứng ở mục 7.
- **Ngoài phạm vi vòng này:** mọi tính năng nhóm 1–6, gọi LLM thật, UI đẹp, CI/CD.
- **Không thương lượng:** stack đã tuyên bố (Next.js/NestJS/Drizzle/Postgres/pnpm/compose); tên trong ontology mục 3; enum ontology 3.5.
- **Điểm chạm:** `docs/ontology.md` (nguồn sự thật đặt tên) · `docs/decisions/` (ADR mới) · `CLAUDE.md` mục 6 (điền stack + lệnh chuẩn, hiện là TBD) · `README.md` bảng lệnh (TBD).

## 3. Phương án layout đã cân nhắc

Tiêu chí: *(1)* chi phí giờ · *(2)* giữ được câu chuyện "chặn ngoài giao diện" cho T-10 · *(3)* rủi ro nhân đôi code giữa api và worker.

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| **A.** 3 package: `apps/web`, `apps/api` (APP_ROLE=api\|worker), `packages/db`, `packages/contracts` | ~3h. Worker cùng codebase → không nhân đôi domain. Service class thường → T-10 gọi thẳng, không boot HTTP | Api và worker chung repo, cần kỷ luật không để worker import controller | ✅ **Chọn** |
| **B.** Như A + tách `packages/domain` | Test bất biến thành unit thuần, kể chuyện gọn với BGK | +1.5h. Mà I-3 (hash), I-5, I-6 đều cần truy vấn DB → vẫn phải đẻ repository interface. Trừu tượng hoá không mua được gì trong 48h | ❌ Loại — YAGNI |
| **C.** Bỏ NestJS, Next.js full-stack + worker script | ~1.5h, 1 deployable | Route handler *là* giao diện → "chặn được kể cả ngoài giao diện" mờ đi, đúng chỗ T-10 và rubric System Design chấm. Trái stack đã tuyên bố | ❌ Loại |

## 4. Quyết định trong phiên (8 câu hỏi)

| # | Quyết định | Phương án bị loại + lý do |
| --- | --- | --- |
| 1 | Worker = **cùng image**, `APP_ROLE=worker` chỉ nạp ScheduleModule + WatchCycleService | *Gộp vào process API*: log lẫn lộn, khó chứng minh production-like. *`apps/worker` riêng*: kéo theo phương án B, +2h |
| 2 | **JWT httpOnly cookie tự viết**, 2 user seed sẵn, không đăng ký/refresh | *Better Auth*: thiên về Next.js, nối qua NestJS rủi ro mất 2h cho thứ BGK không chấm. *Basic auth*: spec đòi "đăng nhập thật" |
| 3 | **Client component + TanStack Query** gọi thẳng NestJS | *BFF proxy*: thêm 1 hop + viết lại type mọi endpoint. *Server Component + Server Action*: hàng đợi duyệt cần phản hồi tức thì + đo `seconds_to_decide` → revalidate liên tục, phức tạp hơn lợi ích |
| 4 | Bàn giao ở mức **walking skeleton** (1 lát cắt dọc chạy thật) | *Chỉ dựng khung*: đẩy rủi ro tích hợp sang đêm 14/08. *Skeleton + toàn bộ schema*: +1.5h, làm sau được |
| 5 | **Vitest** + supertest + Playwright | *Jest*: cắm là chạy nhưng chậm hơn 3–5×/vòng lặp, cộng dồn 48h với 14+ test bất biến chạy liên tục |
| 6 | **Caddy** đứng trước, `:8080` là cổng duy nhất | *next.config rewrites*: API phụ thuộc Next còn sống. *2 cổng + CORS*: `SameSite=None` hay vỡ trên trình duyệt giám khảo |
| 7 | **Tailwind + shadcn/ui** | *Tailwind thuần*: phải tự viết bảng/dialog/dropdown lý do Bỏ (ADR-0008), tốn giờ không đổi lại điểm. *MUI*: theming nặng, sửa sâu khó hơn |
| 8 | **Claude API (Anthropic)** cho `ClaimExtractor` | *Gemini/OpenAI*: đội có key Anthropic; tool use hợp việc ép LLM trả `quote_text` nguyên văn theo I-2 |

## 5. Giải pháp chốt

### 5.1 Cây thư mục

```
apps/
  web/                Next.js 15 App Router · output: 'standalone'
  api/                NestJS · APP_ROLE=api | worker (cùng image)
packages/
  contracts/          enum + zod + type + port ClaimExtractor (chỉ phụ thuộc zod)
  db/                 Drizzle schema · migrations SQL · seed · snapshot fixtures
infra/
  Caddyfile           :8080 → / web · /api api
  docker-compose.yml
seed/                 bộ dữ liệu BTC + bản chụp "trước"/"sau"
```

Không dùng Turborepo — `pnpm --filter` + scripts gốc đủ cho 4 package.

### 5.2 Bộ lệnh — điền vào `CLAUDE.md` mục 6 và `README.md`

| Lệnh | Làm gì |
| --- | --- |
| `pnpm dev` | Postgres trong docker, web+api chạy native |
| `pnpm start` | `docker compose up --build` — production build, 1 cổng `:8080` |
| `pnpm test` | vitest run (unit+integration) → playwright (e2e trên bản compose) |
| `pnpm seed` | Nạp bộ BTC, idempotent (I-14) |
| `pnpm db:generate` · `db:migrate` | **Cấm `drizzle-kit push`** — sẽ thổi bay grant viết tay |
| `pnpm lint` · `pnpm build` | |

### 5.3 Lớp chặn CSDL: hai role + quyền cột (thay trigger)

Đóng câu hỏi treo ở `ontology.md` dòng 232. **Đã chốt bằng [ADR-0010](../../docs/decisions/0010-chan-tang-csdl-bang-hai-role-va-quyen-theo-cot.md), có thực nghiệm trên `postgres:16-alpine`.**

```sql
-- crm_owner  : sở hữu schema, CHỈ chạy migration. App không bao giờ kết nối bằng role này.
-- crm_app    : Sales/Admin, toàn quyền
-- crm_system : mọi đường ghi của AI

GRANT ALL ON ALL TABLES IN SCHEMA public TO crm_app;
ALTER DEFAULT PRIVILEGES FOR ROLE crm_owner IN SCHEMA public GRANT ALL ON TABLES TO crm_app;

-- crm_system: KHÔNG đặt default privileges → bảng mới mặc định cấm
GRANT SELECT ON opportunities TO crm_system;
GRANT UPDATE (next_step_text, next_step_due_date, next_step_source) ON opportunities TO crm_system;
GRANT SELECT, INSERT ON timeline_entries TO crm_system;
-- không GRANT DELETE ở bất kỳ bảng nào do người tạo
```

**Cạm bẫy đã đo được, ghi lại kẻo lặp lại:** bản nháp đầu tiên viết `GRANT UPDATE ON opportunities` rồi `REVOKE UPDATE (stage, expected_value)`. Chạy thử: **không chặn gì cả**, `crm_system` đổi `stage` thành `won` thành công — quyền cấp ở mức bảng phủ mọi cột, revoke theo cột không đục thủng được. Phải **chỉ GRANT đúng cột được phép**, không bao giờ grant toàn bảng rồi thu hồi bớt.

Hai hệ quả nữa cũng đo được: chủ sở hữu bảng bỏ qua toàn bộ quyền cột kể cả khi `NOSUPERUSER` (→ app không được sở hữu bảng); và bảng tạo sau mặc định cấm `crm_system` nhưng `crm_app` vẫn có quyền nhờ `ALTER DEFAULT PRIVILEGES` (→ dev không bị chặn, AI thì phải cấp tay).

API process giữ 2 pool: `db.asHuman` / `db.asSystem`. Worker chỉ có `asSystem`.

**Vì sao hơn trigger:** ~20 dòng SQL thay cho 4 function PL/pgSQL + biến `SET LOCAL app.actor` phải nhớ set ở mọi transaction (quên một chỗ là thủng âm thầm). Chứng minh trước BGK bằng 1 lệnh `psql`.

**Lưu ý:** đây là *bổ sung* cách cài đặt cho lớp CSDL của ADR-0004, không đảo ngược ADR-0004 — lớp domain (`actor` + `AuditEvent`) giữ nguyên, vì Postgres chỉ trả lỗi trống còn `AuditEvent` phải ghi lý do từ chối.

### 5.4 Vòng quét: self-rescheduling loop, không `@Cron`

`@Cron` chốt chu kỳ lúc compile, nhưng `watch_cycle_seconds` nằm trong CSDL và T-9 đòi tắt giữa chừng có hiệu lực ngay.

```
loop: đọc SystemSetting → ai_enabled? → isRunning? (I-10 → bỏ nhịp, ghi skipped_reason)
      → quét → ghi WatchCycleRun → setTimeout(watch_cycle_seconds)
```

Ba yêu cầu (I-10, T-9, chu kỳ cấu hình được) hội tụ vào ~20 dòng này.

### 5.5 Cấu trúc `apps/api`

```
src/
  common/actor/   AsyncLocalStorage<Actor> + chọn pool asHuman/asSystem
  common/audit/   AuditEventService — ghi mọi lần ranh giới từ chối
  auth/           login · JwtGuard (cookie httpOnly) · RolesGuard
  domain/         company · contact · opportunity · timeline
                  observation · claim · proposal
                  autonomy/  ← 4 vùng cấm + I-6 + I-7
  watch/          chỉ nạp khi APP_ROLE=worker
  ai/             AnthropicClaimExtractor (impl port ở contracts)
  settings/       SystemSetting đọc từ DB
```

`domain/*` không dính decorator nào ngoài `@Injectable` → test T-10 gọi `new OpportunityService(dbSystem)` trực tiếp, đúng thứ ADR-0004 đòi ("test gọi thẳng service").

### 5.6 `packages/contracts` — chống ontology thành đồ trang trí

`CLAUDE.md` mục 8 cấm ontology viết trong md mà code không đọc. Giải: 1 file duy nhất giữ 11 enum + nhãn tiếng Việt.

```ts
export const STAGE = {
  prospecting: 'Tiếp cận', qualified: 'Đủ điều kiện', drafting: 'Soạn đề xuất',
  negotiation: 'Thương lượng', won: 'Thắng', lost: 'Thua', on_hold: 'Tạm dừng',
} as const
```

FE lấy nhãn · BE lấy key · Drizzle `pgEnum` lấy `Object.keys`. Đóng checklist ontology dòng 227.

## 6. Chia việc

~**3.5–4h**, 3 người:

```
[15'] 1 người: packages/contracts + pnpm-workspace   ← cả đội chờ, không song song được
   ↓
A: packages/db (schema + migration + grant + seed)        ~75'
B: apps/api (auth + actor + 2 pool + worker loop)         ~105'
C: apps/web (shadcn + login + company list) + Caddyfile   ~90'
   ↓
[45'] gộp: compose + 3 tầng test + chạy 6 mục nghiệm thu mục 7
```

## 7. Nghiệm thu — định nghĩa "xong"

| # | Kiểm chứng |
| --- | --- |
| 1 | `pnpm install && pnpm seed && pnpm start` → `:8080` lên, không hot reload |
| 2 | Login `sales@` và `admin@`, cookie httpOnly, RolesGuard phân biệt được 2 vai |
| 3 | Tạo 1 Company qua UI → có trong Postgres, sống sót `docker compose restart` |
| 4 | Worker log 1 dòng `WatchCycleRun` mỗi 60s, đọc chu kỳ **từ DB**; sửa DB thành 10s → đổi nhịp không cần restart |
| 5 | `pnpm test` xanh đủ 3 tầng: 1 unit (enum ↔ ontology) · **1 integration T-10 mini** (`crm_system` đổi `stage` bị từ chối) · 1 e2e (login → tạo company) |
| 6 | `pnpm seed` lần 2 → về đúng trạng thái đầu, không lỗi |

Điểm 5 giá trị nhất: chứng minh phòng thủ 2 lớp chạy thật **trước** khi viết dòng tính năng đầu tiên.

## 8. Rủi ro

| Rủi ro | Xử lý |
| --- | --- |
| Vitest × NestJS decorator sa lầy (`unplugin-swc`, `reflect-metadata`) | **Timebox 30'.** Quá → rơi về Jest, ghi 1 dòng ADR, đi tiếp. Không debug tiếp |
| `crm_system` bị revoke nhầm → nhóm 4/5 không ghi được `TimelineEntry`/`next_step` | Nghiệm thu mục 7 kiểm **cả hai chiều**: cấm phải cấm, cho phải cho |
| Next standalone + Caddy sai base path / asset 404 | Chạy mục 3+6 nghiệm thu **trước** khi làm UI |
| `drizzle-kit push` xoá grant | Cấm trong `CLAUDE.md` mục 6; không đưa script `db:push` vào `package.json` |
| Skeleton phình thành làm luôn tính năng | Phạm vi đóng ở mục 2; mọi thứ khác đẩy sang plan sau |

## 9. Bước tiếp theo

1. ~~ADR-0010~~ ✅ đã viết, đã verify bằng 4 phép đo trên Postgres thật.
2. ~~ADR-0011~~ ✅ đã viết; **verify còn nợ** — làm ở nghiệm thu skeleton mục 7 điểm 4.
3. Cập nhật `CLAUDE.md` mục 6 (Stack/Test/Lệnh chuẩn hiện là TBD) và bảng lệnh `README.md`.
4. Cập nhật `ontology.md`: tick checklist dòng 227 (enum ánh xạ code), xoá câu hỏi treo dòng 232.
5. `/ck:plan` từ báo cáo này → kế hoạch theo phase khớp chia việc mục 6.

## Câu hỏi chưa giải quyết

- **Bản chụp là HTML hay text** (Q-3 gửi BTC) — quyết định `quote_start`/`quote_end` tính trên chuỗi nào (I-2). **Chặn nhóm 2, hỏi BTC tối nay.** Skeleton lưu `raw_content` kiểu `text`, hoãn được tới lúc code nhóm 2.
- **Admin có được thao tác CRM không** (Q-6) — chưa viết được ma trận quyền đầy đủ. Skeleton chỉ cần RolesGuard phân biệt 2 vai, chưa cần ma trận.
- `source_tier` giữ chỗ hay bỏ — không chặn skeleton, để cột `int` nullable.
- Mốc BTC bắt đầu thu log Grafana (xung đột thể lệ ghi ở `hackathon-rules-and-scoring.md`) — không chặn kỹ thuật nhưng chặn điểm vòng 1.

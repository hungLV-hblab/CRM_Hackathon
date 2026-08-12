# CRM Hackathon — HBLAB AI Hackathon #01 (DEV Edition)

Một module của hệ thống **CRM nội bộ HBLAB**, xây theo Specs BTC. Phần mềm **AI-native**: AI nằm trong lõi luồng nghiệp vụ, không phải chatbot đính cạnh CRUD. End user thật: đội **Sales các thị trường** (họ chấm vòng 3).

Ngày thi **15/08/2026** · feature freeze **tối 14/08** · nộp vòng 1 **15:00 ngày 15/08**.

- **Module:** **"AI Native CRM"** — CRM B2B dùng tay được trọn vẹn + lớp AI đọc nguồn công khai đẩy thông tin vào đúng chỗ. Specs phát 12/08: [docs/hackathon-spec-ai-native-crm.md](docs/hackathon-spec-ai-native-crm.md). 6 nhóm tính năng · 4 ranh giới cứng · nghiệm thu T-1..T-10.
- **Stack:** pnpm monorepo (Node 22, TypeScript 5.7 strict) — `apps/api` NestJS 11 + Drizzle + Postgres 16 · `apps/web` Next 15 App Router (standalone) + React 19 + Tailwind v4 + TanStack Query · `packages/contracts` zod + enum dùng chung · `packages/db` schema/migration/seed. Caddy + docker compose ở `infra/`. Xem [ADR-0010](docs/decisions/0010-chan-tang-csdl-bang-hai-role-va-quyen-theo-cot.md) và [ADR-0011](docs/decisions/0011-worker-cung-image-va-vong-quet-tu-hen-nhip.md).

## Chạy lần đầu

**Cần sẵn:** Docker Desktop **đang chạy** · Node ≥ 22 · pnpm 10 (`corepack enable`). Không cần cài Postgres trên máy — nó nằm trong compose.

### Bước 1 — tạo `.env`

```bash
cp .env.example .env
```

Mở `.env` và điền **ba** biến bắt buộc, thiếu một cái là `pnpm start` dừng ngay với thông báo chỉ đúng tên biến:

| Biến | Điền gì |
| --- | --- |
| `POSTGRES_PASSWORD` | Mật khẩu superuser, chỉ container dùng. Đặt gì cũng được |
| `CRM_DB_PASSWORD` | Mật khẩu chung của 3 role `crm_*`. **Đổi ở đây thì phải đổi cả 6 URL `DATABASE_URL_*` bên dưới** — 6 URL đó là đường đi của các lệnh chạy từ máy (`pnpm seed`, `pnpm test:unit`), không phải của container |
| `JWT_SECRET` | `openssl rand -hex 32` |

### Bước 2 — bật hệ thống (terminal 1)

```bash
pnpm install
pnpm start
```

`pnpm start` **chiếm terminal** (chạy foreground để log hiện ra ngay) và **lần đầu mất vài phút** vì phải build 2 image. Lên xong khi log `caddy-1` có `"msg":"serving initial configuration"`.

Thứ tự khởi động là tự động: `postgres` (chờ healthy) → `migrate` → `api` + `worker` → `web` → `caddy`.

`migrate` là **job chạy một lần rồi exit 0**, không phải service. Thấy dòng `Container crm-hackathon-migrate-1 Exited` trong log khởi động là **đúng**, không phải lỗi — `api` và `worker` chỉ khởi động sau khi job này thành công, nên không bao giờ có hai tiến trình cùng chạy migration. Vì đã exit, nó không hiện trong `ps`; muốn xem thì `ps -a`.

### Bước 3 — nạp dữ liệu demo (terminal 2)

```bash
pnpm seed
```

**Phải chạy sau khi stack lên**, vì seed ghi vào bảng do `migrate` tạo. Kỳ vọng: `Seed complete: 2 users, 4 companies, 3 opportunities, 2 timeline entries.`

### Bước 4 — mở và đăng nhập

Kiểm nhanh stack đã thông chưa (kỳ vọng `307`, chuyển sang `/dang-nhap`):

```bash
curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" http://localhost:8080/
```

Rồi mở <http://localhost:8080>.

| Vai | Email | Mật khẩu |
| --- | --- | --- |
| Sales | `sales@hblab.vn` | `sales123` |
| Admin | `admin@hblab.vn` | `admin123` |

Mật khẩu demo công khai có chủ đích — giám khảo cần đăng nhập được.

### Lần sau

```bash
pnpm start     # không rebuild lại từ đầu, image đã có cache
pnpm stop      # tắt, GIỮ dữ liệu
pnpm reset     # tắt và XOÁ SẠCH dữ liệu (kể cả 3 role Postgres)
```

Sửa code rồi muốn thấy thay đổi thì phải `pnpm start` lại — đây là bản **production build**, không có hot reload (spec 7.3 đòi vậy).

### Gặp lỗi

| Hiện tượng | Nguyên nhân | Cách sửa |
| --- | --- | --- |
| `role "crm_owner" does not exist` | Volume Postgres cũ. Script tạo 3 role chỉ chạy khi cluster khởi tạo trên volume **rỗng** | `pnpm reset` rồi `pnpm start` |
| `POSTGRES_PASSWORD is missing from .env` | Chưa có `.env`, hoặc biến để trống | Làm lại bước 1 |
| `pnpm seed` báo không kết nối được | Stack chưa lên, hoặc mật khẩu trong 6 URL `DATABASE_URL_*` khác `CRM_DB_PASSWORD` | Chờ bước 2 xong; đối chiếu lại mật khẩu |
| Trang trắng, CSS 404 | Image `web` build lỗi ở bước copy `.next/static` | `pnpm reset && pnpm start` để build lại sạch |
| `:8080` không phản hồi | Cổng bị chiếm, hoặc Docker Desktop chưa chạy | `docker compose -f infra/docker-compose.yml --env-file .env ps` xem service nào chết |

Xem log một service — **nhớ `--env-file .env`**, thiếu nó docker compose in một loạt cảnh báo `variable is not set` trông như lỗi thật:

```bash
docker compose -f infra/docker-compose.yml --env-file .env logs -f worker
```

Đổi `worker` thành `api`, `web`, `caddy`, `postgres`. Log worker là chỗ xem vòng quét: một dòng `WatchCycleRun` mỗi 60s.

> **Riêng trên Windows:** `pnpm build` cho `apps/web` gãy ở bước tạo symlink của Next standalone (`EPERM`) nếu chưa bật Developer Mode. Không ảnh hưởng gì tới `pnpm start` — bước đó chạy trong Docker (Linux).

## Lệnh

| Việc | Lệnh |
| --- | --- |
| install | `pnpm install` |
| Bật cả hệ thống (bản production, 1 cổng `:8080`) | `pnpm start` |
| Chỉ bật Postgres (app chạy tay khi dev) | `pnpm dev` |
| Tắt · tắt và xoá sạch dữ liệu | `pnpm stop` · `pnpm reset` |
| Test | `pnpm test` · `pnpm test:unit` · `pnpm test:e2e` |
| Nạp dữ liệu demo | `pnpm seed` |
| CSDL | `pnpm db:generate` · `pnpm db:migrate` |
| lint · typecheck · build | `pnpm lint` · `pnpm typecheck` · `pnpm build` |
| Phản biện yêu cầu (persona) | `/hack:req-challenge <specs hoặc mô tả>` |
| Phản biện thiết kế (virtual architect) | `/hack:design-challenge <vấn đề cần chốt>` |
| Chốt một quyết định thành ADR | `/hack:adr <quyết định>` |

`pnpm test:e2e` cần stack đang chạy (`pnpm start` ở terminal khác) và trình duyệt Playwright: `pnpm exec playwright install chromium` một lần.

**Cấm** thêm script `db:push` của drizzle-kit — nó xoá GRANT theo cột của ADR-0010.

## Đọc theo thứ tự

1. **[CLAUDE.md](CLAUDE.md)** — 7 luật bất di bất dịch, từ vựng ontology, trần tự chủ AI, DoD. Bắt buộc, đọc trước tiên.
2. **[docs/hackathon-spec-ai-native-crm.md](docs/hackathon-spec-ai-native-crm.md)** — đề bài nguyên văn. Nguồn sự thật cho *cần cái gì*; index nhanh theo mục ở [llms.txt](llms.txt).
3. [docs/hackathon-context.md](docs/hackathon-context.md) — bối cảnh + chiến lược suy ra từ tài liệu BTC.
4. [docs/sales-ito-crm-domain.md](docs/sales-ito-crm-domain.md) — đọc trước **mọi quyết định sản phẩm** (hiển thị gì, ưu tiên gì).
5. [docs/ai-native-design-principles.md](docs/ai-native-design-principles.md) — đọc trước **mọi quyết định kiến trúc**.
6. [docs/hackathon-rules-and-scoring.md](docs/hackathon-rules-and-scoring.md) — rubric; quyết định *cách làm việc*, không chỉ *làm gì*.
7. **[docs/ontology.md](docs/ontology.md)** — nguồn sự thật về **đặt tên + ràng buộc**: thực thể, enum, quan hệ có tên, 14 bất biến code phải enforce, trần tự chủ 4 vùng. ⬜ chờ người ngoài người viết duyệt.

Lưu vết quyết định: [docs/decisions/](docs/decisions/) (kết luận + phương án bị loại) · [docs/ai-sessions/](docs/ai-sessions/) (prompt log thô).

## Telemetry — điều kiện qua vòng 1

**Không có log Claude Code trên Grafana = 0 điểm, không qua vòng 1.** Bật trước khi gõ dòng đầu tiên.

Collector: `https://otel.hblab.ai:4317` (gRPC, đã kiểm tra sống ngày 12/08). Cấu hình 6 biến trong `~/.claude/settings.json` — xin endpoint + token từ IT/BTC, **không commit token vào repo**.

| Người | Config trên máy | Thấy data trên Grafana |
| --- | --- | --- |
| HungLV | ✅ đủ 6 biến OTEL | ✅ đã thấy data trên Grafana (13/08) |
| *(thành viên 2)* | ❓ chưa biết | ❓ |
| *(thành viên 3)* | ❓ chưa biết | ❓ |

Verify: `claude --debug 2>&1 | grep -i otel` (không lỗi export) **và** thấy metric `claude_code.session.count` của chính mình trên dashboard. Chỉ "không lỗi" thì chưa tính là xong.

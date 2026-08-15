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

`ANTHROPIC_API_KEY` **không bắt buộc** và cố ý như vậy: bỏ trống thì lớp rút phát hiện chạy bằng `FixtureClaimExtractor` — đọc đúng bộ bản chụp trong repo, câu trích vẫn nguyên văn, vẫn qua đủ cửa kiểm, nên **bộ nghiệm thu 10 điểm chạy được khi không có key** ([ADR-0014](docs/decisions/0014-nhom-2-rut-phat-hien-bang-llm-that-code-kiem-cau-trich.md)). Điền key thì gọi LLM thật, `ANTHROPIC_MODEL` chọn model.

Đang chạy bằng cái nào thì **đọc log lúc khởi động**, đừng đoán từ hành vi. Hai lớp AI có hai dòng log riêng:

```bash
docker compose -f infra/docker-compose.yml logs api | grep -E "ClaimExtractor|SourceDiscovery"
# Rút phát hiện:
# Dùng AgentClaimExtractor qua agent-runtime tại ...  ← Claude CLI trong container
# Dùng AnthropicClaimExtractor (model ...)            ← SDK, LLM thật
# Không có agent-runtime và ANTHROPIC_API_KEY trống → dùng FixtureClaimExtractor
# Tìm nguồn:
# Dùng AgentSourceDiscovery qua agent-runtime tại ... ← Claude CLI + WebSearch
# Dùng AnthropicSourceDiscovery với web_search ...    ← SDK, tìm kiếm thật
# ... → dùng FixtureSourceDiscovery
```

Đổi key trong `.env` thì phải `docker compose ... up -d api worker` lại — container đọc biến môi trường một lần lúc khởi động.

#### Tuỳ chọn — chạy lớp rút phát hiện bằng Claude CLI thay vì SDK

Đường thứ ba, **mặc định tắt** ([ADR-0038](docs/decisions/0038-agent-runtime-la-container-rieng-giu-credential-claude-khong-giu-csdl.md)). Bật khi muốn dùng tài khoản Claude có subscription thay cho API key:

```bash
claude setup-token          # trên máy đã đăng nhập Claude, in ra một token dài
```

Điền **cả ba** biến vào `.env` — thiếu một cái là coi như tắt:

| Biến | Điền gì |
| --- | --- |
| `AGENT_RUNTIME_URL` | `http://agent-runtime:4700` |
| `AGENT_TOKEN` | Chuỗi bí mật tự đặt, để `api` chứng minh với `agent-runtime` rằng nó là ai. `openssl rand -hex 16` |
| `CLAUDE_CODE_OAUTH_TOKEN` | Token vừa in ra ở trên |

Rồi `pnpm start` như bình thường — `agent-runtime` là service trong cùng compose, không phải chạy tay.

Kiểm nó lên chưa:

```bash
docker compose -f infra/docker-compose.yml exec api wget -qO- http://agent-runtime:4700/health
# {"ok":true,"skills":["discover-sources","extract-claims"],"authMode":"oauth",...}
```

Ba điều nên biết trước khi bật:

- **Vòng quét không dùng đường này.** Hạn mức subscription tính theo phiên, mà vòng quét quét mọi công ty mỗi 60s. `worker` đọc cùng biến rồi ghi log rằng nó từ chối — `docker compose logs worker | grep ClaimExtractor` thấy dòng đó là đúng, không phải lỗi.
- **Mỗi lần gọi tốn thêm ~3,4s** khởi động tiến trình, nằm trên đường Sales bấm nút.
- **Dùng subscription làm backend là ngoài điều khoản của Anthropic.** Được cho demo nội bộ, không mang lên production.

Luật của hai skill lúc này nằm ở [`apps/agent-runtime/skills/extract-claims/SKILL.md`](apps/agent-runtime/skills/extract-claims/SKILL.md) (rút phát hiện) và [`apps/agent-runtime/skills/discover-sources/SKILL.md`](apps/agent-runtime/skills/discover-sources/SKILL.md) (tìm nguồn) — sửa file đó rồi `docker compose ... up -d --build agent-runtime` là đổi được cách AI đọc, không cần sửa TypeScript.

Riêng `discover-sources` có một điểm **khác** đường SDK, đừng nhầm hai cái là một ([ADR-0039](docs/decisions/0039-tim-nguon-qua-agent-runtime-xac-minh-bang-cach-mo-that-tung-dia-chi.md)): SDK đối chiếu URL với kết quả `web_search` của cùng lượt gọi, còn CLI không trả về khối kết quả đó, nên bảo đảm chống bịa địa chỉ được **thay** bằng cách **mở thật từng ứng viên** — địa chỉ nào không trả lời thì bị bỏ trước khi ai nhìn thấy. Số bị bỏ và lý do có trong log:

```bash
docker compose -f infra/docker-compose.yml logs api | grep "ứng viên giữ lại"
# Tìm nguồn "Genky": 4 ứng viên giữ lại trên 6 đã xác minh · bỏ vì không mở được: http_4xx×2
```

### Bước 2 — bật hệ thống (terminal 1)

```bash
pnpm install
pnpm start
```

`pnpm start` **chiếm terminal** (chạy foreground để log hiện ra ngay) và **lần đầu mất vài phút** vì phải build 2 image. Lên xong khi log `caddy-1` có `"msg":"serving initial configuration"`.

Thứ tự khởi động là tự động: `postgres` (chờ healthy) → `migrate` → `api` + `worker` → `web` → `caddy`.

`migrate` là **job chạy một lần rồi exit 0**, không phải service. Thấy dòng `Container crm-hackathon-migrate-1 Exited` trong log khởi động là **đúng**, không phải lỗi — `api` và `worker` chỉ khởi động sau khi job này thành công, nên không bao giờ có hai tiến trình cùng chạy migration. Vì đã exit, nó không hiện trong `ps`; muốn xem thì `ps -a`.

### Bước 3 — nạp dữ liệu demo

Hai cách, cùng một hàm parse zip ở dưới (`parseZipDataset()`), cùng ghi lại **đúng trạng thái ban đầu** mỗi lần chạy (I-14):

**Cách chính — giám khảo dùng, qua giao diện (spec mục 7 điều kiện 5):** đăng nhập `admin@hblab.vn` / `admin123`, vào `/quan-tri`, bấm "Chọn file zip…", chọn `hackathon-1-data.zip` (hoặc file BTC phát khác cùng định dạng), xác nhận "Xoá và nạp lại". Nạp lại đúng file bất cứ lúc nào — kể cả giữa demo — để xoá sạch mọi thứ AI/Sales sinh ra và về lại đúng 25 công ty / 38 liên hệ / 15 cơ hội / bản chụp gốc. Xem [ADR-0042](docs/decisions/0042-quyen-crm-owner-ngan-han-cho-import-tu-giao-dien.md).

**Cách phụ — dev/CI, từ terminal (terminal 2):**

```bash
pnpm seed
```

**Phải chạy sau khi stack lên**, vì seed ghi vào bảng do `migrate` tạo. Đọc `hackathon-1-data.zip` checked-in ở `packages/db/seed-assets/`. Kỳ vọng:

```text
Seed complete: 2 users, 25 companies, 38 contacts, 15 opportunities, 86 snapshot pages.
```

Mỗi công ty có sẵn 3–4 trang bản chụp (`snapshot_pages`), đọc qua nút "Đọc bản chụp sau" trên màn chi tiết công ty — không cần lệnh nào để "giả tin mới về" nữa, bản "sau" đã nằm sẵn trong dữ liệu thật.

Hoặc gọi `POST /api/demo/companies/:id/snapshot-variant` với body `{"variant":"after"}` khi đã đăng nhập. Đây là đường của **người**: `crm_system` chỉ đọc được cột này, không ghi được — AI không tự đổi được nguồn nó đọc ([ADR-0022](docs/decisions/0022-ban-chup-hien-tai-la-cot-text-tren-companies-khong-phai-enum-cua-ontology.md)).

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
| Nạp dữ liệu demo (giám khảo dùng: upload zip ở `/quan-tri`) | `pnpm seed` (dev/CI, dùng zip checked-in) |
| Đổi nguồn một công ty sang bản chụp "sau" (diễn tin mới về, ngoài `snapshot_pages`) | `pnpm switch-snapshot "<tên công ty>" after` |
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

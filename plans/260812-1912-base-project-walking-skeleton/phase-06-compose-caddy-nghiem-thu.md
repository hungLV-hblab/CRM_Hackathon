---
phase: 6
title: "Compose, Caddy, nghiệm thu 6 điểm"
status: done
priority: P1
dependencies: [2, 3, 4, 5]
---

# Phase 6: Compose, Caddy, nghiệm thu 6 điểm

## Overview

Gói tất cả thành bản giả lập production 1 lệnh, và chạy 6 điểm nghiệm thu. **Phase này không TDD** — nghiệm thu của hạ tầng là kịch bản chạy tay, không phải unit test. Đừng bịa test cho Dockerfile để trông cho đủ bộ.

## Requirements

- Functional: `pnpm start` → `:8080` phục vụ cả FE lẫn API; worker chạy container riêng cùng image với API; `pnpm test` chạy đủ 3 tầng bằng 1 lệnh; `pnpm seed` 1 lệnh.
- Non-functional: production build, không dev server / hot reload / debug; config ở env; dữ liệu sống sót restart; log ra stdout xem được bằng `docker compose logs`.

## Architecture

```
:8080 Caddy ─┬─ /api/*  → api:3001    (APP_ROLE=api)
             └─ /*      → web:3000    (next start, standalone)
                worker              (APP_ROLE=worker, CÙNG image với api, không mở cổng)
                postgres            (volume, init script tạo 3 role)
```

Một cổng duy nhất giám khảo cần biết. API và worker **cùng một image** — build 1 lần, chạy 2 service khác `APP_ROLE`.

## Related Code Files

- Create: `apps/api/Dockerfile` (multi-stage, dùng chung cho api + worker)
- Create: `apps/web/Dockerfile` (multi-stage, standalone)
- Create: `infra/docker-compose.yml`, `infra/Caddyfile`
- Create: `.dockerignore`
- Modify: `package.json` gốc — `start`, `test`, `seed` thành lệnh thật
- Modify: `README.md` bảng lệnh (đang là TBD)
- Modify: `CLAUDE.md` mục 6 — Stack + Test + Lệnh chuẩn (đang là TBD), thêm dòng cấm `drizzle-kit push`
- Modify: `playwright.config.ts` — trỏ `:8080`

## Implementation Steps

1. **Dockerfile api** — multi-stage: `pnpm install --frozen-lockfile` → build → runtime `node:22-alpine`, `NODE_ENV=production`, chạy `node dist/main.js`. Không `nest start`, không `--watch`.
2. **Dockerfile web** — `next build` → copy `.next/standalone` + `.next/static` + `public` → `node server.js`.
3. **Caddyfile**:
   ```
   :8080 {
     handle /api/* { reverse_proxy api:3001 }
     handle        { reverse_proxy web:3000 }
   }
   ```
   Kiểm sớm rằng API nhận đường dẫn có tiền tố `/api` (đặt `app.setGlobalPrefix('api')` ở NestJS, đừng strip ở Caddy — ít chỗ nhầm hơn).
4. **compose**: postgres (volume + `infra/postgres-init` mount), api, worker, web, caddy. `depends_on` + healthcheck cho postgres. Migration chạy ở bước khởi động api (hoặc service `migrate` chạy một lần) bằng `DATABASE_URL_OWNER`.
5. **Scripts gốc**: `start` = `docker compose -f infra/docker-compose.yml up --build`; `test` = `vitest run && playwright test`; `seed` = chạy seed trong container api.
6. **Cập nhật tài liệu**: README bảng lệnh, CLAUDE.md mục 6.

## Success Criteria — 6 điểm nghiệm thu

**Đã chạy đủ 6/6 ngày 12/08 22:10.** Bằng chứng từng điểm: [báo cáo nghiệm thu](../reports/walking-skeleton-acceptance-260812-2210-sau-diem-nghiem-thu-va-hai-loi-that-report.md).

- [x] **1** — `:8080` lên; `/` → 307 → `/dang-nhap`; CSS standalone trả 200. Log không có `hot reload`, `webpack-hmr`, `nest start --watch`, `next dev`
- [x] **2** — `sales@` + `admin@` 200, sai mật khẩu 401, cookie có cờ `HttpOnly`; `GET /api/settings` Sales **403** · Admin **200**
- [x] **3** — `Cty Kiem Thu` tạo qua UI còn nguyên sau `docker compose restart`
- [x] **4** — 60s: `15:03:21 · 15:04:21 · 15:05:21`; sau UPDATE `='10'`: `:31 :41 :51 15:07:01`, **không** thêm dòng `Starting Nest application`
- [x] **5** — `pnpm test` = 52 unit/integration + 3 e2e, gồm T-10 mini
- [x] **6** — Hai lần seed cho cùng một chuỗi trạng thái + md5, xoá sạch cả công ty vừa tạo lẫn giá trị `10` sửa tay ở điểm 4

## Khác gì so với lúc viết phase

| Định làm | Làm thật | Vì sao |
| --- | --- | --- |
| Migration chạy lúc api khởi động | Service `migrate` riêng, chạy một lần | api và worker cùng `depends_on: service_completed_successfully` → khử hẳn tranh chấp thay vì thu hẹp nó |
| `seed` chạy trong container api | `pnpm seed` chạy từ máy | Cổng 5432 đã publish sẵn cho test, không cần thêm đường thứ hai |
| — | Thêm `--env-file .env` vào mọi script compose | Compose đọc `.env` cạnh **file compose** (`infra/`), không phải gốc repo. Thiếu cái này `pnpm start` gãy ngay từ biến đầu tiên |
| — | Bỏ `pnpm-lock.yaml` khỏi `.gitignore` | Image build bằng `--frozen-lockfile`; giám khảo clone repo phải nhận đúng cây phụ thuộc đã test |
| — | Thêm `pnpm stop` · `pnpm reset` | `down -v` là thao tác bắt buộc khi volume cũ thiếu 3 role |

## Risk Assessment

- **Next standalone thiếu `.next/static` → trang trắng, CSS 404.** Lỗi hay gặp nhất ở bước này. Chạy điểm nghiệm thu 1 **trước** khi động vào bất cứ thứ gì khác.
- **Volume cũ → init script không chạy → thiếu 3 role.** `docker compose down -v` trước lần chạy đầu. Ghi vào README.
- **Migration chạy đồng thời ở api và worker → tranh chấp.** Chỉ api chạy migration, worker chờ healthcheck.
- **Playwright chạy trong CI-less môi trường thiếu trình duyệt** → `pnpm exec playwright install chromium` một lần, ghi vào README.
- **Hết giờ.** Nếu quá 5h tổng: cắt Phase 5 xuống form trần không shadcn. **Không cắt điểm nghiệm thu 4 và 5** — đó là hai thứ chứng minh ADR-0010 và ADR-0011 không phải giấy tờ suông.

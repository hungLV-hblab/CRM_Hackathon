---
phase: 6
title: "Compose, Caddy, nghiệm thu 6 điểm"
status: pending
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

Chạy tuần tự, ghi kết quả vào `plans/reports/`. Không điểm nào được bỏ qua.

- [ ] **1** — `docker compose down -v && pnpm install && pnpm start` → `:8080` lên. `docker compose logs` không có chuỗi `hot reload`, `webpack-hmr`, `nest start --watch`
- [ ] **2** — Đăng nhập `sales@` và `admin@` trên trình duyệt thật, cookie có cờ `HttpOnly`, Sales bị 403 ở endpoint chỉ-Admin
- [ ] **3** — Tạo 1 công ty qua UI → `docker compose restart` → công ty vẫn còn
- [ ] **4** — `docker compose logs -f worker` thấy 1 dòng mỗi 60s; `UPDATE system_settings SET value='10' WHERE key='watch_cycle_seconds'` → nhịp đổi trong ≤1 chu kỳ, **không restart**
- [ ] **5** — `pnpm test` xanh, in rõ số test 3 tầng, gồm T-10 mini
- [ ] **6** — `pnpm seed` lần hai → trạng thái giống hệt lần đầu (kể cả công ty vừa tạo ở điểm 3 bị xoá đi)

## Risk Assessment

- **Next standalone thiếu `.next/static` → trang trắng, CSS 404.** Lỗi hay gặp nhất ở bước này. Chạy điểm nghiệm thu 1 **trước** khi động vào bất cứ thứ gì khác.
- **Volume cũ → init script không chạy → thiếu 3 role.** `docker compose down -v` trước lần chạy đầu. Ghi vào README.
- **Migration chạy đồng thời ở api và worker → tranh chấp.** Chỉ api chạy migration, worker chờ healthcheck.
- **Playwright chạy trong CI-less môi trường thiếu trình duyệt** → `pnpm exec playwright install chromium` một lần, ghi vào README.
- **Hết giờ.** Nếu quá 5h tổng: cắt Phase 5 xuống form trần không shadcn. **Không cắt điểm nghiệm thu 4 và 5** — đó là hai thứ chứng minh ADR-0010 và ADR-0011 không phải giấy tờ suông.

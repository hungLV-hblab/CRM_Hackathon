---
title: "Base project — walking skeleton (Next.js + NestJS + Drizzle + Postgres)"
status: pending
created: 2026-08-12 19:12
mode: tdd
scope: project
blockedBy: []
blocks: []
source: plans/reports/brainstorm-base-project-architecture-260812-1901-nextjs-nestjs-drizzle-monorepo-report.md
---

# Base project — walking skeleton

> Thiết kế đã chốt ở [báo cáo brainstorm](../reports/brainstorm-base-project-architecture-260812-1901-nextjs-nestjs-drizzle-monorepo-report.md) · [ADR-0010](../../docs/decisions/0010-chan-tang-csdl-bang-hai-role-va-quyen-theo-cot.md) · [ADR-0011](../../docs/decisions/0011-worker-cung-image-va-vong-quet-tu-hen-nhip.md).
> **Plan này KHÔNG làm tính năng.** Không nhóm 1–6, không gọi LLM thật, không UI đẹp. Chỉ dựng đường ống và chứng minh nó thông.

## Mục tiêu

Sau plan này, 3 người code song song 6 nhóm tính năng mà không đụng nhau, và mọi ràng buộc kiến trúc đắt tiền (actor 2 lớp, chu kỳ đọc từ CSDL, seed idempotent) đã có test giữ.

**Ngân sách: 4h. Đường găng thực tế 4h25** — P1 30' → P2 75' → P3 75' → P4 40' → P6 45'. Cộng lại không vừa ngân sách, nói thẳng ra thay vì để con số đẹp.

Hai cách kéo về ~3h30, làm cả hai:

- **B không ngồi chờ P2.** Auth, `ActorContext`, `DbModule`, bootstrap `APP_ROLE` không cần schema cuối — dựng song song ngay sau P1, chỉ phần test T-10 mini mới chờ bảng `opportunities` của A. Cắt được ~40' khỏi đường găng.
- **P6 bắt đầu sớm.** C viết Dockerfile + Caddyfile + compose ngay khi xong P5, không đợi P4. Chỉ 6 điểm nghiệm thu mới cần đủ mọi thứ.

Quá 5h là hỏng kế hoạch → cắt Phase 5 xuống form trần không shadcn. **Không cắt Phase 2, không cắt nghiệm thu điểm 4 và 5.**

## Ràng buộc bất biến

| Nguồn | Ràng buộc |
| --- | --- |
| spec 7.3 | Production build. Không dev server, không hot reload, không debug mode |
| spec 7.3–7.5 | 1 lệnh khởi động · 1 lệnh test · 1 lệnh seed |
| spec 7.5 · I-14 | Seed chạy lại về **đúng** trạng thái đầu |
| ontology 3.4 | `ai_enabled`, `watch_cycle_seconds` giá trị hiệu lực ở CSDL; env chỉ là giá trị khởi tạo |
| ADR-0004 + ADR-0010 | Chặn 2 lớp: `actor` tầng service **và** quyền cột tầng CSDL |
| ADR-0011 | Worker cùng image `APP_ROLE`; vòng quét tự hẹn nhịp, không `@Cron` |
| CLAUDE.md mục 3 | Tên bảng/cột/enum lấy đúng từ [ontology.md](../../docs/ontology.md) mục 3 |

## Chế độ TDD

Mỗi phase viết test đỏ trước, code sau. **Nói thẳng chỗ TDD không áp dụng được:** Phase 6 (compose, Caddy, Dockerfile) không có vòng đỏ-xanh có nghĩa — nghiệm thu của nó là kịch bản chạy tay 6 điểm, không phải unit test. Đừng bịa test cho hạ tầng để trông cho đủ bộ.

Test chạy được từ Phase 1 trở đi. Không phase nào coi là xong khi test của nó chưa xanh.

## Phases

| # | Phase | Trạng thái | Ưu tiên | Phụ thuộc | Ước lượng | Người |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | [Workspace + contracts](phase-01-workspace-va-contracts.md) | pending | P1 | — | 30' | 1 người, **cả đội chờ** |
| 2 | [packages/db — schema, role, seed](phase-02-db-schema-role-seed.md) | pending | P1 | 1 | 75' | A |
| 3 | [apps/api — actor, 2 pool, auth](phase-03-api-actor-pool-auth.md) | pending | P1 | 1, 2 | 75' | B |
| 4 | [Worker — vòng quét tự hẹn nhịp](phase-04-worker-vong-quet.md) | pending | P1 | 3 | 40' | B |
| 5 | [apps/web — login + danh sách công ty](phase-05-web-login-company-list.md) | pending | P2 | 1 | 60' | C |
| 6 | [Compose, Caddy, nghiệm thu](phase-06-compose-caddy-nghiem-thu.md) | pending | P1 | 2,3,4,5 | 45' | cả đội |

```
        ┌─ P2 (A) ─────────────┐
P1 ─────┼─ P3 khung (B) ─ P3 test T-10 ─ P4 (B) ─┼─ P6 nghiệm thu (cả đội)
        └─ P5 (C) ─ P6 hạ tầng (C) ──────────────┘
```

Phụ thuộc cứng duy nhất: **test T-10 mini của P3 cần bảng `opportunities` từ P2**. Phần khung của P3 không cần. P5 dựng UI theo type ở `packages/contracts`, nối API thật khi P3 xong.

## Nghiệm thu toàn plan

Chạy tay, đủ 6 điểm, không điểm nào bỏ:

| # | Kiểm chứng | Chứng minh điều gì |
| --- | --- | --- |
| 1 | `pnpm install && pnpm seed && pnpm start` → `:8080` lên, không hot reload | spec 7.3 |
| 2 | Login `sales@` và `admin@`, cookie httpOnly, RolesGuard phân biệt 2 vai | spec 7.3 |
| 3 | Tạo 1 Company qua UI → có trong Postgres, sống sót `docker compose restart` | spec 7.3 (dữ liệu bền) |
| 4 | Worker log `WatchCycleRun` mỗi 60s; `UPDATE system_settings … '10'` → nhịp đổi, **không restart** | Trả nợ verify ADR-0011 |
| 5 | `pnpm test` xanh đủ 3 tầng, có test T-10 mini (`crm_system` đổi `stage` bị từ chối) | ADR-0004 + ADR-0010 |
| 6 | `pnpm seed` lần 2 → về đúng trạng thái đầu | spec 7.5, I-14 |

## Ngoài phạm vi

Nhóm 1–6 tính năng · gọi LLM thật (chỉ khai báo port + adapter đọc fixture) · toàn bộ 15 bảng (chỉ dựng lát cắt cần cho skeleton) · CI/CD · UI ngoài login + danh sách công ty · phân quyền chi tiết Admin.

## Rủi ro

| Rủi ro | Xử lý |
| --- | --- |
| Vitest × NestJS decorator sa lầy | **Timebox 30'** ở Phase 1. Quá → chuyển Jest, ghi 1 dòng ADR, đi tiếp |
| GRANT thiếu → nhóm 4/5 không ghi được | Phase 2 test **cả hai chiều**: cấm phải cấm, cho phải cho |
| Next standalone + Caddy sai base path | Phase 6 chạy nghiệm thu 1+3 **trước** khi chỉnh UI |
| `drizzle-kit push` xoá GRANT | Không đưa script `db:push` vào `package.json`; ghi cấm trong CLAUDE.md mục 6 |
| Phase 1 chặn cả đội | Đúng 1 người làm, 30 phút, hai người kia đọc ontology mục 3 trong lúc chờ |

## Câu hỏi chưa giải quyết

- **Bản chụp HTML hay text** (Q-3 BTC) → quyết `quote_start`/`quote_end` tính trên chuỗi nào (I-2). **Không chặn plan này** (Phase 2 để `raw_content` kiểu `text`), nhưng chặn nhóm 2. Hỏi BTC tối nay.
- Admin có được thao tác CRM không (Q-6) → Phase 3 chỉ làm RolesGuard phân biệt 2 vai, chưa làm ma trận quyền.
- `ck` CLI chưa cài trên máy → plan file viết tay. Không ảnh hưởng nội dung.

---
phase: 1
title: "Workspace + contracts"
status: done
priority: P1
dependencies: []
---

# Phase 1: Workspace + contracts

## Overview

Dựng pnpm workspace, tsconfig, vitest chạy được, và `packages/contracts` giữ nguồn sự thật cho 11 enum. **Cả đội chờ phase này** — đúng 1 người làm, 30 phút.

## Requirements

- Functional: `pnpm test` chạy được và có 1 test xanh; mọi package import được `@crm/contracts`.
- Non-functional: Node 22 · pnpm 10 · TypeScript strict · ESM.

## Architecture

`packages/contracts` **không phụ thuộc gì ngoài `zod`** — FE, API, worker, db đều import được mà không kéo theo NestJS hay Drizzle.

Một file duy nhất giữ enum + nhãn tiếng Việt (ontology mục 3.5). FE lấy nhãn, BE lấy key, Drizzle `pgEnum` lấy `Object.keys`. Chống đúng thứ CLAUDE.md mục 8 cấm: *"ontology viết trong md nhưng code không đọc → trang trí"*.

## Related Code Files

- Create: `pnpm-workspace.yaml`, `package.json`, `tsconfig.base.json`, `.gitignore` (bổ sung), `.env.example`
- Create: `packages/contracts/{package.json,tsconfig.json,src/index.ts}`
- Create: `packages/contracts/src/enums.ts` — 11 enum + nhãn
- Create: `packages/contracts/src/ports/claim-extractor.ts` — interface, chưa có adapter
- Create: `packages/contracts/src/__tests__/enum-khop-ontology.test.ts`
- Create: `vitest.config.ts` (root, workspace projects)

## Implementation Steps

### Bước đỏ — viết test trước

`enum-khop-ontology.test.ts`: đọc `docs/ontology.md`, cắt bảng mục 3.5, parse cột "Giá trị (code)" và "Hiển thị", so với object trong `enums.ts`. Sai lệch → đỏ.

```ts
// ý tưởng, không phải code cuối
const table = parseEnumTable(readFileSync('docs/ontology.md', 'utf8'))
expect(Object.keys(STAGE)).toEqual(table.stage.codes)
expect(Object.values(STAGE)).toEqual(table.stage.labels)
```

**Timebox parse markdown: 20 phút.** Quá thì rơi về bản đơn giản: test chỉ khẳng định số lượng + danh sách key viết tay trong test, và ghi 1 dòng vào phase report là đã hạ mức. Không đốt thêm thời gian cho việc parse.

### Bước xanh

1. `pnpm init`, `pnpm-workspace.yaml` gồm `apps/*` + `packages/*`.
2. `tsconfig.base.json`: `strict`, `moduleResolution: bundler`, `target ES2022`, `experimentalDecorators` + `emitDecoratorMetadata` (NestJS cần).
3. `packages/contracts` + 11 enum theo đúng ontology 3.5. Nhớ bẫy đặt tên: giai đoạn "Soạn đề xuất" là `drafting`, **không** phải `proposal`.
4. Port `ClaimExtractor`: `extract(observation): Promise<ClaimDraft[]>`, chưa cài đặt.
5. Vitest root config, projects trỏ vào từng package.
6. Scripts gốc: `test`, `lint`, `build`, `dev`, `start`, `seed`, `db:generate`, `db:migrate`. **Không có `db:push`** (ADR-0010).

### Chốt hạ tầng test cho NestJS

Cấu hình `unplugin-swc` cho `apps/api` ngay ở phase này, đừng để tới Phase 3 mới phát hiện vỡ:

```ts
// apps/api/vitest.config.ts
plugins: [swc.vite({ module: { type: 'es6' } })]
```

**Timebox 30 phút.** Quá → chuyển toàn bộ sang Jest, ghi ADR-0012 một đoạn ngắn, đi tiếp. Đừng debug tiếp.

## Success Criteria

- [ ] `pnpm install` sạch, không peer warning chặn
- [ ] `pnpm test` chạy, test enum xanh
- [ ] Sửa 1 giá trị enum trong `enums.ts` → test **đỏ** (chứng minh test có răng)
- [ ] Một file `.ts` rỗng trong `apps/api` import được `@crm/contracts` và biên dịch
- [ ] `.env.example` có đủ `DATABASE_URL_OWNER` / `_APP` / `_SYSTEM`, `JWT_SECRET`, `APP_ROLE`, `WATCH_CYCLE_SECONDS`, `ANTHROPIC_API_KEY`

## Risk Assessment

- **Parse markdown lởm khởm** → timebox 20', có đường lùi rõ ràng.
- **Vitest × decorator** → timebox 30', đường lùi là Jest.
- **Phase này chặn cả đội** → hai người còn lại đọc ontology mục 3+4 trong lúc chờ, không ngồi không.

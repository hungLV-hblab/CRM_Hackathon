# Code Standards — luật chung của mã nguồn

> **Đối tượng: cả người và AI.** Đọc trước khi gõ dòng code đầu tiên trong `apps/` hoặc `packages/`.
> File này **không phát minh luật mới**. Nó viết ra thành lời những gì mã nguồn hiện tại đã làm, để 3 người code song song 6 nhóm tính năng mà không mỗi người một kiểu.
> Cập nhật: 2026-08-12 · Suy ra từ mã nguồn walking skeleton (52 test xanh).

## 0. Thứ tự nguồn luật — khi hai chỗ mâu thuẫn

```
Specs BTC  >  docs/ontology.md  >  docs/decisions/ (ADR)  >  file này  >  thói quen cá nhân
```

File này **không được** đè lên ontology hay ADR. Thấy mâu thuẫn: dừng, hỏi, rồi sửa cái sai — đừng code theo cả hai.

---

## 1. Ngôn ngữ trong mã nguồn

**Luật:** code và comment viết **tiếng Anh**. Chỉ **chuỗi hiển thị cho người dùng** giữ **tiếng Việt**.

| Thứ | Ngôn ngữ | Ví dụ thật trong repo |
| --- | --- | --- |
| Tên biến, hàm, class, file, bảng, cột | Anh | `WatchCycleService`, `company-service.ts`, `next_step_source` |
| Comment, JSDoc | Anh | `packages/db/src/client.ts` |
| Nhãn enum (giá trị hiển thị) | **Việt** | `STAGE.drafting = 'Soạn đề xuất'` |
| Thông báo lỗi tới người dùng | **Việt** | `'Hệ thống không được tạo công ty'` |
| Message validation zod | **Việt** | `'Tên công ty không được để trống'` |
| Đoạn URL (Sales nhìn thấy trên thanh địa chỉ) | **Việt** | `/dang-nhap`, `/cong-ty` |
| Tên file component, tên prop, tên biến trong file đó | **Anh** | `confidence-badge.tsx`, `quoteText` |
| Log server, message `Error` nội bộ | Anh | `'Invalid APP_ROLE: ...'` |

Vạch ranh giới: **hễ Sales đọc được bằng mắt thì tiếng Việt, còn lại tiếng Anh.** Đoạn URL nằm bên tiếng Việt vì nó hiện trên thanh địa chỉ; tên file `.tsx` sinh ra nó thì không.

> **Việc cần làm (nợ Phase 5):** 3 component đặt chỗ trong `phase-05` được đặt tên trước khi có luật này. Đổi khi tạo: `badge-do-tin-cay.tsx` → `confidence-badge.tsx` · `khoi-cau-trich.tsx` → `quote-block.tsx` · `nhan-do-he-thong-them.tsx` → `system-added-label.tsx`. Đường dẫn route giữ nguyên tiếng Việt.

---

## 2. Từ vựng — ontology là nguồn sự thật

Tên thực thể, tên cột, tên enum **lấy đúng** từ [ontology.md](ontology.md) mục 3. Không tự đặt từ đồng nghĩa.

- Enum khai báo **đúng một chỗ**: `packages/contracts/src/enums.ts`. Key = mã dùng trong code/CSDL/API, value = nhãn tiếng Việt hiển thị.
- Drizzle `pgEnum` nhận mã qua `enumCodes(...)`, **không** gõ lại mảng chuỗi.
- Thêm/sửa enum mà quên `docs/ontology.md` → `ontology-enum-parity.test.ts` đỏ. Đó là chủ đích, đừng sửa test cho xanh.
- Bẫy đặt tên đã biết: giai đoạn "Soạn đề xuất" là `drafting`, **không phải** `proposal` — `Proposal` đã là tên thực thể gợi ý của AI.

---

## 3. Ranh giới package — chiều phụ thuộc chỉ đi một hướng

```
@crm/contracts  ←  @crm/db  ←  @crm/api
       ↑
   @crm/web
```

| Luật | Vì sao |
| --- | --- |
| `@crm/contracts` **không** phụ thuộc gì ngoài `zod` | Cả web lẫn api đều nhập nó; kéo thêm phụ thuộc là kéo cả Nest vào bundle trình duyệt |
| `@crm/web` **cấm** import `@crm/db` | Schema CSDL không được rò ra trình duyệt. Web chỉ biết DTO |
| Import chéo package luôn qua tên package (`@crm/db`), **không bao giờ** dùng đường dẫn tương đối `../../packages/...` | Đường dẫn tương đối vượt package sẽ vỡ khi build `dist` |
| Type dùng chung giữa web và api → đặt ở `contracts`, không copy | Copy là hai định nghĩa sẽ trôi lệch nhau |

Đặt code mới vào đâu:

- Hợp đồng FE↔API, enum, port của AI → `packages/contracts/src/{dto,ports}/`
- Bảng, migration, seed → `packages/db/src/{schema,seed}/`
- Nghiệp vụ, guard, controller → `apps/api/src/{domain,common,auth,...}/`
- Màn hình → `apps/web/src/`

---

## 4. Đặt tên file

**kebab-case, dài và tự mô tả.** Tên dài không sao, quan trọng là Grep/Glob tìm ra.

| Loại | Quy ước | Ví dụ trong repo |
| --- | --- | --- |
| Service nghiệp vụ | `<danh-từ>-service.ts` | `watch-cycle-service.ts`, `audit-event-service.ts` |
| Tạo tác của NestJS | giữ chấm theo Nest | `jwt.guard.ts`, `db.module.ts`, `company.controller.ts`, `zod-validation.pipe.ts`, `actor.interceptor.ts` |
| Schema Drizzle | tên bảng số nhiều | `timeline-entries.ts`, `watch-cycle-runs.ts` |
| Test | `<điều-cần-chứng-minh>.test.ts` | `column-grants-block-system-actor.test.ts`, `seed-idempotent.test.ts` |
| Component React | `<danh-từ>.tsx` tiếng Anh | `confidence-badge.tsx` |

Đặt tên test theo **điều nó chứng minh**, không theo tên hàm nó gọi. `seed-idempotent.test.ts` nói được nó giữ cái gì; `seed.test.ts` thì không.

**File > 200 dòng: cân nhắc tách.** Kiểm tra module đã có trước khi tạo mới. Không tách file cấu hình, markdown, script shell.

---

## 5. TypeScript

- `strict: true` ở mọi package. Không tắt.
- `@typescript-eslint/no-explicit-any` là **warn**, coi như **cấm**: mỗi `any` phải kèm comment nói vì sao. Không có comment thì sửa, đừng để tồn.
- Import type dùng `import type { ... }` — SWC/esbuild cần biết cái gì xoá được lúc biên dịch.
- Type biến đổi lấy từ nguồn, không gõ tay: `z.infer<typeof schema>`, `typeof companies.$inferSelect`.
- Biến môi trường đọc qua hàm fail-fast, không `process.env.X!` rải khắp nơi — mẫu ở `requireEnv()` trong `packages/db/src/client.ts`.
- Thứ tự import: built-in Node → thư viện ngoài → package `@crm/*` → đường dẫn tương đối. Cách nhau một dòng trắng.

---

## 6. Actor — luật đắt nhất của dự án (ADR-0004)

> **`actor` là tham số ĐẦU TIÊN, BẮT BUỘC của mọi phương thức ghi.**

```ts
async create(actor: Actor, dto: CreateCompanyDto): Promise<CompanyDto>
async updateStage(actor: Actor, id: string, stage: Stage): Promise<void>
```

Ba luật đi kèm, không được vi phạm cái nào:

1. **Service KHÔNG gọi `getCurrentActor()`.** Chỉ tầng ngoài (controller, interceptor) được đọc context rồi truyền xuống. Service đọc context ngầm sẽ thấy context rỗng khi test gọi `new Service(...)` trực tiếp, âm thầm mặc định `human`, và cả bộ test đi chứng minh nhầm thứ.
2. **Không đoán actor.** `getCurrentActor()` trả `undefined` khi không có context — không mặc định `human`. Controller không xác định được actor thì ném `UnauthorizedException`.
3. **Kiểm tra ranh giới nằm trong service, không nằm trong controller.** Vòng cấm phải chặn được cả khi lệnh không đến từ giao diện (CLAUDE.md mục 4).

Vùng cấm tuyệt đối với `actor.kind === 'system'` (ontology mục 5): đổi giai đoạn · đánh Thắng/Thua · sửa giá trị tiền · liên hệ khách · xoá dữ liệu người tạo.

---

## 7. Chọn pool CSDL — lớp chặn thứ hai (ADR-0010)

`DRIZZLE_APP` và `DRIZZLE_SYSTEM` là **hai danh tính** ở tầng Postgres, không phải hai bản sao cho nhanh. Chọn nhầm là **âm thầm** mất lớp chặn thứ hai.

| Service | Inject | Luật |
| --- | --- | --- |
| Chỉ chạm dữ liệu chính thức của Sales | **chỉ** `DRIZZLE_APP` | Không inject cái không dùng — thà thiếu còn hơn để đó chờ ai dùng nhầm |
| Chỉ chạy nhánh AI / worker | **chỉ** `DRIZZLE_SYSTEM` | |
| Cả người và hệ thống cùng ghi | cả hai, **chọn theo `actor`** | Không bao giờ chọn theo cái nào sẵn tay. Mẫu: `dbFor(actor)` trong `audit-event-service.ts` |

`crm_owner` **không** xuất hiện trong runtime app: chủ bảng bỏ qua quyền theo cột kể cả khi NOSUPERUSER (đã đo, ADR-0010). Role đó chỉ dành cho `migrate.ts` và `seed/`.

Cấm đưa `db:push` của drizzle-kit vào `package.json` — nó xoá GRANT.

---

## 8. Từ chối và vết kiểm toán

Khi ranh giới chặn một hành động:

```ts
await this.audit.recordRefusal(actor, action, entity, id, { reason: '... (I-11)' })
throw new ForbiddenException('Thông báo tiếng Việt cho Sales')
```

**Ghi vết TRƯỚC khi ném**, nếu không mất vết. Postgres chỉ trả `permission denied for table ...` — không nói ai gọi, định làm gì, dòng nào. Vòng 2 hỏi "chứng minh nó bị chặn thật" thì bảng `audit_events` là câu trả lời, không phải chuỗi lỗi của Postgres.

Ghi audit qua **pool của chính actor đó**. Ghi hành động `system` qua `crm_app` là làm vết kiểm toán nói dối.

---

## 9. Cấu hình — giá trị hiệu lực nằm ở CSDL

- `ai_enabled`, `watch_cycle_seconds`: giá trị **hiệu lực** ở bảng `system_settings`. `.env` chỉ là **giá trị khởi tạo**, đọc đúng một lần lúc seed (ontology 3.4, ADR-0011).
- **Không cache, không TTL** khi đọc setting. Đây không phải bỏ sót tối ưu — đó là điều kiện để nút tắt AI (T-9) có hiệu lực ngay. Thêm cache là cắt kênh liên lạc duy nhất giữa API và worker.
- Dữ liệu rác trong CSDL không được biến thành vòng lặp quay tít: đọc số thì kiểm `Number.isFinite(x) && x > 0`, sai thì rơi về mặc định.
- Secret: không commit `.env`, token, key. Biến mới → thêm vào `.env.example` kèm comment nói nó dùng khi nào.

---

## 10. Comment — viết cái "vì sao", không viết lại cái code đã nói

Đây là điểm mã nguồn này khác chỗ khác, giữ cho bằng được. Một comment tốt trả lời: **vì sao chọn thế này, đã loại phương án nào, và hỏng gì nếu ai đó đổi.**

```ts
// ✅ Nói được hậu quả
/** Leave the `setTimeout` behind and the process never exits, hanging tests until timeout. */

// ❌ Lặp lại code
/** Clears the timer. */
```

- Được phép nhắc **ID bền**: `ADR-0011`, `I-7`, `T-10`, `ontology 3.4`, `spec 7.3`. Chúng là bất biến của domain, sống lâu hơn code.
- **Cấm** nhắc ID phù du: số phase, tên plan, mã finding của đợt review. Hết hackathon là vô nghĩa.
- Ghi thẳng giới hạn đã biết thay vì giấu — mẫu: comment `scanning` trong `watch-cycle-service.ts` nói rõ nó chỉ đúng khi có **một** worker.

---

## 11. Lỗi

- API ném exception của Nest (`ForbiddenException`, `UnauthorizedException`, `BadRequestException`), message tiếng Việt. Không trả `{ ok: false }` kèm HTTP 200.
- Validate đầu vào bằng chính schema zod ở `@crm/contracts`, qua `ZodValidationPipe`. Không viết tay validate lần hai trong controller.
- Web nhận lỗi qua `ApiError` (có `status`), hiện **tại chỗ người dùng vừa thao tác**. Không nuốt lỗi vào `console.log`.
- Không `catch` rồi bỏ qua. Nuốt lỗi thì phải có comment nói vì sao nuốt được (mẫu: `awaitCurrentTick()`).

---

## 12. Test

| Luật | Chi tiết |
| --- | --- |
| Vị trí | `src/**/__tests__/*.test.ts`, cạnh code nó kiểm |
| Chạy | `pnpm test:unit` (vitest) · `pnpm test:e2e` (playwright) · `pnpm test` cả hai |
| Song song | `fileParallelism: false` ở **vitest.config.ts gốc**. Mọi test tích hợp dùng chung `crm_test` và đều TRUNCATE; chạy song song là file này xoá bảng khi file kia đang assert. Đặt trong config con **không có tác dụng** |
| Dọn dẹp | `TRUNCATE ... RESTART IDENTITY CASCADE` trong `beforeEach`; đóng pool trong `afterAll`, không thì test treo tới timeout |
| Không mock để qua test | Cấm fake data, cấm mock server. Sample data demo để riêng `packages/db/src/seed/`, đánh dấu rõ là seed |
| Test chặn phải **3 assertion** | (1) ném lỗi · (2) có `AuditEvent` · (3) **dữ liệu không đổi**. Chỉ kiểm "có ném" thì một service vừa ném vừa ghi vẫn xanh, và cả đội tin nhầm là đã chặn |
| Kiểm **cả hai chiều** | Cấm phải cấm **và** cho phải cho. Mẫu: `t10-mini-system-actor-blocked.test.ts` — cùng lời gọi đó, actor người thì phải chạy được |
| Tầng thấp nhất | Test ranh giới gọi thẳng `new Service(...)`, không dựng HTTP, không qua guard. Chặn qua guard chỉ chứng minh guard chạy, không chứng minh domain chặn |

Không phase nào coi là xong khi test của nó chưa xanh. Không sửa test cho xanh — sửa code.

---

## 13. apps/web — luật frontend

Kiến trúc đã chốt ở Phase 5, áp cho **mọi** màn hình sau, không chỉ hai màn skeleton:

- **App Router + client component + TanStack Query.** Không dùng Server Action: hàng đợi duyệt (nhóm 3) cần phản hồi tức thì và cần đo `seconds_to_decide`.
- **`src/lib/api-client.ts` là cửa duy nhất ra API.** Không `fetch` rải rác trong component.
- Đường dẫn API luôn **tương đối** `/api/...`, `credentials: 'include'`. **Cấm chuỗi `localhost:3001`** ở bất kỳ đâu trong `apps/web` — hardcode host là giết luôn cookie `httpOnly` cùng origin.
- `output: 'standalone'` bật từ đầu, không bật muộn.

Cấu trúc thư mục:

```
src/app/<doan-url-tieng-viet>/page.tsx   route
src/components/ui/                       primitive shadcn, không chứa nghiệp vụ
src/components/<domain>/                 khối nghiệp vụ, tên file tiếng Anh
src/lib/                                 api-client, query provider, helper
```

Dữ liệu:

- Query key theo hình `['companies']`, `['company', id]` — danh từ số nhiều cho danh sách, kèm id cho chi tiết.
- Sau mutation thành công: `invalidateQueries` đúng key. Không tự sửa cache bằng tay khi chưa cần.
- Trạng thái rỗng phải hiện rõ "chưa có dữ liệu", **không** hiện bảng trống không lời giải thích (luật 4: một dòng sai tệ hơn một dòng để trống).

Ba luật sản phẩm phải **ép ở tầng component**, không trông vào thiện chí người viết:

| Luật | Cách ép bằng code |
| --- | --- |
| **Không provenance thì không hiển thị** | Component hiện nhận định AI **bắt buộc** nhận prop nguồn (`quoteText` + `sourceId`) không cho `undefined`. Thiếu → TypeScript đỏ, không render được. Không thêm nhánh "nếu thiếu thì hiện tạm" |
| **Fact và suy luận phân biệt được bằng mắt** | Dữ liệu người nhập và nhận định AI đi qua **hai component khác nhau**, khác nền/viền. Không dùng chung một component rồi truyền cờ `isAi` — cờ sẽ bị quên |
| **Chỗ hệ thống tự ghi phải gỡ được dễ hơn lúc ghi** | Mục do hệ thống thêm luôn kèm `system-added-label.tsx` + nút gỡ/hoàn tác ngay cạnh, không giấu trong menu phụ |

Cấm: `dangerouslySetInnerHTML` với nội dung lấy từ nguồn ngoài (bản chụp web là dữ liệu không tin được) · lưu token vào `localStorage` (phiên nằm ở cookie `httpOnly`) · hardcode màu thay vì token Tailwind.

---

## 14. Git

- Conventional commit, scope theo package hoặc nghiệp vụ. **Không nhắc AI trong message.**

```
feat(proposal): thêm hàng đợi duyệt kèm nút accept/reject
fix(provenance): claim mất source_id không được render
docs(adr): ADR-0004 chọn cơ chế lưu observation snapshot
```

- Không commit `.env`, token, key, dữ liệu cá nhân.
- Không đặt số phase / tên plan vào commit message hay tên migration — viết thẳng hành vi.

---

## 15. Trước khi mở PR — tự kiểm

- [ ] `pnpm lint` sạch · `pnpm typecheck` sạch · `pnpm test` xanh
- [ ] Mọi phương thức ghi mới nhận `actor` là tham số đầu
- [ ] Service mới inject **đúng** pool cần dùng, không thừa
- [ ] Tên bảng/cột/enum khớp `docs/ontology.md`
- [ ] Nếu hiển thị nhận định AI: bấm ra được nguồn
- [ ] Nếu là proposal: có accept/reject và có ghi nhận vào metric
- [ ] Quyết định kiến trúc phát sinh đã có ADR
- [ ] Có ít nhất 1 người ngoài người viết hiểu và giải thích lại được

---

## Câu hỏi chưa giải quyết

- **Bản chụp lưu HTML hay text** (Q-3 BTC) → quyết `quote_start`/`quote_end` tính trên chuỗi nào (I-2). Chưa chặn code hiện tại (`raw_content` đang là `text`), nhưng chặn nhóm 2.
- **Admin có được thao tác CRM không** (Q-6) → `RolesGuard` mới phân biệt hai vai, chưa có ma trận quyền. Đừng đoán trong code.
- **Chưa có luật lint tự động** cho ba luật đắt nhất (actor tham số đầu · chọn pool theo actor · cấm `localhost` trong `apps/web`). Hiện dựa vào review. Nếu còn thời gian sau feature freeze thì thêm rule ESLint.
- `README.md` mục "Lệnh" và "Stack" vẫn ghi TBD — lệch với `package.json` gốc.

## Hiện trạng cổng chất lượng (đo ngày 12/08, sẽ hết hạn khi Phase 5 xong)

Ghi ra để không ai tưởng checklist mục 15 đang xanh hết:

| Lệnh | Kết quả thật |
| --- | --- |
| `pnpm lint` | ✅ sạch |
| `pnpm test:unit` | ✅ 52 test xanh (contracts 22 · db 11 · api 19) |
| `pnpm typecheck` | ❌ đỏ ở `apps/web`: chưa cài phụ thuộc nên không thấy `next` và `@crm/contracts`. Ba package kia xanh |
| `pnpm test:e2e` → kéo theo `pnpm test` | ❌ chưa dựng: chưa cài Playwright, chưa có `playwright.config.ts` và thư mục `e2e/` |

Cả hai chỗ đỏ đều thuộc Phase 5 đang làm dở, không phải nợ kỹ thuật mới. Xoá bảng này khi Phase 5 đóng.

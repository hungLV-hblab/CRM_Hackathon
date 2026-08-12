# Research Report: Best practice khởi động dự án CRM bằng vibe coding / SDD

**Ngày research:** 2026-08-10 22:44 (Asia/Saigon)
**Scope:** day-0 sequence, build-vs-fork, domain model, MVP scope, traps agent hay sai, ClaudeKit kickoff
**Nguồn:** 5 web searches (~40 nguồn)
**Report trước liên quan:** `vibe-coding-team-workflow-research-260810-2221-rules-docs-claudekit-best-practices-report.md`

---

## Mục lục

1. [Executive Summary](#executive-summary)
2. [Quyết định #0: Build hay Fork](#1-quyết-định-0-build-hay-fork)
3. [Quyết định #1: B2B hay B2C — đổi cả schema](#2-quyết-định-1-b2b-hay-b2c)
4. [MVP scope: cắt tới xương](#3-mvp-scope-cắt-tới-xương)
5. [Domain model tối thiểu](#4-domain-model-tối-thiểu)
6. [10 trap CRM mà AI agent luôn làm sai](#5-10-trap-crm-mà-ai-agent-luôn-làm-sai)
7. [Multi-tenancy: quyết ngày 0, không retrofit](#6-multi-tenancy)
8. [RBAC kiểu CRM ≠ RBAC thường](#7-rbac-kiểu-crm)
9. [Stack đề xuất](#8-stack-đề-xuất)
10. [Kickoff sequence 14 ngày với ClaudeKit](#9-kickoff-sequence-14-ngày)
11. [Anti-patterns](#10-anti-patterns)
12. [Unresolved questions](#11-unresolved-questions)

---

## Executive Summary

**Câu trả lời ngắn:** CRM là **domain-heavy, không phải tech-heavy**. Phần khó không phải code — là quyết định model. Vì vậy "vibe" CRM đúng cách = dành ngày đầu tiên viết spec domain, **không viết dòng code nào**, rồi mới để agent chạy.

**Ba con số quyết định mọi thứ:**

| Số liệu | Ý nghĩa với bạn |
|---|---|
| ~50% CRM implementation thất bại | Rủi ro chính không phải kỹ thuật |
| 80% field không dùng sau 6 tháng (Gartner) | Bắt đầu 15–20 field/object, không hơn |
| >70% breach multi-tenant do lỗi isolation ở **app layer** (PingCAP, 120 app) | Isolation phải ở **DB layer** (RLS), không tin app code |

**Nguyên nhân thất bại CRM — theo thứ tự, không có cái nào là kỹ thuật:**
1. Mục tiêu không rõ ("làm CRM" không phải mục tiêu)
2. **Over-customization** — cố phủ mọi kịch bản → hệ thống phình, khó dùng, khó maintain
3. User không dùng (adoption) — phần mềm lệch với cách team làm việc thật
4. Data quality kém
5. Coi CRM là dự án công nghệ thay vì dự án business

Điều này cực kỳ nguy hiểm với vibe coding: **AI làm cho over-customization gần như miễn phí**. Bảo agent "thêm custom field, thêm workflow engine, thêm automation rules" → nó làm trong 20 phút. Đó chính xác là cách bạn tạo ra hệ thống 80% field vô dụng, chỉ nhanh hơn 50 lần.

> **Ràng buộc số một khi vibe một CRM: khả năng nói KHÔNG.** Tốc độ sinh code không còn là bottleneck; kỷ luật scope mới là.

---

## 1. Quyết định #0: Build hay Fork

Đây là quyết định đắt nhất, phải chốt trước khi gõ phím.

### Ma trận quyết định

| Tình huống | Lựa chọn | Lý do |
|---|---|---|
| CRM nội bộ, quy trình sales chuẩn | **Fork EspoCRM / Twenty** | 90% tính năng có sẵn, bạn chỉ customize |
| Cần CRM vì quy trình đặc thù không CRM nào làm được | **Build** | Chính cái đặc thù đó là lý do tồn tại |
| Làm SaaS bán cho khách | **Build** (hoặc fork rất cẩn thận về license) | Xem cảnh báo AGPL bên dưới |
| Học / portfolio / muốn kiểm soát toàn bộ | **Build** | Mục tiêu là quá trình, không phải sản phẩm |
| Cần dùng trong < 1 tháng | **Fork** hoặc mua | Build CRM production < 1 tháng là ảo tưởng |

### So sánh open-source (2026)

| | Twenty | EspoCRM | SuiteCRM |
|---|---|---|---|
| Stack | TypeScript/React, GraphQL + REST | PHP/MySQL | PHP/MySQL |
| Điểm mạnh | UX hiện đại nhất, dễ tích hợp app mới, GitHub-native | Cân bằng, dễ setup hơn SuiteCRM | Trưởng thành nhất, 5M+ user, nhiều module |
| Điểm yếu | Trẻ hơn, ít module | UX truyền thống | Nặng, UX cũ |
| Hợp với | Team dev hiện đại, muốn self-host | Team muốn CRM truyền thống, ít fuss | Nhu cầu enterprise, có team vận hành |
| License | — | — | **AGPL-3.0** |

⚠️ **Bẫy license:** SuiteCRM là AGPL-3.0. Dùng nội bộ: hoàn toàn ổn. Nhưng nếu bạn **sửa code và cung cấp dưới dạng dịch vụ hosted** → điều khoản network buộc bạn phải publish thay đổi. Nếu định làm SaaS bán cho khách, kiểm tra license **trước** khi fork, không phải sau khi đã viết 6 tháng.

### Nếu fork — vibe khác đi thế nào

Fork **không** làm việc dễ hơn cho agent, mà khó hơn: agent phải hiểu codebase có sẵn (hàng trăm nghìn dòng) trước khi sửa. Sequence khác hẳn:

```
1. /ck:repomix hoặc /ck:graphify  → pack codebase cho agent hiểu
2. /ck:docs:init                  → sinh docs kiến trúc của repo fork
3. Người đọc + sửa docs           → ghi lại extension point, chỗ được phép sửa
4. Chỉ khi đó mới /ck:plan feature customization
```

Đừng bao giờ bảo agent "thêm feature X" vào codebase lạ mà chưa qua bước 1–3. Nó sẽ tạo module song song thay vì dùng extension point có sẵn → mất luôn khả năng upgrade upstream.

---

## 2. Quyết định #1: B2B hay B2C

Quyết định này **đổi cả data model**, không phải chi tiết nhỏ.

```
B2B                                    B2C
────────────────────────────────       ────────────────────────────────
Account (công ty) là trung tâm         Contact (cá nhân) là trung tâm
1 deal ↔ nhiều contact (6–10 người     Company thường vô nghĩa
  ra quyết định trong buying group)
Cần association label                  Cần lifecycle stage, subscription
  (ai là decision maker, ai là user)      status, transaction history
Deal cycle dài, nhiều stage            Volume cao, cycle ngắn
```

Chọn sai → 3 tháng sau phải viết lại core schema. Agent **không** hỏi bạn cái này; nó sẽ đoán và thường đoán B2B (vì tài liệu training nhiều hơn).

**Ghi vào spec ngay dòng đầu.**

---

## 3. MVP scope: cắt tới xương

### Nguyên tắc: một luồng công việc trọn vẹn, chạy được end-to-end

MVP tốt = **1 user journey hoàn chỉnh từ đầu đến giá trị**, không phải 10 feature dở dang.

### V1 — chỉ 3 thứ

| Feature | Vì sao bắt buộc |
|---|---|
| **Contact management** | Không có contact thì không có CRM |
| **Pipeline (deal + stage)** | Đây là thứ khiến CRM khác một bảng Excel |
| **Activity log gắn vào contact/deal** | call/email/meeting/note + thời gian + mô tả + liên kết. Đây là **giá trị cốt lõi**: lịch sử tương tác đầy đủ |

Ba cái này. Hết. Nếu chưa có người dùng thật dùng hàng ngày 3 tính năng này thì mọi thứ thêm vào đều là đầu cơ.

### V1 — cấm tuyệt đối

❌ Workflow/automation engine
❌ Custom field builder cho user
❌ Email integration 2 chiều
❌ Reporting/dashboard builder
❌ Mobile app
❌ AI features (lead scoring, summarize...)
❌ Import/export phức tạp
❌ Marketing automation

Mỗi cái trên là 1 dự án riêng. Agent sẽ vui vẻ làm hết trong 2 ngày và bạn sẽ có 8 module không cái nào hoạt động đúng.

### Field budget: 15–20 field mỗi object

Gartner: **80% field CRM không được dùng sau 6 tháng.** Quy tắc cứng:

> Không thêm field nào trừ khi chỉ ra được **báo cáo cụ thể** hoặc **automation cụ thể** sẽ dùng nó.

"Biết đâu sau này cần" = không thêm. Đây là YAGNI ở dạng thuần khiết nhất, và là chỗ AI phá hoại mạnh nhất.

---

## 4. Domain model tối thiểu

### Vòng đời chuẩn (đừng phát minh lại)

```
Lead  ──[qualify]──>  Contact  +  Account  +  Deal(optional)
 │                        │           │          │
 │ flat record            │ person    │ company  │ có value, stage, close date
 │ chưa gắn account       │           │          │
 │ chưa gắn deal          └───────────┴──────────┘
 │                                    │
 └── disqualified ──> lưu lại,   Activity (timeline) gắn vào bất kỳ cái nào
     KHÔNG xoá
```

**Điểm mấu chốt agent hay bỏ:** Lead là **record phẳng** gộp thông tin cá nhân + công ty + cơ hội vào một dòng, *vì lúc đó chưa biết đủ để tách*. Khi qualify → chạy **conversion process**: tách thành Contact, link vào Account, tuỳ chọn tạo Deal.

Nếu agent gộp Lead và Contact thành một bảng `customers` → sai từ gốc, không sửa được bằng migration nhỏ.

### Schema skeleton (Postgres)

```sql
-- Mọi bảng tenant-scoped đều có tenant_id + index. Không ngoại lệ.
create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table accounts (              -- công ty (B2B). B2C: bỏ bảng này.
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  name text not null,
  domain text,
  owner_id uuid references users(id),   -- record-level ownership
  custom jsonb not null default '{}',   -- custom field: JSONB, KHÔNG ALTER TABLE
  deleted_at timestamptz,               -- soft delete. CRM không bao giờ hard delete.
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on accounts (tenant_id) where deleted_at is null;

create table contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  account_id uuid references accounts(id),
  first_name text, last_name text,
  owner_id uuid references users(id),
  custom jsonb not null default '{}',
  deleted_at timestamptz,
  merged_into_id uuid references contacts(id),  -- merge duplicate: giữ vết
  created_at timestamptz not null default now()
);
create index on contacts (tenant_id) where deleted_at is null;

-- Một người có NHIỀU email/phone. Đừng nhét vào 1 cột.
create table contact_emails (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  contact_id uuid not null references contacts(id),
  email citext not null,
  is_primary boolean not null default false
);
-- unique THEO tenant, không unique toàn cục
create unique index on contact_emails (tenant_id, email);

create table pipelines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  name text not null
);
create table pipeline_stages (       -- stage là DATA, không phải enum hardcode
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  pipeline_id uuid not null references pipelines(id),
  name text not null,
  position int not null,
  is_won boolean not null default false,
  is_lost boolean not null default false
);

create table deals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  account_id uuid references accounts(id),
  stage_id uuid not null references pipeline_stages(id),
  title text not null,
  amount_minor bigint,               -- TIỀN: integer minor units. KHÔNG float.
  currency char(3) not null default 'VND',
  expected_close_date date,
  owner_id uuid references users(id),
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

-- B2B: nhiều contact trên 1 deal, mỗi người 1 vai trò
create table deal_contacts (
  deal_id uuid references deals(id),
  contact_id uuid references contacts(id),
  role text,                          -- 'decision_maker' | 'champion' | 'user' ...
  primary key (deal_id, contact_id)
);

-- Timeline. subject_type/subject_id = polymorphic, KHÔNG có FK -> cần validate ở app.
create table activities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  kind text not null,                 -- 'call' | 'email' | 'meeting' | 'note'
  subject_type text not null,         -- 'contact' | 'deal' | 'account'
  subject_id uuid not null,
  body text,
  occurred_at timestamptz not null,   -- timestamptz, KHÔNG timestamp
  actor_id uuid references users(id),
  created_at timestamptz not null default now()
);
create index on activities (tenant_id, subject_type, subject_id, occurred_at desc);

-- Audit log: append-only, không update/delete
create table audit_log (
  id bigserial primary key,
  tenant_id uuid not null,
  actor_id uuid,
  action text not null,               -- 'create'|'update'|'delete'|'export'|'view_pii'
  entity_type text not null,
  entity_id uuid not null,
  diff jsonb,
  at timestamptz not null default now()
);

-- Lịch sử chuyển stage: cần cho MỌI báo cáo sales sau này.
create table deal_stage_history (
  id bigserial primary key,
  tenant_id uuid not null,
  deal_id uuid not null references deals(id),
  from_stage_id uuid, to_stage_id uuid not null,
  changed_at timestamptz not null default now(),
  changed_by uuid
);
```

`deal_stage_history` là bảng người ta luôn quên và luôn phải thêm sau — lúc đó dữ liệu quá khứ đã mất vĩnh viễn. Thêm ngay từ ngày 0, chi phí gần bằng 0.

---

## 5. 10 trap CRM mà AI agent luôn làm sai

Đây là danh sách **phải ghi vào spec/rules**, vì agent sẽ mắc lại mỗi session nếu không ghi:

| # | Trap | Agent thường làm | Đúng |
|---|---|---|---|
| 1 | **Lead vs Contact** | Gộp thành bảng `customers` | Tách; có conversion process |
| 2 | **Hard delete** | `DELETE FROM contacts` | `deleted_at`, không bao giờ hard delete |
| 3 | **Tenant** | Quên `tenant_id`, thêm sau | `tenant_id` mọi bảng + RLS từ ngày 0 |
| 4 | **Custom field** | `ALTER TABLE` mỗi lần, hoặc EAV quá sớm | Cột `jsonb` + registry định nghĩa field |
| 5 | **Tiền** | `float` / `decimal` không rõ đơn vị | Integer minor units + mã currency |
| 6 | **Thời gian** | `timestamp` không timezone | `timestamptz` mọi nơi, lưu UTC |
| 7 | **Pipeline stage** | Hardcode enum `'new','won','lost'` | Bảng `pipeline_stages`, stage là data |
| 8 | **Email unique** | `unique(email)` toàn cục | Unique theo tenant; 1 người nhiều email |
| 9 | **Merge duplicate** | Không nghĩ tới | `merged_into_id` + giữ vết; CRM nào cũng cần |
| 10 | **Timeline polymorphic** | Tạo `contact_activities`, `deal_activities`... riêng | Một bảng `activities` + subject_type/id |

Thêm 2 cái đặc thù vibe coding:

| # | Trap | Hậu quả |
|---|---|---|
| 11 | **Agent thêm field "cho chắc"** | Vào thẳng 80% field vô dụng |
| 12 | **Agent build workflow engine khi bạn xin "gửi email khi deal won"** | 2000 dòng để giải bài toán 20 dòng |

Trap 11 và 12 là lý do #2 trong danh sách nguyên nhân CRM thất bại (over-customization) — và AI làm nó xảy ra nhanh gấp 50 lần.

---

## 6. Multi-tenancy

### Quyết ngay ngày 0. Retrofit = viết lại.

Ba mô hình:

| Mô hình | Isolation | Chi phí vận hành | Hợp với |
|---|---|---|---|
| Shared schema + `tenant_id` + **RLS** | Tốt (DB-enforced) | Thấp nhất | **Mặc định cho hầu hết SaaS** |
| Schema per tenant | Cao hơn | Trung bình | Chục–trăm tenant, cần tách rõ |
| DB per tenant | Cao nhất | Cao nhất | Enterprise, yêu cầu compliance/data residency |

Xu hướng 2026: **hybrid** — tier thường dùng pooled (shared+RLS), enterprise có compliance thì tách riêng. Cho phép bắt đầu rẻ mà vẫn bán được lên enterprise.

**Khuyến nghị:** shared schema + RLS. Đây là điểm cân bằng tốt nhất giữa isolation và độ đơn giản vận hành.

### Vì sao bắt buộc RLS, không tin app code

PingCAP khảo sát 120 SaaS app: **>70% breach multi-tenant đến từ lỗi isolation ở tầng application**. Nghĩa là: một câu query quên `WHERE tenant_id = ?` là đủ. Với vibe coding — agent sinh hàng trăm query — xác suất quên gần như bằng 1.

RLS đẩy isolation xuống DB: **kể cả khi code có bug, DB vẫn chặn.**

```sql
alter table contacts enable row level security;
alter table contacts force row level security;   -- áp cả với owner của table

create policy tenant_isolation on contacts
  using (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

Set context ở middleware/ORM session mỗi request:
```sql
set local app.current_tenant_id = '<uuid>';
```

**Giới hạn phải biết:** RLS chỉ cô lập **row**. Không giới hạn disk, CPU, cache theo tenant. Một tenant chạy query nặng vẫn làm chậm mọi tenant khác. Cần rate limit riêng ở tầng app.

**Admin access:** dùng **policy-based** (policy riêng cho role admin), **không** dùng `BYPASSRLS`. Bypass là không audit được và không revoke được.

---

## 7. RBAC kiểu CRM

CRM không dùng RBAC thuần. Nó cần **record-level ownership + team visibility** — đây là điểm agent hay làm thiếu.

```
Câu hỏi RBAC thường:  "User này được làm gì?"        → role → permission
Câu hỏi CRM:          "User này thấy được deal NÀO?"  → ownership + team + hierarchy
```

Mô hình tối thiểu cho V1:

```
Role (làm được gì):      admin | manager | sales_rep | viewer
Scope (thấy được gì):    own | team | all
```

Sales rep = `sales_rep` + scope `own` → chỉ thấy deal mình sở hữu.
Manager = `manager` + scope `team` → thấy deal của team mình.

Đủ cho V1. **Đừng** build permission matrix từng field ngay — đó là chỗ sinh ra "role explosion".

### Ba thứ phải thiết kế từ ngày 0, không retrofit được

Nguồn thống nhất: **RBAC, encryption, audit logging phải design từ ngày đầu, không phải bổ sung sau.**

1. **Audit log append-only** — log mọi access, change, export, admin action. Không update, không delete.
2. **Ghi log export** — export data là hành vi rò rỉ số một. Phải biết ai export cái gì, khi nào.
3. **PII marking** — đánh dấu field nào là PII ngay trong schema/spec. Cần cho GDPR/quyền xoá sau này.

Hai cái sau tốn ~1 ngày lúc đầu, tốn ~1 tháng nếu làm sau.

### Cạm bẫy dài hạn

- **Role explosion** — quá nhiều role, không ai hiểu role nào làm gì
- **Permission creep** — user tích luỹ quyền theo thời gian, không ai gỡ

Cả hai cần audit định kỳ. Ghi vào roadmap, đừng để tự nhớ.

---

## 8. Stack đề xuất

Nếu **build từ đầu**, ưu tiên stack mà ClaudeKit đã có skill sẵn — agent làm đúng cao hơn hẳn vì có reference cụ thể thay vì đoán:

| Lớp | Chọn | Skill ClaudeKit tương ứng |
|---|---|---|
| Framework | Next.js (App Router) | `web-frameworks`, `react-best-practices` |
| DB | PostgreSQL + RLS | `databases` |
| Auth | Better Auth (session, RBAC, MFA) | `better-auth` |
| UI | shadcn/ui + Tailwind | `ui-styling`, `ui-ux-pro-max` |
| Test | Playwright + Vitest | `web-testing` |
| Payment (nếu SaaS) | SePay/Stripe/Polar | `payment-integration` |
| Security audit | — | `ck-security`, `security-scan` |

Đây không phải "stack tốt nhất tuyệt đối" — là **stack có tỷ lệ agent-làm-đúng cao nhất trong môi trường của bạn**. Với vibe coding, đó là tiêu chí quan trọng hơn benchmark hiệu năng.

**ORM:** chọn cái set được session variable dễ dàng (cần cho RLS). Drizzle hoặc Prisma đều được, nhưng phải verify pattern set `app.current_tenant_id` per-request hoạt động với connection pooling — đây là chỗ hay hỏng ngầm (pool reuse connection → context tenant rò sang request khác). **Bắt buộc viết test cho việc này.**

---

## 9. Kickoff sequence 14 ngày

### Ngày 1 — KHÔNG viết code

```
Sáng: Trả lời 5 câu, viết ra file, không quá 1 trang
  1. Ai dùng? (bao nhiêu người, vai trò gì)
  2. B2B hay B2C?
  3. Quy trình sales hiện tại đang chạy bằng gì? (Excel? Zalo? Không có?)
  4. Nỗi đau số 1 cần giải? (một câu)
  5. Thành công đo bằng gì sau 3 tháng?

Chiều: /ck:brainstorm --problem-first
  → validate: có thật cần build không, hay fork/mua là đủ
  → CHỐT quyết định build vs fork
```

Nếu không trả lời được câu 4 bằng một câu → chưa đủ điều kiện bắt đầu. Đó là nguyên nhân thất bại #1.

### Ngày 2–3 — Domain spec

```
Tạo docs/domain/crm-core.md, người viết (không để agent tự sinh):
  - Ubiquitous language: Lead/Contact/Account/Deal nghĩa là gì TRONG NGHIỆP VỤ CỦA BẠN
  - Vòng đời: lead → qualify → convert. Điều kiện qualify là gì?
  - Pipeline stages thật của team bạn (không copy Salesforce)
  - Invariants: cái gì phải luôn đúng
  - Field list: 15-20 field/object, mỗi field kèm "dùng cho report/automation nào"
  - Quyết định đã LOẠI + lý do
```

Đây là artifact quan trọng nhất của cả dự án. Agent sẽ đọc nó mỗi session.

### Ngày 4 — Plan

```
/ck:plan  → plans/<slug>/plan.md + phase files
  Phase 01: schema + migration + RLS + seed
  Phase 02: auth + RBAC (own/team/all)
  Phase 03: Contact CRUD + list + search
  Phase 04: Pipeline + Deal + kanban drag
  Phase 05: Activity timeline
  Phase 06: audit log + export logging

REVIEW PLAN — đây là gate rẻ nhất. Sửa 1 câu ở đây = 500 dòng ở sau.
/ck:predict  (nếu chưa chắc về schema — 5 persona debate)
```

### Ngày 5–12 — Implement, từng phase một

```
Mỗi phase:
  /ck:cook <phase-file>
  /ck:test
  đọc diff  ← BẮT BUỘC, không skip
  /clear    ← reset context trước phase sau
```

Đọc diff không phải nghi thức: **45% code AI sinh chứa lỗ hổng OWASP Top 10.** Với CRM (chứa PII khách hàng) thì đây không phải rủi ro chấp nhận được.

**Sau Phase 01 và Phase 02** — chạy `/ck:security`. Auth và tenant isolation là hai chỗ lỗi đắt nhất, phát hiện sớm nhất có thể.

### Ngày 13–14 — Verify + đưa cho người thật

```
/ck:code-review
/ck:security
Test tenant isolation THỦ CÔNG: đăng nhập tenant A, thử truy cập id của tenant B
  → phải bị chặn ở DB, không chỉ ở UI
Đưa cho 1 sales thật dùng 3 ngày
```

Chỉ số duy nhất quan trọng ở tuần 3: **họ có mở nó lên ngày hôm sau không.** Nếu không → dừng code, đi hỏi vì sao. Đó là failure mode #3 (adoption), và không code thêm nào chữa được.

### Sau đó

Chỉ thêm feature khi có **người dùng thật yêu cầu 2 lần trở lên**. Không phải khi bạn nghĩ ra.

---

## 10. Anti-patterns

| Anti-pattern | Vì sao chết | Thay bằng |
|---|---|---|
| "Làm CRM giống Salesforce" | Salesforce có 20 năm + 10k kỹ sư | Giải 1 nỗi đau cụ thể |
| Bắt đầu bằng code | Domain sai → viết lại toàn bộ | Ngày 1 viết spec, không code |
| Để agent thiết kế schema | Nó đoán B2B/B2C, gộp Lead+Contact | Người viết domain model |
| Thêm `tenant_id` sau | Retrofit multi-tenancy = viết lại | Ngày 0, kèm RLS |
| Isolation chỉ ở app layer | >70% breach từ đây | RLS ở DB |
| Custom field builder ở V1 | Chưa biết field nào cần mà đã build framework | JSONB, thêm field thủ công |
| Workflow engine ở V1 | 2000 dòng cho bài toán 20 dòng | Hardcode 2-3 rule cụ thể |
| Hard delete | Mất data khách hàng = mất niềm tin | Soft delete + audit |
| Float cho tiền | Sai số tích luỹ, kế toán không khớp | Integer minor units |
| Copy pipeline stage của tool khác | Không khớp quy trình team → không ai dùng | Hỏi sales team thật |
| Không đọc diff AI sinh | 45% chứa OWASP Top 10, mà đây là PII | Review bắt buộc |
| Fork rồi sửa lung tung | Mất khả năng upgrade upstream | Hiểu extension point trước |
| Fork AGPL rồi bán SaaS | Rủi ro pháp lý | Check license trước |

---

## 11. Unresolved questions

Những câu này **đổi hẳn kế hoạch**, cần bạn trả lời trước khi bắt đầu:

1. **Build hay fork?** Report giả định build. Nếu fork → sequence hoàn toàn khác (§1).
2. **B2B hay B2C?** Đổi core schema (§2). Không có default an toàn.
3. **Ai dùng?** Nội bộ team bạn / khách hàng công ty bạn / bán làm SaaS? Quyết định multi-tenancy, auth, billing, và cả có cần multi-tenant hay không (nếu chỉ nội bộ 1 công ty → **bỏ toàn bộ tenant_id + RLS**, tiết kiệm rất nhiều).
4. **Có data cũ cần import?** Nếu có → data quality là failure mode #4, cần phase migration riêng, thường tốn hơn dự tính 3x.
5. **Stack có sẵn?** Repo `petty_ai` đang dùng gì? Nếu đã có stack quen thì dùng lại > chọn theo report này.
6. **Timeline & số người?** 1 người 2 tuần vs 3 người 3 tháng → scope khác nhau hoàn toàn.

---

---

## 12. ADDENDUM — Quyết định sau khi chốt context

**Context đã chốt (2026-08-10):** B2B · nội bộ 1 công ty · chưa quyết build/fork.

### 12.1 Ba đơn giản hoá lớn — xoá khỏi scope

Vì **nội bộ 1 công ty**:

| Bỏ | Tiết kiệm |
|---|---|
| `tenant_id` mọi bảng + RLS policy + middleware set context | ~1 tuần + toàn bộ rủi ro tenant leak |
| Billing / subscription / plan tier | ~1 tuần |
| Onboarding/signup flow, tenant provisioning | vài ngày |

Toàn bộ §6 (Multi-tenancy) **không áp dụng**. Chỉ giữ lại RBAC record-level ở §7 (own/team/all) — cái này vẫn cần vì sales rep không nên thấy deal của nhau.

⚠️ Chỉ giữ `tenant_id` nếu khả năng bán ra ngoài là **thật**, không phải "biết đâu". Thêm sau tốn ~1 tuần; thêm thừa ngay bây giờ tốn ~1 tuần + phức tạp vĩnh viễn. Với "nội bộ 1 công ty" → **bỏ**.

### 12.2 Build vs Fork: fork thắng rõ

Tổ hợp *B2B + nội bộ + quy trình sales tiêu chuẩn* rơi đúng vào ô mà **fork/mua thắng build**.

**Lý do, theo mức độ quan trọng:**

1. **Không có differentiation.** CRM không phải sản phẩm bạn bán. Mỗi giờ build core CRM = giờ tái tạo thứ đã tồn tại 20 năm. Zero lợi thế cạnh tranh.

2. **Failure mode thật là adoption, không phải code.** Nguyên nhân thất bại #3: phần mềm lệch với cách team làm việc → không ai dùng. V1 tự build (3 feature) sẽ **thua Excel hiện tại** ở nhiều mặt: không import, không search tốt, không attachment, không email, không mobile. Sales team sẽ quay lại Excel trong 2 tuần. Fork → user có UX trưởng thành từ ngày 1.

3. **Chi phí thật bị đánh giá thấp 5–10x.** MVP 3 feature ≈ 2 tuần với agent. Nhưng "CRM đủ dùng hàng ngày" cần thêm: import Excel, full-text search, attachment, email log, notification, báo cáo cơ bản, view mobile, undo/merge duplicate ≈ **3–6 tháng**. Fork cho tất cả miễn phí ngày đầu.

4. **Bảo trì vĩnh viễn.** Code tự build = bạn nuôi mãi. Fork = upstream vá bug và thêm feature cho bạn.

**Ba điều kiện lật ngược quyết định** — chỉ build nếu ≥1 điều đúng:

| Điều kiện | Kiểm tra thế nào |
|---|---|
| Quy trình sales **không mô hình hoá được** bằng CRM chuẩn | Thử map quy trình thật vào EspoCRM demo trong 1 ngày. Map được → fork. |
| CRM chỉ là **lớp mỏng** trên hệ thống nội bộ đã có (ERP/kho/kế toán); 80% giá trị nằm ở integration | Nếu đúng → build lớp mỏng, đừng build CRM |
| Mục tiêu thật là **học vibe coding**, CRM chỉ là đề bài | Nếu đúng → build, và bỏ qua toàn bộ lý lẽ ở trên |

**Đường giữa (thường đúng nhất):** fork làm CRM core → chỉ **build custom** phần thực sự đặc thù của công ty. Đây là chỗ vibe coding có giá trị cao nhất: viết integration/module riêng, không viết lại contact management.

### 12.3 Twenty vs EspoCRM cho case này

| | Twenty | EspoCRM |
|---|---|---|
| Stack | TypeScript/React, GraphQL + REST | PHP/MySQL |
| Customize bằng | Code (hợp nếu team là TS dev) | Chủ yếu qua admin UI (ít code hơn) |
| UX | Hiện đại nhất — quan trọng vì adoption là failure mode #1 | Truyền thống, chức năng đầy đủ |
| Setup | Docker | Dễ hơn SuiteCRM |
| Chọn khi | Team dev TS, cần customize sâu bằng code, UX là yếu tố adoption | Muốn ít code nhất, CRM truyền thống là đủ |

**SuiteCRM: loại** — quá nặng cho nội bộ 1 công ty, UX cũ làm adoption khó hơn.

⚠️ Chưa verify trong research này: mức độ customize được của EspoCRM qua admin UI mà không cần code (Entity Manager). Cần thử demo trước khi chốt.

### 12.4 Next step đề xuất — 1 ngày, trước mọi dòng code

```
Sáng (2h):  Viết ra quy trình sales THẬT của công ty
            - các stage thật, ai làm gì ở mỗi stage
            - dữ liệu hiện đang lưu ở đâu (Excel? Zalo? sổ?)
            - nỗi đau số 1, một câu

Chiều (4h): Dựng EspoCRM + Twenty bằng Docker (mỗi cái ~30 phút)
            Thử map quy trình vừa viết vào cả hai
            Nhập 20 contact + 5 deal thật

Chốt:  map được  → fork, sang bước customize
       map không được → ghi rõ CHỖ NÀO không map được
                        → đó chính là spec của phần cần build
```

Buổi chiều này tiết kiệm được vài tháng. Nếu bỏ qua nó và build luôn, bạn sẽ phát hiện ra điều tương tự vào tháng thứ 3.

---

## Sources

**CRM data model & multi-tenancy:**
- [CRM Data Model Explained: Contacts, Companies, Deals — MRIA CRM](https://mriacrm.com/crm-data-model-explained-contacts-companies-deals-and-beyond/)
- [What is a CRM data model? Objects and relationships — HubSpot](https://blog.hubspot.com/marketing/crm-data-model)
- [CRM Data Model Design: A 6-Step Guide — Rework](https://resources.rework.com/guides/crm-implementation/crm-data-model-design)
- [How to Build a Multi-Tenant CRM SaaS Platform — Abbacus](https://www.abbacustechnologies.com/how-to-build-a-multi-tenant-crm-saas-platform/)
- [Multi-Tenant SaaS Architecture Guide: 2026 Best Practices — Mallary](https://mallary.ai/blog/multi-tenant-saas-architecture)
- [Salesforce Data Model Design: Best Practices](https://www.getgenerative.ai/salesforce-data-model-design-best-practices/)

**Postgres RLS:**
- [Shipping multi-tenant SaaS using Postgres Row-Level Security — Nile](https://www.thenile.dev/blog/multi-tenant-rls)
- [Approaches to tenancy in Postgres — PlanetScale](https://planetscale.com/blog/approaches-to-tenancy-in-postgres)
- [Multi-tenant data isolation with PostgreSQL RLS — AWS Database Blog](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security)
- [How to Secure Multi-Tenant Data with RLS in PostgreSQL — OneUptime](https://oneuptime.com/blog/post/2026-01-25-row-level-security-postgresql/view)
- [Mastering PostgreSQL RLS for Rock-Solid Multi-Tenancy — Rico Fritzsche](https://ricofritzsche.me/mastering-postgresql-row-level-security-rls-for-rock-solid-multi-tenancy/)

**Open source CRM:**
- [Twenty CRM vs EspoCRM: Choosing a Self-Hosted CRM (2026) — Use Apify](https://use-apify.com/blog/twenty-crm-vs-espocrm-2026)
- [Best Open Source CRM on GitHub: 2026 Comparison](https://allgreatthings.io/blog/crm-automation/best-open-source-crm-on-github-2026-comparison)
- [The Best Open Source CRM Alternatives in 2026](https://www.dench.com/blog/best-open-source-crm-2026)
- [20 Best Open-Source Self-Hosted CRMs (2026, Ranked) — GrowCRM](https://growcrm.io/2026/01/04/top-20-open-source-self-hosted-crms-in-2025/)

**MVP scope & failure modes:**
- [Why 50% of CRM Implementations Fail — Clevyr](https://clevyr.com/blog/post/why-crm-implementations-fail)
- [Why Do CRM Projects Fail (And How to Fix Them) — Salesforce](https://www.salesforce.com/ap/hub/crm/why-do-crm-projects-fail/)
- [Top 5 reasons enterprise CRM projects fail — Nintex](https://www.nintex.com/blog/top-5-reasons-enterprise-crm-projects-fail/)
- [Why CRM Projects Fail in 2025 — Atyantik](https://atyantik.com/why-crm-projects-fail-in-2025/)
- [10 Must-Have Features Every Custom CRM Should Include — Caspio](https://www.caspio.com/blog/what-should-a-custom-crm-include/)
- [MVP Scope Explained — Asper Brothers](https://asperbrothers.com/blog/mvp-scope-explained/)

**RBAC & security:**
- [Custom CRM Security Before Your First Enterprise Deal — Lowcode Agency](https://www.lowcode.agency/blog/custom-crm-security-compliance)
- [CRM Data Security: Implementation Framework & Architecture — Nadcab](https://www.nadcab.com/blog/crm-data-security-compliance-framework)
- [10 RBAC Best Practices — Oso](https://www.osohq.com/learn/rbac-best-practices)
- [How to Design an RBAC System — NocoBase](https://www.nocobase.com/en/blog/how-to-design-rbac-role-based-access-control-system)
- [RBAC in CRM: Complete Guide (2025)](https://crmexpertsonline.com/role-based-access-control-in-crm-systems/)

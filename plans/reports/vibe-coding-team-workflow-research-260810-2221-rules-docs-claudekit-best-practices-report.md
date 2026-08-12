# Research Report: Cách tiếp cận đúng khi phát triển ứng dụng bằng "vibe coding"

**Ngày research:** 2026-08-10 22:21 (Asia/Saigon)
**Scope:** rules files, docs lưu business logic, co-working nhiều thành viên, best practice với ClaudeKit
**Nguồn:** 5 web searches (~35 nguồn), + scout cấu trúc `.claude/` local

---

## Mục lục

1. [Executive Summary](#executive-summary)
2. [Dữ liệu thực tế 2026 — vì sao vibe coding thuần thất bại](#1-dữ-liệu-thực-tế-2026)
3. [Mô hình đúng: Spec-Driven Development (SDD)](#2-mô-hình-đúng-spec-driven-development)
4. [Rules files — cần, nhưng ít hơn bạn nghĩ](#3-rules-files)
5. [Docs lưu business logic — kiến trúc 3 tầng](#4-docs-lưu-business-logic)
6. [Co-working nhiều thành viên](#5-co-working-nhiều-thành-viên)
7. [Best practice với ClaudeKit](#6-best-practice-với-claudekit)
8. [Anti-patterns](#7-anti-patterns)
9. [Next steps](#8-next-steps)
10. [Unresolved questions](#9-unresolved-questions)

---

## Executive Summary

**Kết luận ngắn:** "Vibe coding" đúng nghĩa (prompt → code → patch, không đọc code) chỉ hợp cho prototype/throwaway. Với app thật, mô hình 2026 đã hội tụ về **Spec-Driven Development (SDD)**: spec là source of truth, code là output tái sinh được. Không phải "vibe coding có rules" — mà là "SDD, dùng agent để execute".

**Ba câu trả lời trực tiếp:**

1. **Có cần rules files?** Có — nhưng **ít và scoped**, không phải file 3000 dòng. Nghiên cứu ETH Zurich: context file do LLM tự sinh **giảm** 3% success rate; file người viết chỉ **tăng** 4% nhưng **tăng >20% chi phí inference**. Rules ăn context budget mỗi turn → giá trị phải > chi phí. Repo của bạn hiện có 6 file rules ~2-3KB mỗi file, luôn load: đó là ngưỡng hợp lý, đừng phình thêm.

2. **Có cần docs lưu business logic?** **Bắt buộc**, và đây là phần quan trọng hơn rules. Business logic là thứ **không suy ra được từ code** (vì sao threshold = 3, vì sao flow này bỏ qua bước kia). Rules dạy agent *cách làm việc*; docs/specs dạy agent *phải làm gì*. Thiếu docs → agent tái phát minh logic sai mỗi session, đó chính là nguồn của "48% code duplication".

3. **Co-working nhiều người?** Vấn đề không phải Git conflict (Git giải quyết được text-level) mà là **semantic conflict**: 2 agent viết 2 implementation khác nhau cho cùng 1 business rule, cả hai đều compile + pass lint. Cách chặn: spec chung được review **trước khi** code, file ownership rõ ràng, worktree isolation, human review gate trước merge.

---

## 1. Dữ liệu thực tế 2026

Vì sao cần rules/docs — không phải lý thuyết, là số:

| Chỉ số | Số liệu | Nguồn |
|---|---|---|
| Adoption vibe coding | 84% | Stack Overflow Survey 2025-2026 |
| Trust vào AI coding tools | Giảm 43% → 29% (18 tháng) | Stack Overflow |
| App vibe-coded có security issue | 65% (58% có critical) | Escape.tech, scan 1,400+ app production |
| AI code chứa OWASP Top 10 | 45% (86% fail XSS, 88% fail log injection) | Veracode, 100+ LLM |
| Technical debt sau khi adopt AI tool | +30–41% | Keyhole/industry data |
| Code duplication | +48%, refactoring −60% | ibid |
| Bug rate sau adoption | +41% | ibid |
| Security findings tại Fortune 50 | 1,000 → 10,000/tháng (Dec 2024 → Jun 2025) | Apiiro |
| Chi phí maintain sau 18 tháng | +300% | industry analysis |

**Đọc số này ra sao:** adoption tăng nhưng trust giảm — nghĩa là tool tốt hơn, nhưng **process** không theo kịp. "Governance gap": tổ chức adopt AI nhanh hơn tốc độ xây review process. Rules + docs + gates chính là để lấp gap đó.

Mặt khác, SDD làm đúng có số ngược lại: GitHub báo cáo team dùng Spec Kit giảm ~1 bậc độ lớn số vòng "regenerate from scratch"; AWS Kiro có case feature 40 giờ → dưới 8 giờ human time khi viết spec trước.

---

## 2. Mô hình đúng: Spec-Driven Development

### 2.1 Định nghĩa

**Spec là artifact chính, version-controlled; code là output tái sinh được** từ spec bởi người hoặc agent.

```
Vibe coding:  prompt ──> code ──> patch ──> patch ──> patch ──> (drift)
SDD:          spec ──> design ──> task plan ──> implement ──> verify
                ^                                                │
                └────────── update spec khi thay đổi ────────────┘
```

Năm 2026 mọi tool lớn đều có flavor SDD riêng: GitHub Spec Kit (29 integration, gồm Claude Code), AWS Kiro (spec → design → tasks → impl, dùng cú pháp EARS), BMAD-METHOD, OpenSpec, Tessl, Google Antigravity. ClaudeKit của bạn về bản chất cũng là một SDD harness (`/ck:plan` → `plans/<slug>/plan.md` + `phase-NN.md` → `/ck:cook` → `/ck:test` → `/ck:code-review`).

### 2.2 Khi nào vibe, khi nào spec

Đây là quyết định **per-task**, không phải per-project:

| Dùng vibe coding | Dùng SDD |
|---|---|
| Prototype, spike, POC | Bất kỳ thứ gì lên production |
| Code sẽ vứt trong 1 tuần | Code có người khác đọc |
| Khám phá: "cái này khả thi không?" | Auth, payment, data access, migration |
| 1 người, 1 file, throwaway | ≥2 người hoặc ≥2 agent |
| UI experiment, styling | Bất kỳ business rule nào |

Câu chốt từ Augment Code: *"vibe coding mua tốc độ khám phá, SDD mua độ bền production"*. Kỹ năng 2026 là biết task trước mặt cần cái nào.

### 2.3 Vòng lặp thực dụng cho 1 feature

```
1. RESEARCH   → hiểu bối cảnh (đọc docs + code hiện có)
2. SPEC       → viết requirements: user-facing behavior, edge cases, acceptance criteria
                (HUMAN REVIEW GATE #1 — rẻ nhất để sửa ở đây)
3. PLAN       → design + chia phase, file ownership, thứ tự dependency
                (HUMAN REVIEW GATE #2)
4. IMPLEMENT  → agent code theo phase
5. VERIFY     → test + lint + typecheck + security scan (AUTOMATED GATE)
6. REVIEW     → human review diff (HUMAN REVIEW GATE #3 — bắt buộc cho auth/payment/data)
7. SYNC DOCS  → cập nhật spec/docs nếu implementation lệch intent
```

Gate #1 là gate có ROI cao nhất. Sửa 1 dòng spec sai = 30 giây. Sửa cùng lỗi đó sau khi đã sinh 2000 dòng code = vài giờ.

---

## 3. Rules files

### 3.1 Có cần không? — Có, với điều kiện

**Bằng chứng phản biện (quan trọng, đừng bỏ qua):** Nghiên cứu ETH Zurich đo được:
- Context file do LLM tự sinh: **−3%** task success rate so với không có file
- Context file do người viết: **+4%** success rate, nhưng **+20% inference cost**

Kết luận thực tế: **rules chỉ có giá trị khi do người viết, ngắn, và chứa thứ agent không thể tự tìm ra.** Đừng để Claude tự sinh CLAUDE.md rồi commit — đó là net negative.

### 3.2 Rules nên chứa gì

Anthropic khuyến nghị CLAUDE.md giữ **ngắn, human-readable**, chứa:

✅ **NÊN có** (thông tin agent không suy ra được từ code):
- Lệnh build/test/lint hay dùng (`pnpm test:unit`, không phải `npm test`)
- Quy ước không hiển nhiên (branch naming, merge vs rebase)
- Cạm bẫy môi trường ("dùng pyenv", "compiler X mới build được")
- File/util lõi mà agent hay bỏ sót
- Điều **cấm** ("không sửa `~/.claude/skills` trực tiếp")

❌ **KHÔNG nên có**:
- Thứ agent grep 5 giây ra được (danh sách file, cấu trúc thư mục)
- Business logic chi tiết (→ đưa vào `docs/`, load on-demand)
- Coding style dài dòng (→ để linter enforce, rẻ hơn nhiều)
- Lịch sử thay đổi, changelog
- Nội dung lặp giữa global CLAUDE.md và project CLAUDE.md (bạn **đang bị** lỗi này — xem §6.1)

### 3.3 Kiến trúc rules: hybrid load

Mô hình Anthropic dùng cho Claude Code là **hybrid**:
- CLAUDE.md → naive load up-front (luôn nằm trong context)
- glob/grep/Read → just-in-time retrieval

Áp dụng: chia 2 tầng.

```
.claude/rules/CLAUDE.md          ← LUÔN load. < 100 dòng. Chỉ contract + pointer.
.claude/rules/development-rules.md   ← load khi sửa code
.claude/rules/orchestration-protocol.md ← load khi spawn subagent
docs/domain/*.md                 ← load khi chạm domain đó
```

Đây chính xác là pattern repo bạn đang dùng (`## On-Demand References`) — đúng hướng, giữ nguyên.

**Nested rules:** Claude Code hỗ trợ CLAUDE.md lồng theo thư mục, load theo mức liên quan. Monorepo nhiều package → mỗi package 1 CLAUDE.md nhỏ thay vì 1 file root khổng lồ.

### 3.4 Chuẩn hoá đa tool: AGENTS.md

Nếu team dùng nhiều tool (Cursor, Copilot, Claude Code, Codex), đừng maintain 4 file. Pattern hiện tại:

```
AGENTS.md              ← nguồn duy nhất (chuẩn đang được đa số tool đọc)
CLAUDE.md -> AGENTS.md ← symlink hoặc file 1 dòng: "@AGENTS.md"
.cursorrules -> AGENTS.md
```

Chỉ làm nếu team thực sự đa tool. Nếu 100% Claude Code → giữ CLAUDE.md, đừng thêm indirection vô ích (YAGNI).

---

## 4. Docs lưu business logic

**Đây là phần quan trọng nhất và cũng là phần hay bị bỏ.** Rules dạy *cách làm*, docs dạy *làm gì*.

### 4.1 Nguyên tắc: chỉ ghi thứ code không tự nói

Test đơn giản trước khi viết 1 dòng docs:

> *"Một dev giỏi đọc code này 30 phút có tự tìm ra không?"*
> - Có → **đừng viết** (docs sẽ lỗi thời, thành nợ)
> - Không → **phải viết** (đây là knowledge sẽ mất)

Thứ **phải** ghi:
- **Vì sao**, không phải cái gì. `threshold = 3` — vì sao 3? Ai quyết? Đổi được không?
- Ràng buộc từ business/pháp lý ("phải lưu invoice 10 năm — luật kế toán VN")
- Quyết định bị loại + lý do (chống agent "đề xuất lại" giải pháp đã bác)
- Domain vocabulary (từ nghiệp vụ ≠ tên biến trong code)
- Luồng end-to-end xuyên nhiều service (không repo nào chứa trọn)
- Invariant: điều kiện phải luôn đúng dù code đổi thế nào

### 4.2 Kiến trúc 3 tầng

```
TẦNG 1 — CONTRACT (luôn load, < 100 dòng)
  .claude/rules/CLAUDE.md
  → core rules + pointer sang tầng 2/3

TẦNG 2 — REFERENCE (load on-demand, ổn định, đời sống dài)
  docs/project-overview-pdr.md      → app này là gì, cho ai, vì sao
  docs/system-architecture.md       → boundary, data flow, quyết định + lý do
  docs/domain/<bounded-context>.md  → BUSINESS LOGIC ở đây
  docs/code-standards.md            → convention không enforce được bằng linter
  docs/deployment-guide.md

TẦNG 3 — WORKING (đời sống ngắn, theo feature)
  plans/<timestamp>-<slug>/plan.md          → status, phase, acceptance criteria
  plans/<timestamp>-<slug>/phase-01-*.md    → file ownership, steps, rollback
  plans/<timestamp>-<slug>/reports/         → output từ agent
```

Repo bạn đã có đúng cấu trúc này. Vấn đề là `docs/` **chưa tồn tại** ở root workspace và `plans/` mới chỉ có `templates/` — tức tầng 2 và 3 đang trống.

### 4.3 Template domain doc (phần thiếu nhiều nhất)

`docs/domain/<context>.md`:

```markdown
# Domain: Order Processing

## Ubiquitous language
- **Order**: ... (khác "Cart" ở chỗ đã lock giá)
- **Fulfillment**: ...

## Invariants (LUÔN đúng)
- Order.total == sum(items) + shipping − discount. Không bao giờ tính lại ở FE.
- Order đã PAID không được đổi items. Muốn đổi → tạo Amendment.

## Business rules
| Rule | Giá trị | Vì sao | Ai quyết | Ngày |
|---|---|---|---|---|
| Free ship ngưỡng | 500k VND | margin phân tích Q1, dưới mức này lỗ | @pm | 2026-03 |
| Retry payment | 3 lần, backoff 2^n | giới hạn rate của SePay | @backend | 2026-05 |

## Edge cases đã xử lý
- Thanh toán về sau khi order đã cancel → refund tự động, không revive order.

## Quyết định đã LOẠI (đừng đề xuất lại)
- ❌ Event sourcing cho order: team 3 người, chi phí vận hành > lợi ích. (2026-04)
```

Bảng "Vì sao / Ai quyết / Ngày" là thứ cứu bạn 6 tháng sau. Cột "quyết định đã loại" chặn agent lặp đề xuất cũ.

### 4.4 Chống docs lỗi thời

Docs sai **tệ hơn không có docs** — agent tin docs hơn code.

Biện pháp:
- **Update trong cùng PR** với code thay đổi behavior. Không có "docs sprint" riêng.
- Chỉ update khi đổi: user-visible behavior, setup, command, architecture, security posture, public contract. Đổi nội bộ thuần → không update (tránh changelog noise).
- Ghi ngày + owner ở mỗi quyết định.
- Định kỳ (hàng quý): chạy `/ck:docs --update` để agent so docs vs codebase, báo drift.

---

## 5. Co-working nhiều thành viên

### 5.1 Vấn đề thật: semantic conflict, không phải merge conflict

Git bắt được đụng độ **text-level**. Agent tạo ra đụng độ **semantic**:

- Dev A bảo agent implement "giảm giá VIP" trong `pricing.ts`
- Dev B bảo agent implement "giảm giá campaign" trong `checkout.ts`
- Cả hai đều viết hàm tính discount riêng, logic hơi khác
- Git merge sạch sẽ. Lint pass. Type pass. Test pass.
- Production: 2 nguồn sự thật cho giá → bug tính tiền

Đây là cơ chế đằng sau con số "+48% code duplication". Git không cứu được. **Chỉ spec chung + review trước code mới cứu được.**

### 5.2 Bốn lớp phòng vệ

**Lớp 1 — Shared spec là nguồn sự thật chung**
Spec/plan được commit và review **trước** khi ai đó code. Người thứ 2 đọc spec, thấy "discount đã có owner ở `pricing.ts`" → không sinh bản trùng. Đây là lớp quan trọng nhất; 3 lớp còn lại chỉ là bảo hiểm.

**Lớp 2 — File ownership tường minh**
Trong `plan.md`, mỗi phase khai báo file được sửa. Hai phase chạy song song **không được** trùng file. Cấm song song trên: cùng file, artifact generated, chuỗi DB migration, shared config.

```markdown
### Phase 02 — Payment webhook
Owns: src/payment/webhook-handler.ts, src/payment/types.ts
Reads-only: src/order/order-service.ts
Depends: Phase 01
```

**Lớp 3 — Worktree isolation**
Mỗi agent/task 1 worktree riêng: cùng chia `.git`, khác working directory. Không tốn dung lượng như full clone, không tranh file handle.

```bash
git worktree add ../proj-feat-payment feat/payment
git worktree add ../proj-feat-search  feat/search
# mỗi worktree = 1 Claude Code session
```

ClaudeKit có `/ck:worktree` cho việc này. Lưu ý: worktree giải quyết **file collision**, không giải quyết semantic conflict (lớp 1 mới giải quyết).

**Lớp 4 — Gate trước main**
Không có agent output nào vào main mà không qua human review có ghi nhận. Bắt buộc cho: auth, payment, data access, migration, thay đổi public contract. Cộng automated gate: lint + typecheck + test + security scan mỗi commit.

### 5.3 Chia việc thế nào cho ít va chạm

Ưu tiên chia theo **vertical slice** (feature trọn vẹn) hơn là theo **layer** (FE/BE/DB):

```
❌ Theo layer:  A làm toàn bộ backend, B làm toàn bộ frontend
   → mọi feature đều cần cả hai, block nhau liên tục, contract đổi liên tục

✅ Theo slice:  A làm trọn "checkout" (BE+FE+test), B làm trọn "search"
   → boundary rõ, ít chạm chung, merge sạch
```

Khi buộc phải chia layer → **định nghĩa contract (API schema/types) trước, commit trước, rồi mới song song**.

### 5.4 Quy ước commit & PR khi có AI

- Conventional commits, **không nhắc AI** trong message (rule của repo bạn đã có).
- PR nhỏ. AI dễ sinh diff 2000 dòng — không ai review nổi 2000 dòng, và review giả tạo là chỗ 45% OWASP lọt qua.
- PR description phải link tới spec/plan. Reviewer đọc spec trước, đọc code sau.
- Không commit secrets/dotenv/token/key — bắt buộc có secret scanning trong CI, vì agent hay hardcode key khi debug.

### 5.5 Chia sẻ context giữa người

Thứ **phải** vào git (mọi người dùng chung):
- `CLAUDE.md` / `AGENTS.md`, `.claude/rules/`, `docs/`, `plans/`
- Skills/commands dùng chung của team

Thứ **không** vào git:
- `CLAUDE.local.md` (sở thích cá nhân, path máy local)
- `.claude/settings.local.json`
- Session state, cache

Khi 1 người tìm ra prompt/rule hiệu quả → commit vào `.claude/rules/` hoặc skill, đừng giữ riêng. Đây là nơi team AI-native tạo compounding advantage: rules được refine dần thành tài sản chung.

---

## 6. Best practice với ClaudeKit

Dựa trên scout thực tế repo: 93 skills, 6 rules files, hooks, agents, `plans/`, config `.ck.json`.

### 6.1 Vấn đề phát hiện ngay: rules bị trùng lặp

Global `~/.claude/rules/*.md` và project `.claude/rules/*.md` chứa **nội dung gần như y hệt** (`development-rules.md`, `documentation-management.md`, `orchestration-protocol.md`, `primary-workflow.md`, `review-audit-self-decision.md` — đều trùng). Cả hai đều được load.

Hệ quả: mỗi session đốt ~2x token cho cùng một nội dung. Vi phạm DRY, và đúng vào cái ETH Zurich cảnh báo (+20% cost, +4% benefit → trùng lặp làm tỷ lệ này thành âm).

**Fix:** chọn 1 nguồn.
- Rules **generic** (áp cho mọi project) → giữ ở global `~/.claude/`, xoá bản project.
- Rules **đặc thù project** → giữ ở project, xoá khỏi global.
- Project `.claude/rules/CLAUDE.md` chỉ giữ phần thực sự riêng của repo + pointer.

Hiện `.claude/rules/CLAUDE.md` đã viết đúng tinh thần ("Keep it short", "load linked files only when needed") — nhưng 5 file kia lại trùng global, phá vỡ chính ý định đó.

### 6.2 Pipeline chuẩn theo loại việc

| Loại việc | Pipeline |
|---|---|
| Prototype/spike | `/ck:cook` trực tiếp. Không plan, không docs. Vứt sau. |
| Feature nhỏ (<3 file) | `/ck:plan:fast` → `/ck:cook` → `/ck:test` |
| Feature production | `/ck:research` (nếu tech mới) → `/ck:plan` → **review plan** → `/ck:cook` → `/ck:test` → `/ck:code-review` → `/ck:ship` |
| Rủi ro cao (auth/payment) | thêm `/ck:predict` (5 persona debate) + `/ck:security` trước cook |
| Bug | `/ck:debug` (chứng minh root cause) → `/ck:fix` → `/ck:test` |
| Nhiều người song song | `/ck:worktree` mỗi người → `/ck:team` khi cần điều phối |
| Onboard repo lạ | `/ck:docs:init` hoặc `/ck:repomix` → `/ck:watzup` |

**Nguyên tắc lựa chọn:** cost của plan ≈ 5–10 phút. Cost của việc cook sai hướng ≈ vài giờ + drift docs. Bất kỳ việc gì >3 file hoặc chạm business logic → **luôn plan trước**.

### 6.3 Khắc phục 2 tầng đang trống

Repo có `plans/templates/` nhưng chưa có `docs/`. Việc cần làm:

```bash
# Tầng 2 — chạy 1 lần cho mỗi project con (RedisProject, petty_ai)
/ck:docs:init     # agent quét codebase, sinh docs/ khởi tạo
# rồi NGƯỜI sửa lại: thêm "vì sao", invariant, quyết định đã loại
```

Bước "người sửa lại" là bắt buộc. Docs do agent tự sinh 100% = đúng cái ETH Zurich đo là net negative — nó chỉ mô tả lại code (thứ agent tự đọc được), không chứa intent.

### 6.4 Hooks: tự động hoá gate

Repo đã bật 11 hooks. Đáng chú ý cho vibe coding an toàn:
- `privacy-block.cjs` — chặn agent đọc secrets. **Giữ.** Đây là guard chống rò key vào context/log.
- `dev-rules-reminder.cjs` — nhắc rules khi sửa code.
- `simplify-gate.cjs` / `post-edit-simplify-reminder.cjs` — chống code phình (đối trọng với "+48% duplication").
- `descriptive-name.cjs` — ép tên file self-documenting, giúp Grep/Glob của agent sau này.

**Nên bổ sung** (nếu chưa có): PostToolUse hook chạy lint/typecheck sau mỗi Edit. Bắt lỗi ngay trong loop rẻ hơn nhiều so với bắt ở CI — agent tự sửa mà không tốn round-trip của người.

### 6.5 Kỷ luật context

- Session dài → context loãng → chất lượng giảm. Chốt xong 1 phase thì `/clear`, bắt đầu phase sau bằng cách load plan file.
- Dùng subagent cho việc "đọc nhiều, kết luận ít" (scout, research) — giữ file dump ra khỏi context chính. Repo đã có `Explore`, `/ck:scout`.
- Cảnh báo trong hook đã ghi rõ: mỗi subagent chỉ 200K context → prompt phải scoped, kèm đủ file path, acceptance criteria, reports path.
- Đừng spawn subagent bừa. Hook local nói thẳng: spawn nhiều subagent gây vấn đề hiệu năng; chỉ delegate khi request cho phép.

### 6.6 Với team dùng ClaudeKit

1. **Commit `.claude/` vào repo** (trừ `settings.local.json`, session-state). Rules + skills + hooks = tài sản chung.
2. **Chuẩn hoá `.ck.json`** ở project level, để mọi người cùng naming format `{date}-{issue}-{slug}` → plan folder không đụng nhau.
3. **`plans/` là kênh giao tiếp bất đồng bộ.** Người A viết plan, người B đọc plan rồi cook. Không cần meeting.
4. **Review plan quan trọng hơn review code.** Bắt lỗi ở plan = sửa 1 câu. Bắt ở code = sửa 500 dòng.
5. **`/ck:watzup`** cuối phiên → handoff report, người tiếp theo pick-up không cần hỏi lại.

---

## 7. Anti-patterns

| Anti-pattern | Vì sao sai | Thay bằng |
|---|---|---|
| CLAUDE.md 3000 dòng | Agent xử lý toàn bộ mọi task, tốn token, khó maintain | Contract ngắn + on-demand refs |
| Để LLM tự sinh CLAUDE.md rồi commit | ETH Zurich: −3% success rate | Người viết, chỉ ghi thứ không suy ra được |
| Trùng rules global + project | 2x token cho cùng nội dung | Chọn 1 nguồn |
| Docs mô tả lại code | Lỗi thời ngay, agent tin docs sai | Ghi "vì sao", invariant, quyết định đã loại |
| Không đọc code AI sinh | 45% chứa OWASP Top 10 | Review bắt buộc cho auth/payment/data |
| PR 2000 dòng do AI | Không ai review thật | Chia phase nhỏ, PR nhỏ |
| Song song không định nghĩa ownership | Semantic conflict, duplicate logic | File ownership trong plan, contract-first |
| "Make it better" | Agent đoán mò | Feedback cụ thể, đo được |
| Vibe thẳng lên production | 65% app có security issue | SDD cho mọi thứ chạm production |
| Sửa `~/.claude/skills` trực tiếp | Mất khi update kit, không share được | Sửa bản trong project |

---

## 8. Next steps

**Ngay (30 phút):**
1. Khử trùng lặp rules global vs project — chọn 1 nguồn cho 5 file trùng.
2. Quyết định phạm vi: `PersonalSplace` là workspace chứa nhiều project → docs/plans nên đặt ở **từng project con** (`RedisProject/docs`, `petty_ai/docs`), không dồn hết ở root.

**Tuần này:**
3. Chạy `/ck:docs:init` cho project đang active nhất, rồi **người** bổ sung: invariants, bảng business rules (giá trị / vì sao / ai quyết / ngày), quyết định đã loại.
4. Thêm PostToolUse hook lint+typecheck nếu chưa có.
5. Bật secret scanning trong CI.

**Trước khi thêm người vào team:**
6. Viết `docs/code-standards.md` — chỉ những gì linter không enforce được.
7. Chốt quy ước: mọi feature production đi qua `plans/<slug>/plan.md`, review plan trước khi cook.
8. Chốt file ownership template trong `plans/templates/`.

**Định kỳ:**
9. Hàng quý: `/ck:docs --update` phát hiện drift docs vs code.
10. Sau mỗi feature lớn: `/ck:journal` ghi lại quyết định + bài học vào docs.

---

## 9. Unresolved questions

1. **Phạm vi áp dụng:** `PersonalSplace` là workspace nhiều repo (RedisProject, petty_ai, petty_ai-wt-seo). Docs/plans nên tập trung ở root hay tách theo từng project con? Report này giả định **tách theo project con**, root chỉ giữ `.claude/` dùng chung. Cần xác nhận.

2. **Quy mô team thực tế:** câu hỏi nói "nhiều thành viên" nhưng chưa rõ mấy người, cùng repo hay khác repo, có dùng chung Claude Code hay mix nhiều tool. Nếu đa tool → cần AGENTS.md; nếu 100% Claude Code → không cần (YAGNI).

3. **`petty_ai-wt-seo`** trông như worktree của `petty_ai`. Đang dùng worktree workflow rồi? Nếu có, phần §5.2 lớp 3 có thể bỏ qua.

4. **CI hiện có gì?** Report giả định cần bổ sung security scan + lint gate. Chưa verify repo con có CI chưa.

5. **Rules trùng lặp** — cố ý (để repo tự chứa, portable) hay vô tình? Nếu cố ý thì trade-off token là chấp nhận được, chỉ cần biết đang trả giá gì.

---

## Sources

**Vibe coding & SDD:**
- [Vibe Coding vs Spec-Driven Development (2026) — Augment Code](https://www.augmentcode.com/guides/vibe-coding-vs-spec-driven-development)
- [Spec-Driven Development (SDD): The Definitive 2026 Guide — BCMS](https://www.thebcms.com/blog/spec-driven-development/)
- [Spec-Driven Development vs Vibe Coding — Turing Post](https://www.turingpost.com/p/sdd)
- [Spec-driven development with AI — GitHub Blog](https://github.blog/ai-and-ml/generative-ai/spec-driven-development-with-ai-get-started-with-a-new-open-source-toolkit/)
- [Meet GitHub Spec-Kit — MarkTechPost](https://www.marktechpost.com/2026/05/08/meet-github-spec-kit-an-open-source-toolkit-for-spec-driven-development-with-ai-coding-agents/)
- [Comprehensive Guide to SDD: Kiro, Spec Kit, BMAD — Medium](https://medium.com/@visrow/comprehensive-guide-to-spec-driven-development-kiro-github-spec-kit-and-bmad-method-5d28ff61b9b1)
- [Vibe Coding Best Practices: Ship Production — Blink](https://blink.new/blog/vibe-coding-best-practices-production-2026)
- [9 Vibe Coding Best Practices — Memberstack](https://www.memberstack.com/blog/9-vibe-coding-best-practices)

**Rules & context engineering:**
- [Effective context engineering for AI agents — Anthropic](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Claude Code best practices — Anthropic](https://www.anthropic.com/engineering/claude-code-best-practices)
- [Best practices for Claude Code — Docs](https://code.claude.com/docs/en/best-practices)
- [The Complete Guide to AI Agent Memory Files — Data Science Collective](https://medium.com/data-science-collective/the-complete-guide-to-ai-agent-memory-files-claude-md-agents-md-and-beyond-49ea0df5c5a9)
- [Do AGENTS.md/CLAUDE.md Files Help Coding Agents? (ETH Zurich paper)](https://todatabeyond.substack.com/p/do-agentsmdclaudemd-files-help-coding)
- [Context Engineering Best Practices for AI-Powered Dev Teams — Packmind](https://packmind.com/context-engineering-ai-coding/context-engineering-best-practices/)

**Team & multi-agent:**
- [Parallel AI Coding with Git Worktrees — jsmanifest](https://medium.com/@jsmanifest/parallel-ai-coding-with-git-worktrees-run-multiple-agents-without-conflicts-b57dc96a65e7)
- [Git Worktrees for AI Coding — MindStudio](https://www.mindstudio.ai/blog/git-worktrees-parallel-ai-coding-agents)
- [How to Run a Multi-Agent Coding Workspace — Augment Code](https://www.augmentcode.com/guides/how-to-run-a-multi-agent-coding-workspace)
- [Agentic Coding 2026: AI Agent Teams Guide](https://halallens.no/en/blog/agentic-coding-in-2026-the-complete-guide-to-plugins-multi-model-orchestration-and-ai-agent-teams)

**Technical debt & security data:**
- [Vibe Coding Trends 2026: Adoption, Productivity, Code Quality Data — Keyhole](https://keyholesoftware.com/vibe-coding-trends-2026/)
- [Vibe Coding Hit 84% Adoption. 45% Has Vulnerabilities — Pixelmojo](https://www.pixelmojo.io/blogs/vibe-coding-technical-debt-crisis-2026-2027)
- [Vibe Coding's Technical-Debt Bill Just Came Due — AI Founders](https://aifounders.cz/en/vibe-codings-technical-debt-bill-just-came-due-and-the-security-numbers-havent-moved/)
- [AI Code Quality Crisis 2026: Engineering Leader Guide](https://www.ofashandfire.com/blog/ai-generated-code-quality-crisis)
- [8 Vibe Coding Problems That Break Production in 2026 — TakDevs](https://takdevs.com/8-vibe-coding-problems-that-break-production-in-2026/)

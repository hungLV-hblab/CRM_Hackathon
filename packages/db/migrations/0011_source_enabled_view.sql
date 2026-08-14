-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- Tạm ngưng đọc một trang mà không xoá nó (ADR-0037) — và chặn "AI đọc trang vừa bị tắt"
-- bằng QUYỀN CSDL thay vì bằng một `WHERE` phải nhớ.
-- ═══════════════════════════════════════════════════════════════════════════════════════════
--
-- READ THIS BEFORE EDITING. The three statements below are one mechanism, and taking any of them
-- out on its own turns a database guarantee back into a coding habit:
--
--   1. ADD COLUMN enabled     — the switch itself.
--   2. REVOKE SELECT          — so the AI identity can no longer see the table at all.
--   3. CREATE VIEW + GRANT    — so it sees exactly the rows that are switched ON, and nothing else.
--
-- WHY NOT just `WHERE enabled` in the service. `crm_system` held `SELECT` on the whole table
-- (0008), so a filter in code is only as strong as every future reader remembering to write it.
-- Forgetting it would fetch a page somebody had just switched off — and SUCCEED, silently, with a
-- fresh observation and an LLM bill to show for it. With SELECT revoked the same mistake is
-- `permission denied`: loud, immediate, and impossible to ship. This is the same reasoning that
-- put `company_sources` behind a GRANT in the first place, applied one level deeper.
--
-- This STRENGTHENS I-18 rather than relaxing it:
--   before → `crm_system` has SELECT, and no INSERT/UPDATE/DELETE, on `company_sources`.
--   after  → `crm_system` cannot read `company_sources` at all; it reads `company_sources_enabled`,
--            and it still writes nothing anywhere.
--
-- `live-source-columns-and-grants.test.ts` test 15 was INVERTED by this migration, on purpose: it
-- used to assert that `crm_system` could read the table. Tests 24 and 25 replace it.
--
-- A plain view, not `security_barrier` and not RLS: the risk being managed is our own code
-- forgetting a filter, not a hostile user probing rows. The cheapest thing that makes the mistake
-- impossible is the right size of mechanism.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

-- Default `true`, so every source saved before this migration keeps behaving exactly as it did.
-- The safe branch is the default branch (I-17) — and here "safe" means "no company silently stops
-- being read the moment this ships".
ALTER TABLE company_sources ADD COLUMN enabled boolean NOT NULL DEFAULT true;
--> statement-breakpoint

-- `crm_app` is untouched: a person has to be able to SEE the row they switched off, and edit it.
REVOKE SELECT ON company_sources FROM crm_system;
--> statement-breakpoint

-- The view deliberately does NOT expose `enabled`. A row that comes out of here is on by
-- definition, and carrying the column would only invite a second filter downstream — the very
-- habit this migration exists to remove.
CREATE VIEW company_sources_enabled AS
  SELECT id, company_id, url, source_tier, discovered_via, search_snippet, added_by, created_at
  FROM company_sources
  WHERE enabled;
--> statement-breakpoint

-- SELECT only. A simple view is updatable in Postgres, so read-only is this GRANT and not a
-- property of the view — without this line the AI would have gained a write path to the reading
-- list by way of its own read path. Measured by test 25.
GRANT SELECT ON company_sources_enabled TO crm_system;

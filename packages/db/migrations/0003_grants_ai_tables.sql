-- ═══════════════════════════════════════════════════════════════════════════════════════
-- Privileges for `crm_system` on the seven tables added by 0002. Hand-written, because
-- `crm_system` deliberately has NO `ALTER DEFAULT PRIVILEGES` (see 0001_grants.sql): every
-- new table is FORBIDDEN to the AI identity until someone grants it here by hand.
--
-- READ 0001_grants.sql FIRST. It records the trap measured on `UPDATE`. This file records the
-- SAME trap on `INSERT`, per ADR-0015:
--
--   `GRANT INSERT ON proposals TO crm_system` covers EVERY COLUMN, including `status`. The AI
--   would then not need any UPDATE privilege to approve its own suggestion — it just passes
--   `status` in the INSERT. The comment "INSERT only, no UPDATE on status" is true and
--   useless. Same shape for `undo_deadline` (the 7-day undo window of T-7) and `read_at` (an
--   unread notification of T-6).
--
-- So the seven tables split by ONE question: does this table hold a column that belongs to a
-- HUMAN decision?
--
--   No  → `GRANT SELECT, INSERT` at table level is safe.
--   Yes → `GRANT INSERT (explicit column list)`, with the human's column ABSENT and carrying
--         a DEFAULT so it still gets the right value.
--
-- ADDING A COLUMN TO ONE OF THE THREE COLUMN-LEVEL TABLES → ADD IT TO THE LIST HERE, or the
-- AI silently loses the ability to write it. That direction of failure is the safe one.
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- ─── Zone 1: read snapshots, extract findings. No column here belongs to a human ────────
GRANT SELECT, INSERT ON observations TO crm_system;
--> statement-breakpoint
GRANT SELECT, INSERT ON claims TO crm_system;
--> statement-breakpoint

-- ─── Zone 2: generate suggestions. `status` is the human's ──────────────────────────────
-- `status` is absent below, so its DEFAULT 'pending' always applies: the DATABASE guarantees
-- every AI-generated proposal starts out waiting for a human (T-4 at the second layer).
-- No UPDATE either — approving is a human act, recorded by crm_app.
GRANT SELECT ON proposals TO crm_system;
--> statement-breakpoint
GRANT INSERT (id, company_id, claim_id, proposal_type, target_field,
              current_value, proposed_value, impact_if_wrong, created_at)
  ON proposals TO crm_system;
--> statement-breakpoint

-- Deciding is a human act BY DEFINITION, so the AI identity gets nothing at all here. This is
-- also the single source of every number on the dashboard (ADR-0016) — the AI must not be
-- able to write its own score.
-- (no grant on proposal_decisions)

-- ─── Zone 3: set the next step, undoable. The undo trail is the human's ─────────────────
-- `undo_deadline` is absent → its DEFAULT (now() + 7 days) fixes the window, so the AI cannot
-- shrink it. The four `undone_*` columns are absent → the AI cannot fabricate an undo record.
-- No UPDATE → undoing is a human clicking a button, written by crm_app.
GRANT SELECT ON auto_next_step_events TO crm_system;
--> statement-breakpoint
GRANT INSERT (id, opportunity_id, claim_id, previous_text, previous_due_date,
              previous_source, new_text, new_due_date, created_at)
  ON auto_next_step_events TO crm_system;
--> statement-breakpoint

-- `read_at` is absent → the AI can raise a notification but cannot mark it read on Sales'
-- behalf. Without this, the system that wrote to official data could also silently swallow
-- the notice that it did so (T-6).
GRANT SELECT ON notifications TO crm_system;
--> statement-breakpoint
GRANT INSERT (id, user_id, auto_event_id, message, created_at)
  ON notifications TO crm_system;
--> statement-breakpoint

-- ─── Human data the AI only reads ───────────────────────────────────────────────────────
-- Contacts are read to interpret news ("the new CTO used to work at..."), never written.
GRANT SELECT ON contacts TO crm_system;

-- No DELETE on any of the seven tables: the fourth absolute boundary.
-- No UPDATE on any of the seven tables: zones 1 and 2 only ever append, and the one place the
-- AI updates anything at all is the three next-step columns of `opportunities` in 0001.

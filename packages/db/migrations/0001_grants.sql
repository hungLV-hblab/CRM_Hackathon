-- ═══════════════════════════════════════════════════════════════════════════════════════
-- The SECOND defence layer of ADR-0004, implemented per ADR-0010: COLUMN-level privileges
-- for two roles.
--
-- READ THIS BEFORE EDITING — two facts established by experiment, not by reasoning:
--
--  1. NEVER write `GRANT UPDATE ON opportunities TO crm_system` followed by
--     `REVOKE UPDATE (stage, expected_value)`. That combination BLOCKS NOTHING — an UPDATE
--     privilege granted at table level covers every column, and a column-level REVOKE cannot
--     punch a hole in it. Measured: `crm_system` successfully set `stage` to 'won'.
--     Only ever GRANT the exact columns that are allowed.
--
--  2. `crm_system` deliberately has NO `ALTER DEFAULT PRIVILEGES`. Any table added later is
--     FORBIDDEN to `crm_system` until someone grants it by hand right here. That is a
--     FEATURE: forgetting a GRANT costs the AI a privilege (safe), it never hands the AI one
--     it should not have (a silent hole).
--
-- ADDING A TABLE THAT GROUP 4/5 MUST WRITE → ADD ITS GRANT AT THE END OF THIS FILE
-- (or in the next 000X migration).
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- ─── crm_app: the HUMAN identity, full rights over business data ────────────────────────
GRANT ALL ON ALL TABLES IN SCHEMA public TO crm_app;
--> statement-breakpoint
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO crm_app;
--> statement-breakpoint
-- Tables and sequences crm_owner creates later are covered automatically, so day-to-day
-- development never gets blocked halfway through.
ALTER DEFAULT PRIVILEGES FOR ROLE crm_owner IN SCHEMA public GRANT ALL ON TABLES TO crm_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE crm_owner IN SCHEMA public GRANT ALL ON SEQUENCES TO crm_app;
--> statement-breakpoint

-- ─── crm_system: the AI identity. Only what the four autonomy zones allow ───────────────

-- Reads: needed to know which companies are watched, which opportunities are open (I-6),
-- and which parameters are currently in effect.
GRANT SELECT ON companies TO crm_system;
--> statement-breakpoint
GRANT SELECT ON opportunities TO crm_system;
--> statement-breakpoint
GRANT SELECT ON system_settings TO crm_system;
--> statement-breakpoint

-- Zone 3 — setting the next step, undoable. EXACTLY THREE COLUMNS, no more.
-- No `stage`, no `expected_value` → the first two absolute boundaries of ontology section 5
-- are blocked right here, including when the command does not come from the UI (T-10).
GRANT UPDATE (next_step_text, next_step_due_date, next_step_source) ON opportunities TO crm_system;
--> statement-breakpoint

-- Zone 4 — the watch cycle adds timeline entries. INSERT yes, DELETE no: deleting is Sales'
-- act and the only error-detection signal feature group 5 produces (I-13).
GRANT SELECT, INSERT ON timeline_entries TO crm_system;
--> statement-breakpoint

-- Watch-cycle log and audit trail: the AI must be able to record its own refusals, but never
-- to rewrite them afterwards.
GRANT SELECT, INSERT ON watch_cycle_runs TO crm_system;
--> statement-breakpoint
GRANT SELECT, INSERT ON audit_events TO crm_system;
--> statement-breakpoint

-- No DELETE on any table: the fourth boundary (never delete human-created data).
-- Nothing at all on `users`: the AI has no business with user accounts.
-- No UPDATE on `system_settings`: the worker reads its parameters, it does not rewrite them.

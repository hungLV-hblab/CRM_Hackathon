-- ═══════════════════════════════════════════════════════════════════════════════════════
-- `companies.company_type` — enum → free text.
--
-- Discovered while wiring the real BTC import (feature 260815-1026): the enum was fine for the
-- hand-typed demo fixture (5 companies, values chosen to match `company_type` exactly), but
-- `Account.csv` carries free text that does not fold into the 5-value set without guessing —
-- "SIer", "Enduser", "drug store", "IT Consulting", 6 blank rows, and no row anywhere reading
-- literally "Tech-based/Startup". Rule 4 (CLAUDE.md): a wrong classification is worse than no
-- classification, and a closed enum FORCES a classification on every row whether or not one is
-- knowable from the source data. `text` removes that forcing.
--
-- No GRANT changes: `companies` already grants `crm_app` full rights via `ALTER DEFAULT
-- PRIVILEGES` (0001) and `crm_system` SELECT-only on the whole table (0001) — a column type
-- change touches neither.
-- ═══════════════════════════════════════════════════════════════════════════════════════
ALTER TABLE companies
  ALTER COLUMN company_type TYPE text USING company_type::text;
--> statement-breakpoint

DROP TYPE IF EXISTS company_type;

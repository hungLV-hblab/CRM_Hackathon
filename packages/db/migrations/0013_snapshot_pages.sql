-- ═══════════════════════════════════════════════════════════════════════════════════════
-- `snapshot_pages` — the stored page content the demo reading path serves, generalised from
-- 1 page/company (`apps/api/src/ai/demo-snapshots.ts`, ADR-0021) to N pages/company.
--
-- READ 0001_grants.sql FIRST. `crm_system` has NO `ALTER DEFAULT PRIVILEGES` (0001), so this
-- new table is FORBIDDEN to the AI identity until granted by hand, right here. Only SELECT is
-- granted — same reasoning as `company_sources` (0008_live_source.sql): the AI reads which
-- content is available to interpret, it never adds or edits a page. `crm_app` needs no line:
-- 0001 already grants it ALL on tables `crm_owner` creates.
-- ═══════════════════════════════════════════════════════════════════════════════════════
CREATE TABLE snapshot_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  page_slug text NOT NULL,
  source_url text,
  before_html text,
  after_html text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT snapshot_pages_company_id_page_slug_unique UNIQUE (company_id, page_slug)
);
--> statement-breakpoint

CREATE INDEX snapshot_pages_company_id_idx ON snapshot_pages (company_id);
--> statement-breakpoint

GRANT SELECT ON snapshot_pages TO crm_system;

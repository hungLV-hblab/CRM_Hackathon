-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- The live web source — ADR-0035 opened the door, this migration builds it.
-- ═══════════════════════════════════════════════════════════════════════════════════════════
--
-- READ 0001_grants.sql AND 0003_grants_ai_tables.sql FIRST. Between them they establish the one
-- question every schema change has to answer: does this touch a column or table that belongs to
-- a HUMAN decision? Three of the four changes below were checked against it and need NO grant
-- work at all, and knowing WHY is the point of this header:
--
--   observations.source_kind, observations.fetch_error_reason
--     0003 granted `SELECT, INSERT` on `observations` at TABLE level, because no column of that
--     table belongs to a human decision. Table-level grants cover columns added later, so the
--     AI identity can write both new columns and nothing had to be widened. That is the safe
--     direction: `observations` is zone 1 — the AI records what a source said, and a human never
--     types into it.
--
--   companies.live_source_enabled
--     `crm_system` holds `GRANT SELECT ON companies` and NO UPDATE whatsoever (0001). So the AI
--     can read the switch and can never set it. This is the same guarantee that makes
--     `snapshot_variant` safe to exist: an AI that could flip its own source would be choosing
--     which evidence to then report on. Measured, not assumed — see
--     `live-source-columns-and-grants.test.ts` tests 10 to 12.
--
--   company_sources
--     A NEW TABLE, and this is where the deliberate work is. `crm_system` has no
--     `ALTER DEFAULT PRIVILEGES` (0001), so a new table is FORBIDDEN to the AI identity until
--     someone grants it by hand. Here that default is exactly right and only SELECT is granted:
--     the AI may read which pages to fetch, and may never add one. "Find sources and save them"
--     would be a third self-write path outside the two exceptions Specs opens (CLAUDE.md
--     section 4) — the candidate-then-human-click design exists precisely to avoid it.
--     `crm_app` needs no line here: 0001 set ALTER DEFAULT PRIVILEGES granting it ALL on
--     tables crm_owner creates, and migrations run as crm_owner.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

-- ─── Which source produced this observation ─────────────────────────────────────────────────
-- DEFAULT, not NULL-able-and-backfilled: every insert in the codebase today predates this
-- column, and the default is what keeps their meaning intact rather than leaving a NULL that
-- reads as "nobody knows where this row came from".
ALTER TABLE observations
  ADD COLUMN source_kind text NOT NULL DEFAULT 'demo_snapshot';
--> statement-breakpoint

-- `text` + CHECK rather than a pg enum, matching the decision already taken for `source_tier`
-- and `snapshot_variant`: adding a value must not need an ALTER TYPE, and the ontology enums in
-- `enums.ts` describe the business rather than every closed list in the schema.
ALTER TABLE observations
  ADD CONSTRAINT observations_source_kind_check
  CHECK (source_kind IN ('demo_snapshot', 'live_crawl'));
--> statement-breakpoint

-- ─── Why a read failed, when it did ─────────────────────────────────────────────────────────
-- The single most valuable value in this list is `js_required`. Specs group 2 has ONE state for
-- an unreadable source, which cannot tell "the site blocked our reader" from "the company
-- genuinely published nothing" — and a Sales Manager asked for exactly that distinction during
-- the requirement challenge of 14/08. This column is the answer.
ALTER TABLE observations ADD COLUMN fetch_error_reason text;
--> statement-breakpoint

-- TWO rules in one constraint, and the second is the one worth naming:
--   closed list  — free text means every consumer invents its own vocabulary and the Vietnamese
--                  label shown to Sales silently falls through to nothing.
--   PAIRED with a failed read — a reason on a successful read is a contradiction. Storing it
--                  would let the failure-reason dashboard count reads that actually worked.
ALTER TABLE observations
  ADD CONSTRAINT observations_fetch_error_reason_check
  CHECK (
    fetch_error_reason IS NULL
    OR (
      fetch_status = 'failed'
      AND fetch_error_reason IN (
        'timeout', 'http_4xx', 'http_5xx', 'redirect_loop', 'js_required',
        'not_html', 'too_large', 'blocked_url', 'invalid_url'
      )
    )
  );
--> statement-breakpoint

-- ─── I-3 now compares per URL, so give that lookup an index ─────────────────────────────────
-- ADR-0036: with several sources per company, comparing the content hash against "the latest
-- observation of the company" cross-checks URL A against URL B's row — every read would then
-- store N new rows and pay for N LLM calls. The comparison moves to (company_id, source_url),
-- and this index is what keeps "fetch the latest one for this URL" cheap. Still enforced in the
-- service and NOT as a UNIQUE index: ADR-0017 explains why a global unique breaks the
-- before → after → before replay a judge performs on the second run of T-6/T-8.
CREATE INDEX observations_company_source_url_captured_at_idx
  ON observations (company_id, source_url, captured_at);
--> statement-breakpoint

-- ─── The per-company switch (I-17: the safe branch is the default branch) ────────────────────
-- Off by default at the column level, so reseeding (I-14) returns every company to "off" with no
-- clean-up code, and a company nobody opted in can never be crawled by accident.
ALTER TABLE companies
  ADD COLUMN live_source_enabled boolean NOT NULL DEFAULT false;
--> statement-breakpoint

-- ─── The read list: which public pages this company's sources are ───────────────────────────
-- `added_by` is what makes the human ownership of this table visible in the row itself, not just
-- in the GRANT. A row with no `added_by` would be indistinguishable from one the AI wrote, which
-- is the exact confusion the design is built to prevent.
CREATE TABLE company_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  url text NOT NULL,
  source_tier text NOT NULL DEFAULT 'company_website',
  discovered_via text NOT NULL,
  -- The search snippet that made a person pick this URL. Kept so "why is the system reading
  -- this page" is answerable months later without re-running the search.
  search_snippet text,
  added_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_sources_company_id_url_unique UNIQUE (company_id, url),
  CONSTRAINT company_sources_source_tier_check
    CHECK (source_tier IN ('company_website', 'news', 'social')),
  CONSTRAINT company_sources_discovered_via_check
    CHECK (discovered_via IN ('web_search', 'manual'))
);
--> statement-breakpoint

CREATE INDEX company_sources_company_id_idx ON company_sources (company_id);
--> statement-breakpoint

-- SELECT and nothing else. See the header: this one line is what turns "the AI does not choose
-- the source it reads" from a sentence in a document into a database privilege.
GRANT SELECT ON company_sources TO crm_system;

-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- The suggestion list: what a search offered, kept so a refresh stops costing 10–20 seconds
-- and another paid search (ADR-0037).
-- ═══════════════════════════════════════════════════════════════════════════════════════════
--
-- READ 0001_grants.sql AND 0008_live_source.sql FIRST, because this file answers their question
-- the OTHER way round, and the difference is the whole design:
--
--   company_sources (0008)          → GRANT SELECT TO crm_system.
--     The reading list. The crawler has to know which pages to fetch, so it reads this one.
--
--   company_source_candidates (here) → NO GRANT AT ALL.
--     The suggestion list. Nothing the crawler acts on: a row here means "a search offered this
--     URL", never "someone kept it". `crm_system` has no ALTER DEFAULT PRIVILEGES (0001), so a
--     new table is FORBIDDEN to the AI identity until someone grants it by hand — and here that
--     default is the feature. THE MOST IMPORTANT LINE IN THIS FILE IS THE ONE THAT IS ABSENT.
--
-- If you are here to "finish the set" by adding a GRANT because the neighbouring table has one:
-- don't. An AI that could read this list could act on pages nobody kept, and one that could
-- write it could put its own URLs in front of a person about to tick them — the two-step of
-- ADR-0036 exists precisely so neither is possible. `live-source-columns-and-grants.test.ts`
-- tests 20 and 21 fail the moment a GRANT appears.
--
-- `crm_app` needs no line either: 0001 set ALTER DEFAULT PRIVILEGES granting it ALL on tables
-- crm_owner creates, and migrations run as crm_owner.
--
-- WHY A SEPARATE TABLE rather than a `status` column on `company_sources`: today "a row exists in
-- company_sources" means "a person kept this", and 0008 turns that sentence into a privilege
-- (I-18). A status column would make the same table hold both kept and merely-offered rows, so
-- every reader would need a WHERE to stay correct, and the one that forgot would read a page
-- nobody approved. Two tables, one meaning each.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE company_source_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  url text NOT NULL,
  source_tier text NOT NULL DEFAULT 'company_website',
  -- NOT NULL, and it is the only text column here that is. This is the sentence a person reads to
  -- decide whether the URL is really about this company; a candidate without one is a row asking
  -- for a decision while withholding the grounds for it (rule 4).
  reason text NOT NULL,
  -- The quoted fragment from the search result. Nullable: a search that returned no snippet is a
  -- fact, and inventing one to fill the column would be worse than the gap.
  snippet text,
  found_at timestamptz NOT NULL DEFAULT now(),
  -- Who pressed "Tìm nguồn công khai". Nullable in the column for the same reason as
  -- `company_sources.added_by`: a future import path needs somewhere honest to say "unknown"
  -- rather than naming an innocent user.
  found_by uuid REFERENCES users(id),
  -- A second search that returns a URL already on the list must not double the row someone reads.
  CONSTRAINT company_source_candidates_company_id_url_unique UNIQUE (company_id, url),
  -- The same closed list as `company_sources.source_tier` and `observations.source_tier`: a
  -- candidate that gets kept carries its tier across unchanged, so a second vocabulary here would
  -- mean a translation step that can go wrong.
  CONSTRAINT company_source_candidates_source_tier_check
    CHECK (source_tier IN ('company_website', 'news', 'social'))
);
--> statement-breakpoint

CREATE INDEX company_source_candidates_company_id_idx ON company_source_candidates (company_id);

-- NO GRANT for crm_system. See the header — this absence is the guarantee.

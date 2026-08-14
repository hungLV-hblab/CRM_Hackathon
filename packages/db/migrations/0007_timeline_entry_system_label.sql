-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- Autonomy zone 4 at the database layer — ADR-0029, extending ADR-0015 to a table it missed.
-- ═══════════════════════════════════════════════════════════════════════════════════════════
--
-- READ 0003_grants_ai_tables.sql FIRST. It classifies the seven tables added by 0002 by one
-- question: does this table hold a column that belongs to a HUMAN decision? `timeline_entries`
-- was never put through that question, because it predates 0002 — 0001_grants.sql granted
-- `INSERT` at TABLE level here, in the era before the trap was measured.
--
-- Answer the question now and the table fails it twice:
--
--   `created_by`      is what the "do hệ thống thêm" label on the row is rendered from. An AI
--                     holding this column can write a row that reads as something Sales typed:
--                     rule 2 of CLAUDE.md gone, and gone invisibly.
--   `source_claim_id` is the way back to the quote. An AI holding table-level INSERT can leave
--                     it NULL, i.e. state a fact on the official timeline with no source behind
--                     it at all: rule 1 gone.
--
-- Together those two are the one row nobody could ever defend in round 2. Three changes close
-- it, and each closes a DIFFERENT half — the CHECK holds against raw SQL from any role, the
-- column list holds against the AI identity, the DEFAULT is what makes the column list safe to
-- impose in the first place.
--
-- `contact_id` is DELIBERATELY ABSENT from the GRANT below, and it is not an oversight worth
-- "fixing" later: the AI naming a person on an entry it invented is fabricating a meeting that
-- never took place. Zone 4 buys the right to append news, not to record who was in the room.
--
-- ADDING A COLUMN TO `timeline_entries` LATER → add it to the list below or the watch cycle
-- silently loses the ability to write it. That direction of failure is the safe one.
--
-- Rollback is a `REVOKE` plus a table-level `GRANT` (5 minutes), which works precisely because
-- privileges granted per column are removable per column — measured in ADR-0015 step 3.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

-- ─── 1. The DEFAULT that makes the missing column harmless ──────────────────────────────
-- With `created_by` absent from the GRANT, an AI insert must still land on a labelled row —
-- otherwise every "denied" below turns into a NOT NULL violation and feature group 5 simply
-- stops working. `'system'` is the honest default here: every writer that is NOT the AI names
-- the column explicitly (`timeline-service.ts` and `opportunity-service.ts` both pass 'human'),
-- so the only statement this default can ever answer for is one the AI made.
ALTER TABLE "timeline_entries" ALTER COLUMN "created_by" SET DEFAULT 'system';--> statement-breakpoint

-- ─── 2. The CHECK: no provenance, no row (rule 1 at the lowest layer) ───────────────────
-- Compared as `::text` rather than against the enum literal. `created_by` and `entry_type` are
-- pg enums, and drizzle runs every migration inside ONE transaction: an enum value added by an
-- earlier `ALTER TYPE ... ADD VALUE` in the same transaction cannot be referenced yet (55P04).
-- Casting to text sidesteps that for good, on every fresh database — which is every test run
-- and every time a judge replays the demo from scratch.
--
-- The second half (`entry_type = 'system_entry'`) is not redundant. Without it the AI could
-- write `entry_type = 'activity'` and its row would render as "Hoạt động": the machine hue of
-- rule 2 is chosen from the type as well as from the author.
ALTER TABLE "timeline_entries" ADD CONSTRAINT "timeline_system_entry_needs_quote"
  CHECK ("created_by"::text <> 'system'
         OR ("entry_type"::text = 'system_entry' AND "source_claim_id" IS NOT NULL));--> statement-breakpoint

-- ─── 3. Table-level INSERT out, column-level INSERT in ─────────────────────────────────
-- The REVOKE is the load-bearing line. A column-level GRANT ADDED ON TOP of a table-level one
-- widens nothing and protects nothing — ADR-0010 measured exactly that on `UPDATE`: a
-- column-level REVOKE cannot punch a hole in a table-level grant, so the table-level grant has
-- to go away first.
REVOKE INSERT ON "timeline_entries" FROM crm_system;--> statement-breakpoint
GRANT INSERT (id, company_id, entry_type, occurred_at, description, source_claim_id, created_at)
  ON "timeline_entries" TO crm_system;
-- Still no UPDATE and still no DELETE for `crm_system` (both from 0001): an entry is appended,
-- never rewritten, and removing one is Sales' act — the single error-detection signal feature
-- group 5 produces (I-13).

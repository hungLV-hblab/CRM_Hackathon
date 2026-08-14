import { check, index, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

import { companies } from './companies'
import { users } from './users'

/**
 * What a search OFFERED for a company — the suggestion list, kept so a page refresh no longer
 * costs 10–20 seconds and another paid search (ADR-0037).
 *
 * THE ABSENCE OF A GRANT IS THIS TABLE'S POINT, and it is the exact opposite of its neighbour's.
 * `company_sources` grants `SELECT` to `crm_system` because the crawler has to know which pages to
 * fetch. Here `crm_system` holds NOTHING — not even SELECT (`0010_source_candidates.sql`) — because
 * a row here means "a search offered this URL", never "a person kept it". An AI that could read
 * this list could act on pages nobody approved; one that could write it could put URLs of its own
 * invention in front of someone about to tick them. `crm_system` has no
 * `ALTER DEFAULT PRIVILEGES` (`0001_grants.sql:13`), so that refusal came for free and the
 * migration only had to not undo it.
 *
 * WHY NOT a `status` column on `company_sources`: today "a row exists in `company_sources`" means
 * "a person kept this", and 0008 turns that sentence into a database privilege (I-18). Holding
 * both kept and merely-offered rows in one table would make every reader depend on a `WHERE` to
 * stay correct, and the reader that forgot would fetch a page nobody approved. Two tables, one
 * meaning each — so "which pages do we read" still has exactly one answer.
 *
 * Persisting candidates does NOT reopen the option ADR-0036 rejected. That one was "the search
 * saves what it finds into the READING LIST"; this is "the search records what it offered, where
 * the AI cannot see it". The human click is still the only thing that writes `company_sources`.
 */
export const companySourceCandidates = pgTable(
  'company_source_candidates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    url: text('url').notNull(),
    /** Mirrors `company_sources.source_tier`: a candidate that gets kept carries its tier across. */
    sourceTier: text('source_tier').notNull().default('company_website'),
    /**
     * Why this URL is about THIS company — the sentence a person reads to decide. `notNull` and
     * deliberately so: a candidate with no grounds is a row asking for a decision while
     * withholding what the decision rests on (rule 4).
     */
    reason: text('reason').notNull(),
    /**
     * The quoted fragment from the search result. Nullable: a search that returned no snippet is a
     * fact, and filling the column with something invented would be worse than the gap.
     */
    snippet: text('snippet'),
    foundAt: timestamp('found_at', { withTimezone: true }).notNull().defaultNow(),
    /**
     * Who pressed "Tìm nguồn công khai". Nullable in the column for the same reason as
     * `company_sources.added_by`: a future import path needs somewhere honest to say "unknown".
     */
    foundBy: uuid('found_by').references(() => users.id),
  },
  (table) => [
    unique('company_source_candidates_company_id_url_unique').on(table.companyId, table.url),
    check(
      'company_source_candidates_source_tier_check',
      sql`${table.sourceTier} IN ('company_website', 'news', 'social')`,
    ),
    index('company_source_candidates_company_id_idx').on(table.companyId),
  ],
)

export type CompanySourceCandidate = typeof companySourceCandidates.$inferSelect

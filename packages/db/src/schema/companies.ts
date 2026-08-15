import { boolean, check, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

import { users } from './users'

/**
 * ontology 3.1 — Sales' official data, the ROOT entity. Everything else (`Opportunity`,
 * `TimelineEntry`, `Observation`, `Claim`) derives from it.
 *
 * `name`, `industry` and `companyType` are required at creation. `companyType` is required
 * because it is the lens signals are read under (`Claim` `read_under_lens_of` `company_type`);
 * without it feature group 2 cannot interpret news correctly. That is also why I-11 FORBIDS
 * a `Proposal` from editing it — editing the lens creates a self-referential loop.
 *
 * `companyType` is `text`, NOT a pg enum (ADR-0042 amendment, migration 0012). It used to be a
 * 5-value enum (`traditional`/`it_solution`/`it_product`/`tech_startup`/`other_ito`), fine for a
 * hand-typed demo fixture — but the real BTC `Account.csv` carries free text ("SIer", "Enduser",
 * "drug store", "IT Consulting", 6 rows blank) that does not fold cleanly into 5 buckets, and
 * forcing a reverse-lookup would mean silently GUESSING which of the 5 buckets a real company
 * belongs to — exactly what rule 4 forbids. `text` stores the source value as-is; the 5-value
 * dictionary in `@crm/contracts` becomes a set of SUGGESTED values for the create/edit form, not
 * an enforced list.
 *
 * `isWatched` means "Đang theo dõi". Turning it on delegates news-writing to the system
 * (ADR-0006, I-5).
 */
export const companies = pgTable(
  'companies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    industry: text('industry').notNull(),
    companyType: text('company_type').notNull(),
    country: text('country'),
    size: text('size'),
    website: text('website'),
    isWatched: boolean('is_watched').notNull().default(false),
    ownerId: uuid('owner_id').references(() => users.id),
    /**
     * DEMO SCAFFOLDING, not ontology (ADR-0022): which stored snapshot is "the source right
     * now" for this company. The watch cycle runs on a timer and takes no parameters, so
     * without a column to read it cannot know which page it is looking at — and acceptance
     * check 8 ("flip the source of two companies") has nothing to flip.
     *
     * `text` + CHECK rather than a pg enum on purpose: the ontology enums describe the
     * business, and a demo control does not belong among them. `crm_system` holds SELECT on
     * this table and no UPDATE, so the AI cannot switch the source it then draws conclusions
     * from — measured, not assumed.
     *
     * Not exposed by `CompanyDto`: `toDto` lists its columns, so the scaffolding stays out of
     * the API.
     */
    snapshotVariant: text('snapshot_variant').notNull().default('before'),
    /**
     * The per-company gate on the live web source (ADR-0035 · I-17). Off by default, so a company
     * nobody opted in can never be crawled and reseeding (I-14) returns everything to "off" with
     * no clean-up code.
     *
     * Protected by exactly the same privilege as `snapshotVariant` above, and for the same
     * reason: `crm_system` holds SELECT on this table and NO UPDATE, so the AI can read the
     * switch and can never set it. An AI able to turn on its own uncontrolled source would be
     * choosing which evidence it then reports on. Measured in
     * `live-source-columns-and-grants.test.ts`, not assumed.
     *
     * Turning it on for a company of the seed set is REFUSED (I-16) and audited: the acceptance
     * suite must stay reproducible, and it is only reproducible while every company a judge
     * touches reads the stored snapshot.
     */
    liveSourceEnabled: boolean('live_source_enabled').notNull().default(false),
    /** Soft delete: `actor=system` may never delete human-created data (ontology section 5). */
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'companies_snapshot_variant_check',
      sql`${table.snapshotVariant} IN ('before', 'after')`,
    ),
  ],
)

export type Company = typeof companies.$inferSelect

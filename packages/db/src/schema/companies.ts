import { boolean, check, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

import { companyTypeEnum } from './enums'
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
 * `isWatched` means "Đang theo dõi". Turning it on delegates news-writing to the system
 * (ADR-0006, I-5).
 */
export const companies = pgTable(
  'companies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    industry: text('industry').notNull(),
    companyType: companyTypeEnum('company_type').notNull(),
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

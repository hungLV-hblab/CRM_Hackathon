import {
  boolean,
  check,
  index,
  pgTable,
  pgView,
  text,
  timestamp,
  uuid,
  unique,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

import { companies } from './companies'
import { users } from './users'

/**
 * Which public pages the live-crawl path is allowed to read for a company (ADR-0035, ADR-0036).
 *
 * THE OWNERSHIP OF THIS TABLE IS THE POINT. `crm_system` holds `SELECT` and nothing else
 * (`0008_live_source.sql`): the AI may read which pages to fetch and may never add one. A model
 * that could save its own reading list would be choosing which evidence to then report on —
 * the same failure `snapshot_variant` is protected against (`companies.ts:39`), and a third
 * self-write path outside the two exceptions Specs opens (CLAUDE.md section 4).
 *
 * So the flow is: `web_search` returns CANDIDATES in an HTTP response and persists nothing, a
 * person ticks the ones that are actually about this company, and only that click writes here —
 * under `crm_app`, with `added_by` set. Rule 3 of CLAUDE.md, applied to the reading list itself:
 * máy chuẩn bị sẵn, người quyết định ghi.
 *
 * `source_tier` mirrors `observations.source_tier` rather than introducing a second vocabulary;
 * the observation written from a row here inherits this value.
 */
export const companySources = pgTable(
  'company_sources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    url: text('url').notNull(),
    sourceTier: text('source_tier').notNull().default('company_website'),
    /** `web_search` (LLM found it, a human kept it) or `manual` (a human typed it). */
    discoveredVia: text('discovered_via').notNull(),
    /**
     * The search snippet that made a person pick this URL. Kept so "why is the system reading
     * this page" stays answerable months later without re-running the search.
     */
    searchSnippet: text('search_snippet'),
    /**
     * Who kept it. NOT nullable in practice for anything the product writes — a row without an
     * `added_by` would be indistinguishable from one the AI wrote, which is the exact confusion
     * this design prevents. Nullable in the column only so a future import path has somewhere
     * honest to say "unknown" instead of naming an innocent user.
     */
    addedBy: uuid('added_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    /**
     * Pause reading this page without losing why it was chosen (ADR-0037). `true` by default so
     * shipping the switch changes no existing company's behaviour.
     *
     * READ THIS BEFORE WRITING A QUERY: do NOT filter on this column to decide what to fetch. The
     * read path goes through `companySourcesEnabled` below, and `crm_system` has no SELECT on this
     * table at all (`0011_source_enabled_view.sql`) — so a reader that tries to filter here gets
     * `permission denied` instead of quietly fetching a page somebody switched off.
     */
    enabled: boolean('enabled').notNull().default(true),
  },
  (table) => [
    unique('company_sources_company_id_url_unique').on(table.companyId, table.url),
    check(
      'company_sources_source_tier_check',
      sql`${table.sourceTier} IN ('company_website', 'news', 'social')`,
    ),
    check(
      'company_sources_discovered_via_check',
      sql`${table.discoveredVia} IN ('web_search', 'manual')`,
    ),
    index('company_sources_company_id_idx').on(table.companyId),
  ],
)

export type CompanySource = typeof companySources.$inferSelect

/**
 * THE ONLY WAY THE AI IDENTITY SEES THE READING LIST (`0011_source_enabled_view.sql`).
 *
 * `crm_system` lost `SELECT` on `company_sources` and holds `SELECT` on this view instead, so
 * "don't read a page somebody switched off" stopped being a filter someone has to remember and
 * became a privilege. A read path that queries the table by mistake fails with `permission denied`
 * rather than succeeding quietly against a switched-off URL.
 *
 * `.existing()` because the view is created by the hand-written migration, where the REVOKE and
 * the GRANT live next to it and can be read as one mechanism. Drizzle only needs the shape so
 * `select().from(companySourcesEnabled)` types correctly.
 *
 * No `enabled` column here on purpose: every row this view returns is on, and exposing the column
 * would only invite a second filter downstream.
 */
export const companySourcesEnabled = pgView('company_sources_enabled', {
  id: uuid('id').notNull(),
  companyId: uuid('company_id').notNull(),
  url: text('url').notNull(),
  sourceTier: text('source_tier').notNull(),
  discoveredVia: text('discovered_via').notNull(),
  searchSnippet: text('search_snippet'),
  addedBy: uuid('added_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
}).existing()

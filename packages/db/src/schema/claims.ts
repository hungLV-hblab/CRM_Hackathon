import { check, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

import { companies } from './companies'
import { confidenceEnum, signalTypeEnum, triggerContextEnum } from './enums'
import { observations } from './observations'

/**
 * ontology 3.2 — "phát hiện". A proposition INFERRED from an `Observation`, which is what
 * separates it from a 1-1 transcription (CLAUDE.md section 3).
 *
 * The two CHECK constraints below are the reason T-2 can be proven: they hold even when the
 * write bypasses the API, the service and Drizzle entirely and goes straight to SQL — which
 * is exactly what T-2 asks for ("thử ghi thẳng, phải bị từ chối").
 *
 * - I-1: `quoteText` NOT NULL **and** non-blank. `NOT NULL` alone lets `''` through, and an
 *   empty quote is fake provenance dressed as real provenance.
 * - I-2: the offsets must describe a non-empty span. Code computes them by locating
 *   `quoteText` inside `Observation.rawContent`; they are NEVER accepted from the LLM (see
 *   `ClaimDraft` in @crm/contracts, which deliberately has no offset fields). The check here
 *   cannot verify the substring relation — that belongs to the service — but it does stop
 *   nonsense spans from ever being stored.
 *
 * `triggerContext` decides whether this claim may become a `TimelineEntry`: I-4 forbids it
 * for `manual_ingest`; only the watch cycle (feature group 5) may write to the timeline.
 */
export const claims = pgTable(
  'claims',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    observationId: uuid('observation_id')
      .notNull()
      .references(() => observations.id),
    statement: text('statement').notNull(),
    signalType: signalTypeEnum('signal_type').notNull(),
    confidence: confidenceEnum('confidence').notNull(),
    /** Verbatim substring of `Observation.rawContent`. A paraphrase is rejected (I-2). */
    quoteText: text('quote_text').notNull(),
    quoteStart: integer('quote_start').notNull(),
    quoteEnd: integer('quote_end').notNull(),
    triggerContext: triggerContextEnum('trigger_context').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('claims_quote_text_not_blank', sql`length(btrim(${table.quoteText})) > 0`),
    check(
      'claims_quote_span_is_valid',
      sql`${table.quoteStart} >= 0 AND ${table.quoteEnd} > ${table.quoteStart}`,
    ),
  ],
)

export type Claim = typeof claims.$inferSelect

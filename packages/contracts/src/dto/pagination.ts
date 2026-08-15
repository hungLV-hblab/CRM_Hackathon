import { z } from 'zod'

/**
 * ADR-0047 — one pagination contract, shared by every list endpoint.
 *
 * Offset rather than cursor: the screens need to jump to a page and to show a total, and at this
 * product's size the cost cursors buy back is not being paid. The trade-off offset carries — a
 * concurrent insert shifting rows between two requests — is reduced by the tiebreaker rule below
 * and accepted for the rest.
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type PaginationQuery = z.infer<typeof paginationQuerySchema>

/**
 * `total` counts rows matching the same filter, NOT the rows in `items`. It is read under a
 * separate statement from the one that fetched `items`, so it can describe a snapshot one beat
 * newer. That is accepted (ADR-0047) — nothing in this product needs the number to be exact at
 * an instant — and it is written down here rather than quietly assumed to be exact.
 *
 * ORDERING RULE for anything paginated with this: the `ORDER BY` must end in a unique column,
 * normally `id`. `created_at` is not unique — the watch cycle runs every 10 seconds in e2e and
 * writes several rows inside one transaction, so equal timestamps are ordinary. Without the
 * tiebreaker, rows with equal timestamps have undefined relative order and one can appear on two
 * pages, or on neither.
 */
export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

/**
 * A query-string boolean. NEVER use `z.coerce.boolean()` for this.
 *
 * In zod 3 `z.coerce.boolean()` is `Boolean(input)`, so EVERY non-empty string is `true` —
 * including the literal `"false"`, which is exactly what a client sends when it serialises a
 * `false` state. A filter that silently inverts is worse than no filter: the caller asked for
 * "show everything" and got "show one subset", with no error to notice.
 *
 * This is the packaged form of the rule `company.controller.ts` already spelled out inline:
 * only the literal 'true'/'false' means anything, and anything else leaves the filter off.
 */
export const booleanQuerySchema = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => value === 'true')

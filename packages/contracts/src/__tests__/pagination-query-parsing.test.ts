import { describe, expect, it } from 'vitest'

import { booleanQuerySchema, paginationQuerySchema } from '../dto/pagination'

/**
 * These tests exist for ONE invariant, not to re-test zod: a query string carries only strings,
 * and every place this product reads a boolean or a page number out of one must agree on what
 * those strings mean.
 *
 * The `'false'` case below is the whole reason the file exists. The first draft of this contract
 * used `z.coerce.boolean()`, which is `Boolean(input)` — so `?unreadOnly=false` would have
 * arrived as `true` and the notification history page would have quietly shown only unread rows,
 * with every test that only ever passes `true` staying green. ADR-0047.
 */
describe('booleanQuerySchema', () => {
  it('reads the literal "false" as false — the case z.coerce.boolean() gets wrong', () => {
    expect(booleanQuerySchema.parse('false')).toBe(false)
  })

  it('reads the literal "true" as true', () => {
    expect(booleanQuerySchema.parse('true')).toBe(true)
  })

  it('treats an absent parameter as false rather than guessing', () => {
    expect(booleanQuerySchema.parse(undefined)).toBe(false)
  })

  it('refuses anything that is not the two literals, instead of coercing it', () => {
    expect(() => booleanQuerySchema.parse('1')).toThrow()
    expect(() => booleanQuerySchema.parse('yes')).toThrow()
  })
})

describe('paginationQuerySchema', () => {
  it('defaults to the first page of 20 when the client sends nothing', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 })
  })

  it('accepts the numbers as the strings a query string actually delivers', () => {
    expect(paginationQuerySchema.parse({ page: '3', pageSize: '50' })).toEqual({
      page: 3,
      pageSize: 50,
    })
  })

  it('refuses a page below one, so an offset can never go negative', () => {
    expect(() => paginationQuerySchema.parse({ page: '0' })).toThrow()
    expect(() => paginationQuerySchema.parse({ page: '-1' })).toThrow()
  })

  it('caps pageSize, so one request cannot ask for the whole table', () => {
    expect(() => paginationQuerySchema.parse({ pageSize: '101' })).toThrow()
    expect(() => paginationQuerySchema.parse({ pageSize: '0' })).toThrow()
  })

  it('refuses a non-integer page rather than truncating it', () => {
    expect(() => paginationQuerySchema.parse({ page: '1.5' })).toThrow()
  })
})

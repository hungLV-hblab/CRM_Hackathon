import { describe, expect, it } from 'vitest'

import { deterministicUuid } from '../deterministic-uuid'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('deterministicUuid', () => {
  it('1 · same kind+code always produces the same value', () => {
    const values = Array.from({ length: 100 }, () => deterministicUuid('company', 'C18'))
    expect(new Set(values).size).toBe(1)
  })

  it('2 · output matches UUID shape (version 4, valid variant nibble)', () => {
    expect(deterministicUuid('company', 'C18')).toMatch(UUID_RE)
    expect(deterministicUuid('opportunity', 'O9')).toMatch(UUID_RE)
  })

  it('3 · different code produces a different value', () => {
    expect(deterministicUuid('company', 'C18')).not.toBe(deterministicUuid('company', 'C19'))
  })

  it('4 · different kind produces a different value for the same code', () => {
    expect(deterministicUuid('company', 'C18')).not.toBe(deterministicUuid('contact', 'C18'))
  })

  it('5 · no collision across every real company/contact/opportunity code (C15-C39, P31-P68, O1-O23)', () => {
    const companyCodes = Array.from({ length: 25 }, (_, i) => `C${15 + i}`)
    const contactCodes = Array.from({ length: 38 }, (_, i) => `P${31 + i}`)
    const opportunityCodes = Array.from({ length: 23 }, (_, i) => `O${1 + i}`)

    const ids = [
      ...companyCodes.map((c) => deterministicUuid('company', c)),
      ...contactCodes.map((c) => deterministicUuid('contact', c)),
      ...opportunityCodes.map((c) => deterministicUuid('opportunity', c)),
    ]
    expect(new Set(ids).size).toBe(ids.length)
  })
})

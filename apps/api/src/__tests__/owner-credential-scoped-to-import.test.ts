import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * `DATABASE_URL_OWNER`/`crm_owner` is a deliberate, narrow exception to "the API never uses the
 * owner role" (`packages/db/src/client.ts`: "crm_owner is deliberately absent here... belongs to
 * migrate.ts and seed/"). ADR-0042 argues this is safe ONLY because it is confined to exactly
 * one file, one admin-gated route, and a connection opened and closed within a single call.
 *
 * This test is the enforcement — not a comment, a red test if anyone widens the exception.
 */

const SRC_ROOT = resolve(__dirname, '..')

function listTsFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      if (entry === '__tests__') continue
      out.push(...listTsFiles(full))
    } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
      out.push(full)
    }
  }
  return out
}

describe('DATABASE_URL_OWNER stays confined to the admin import path', () => {
  it('is referenced in exactly one non-test file under apps/api/src', () => {
    const files = listTsFiles(SRC_ROOT)
    const matches = files.filter((f) => readFileSync(f, 'utf8').includes('DATABASE_URL_OWNER'))
    expect(matches).toEqual([resolve(SRC_ROOT, 'admin/admin-import-service.ts')])
  })
})

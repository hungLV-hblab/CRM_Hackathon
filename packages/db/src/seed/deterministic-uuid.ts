import { createHash } from 'node:crypto'

/**
 * I-14 requires a reseed to return the system to EXACTLY the initial state. With the dataset
 * now coming from a re-uploadable zip instead of a hardcoded array, the only way an ID stays
 * the same across every seed run is to derive it from the source code itself rather than
 * generate it (`gen_random_uuid()`/`crypto.randomUUID()` would give a different ID every time).
 *
 * sha256, not a "real" UUIDv5 (no external namespace/library) — this repo only needs a value
 * that (a) is stable for the same input, (b) never collides across the handful of codes in one
 * dataset, and (c) is valid input for a Postgres `uuid` column. RFC 4122 version/variant bits
 * are set anyway so the value reads as a normal-looking UUID and downstream code (Zod `.uuid()`
 * validators, etc.) does not need a special case.
 */
export function deterministicUuid(kind: string, code: string): string {
  const hash = createHash('sha256').update(`${kind}:${code}`).digest('hex')
  const bytes = hash.slice(0, 32).split('')

  // Version nibble: 4 (arbitrary — this is not a real UUIDv4, just needs a valid version digit).
  bytes[12] = '4'
  // Variant nibble: RFC 4122 requires the top two bits of this nibble to be `10`, i.e. one of
  // 8/9/a/b.
  const variantNibbles = ['8', '9', 'a', 'b']
  bytes[16] = variantNibbles[parseInt(bytes[16], 16) % 4]

  const hex = bytes.join('')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-')
}

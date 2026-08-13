import { resolve } from 'node:path'

import { config } from 'dotenv'
import { Pool } from 'pg'

/**
 * Switches one company between the stored `before` and `after` snapshots, from a terminal.
 *
 * The demo needs a hand-driven way to say "the news broke now": acceptance checks 6 and 8 both
 * open with a change of source. The API has the same switch behind `POST
 * /demo/companies/:id/snapshot-variant`; this is the version that works while the browser is
 * showing the screen the judge is about to watch change.
 *
 * Connects as `crm_app`, NOT as `crm_owner`: the flip is a human act, and running it under an
 * identity that bypasses column privileges would prove nothing about who is allowed to do it.
 *
 *   pnpm switch-snapshot "Sakura" after
 *   pnpm switch-snapshot aaaaaaaa-0002-4000-8000-000000000002 before
 */

const VARIANTS = ['before', 'after'] as const
type Variant = (typeof VARIANTS)[number]

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function switchSnapshot(
  connectionString: string,
  companyRef: string,
  variant: Variant,
): Promise<{ id: string; name: string; snapshotVariant: string }> {
  const pool = new Pool({ connectionString })
  try {
    /**
     * A name FRAGMENT is accepted because nobody types "Sakura Manufacturing KK" mid-demo,
     * but an ambiguous fragment is refused rather than resolved to the first match: flipping
     * the wrong company is a mistake that looks exactly like a broken watch cycle.
     */
    const { rows } = UUID.test(companyRef)
      ? await pool.query('SELECT id, name FROM companies WHERE id = $1 AND deleted_at IS NULL', [
          companyRef,
        ])
      : await pool.query(
          'SELECT id, name FROM companies WHERE name ILIKE $1 AND deleted_at IS NULL',
          [`%${companyRef}%`],
        )

    if (rows.length === 0) throw new Error(`Không tìm thấy công ty khớp "${companyRef}".`)
    if (rows.length > 1) {
      throw new Error(
        `"${companyRef}" khớp ${rows.length} công ty: ${rows
          .map((row) => row.name)
          .join(', ')}. Gõ rõ hơn hoặc dùng id.`,
      )
    }

    const { rows: updated } = await pool.query(
      'UPDATE companies SET snapshot_variant = $1, updated_at = now() WHERE id = $2 RETURNING id, name, snapshot_variant',
      [variant, rows[0].id],
    )
    return {
      id: updated[0].id,
      name: updated[0].name,
      snapshotVariant: updated[0].snapshot_variant,
    }
  } finally {
    await pool.end()
  }
}

function isVariant(value: string | undefined): value is Variant {
  return VARIANTS.includes(value as Variant)
}

async function runFromCli(): Promise<void> {
  config({ path: resolve(__dirname, '../../../../.env') })

  const [companyRef, variant] = process.argv.slice(2)
  if (!companyRef || !isVariant(variant)) {
    throw new Error('Cách dùng: pnpm switch-snapshot <tên công ty hoặc id> <before|after>')
  }

  const url = process.env.DATABASE_URL_APP
  if (!url) {
    throw new Error('Missing DATABASE_URL_APP. Copy .env.example to .env and fill it in.')
  }

  const result = await switchSnapshot(url, companyRef, variant)
  console.log(`${result.name} → bản chụp "${result.snapshotVariant}".`)
}

if (require.main === module) {
  runFromCli().catch((error) => {
    console.error((error as Error).message)
    process.exit(1)
  })
}

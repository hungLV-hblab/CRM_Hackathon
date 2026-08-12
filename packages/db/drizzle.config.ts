import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

config({ path: '../../.env' })

/**
 * There is NO `push` command anywhere in this project (ADR-0010, CLAUDE.md section 6).
 * `drizzle-kit push` diffs the schema and applies it directly, bypassing migration files —
 * it would wipe out `0001_grants.sql` and with it the entire database-level defence layer,
 * without printing a single warning. Only `generate` and `migrate`.
 */
export default defineConfig({
  schema: './src/schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL_OWNER ?? '',
  },
})

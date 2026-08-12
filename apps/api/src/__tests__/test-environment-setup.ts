import { resolve } from 'node:path'

import { config } from 'dotenv'

/**
 * Points all of `apps/api` at the TEST database before any module reads the environment.
 * Without this, `DbModule` opens pools against the dev database and the tests would wipe the
 * actual demo data.
 */
config({ path: resolve(__dirname, '../../../../.env') })

process.env.DATABASE_URL_APP = process.env.DATABASE_URL_TEST_APP
process.env.DATABASE_URL_SYSTEM = process.env.DATABASE_URL_TEST_SYSTEM
process.env.JWT_SECRET ||= 'test-only-signing-key'

import { DEMO_ACCOUNTS } from '@crm/contracts'

/**
 * The login accounts. Not part of `SeedDataset`/`parseZipDataset`: the BTC zip carries
 * companies/contacts/opportunities/snapshots, never credentials, so there is no file to parse
 * these from. Kept here as the one deliberate exception to "no hand-typed data" — this is a
 * system credential, not company data (validate session 1, question 1).
 *
 * WHO exists comes from `DEMO_ACCOUNTS` (the same list the login screen's demo tab renders);
 * only ids and the password hash are seed-local. IDs and hashes are fixed constants, same
 * reasoning as everything else that must survive a reseed unchanged (I-14): generating them at
 * run time would leave every login broken after the second seed.
 *
 * The demo password is published by the organizers for every handed-out account. A bcrypt hash
 * of an already-published password is not a secret.
 */

/** bcrypt of `DEMO_PASSWORD` (cost 10). Same published password → one hash serves all rows. */
const DEMO_PASSWORD_HASH = '$2a$10$rcKZUGmNAT8PDGFwUwwhlecaUBpDZIAfKchBu89Zo8nnv3jrapj.O'

/**
 * Keyed by EMAIL, not by array position. Positional matching would let a seventh account
 * typecheck its way to `id: undefined`, drizzle would omit the column, `defaultRandom()` would
 * fire, and the seed would stop being reproducible — I-14 broken silently. A missing id throws
 * instead, at seed time, naming the account.
 */
const SEED_USER_IDS: Record<string, string> = {
  'sales@hblab.vn': '11111111-1111-4111-8111-111111111111',
  'sales2@hblab.vn': '33333333-3333-4333-8333-333333333333',
  'sales3@hblab.vn': '44444444-4444-4444-8444-444444444444',
  'sales4@hblab.vn': '55555555-5555-4555-8555-555555555555',
  'sales5@hblab.vn': '66666666-6666-4666-8666-666666666666',
  'admin@hblab.vn': '22222222-2222-4222-8222-222222222222',
}

export const SEED_USERS = DEMO_ACCOUNTS.map((account) => {
  const id = SEED_USER_IDS[account.email]
  if (!id) {
    throw new Error(
      `Thiếu id cố định cho tài khoản demo "${account.email}". Thêm vào SEED_USER_IDS trong default-users.ts.`,
    )
  }
  return {
    id,
    email: account.email,
    name: account.name,
    role: account.role,
    passwordHash: DEMO_PASSWORD_HASH,
  }
})

/**
 * "The" sales account — the one a test signs in as when it does not care which sales person it
 * is. Kept as a named export because several call sites predate there being more than one.
 */
export const SALES_ID = SEED_USERS[0].id

/**
 * `sales_owner` cell → user id, the join `parseZipDataset` uses to give each imported company
 * the person `Account.csv` says looks after it. Admin is deliberately absent: an administrator
 * is not a candidate owner, and a CSV naming one should fall through to the unknown-name
 * warning rather than quietly succeed.
 */
export const SALES_ID_BY_OWNER_NAME: ReadonlyMap<string, string> = new Map(
  SEED_USERS.filter((user) => user.role === 'sales').map((user) => [user.name, user.id]),
)

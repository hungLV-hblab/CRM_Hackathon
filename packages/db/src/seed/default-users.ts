/**
 * The two login accounts (ADR-0033 — exactly two roles, one account each). Not part of
 * `SeedDataset`/`parseZipDataset`: the BTC zip carries companies/contacts/opportunities/
 * snapshots, never credentials, so there is no file to parse these from. Kept here as the one
 * deliberate exception to "no hand-typed data" — this is a system credential, not company data
 * (validate session 1, question 1).
 *
 * IDs and password hashes are fixed constants, same reasoning as everything else that must
 * survive a reseed unchanged (I-14): generating them at run time would make every login broken
 * after the second seed.
 *
 * The demo passwords `sales123` / `admin123` are published in the README so judges can log in.
 * A bcrypt hash of an already-published password is not a secret.
 */

export const DEMO_PASSWORDS = {
  sales: 'sales123',
  admin: 'admin123',
} as const

export const SEED_USERS = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'sales@hblab.vn',
    name: 'Sales ITO',
    role: 'sales' as const,
    passwordHash: '$2a$10$0PdFm08li2/lN/wIJ7jBoevYWmURrzqRZqrxoTtWO21Mk.dqTpB3i',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'admin@hblab.vn',
    name: 'Quản trị',
    role: 'admin' as const,
    passwordHash: '$2a$10$rWBpvu8RmgoSaH9icjyqA.b4ADRQx9SeDKrN39eEC8uCECu7PkuJq',
  },
]

export const SALES_ID = SEED_USERS[0].id

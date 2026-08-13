import { Pool } from 'pg'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import type { ClaimDraft, ClaimExtractor } from '@crm/contracts'
import { createConnection, resetTestDatabase } from '@crm/db'

import { AuditEventService } from '../../../common/audit/audit-event-service'
import { AutoNextStepService } from '../../opportunity/auto-next-step-service'
import { ClaimReactionService } from '../../claim/claim-reaction-service'
import { ClaimService } from '../../claim/claim-service'
import { DemoSnapshotSource } from '../../../ai/demo-snapshots'
import { FixtureClaimExtractor } from '../../../ai/fixture-claim-extractor'
import { ObservationService } from '../../observation/observation-service'
import { ProposalService } from '../proposal-service'
import { SystemSettingService } from '../../../settings/system-setting-service'

/**
 * The generation half of feature group 3: which suggestions come into existence, and which are
 * refused. Everything runs against a real database through the real ingest path, because the
 * gates being tested are only worth anything where they actually sit.
 *
 * The four `crm_system` columns of a company profile are seeded to match, or not match, the
 * facts block of the stored snapshot on purpose — that difference is the entire input to G3.
 */

const SALES_ID = '11111111-1111-4111-8111-111111111111'
/** Watched, facts block says `1000+` in `after` while the profile says `500-1000`. */
const SAKURA = 'aaaaaaaa-0001-4000-8000-000000000001'
/** Watched, and its seeded `website` is deliberately NULL — the "fill a blank" case. */
const KITEFIN = 'aaaaaaaa-0003-4000-8000-000000000003'
/** NOT watched: the only company whose news may become a `timeline_entry` suggestion (I-5). */
const MARLIN = 'aaaaaaaa-0005-4000-8000-000000000005'

const owner = new Pool({ connectionString: process.env.DATABASE_URL_TEST })
const appConnection = createConnection(process.env.DATABASE_URL_TEST_APP as string)
const systemConnection = createConnection(process.env.DATABASE_URL_TEST_SYSTEM as string)

const settings = new SystemSettingService(appConnection.db, systemConnection.db)
const snapshots = new DemoSnapshotSource()

function buildIngest(extractor: ClaimExtractor = new FixtureClaimExtractor()): ObservationService {
  const claims = new ClaimService(systemConnection.db, appConnection.db)
  const proposals = new ProposalService(systemConnection.db, appConnection.db)
  return new ObservationService(
    systemConnection.db,
    appConnection.db,
    extractor,
    claims,
    snapshots,
    settings,
    new ClaimReactionService(
      new AutoNextStepService(
        systemConnection.db,
        appConnection.db,
        new AuditEventService(appConnection.db, systemConnection.db),
      ),
      proposals,
    ),
  )
}

async function listProposals(): Promise<
  { proposal_type: string; target_field: string | null; proposed_value: string; current_value: string | null; impact_if_wrong: string | null; status: string }[]
> {
  const { rows } = await owner.query(
    `SELECT proposal_type, target_field, proposed_value, current_value, impact_if_wrong, status
     FROM proposals ORDER BY proposal_type, target_field`,
  )
  return rows
}

beforeEach(async () => {
  await resetTestDatabase(owner)
  await owner.query(
    `INSERT INTO users (id, email, password_hash, name, role)
     VALUES ($1, 'sales@test.local', 'x', 'Sales', 'sales')`,
    [SALES_ID],
  )
  await owner.query(
    `INSERT INTO companies (id, name, industry, company_type, owner_id, is_watched,
                            country, size, website) VALUES
       ($1, 'Sakura Manufacturing KK', 'Sản xuất linh kiện', 'traditional', $4, true,
        'Nhật Bản', '500-1000', 'https://sakura-mfg.example.jp'),
       ($2, 'Kitefin Analytics', 'Phân tích dữ liệu', 'tech_startup', $4, true,
        'Hoa Kỳ', '50-100', NULL),
       ($3, 'Marlin Product Labs', 'Phần mềm đóng gói', 'it_product', $4, false,
        'Singapore', '50-100', 'https://marlin-labs.example.com')`,
    [SAKURA, KITEFIN, MARLIN, SALES_ID],
  )
  await owner.query(
    `INSERT INTO system_settings (key, value) VALUES ('ai_enabled', 'true'), ('watch_cycle_seconds', '60')
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
  )
})

afterAll(async () => {
  await Promise.all([owner.end(), appConnection.close(), systemConnection.close()])
})

describe('G3 · only a blank or a stale cell is proposed', () => {
  it('1 · a facts block that agrees with the profile produces NO suggestion', async () => {
    const result = await buildIngest().ingest(SAKURA, 'before', 'watch_cycle')

    expect(result.claimsSaved).toBe(0)
    expect(await listProposals()).toHaveLength(0)
  })

  it('2 · a stale cell is proposed, and the card carries what it would overwrite', async () => {
    await buildIngest().ingest(SAKURA, 'after', 'watch_cycle')

    const fieldUpdates = (await listProposals()).filter((row) => row.proposal_type === 'field_update')
    expect(fieldUpdates).toHaveLength(1)
    expect(fieldUpdates[0].target_field).toBe('size')
    expect(fieldUpdates[0].proposed_value).toBe('1000+')
    // "hiện tại → đề nghị": without the current value the reviewer cannot see the change.
    expect(fieldUpdates[0].current_value).toBe('500-1000')
  })

  it('3 · a blank cell is proposed too — that is the other half of the Specs sentence', async () => {
    await buildIngest().ingest(KITEFIN, 'before', 'watch_cycle')

    const websites = (await listProposals()).filter((row) => row.target_field === 'website')
    expect(websites).toHaveLength(1)
    expect(websites[0].proposed_value).toBe('https://kitefin.example.com')
    expect(websites[0].current_value).toBeNull()
  })

  it('4 · an expansion into a market is NOT a change of headquarters country', async () => {
    // The Kitefin `after` page says the company is expanding into Japan while its facts block
    // still reads `Boston, Hoa Kỳ`. This is the exact wrong-data case ADR-0024 was written for.
    await buildIngest().ingest(KITEFIN, 'after', 'watch_cycle')

    const countries = (await listProposals()).filter((row) => row.target_field === 'country')
    expect(countries).toHaveLength(0)

    const { rows } = await owner.query('SELECT country FROM companies WHERE id = $1', [KITEFIN])
    expect(rows[0].country).toBe('Hoa Kỳ')
  })
})

describe('G1 and G2 · nothing the extractor says is taken on trust', () => {
  /** A draft whose quote is real but whose proposed value is nowhere inside it. */
  const inventingValue: ClaimExtractor = {
    async extract(): Promise<ClaimDraft[]> {
      return [
        {
          statement: 'Trang nguồn ghi Quy mô: 5000+',
          signalType: 'other',
          confidence: 'likely',
          quoteText: 'Quy mô: 500-1000 nhân viên',
          fieldSuggestion: { targetField: 'size', proposedValue: '5000+' },
        },
      ]
    },
  }

  /** A draft aiming at a field I-11 bans outright. */
  const bannedField: ClaimExtractor = {
    async extract(): Promise<ClaimDraft[]> {
      return [
        {
          statement: 'Trang nguồn ghi loại hình công ty',
          signalType: 'other',
          confidence: 'likely',
          quoteText: 'Quy mô: 500-1000 nhân viên',
          fieldSuggestion: { targetField: 'company_type', proposedValue: 'Quy mô' },
        },
      ]
    },
  }

  it('5 · G2: a value not verbatim in the quote is dropped — but the finding is kept', async () => {
    // `before`, because the quote above has to be a real substring of the page for I-2 to let
    // the finding through at all — this test is about G2, not about I-2 firing first.
    const result = await buildIngest(inventingValue).ingest(SAKURA, 'before', 'watch_cycle')

    // The finding itself is readable and traceable, so it stays; only the field implication
    // was unusable. Dropping the whole claim would lose real information.
    expect(result.claimsSaved).toBe(1)
    expect(await listProposals()).toHaveLength(0)
  })

  it('6 · G1: I-11 refuses `company_type` at the service, before the CHECK ever sees it', async () => {
    const result = await buildIngest(bannedField).ingest(SAKURA, 'before', 'watch_cycle')

    expect(result.claimsSaved).toBe(1)
    expect(await listProposals()).toHaveLength(0)
  })
})

describe('I-5 · watching a company delegates the news, not the profile', () => {
  it('7 · a watched company gets NO `timeline_entry` suggestion', async () => {
    await buildIngest().ingest(SAKURA, 'after', 'watch_cycle')

    const rows = await listProposals()
    expect(rows.filter((row) => row.proposal_type === 'timeline_entry')).toHaveLength(0)
    // …while the profile half still works, which is the part I-5 does NOT block.
    expect(rows.filter((row) => row.proposal_type === 'field_update')).toHaveLength(1)
  })

  it('8 · an unwatched company DOES get one, quoting the finding it came from', async () => {
    await buildIngest().ingest(MARLIN, 'after', 'watch_cycle')

    const entries = (await listProposals()).filter((row) => row.proposal_type === 'timeline_entry')
    expect(entries).toHaveLength(1)
    expect(entries[0].target_field).toBeNull()
    expect(entries[0].proposed_value).toContain('gọi vốn')
  })
})

describe('the same suggestion never appears twice in the queue', () => {
  it('11 · reading `before` then `after` proposes the blank website ONCE, not twice', async () => {
    // Kitefin states the same website on both pages while its profile cell is empty, so both
    // reads produce the same suggestion. Found by measuring the demo dataset, not by reasoning:
    // the queue showed two identical Kitefin cards, and deciding one left the other behind.
    const ingest = buildIngest()
    await ingest.ingest(KITEFIN, 'before', 'watch_cycle')
    await ingest.ingest(KITEFIN, 'after', 'watch_cycle')

    const websites = (await listProposals()).filter((row) => row.target_field === 'website')
    expect(websites).toHaveLength(1)
  })
})

describe('every suggestion arrives reviewable', () => {
  it('9 · `impact_if_wrong` is a real sentence on every row, written by code', async () => {
    await buildIngest().ingest(SAKURA, 'after', 'watch_cycle')
    await buildIngest().ingest(MARLIN, 'after', 'watch_cycle')

    const rows = await listProposals()
    expect(rows.length).toBeGreaterThan(1)
    for (const row of rows) {
      // Not a length check for its own sake: a model asked for this line can return "" or
      // "N/A", and the reviewer then decides with the consequence column blank.
      expect(row.impact_if_wrong?.trim().length ?? 0).toBeGreaterThan(40)
      expect(row.impact_if_wrong).toMatch(/[.!?]$/)
    }
  })

  it('10 · and arrives `pending`, without the service ever saying so', async () => {
    await buildIngest().ingest(SAKURA, 'after', 'watch_cycle')

    for (const row of await listProposals()) {
      expect(row.status).toBe('pending')
    }
  })
})

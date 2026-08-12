import { getTableName } from 'drizzle-orm'

import { auditEvents } from './audit-events'
import { autoNextStepEvents } from './auto-next-step-events'
import { claims } from './claims'
import { companies } from './companies'
import { contacts } from './contacts'
import { notifications } from './notifications'
import { observations } from './observations'
import { opportunities } from './opportunities'
import { proposalDecisions } from './proposal-decisions'
import { proposals } from './proposals'
import { systemSettings } from './system-settings'
import { timelineEntries } from './timeline-entries'
import { users } from './users'
import { watchCycleRuns } from './watch-cycle-runs'

/**
 * Every table, in ONE place. Two callers depend on this list being complete:
 *
 * - `seed()`: I-14 requires a reseed to return the system to EXACTLY the initial state, so a
 *   table missing from here leaves rows from the previous demo run behind.
 * - `resetTestDatabase()`: a table missing from here leaks rows between integration test
 *   files, which shows up as tests that pass alone and fail in a suite.
 *
 * Before this list existed the same table names were retyped in four places, and adding a
 * table meant remembering all four. Add new tables HERE and both callers follow.
 */
export const ALL_TABLES = [
  // AI-generated and AI-written data first: it references the official data below.
  notifications,
  autoNextStepEvents,
  proposalDecisions,
  proposals,
  claims,
  observations,
  // Sales' official data.
  auditEvents,
  watchCycleRuns,
  timelineEntries,
  opportunities,
  contacts,
  companies,
  systemSettings,
  users,
] as const

/** Physical names, for the raw-SQL callers that do not go through Drizzle. */
export const ALL_TABLE_NAMES: string[] = ALL_TABLES.map((table) => getTableName(table))

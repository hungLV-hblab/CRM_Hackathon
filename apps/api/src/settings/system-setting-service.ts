import { Inject, Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'

import {
  SETTING_KEY_AI_ENABLED,
  SETTING_KEY_WATCH_CYCLE_SECONDS,
  type CrmDatabase,
  systemSettings,
} from '@crm/db'

import { DRIZZLE_APP, DRIZZLE_SYSTEM } from '../common/db/db.module'

export interface SystemParameters {
  aiEnabled: boolean
  watchCycleSeconds: number
}

const DEFAULTS: SystemParameters = { aiEnabled: true, watchCycleSeconds: 60 }

/**
 * ontology 3.4 and ADR-0011 — the EFFECTIVE value lives in the database; environment
 * variables are only the initial value written at seed time.
 *
 * `read()` queries on every call: NO cache, NO TTL. This is not a missed optimisation, it is
 * the condition that makes T-9 take effect immediately — Sales hits the AI kill switch, the
 * API writes one row, and the worker sees it on the next tick. The database is the ONLY
 * channel between API and worker; adding a cache severs that channel.
 */
@Injectable()
export class SystemSettingService {
  constructor(
    @Inject(DRIZZLE_APP) private readonly dbApp: CrmDatabase,
    @Inject(DRIZZLE_SYSTEM) private readonly dbSystem: CrmDatabase,
  ) {}

  /** Used by the worker — it only holds the `crm_system` identity (SELECT on system_settings). */
  async read(): Promise<SystemParameters> {
    return this.readFrom(this.dbSystem)
  }

  async readForHuman(): Promise<SystemParameters> {
    return this.readFrom(this.dbApp)
  }

  async setAiEnabled(enabled: boolean): Promise<void> {
    await this.dbApp
      .update(systemSettings)
      .set({ value: String(enabled), updatedAt: new Date() })
      .where(eq(systemSettings.key, SETTING_KEY_AI_ENABLED))
  }

  private async readFrom(db: CrmDatabase): Promise<SystemParameters> {
    const rows = await db
      .select({ key: systemSettings.key, value: systemSettings.value })
      .from(systemSettings)
    const byKey = new Map(rows.map((row) => [row.key, row.value]))

    const seconds = Number(byKey.get(SETTING_KEY_WATCH_CYCLE_SECONDS))
    return {
      aiEnabled: byKey.has(SETTING_KEY_AI_ENABLED)
        ? byKey.get(SETTING_KEY_AI_ENABLED) === 'true'
        : DEFAULTS.aiEnabled,
      // Garbage in the database must not turn into a spinning loop: fall back to the default.
      watchCycleSeconds:
        Number.isFinite(seconds) && seconds > 0 ? seconds : DEFAULTS.watchCycleSeconds,
    }
  }
}

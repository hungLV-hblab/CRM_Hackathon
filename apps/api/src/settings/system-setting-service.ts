import { Inject, Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'

import {
  TOGGLE_AI_ACTION,
  UPDATE_WATCH_CYCLE_SECONDS_ACTION,
  type UpdateSystemSettingsDto,
} from '@crm/contracts'
import {
  SETTING_KEY_AI_ENABLED,
  SETTING_KEY_WATCH_CYCLE_SECONDS,
  type CrmDatabase,
  systemSettings,
} from '@crm/db'

import { AuditEventService } from '../common/audit/audit-event-service'
import { DRIZZLE_APP, DRIZZLE_SYSTEM } from '../common/db/db.module'
import type { Actor } from '../common/actor/actor-context'

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
    private readonly audit: AuditEventService,
  ) {}

  /** Used by the worker — it only holds the `crm_system` identity (SELECT on system_settings). */
  async read(): Promise<SystemParameters> {
    return this.readFrom(this.dbSystem)
  }

  async readForHuman(): Promise<SystemParameters> {
    return this.readFrom(this.dbApp)
  }

  /**
   * The ONE bit every logged-in account may read (ADR-0032). Sales is the person T-9 requires
   * to see the banner, and Sales gets a 403 on the admin payload — so the kill switch's state
   * travels on its own contract rather than as a field somebody might widen a guard to reach.
   */
  async aiStatus(): Promise<{ aiEnabled: boolean }> {
    const { aiEnabled } = await this.readForHuman()
    return { aiEnabled }
  }

  async setAiEnabled(enabled: boolean): Promise<void> {
    await this.dbApp
      .update(systemSettings)
      .set({ value: String(enabled), updatedAt: new Date() })
      .where(eq(systemSettings.key, SETTING_KEY_AI_ENABLED))
  }

  /**
   * The admin dashboard writing the two parameters — and writing ONE `AuditEvent` PER KEY that
   * actually changed.
   *
   * Per key, because "ai_enabled went true → false" and "the cycle went 60s → 10s" are two
   * different questions round 2 can ask, and a single merged event answers neither cleanly.
   *
   * Only when the value CHANGED, because an event saying `{from: false, to: false}` is a row
   * that looks like an action and was not one — it would inflate the trail that is supposed to
   * prove exactly when the machine was switched off.
   *
   * Takes effect immediately for both readers: nothing here is cached, and the worker re-reads
   * `system_settings` at the top of every tick (ADR-0011). No restart, no signal, no queue.
   * Scope of the kill switch is ADR-0009 — it stops NEW generation only; proposals already in
   * the queue stay decidable.
   */
  async updateParameters(actor: Actor, dto: UpdateSystemSettingsDto): Promise<SystemParameters> {
    const before = await this.readForHuman()

    if (dto.aiEnabled !== undefined && dto.aiEnabled !== before.aiEnabled) {
      await this.write(SETTING_KEY_AI_ENABLED, String(dto.aiEnabled))
      await this.audit.record(actor, TOGGLE_AI_ACTION, 'system_setting', SETTING_KEY_AI_ENABLED, {
        from: before.aiEnabled,
        to: dto.aiEnabled,
      })
    }

    if (
      dto.watchCycleSeconds !== undefined &&
      dto.watchCycleSeconds !== before.watchCycleSeconds
    ) {
      await this.write(SETTING_KEY_WATCH_CYCLE_SECONDS, String(dto.watchCycleSeconds))
      await this.audit.record(
        actor,
        UPDATE_WATCH_CYCLE_SECONDS_ACTION,
        'system_setting',
        SETTING_KEY_WATCH_CYCLE_SECONDS,
        { from: before.watchCycleSeconds, to: dto.watchCycleSeconds },
      )
    }

    return this.readForHuman()
  }

  /**
   * UPSERT rather than UPDATE: `watch_cycle_seconds` is seeded, but a database restored without
   * it would otherwise accept the write, report success and change nothing at all.
   */
  private async write(key: string, value: string): Promise<void> {
    await this.dbApp
      .insert(systemSettings)
      .values({ key, value })
      .onConflictDoUpdate({ target: systemSettings.key, set: { value, updatedAt: new Date() } })
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

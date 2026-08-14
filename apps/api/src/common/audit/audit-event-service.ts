import { Inject, Injectable } from '@nestjs/common'

import { type CrmDatabase, auditEvents } from '@crm/db'

import { DRIZZLE_APP, DRIZZLE_SYSTEM } from '../db/db.module'
import type { Actor } from '../actor/actor-context'

/**
 * ADR-0010 explains why this service exists even with the database layer in place:
 * Postgres only answers `ERROR: permission denied for table opportunities` — an empty
 * sentence naming neither the caller, the intent, nor the row. When round 2 asks "prove it
 * was actually blocked", this table is the answer, not a Postgres error string.
 *
 * Writes go through the actor's OWN pool, not whichever is convenient: recording a
 * `system` action through `crm_app` would make the audit trail lie about who acted.
 */
@Injectable()
export class AuditEventService {
  constructor(
    @Inject(DRIZZLE_APP) private readonly dbApp: CrmDatabase,
    @Inject(DRIZZLE_SYSTEM) private readonly dbSystem: CrmDatabase,
  ) {}

  /**
   * An action HAPPENED. Record it after the write succeeded, so the trail never claims something
   * the database rejected — the opposite ordering from `recordRefusal` below, and for the mirror
   * reason.
   *
   * `outcome` is stamped into `detail` here rather than left to callers: the dashboard of feature
   * group 6 filters on it, and a caller that forgets the key produces an event that is invisible
   * to every count without failing anything.
   */
  async record(
    actor: Actor,
    action: string,
    entity: string,
    entityId: string | null,
    detail: Record<string, unknown>,
  ): Promise<void> {
    await this.dbFor(actor)
      .insert(auditEvents)
      .values({
        actor: actor.kind,
        action,
        entity,
        entityId,
        detail: { outcome: 'done', ...detail },
      })
  }

  /** A boundary just refused an action. Record it BEFORE throwing, or the trail is lost. */
  async recordRefusal(
    actor: Actor,
    action: string,
    entity: string,
    entityId: string | null,
    detail: Record<string, unknown>,
  ): Promise<void> {
    await this.dbFor(actor)
      .insert(auditEvents)
      .values({
        actor: actor.kind,
        action,
        entity,
        entityId,
        detail: { outcome: 'refused', ...detail },
      })
  }

  private dbFor(actor: Actor): CrmDatabase {
    return actor.kind === 'system' ? this.dbSystem : this.dbApp
  }
}

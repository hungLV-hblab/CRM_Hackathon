import { AsyncLocalStorage } from 'node:async_hooks'

import type { UserRole } from '@crm/contracts'

/**
 * ADR-0004 — the `actor` is who a WRITE is performed under.
 *
 * The rule that keeps this honest, read it before writing a new service: **`actor` is the
 * mandatory FIRST parameter of every write method.** A service must NOT call
 * `getCurrentActor()` internally. Why: a service that reads the ambient context would see an
 * empty context when T-10 calls `new Service(...)` directly, silently default to `human`,
 * and the test suite would be proving the wrong thing.
 *
 * The `AsyncLocalStorage` below exists only so the OUTER layer (controllers, interceptors)
 * can learn who is calling and then pass it down explicitly. It is not a back channel.
 */
export type ActorKind = 'human' | 'system'

export interface Actor {
  kind: ActorKind
  userId?: string
  role?: UserRole
}

/** Identity of the watch cycle and every AI branch. No `userId`: no person stands behind it. */
export const SYSTEM_ACTOR: Actor = { kind: 'system' }

export function humanActor(userId: string, role: UserRole): Actor {
  return { kind: 'human', userId, role }
}

const actorStorage = new AsyncLocalStorage<Actor>()

export function runWithActor<T>(actor: Actor, fn: () => T): T {
  return actorStorage.run(actor, fn)
}

/**
 * Outer layer only. Returns `undefined` when there is no context — deliberately NOT
 * defaulting to `human`: guessing an identity is precisely the class of bug ADR-0004 exists
 * to eliminate.
 */
export function getCurrentActor(): Actor | undefined {
  return actorStorage.getStore()
}

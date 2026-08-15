import { ForbiddenException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'

import { SYSTEM_ACTOR, humanActor, type Actor } from '../actor-context'
import { ownerScopeFor } from '../owner-scope'

const SALES_ID = '11111111-1111-4111-8111-111111111111'
const ADMIN_ID = '22222222-2222-4222-8222-222222222222'

/**
 * ADR-0046. The gate decides, for one caller, WHICH companies exist as far as they are
 * concerned. Everything else in the authorization work reads its answer, so a mistake here is a
 * mistake everywhere at once — which is the whole reason it is one function and not a condition
 * copied into a dozen `where` clauses.
 *
 * The case that matters most is `refuses a human actor with no role`. The first draft of this
 * work wrote the gate as "narrow IF the role is sales", and `Actor.role` is optional
 * (`actor-context.ts:22`) — so an actor with no role would have fallen through to the ADMIN
 * branch, the widest one. Two real paths produce such an actor: a service test constructing
 * `{ kind: 'human', userId }` by hand, and a JWT minted before `role` was in the payload
 * (`actor.interceptor.ts:25` passes `user.role` straight through). A permission gate that
 * widens when it is confused is worse than no gate, because it reads as if it were closed.
 */
describe('ownerScopeFor', () => {
  it('lets an admin see everything, by returning no restriction at all', () => {
    expect(ownerScopeFor(humanActor(ADMIN_ID, 'admin'))).toBeNull()
  })

  it('pins a sales actor to their own companies', () => {
    expect(ownerScopeFor(humanActor(SALES_ID, 'sales'))).toBe(SALES_ID)
  })

  it('refuses a human actor with no role rather than widening to the admin branch', () => {
    const roleless: Actor = { kind: 'human', userId: SALES_ID }
    expect(() => ownerScopeFor(roleless)).toThrow(ForbiddenException)
  })

  it('refuses the system actor — these are the read/write paths of a person', () => {
    expect(() => ownerScopeFor(SYSTEM_ACTOR)).toThrow(ForbiddenException)
  })

  it('refuses a human actor with no userId, which cannot own anything', () => {
    const anonymous: Actor = { kind: 'human', role: 'sales' }
    expect(() => ownerScopeFor(anonymous)).toThrow(ForbiddenException)
  })
})

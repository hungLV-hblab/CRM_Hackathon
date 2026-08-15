import { ForbiddenException } from '@nestjs/common'

import type { Actor } from './actor-context'

/**
 * ADR-0046 — who a caller is allowed to see, expressed as one value.
 *
 * `null` means "no restriction" (admin). A string means "only companies whose `owner_id` is
 * this". Every scoped query in the product reads this and nothing else, so the rule lives in
 * one place rather than in a dozen `where` clauses that can quietly disagree.
 *
 * WRITTEN NARROW-FIRST, ON PURPOSE. The obvious phrasing — "narrow if the role is sales" —
 * is wrong here, and the bug it causes is invisible: `Actor.role` is optional
 * (`actor-context.ts:22`), so any actor arriving without one would fall through to the ADMIN
 * branch and see everything. Two paths produce such an actor for real: service tests that build
 * `{ kind: 'human', userId }` by hand, and a JWT minted before `role` existed in the payload,
 * which `actor.interceptor.ts:25` forwards verbatim. So the roles are named explicitly and
 * anything else is refused: a gate that widens when confused reads as closed while being open.
 *
 * Not a substitute for the AI autonomy ceiling. That one is enforced twice — domain layer AND
 * per-column GRANTs, so forgetting a check still ends in `permission denied`. This rule has no
 * such second layer: `crm_app` holds `GRANT ALL` (`0001_grants.sql:24-31`) and there is no RLS
 * anywhere. Every `dbApp` reader of `companies`/`proposals` is therefore a surface a person has
 * to keep correct by eye. ADR-0046 says so out loud rather than implying two layers.
 */
export function ownerScopeFor(actor: Actor): string | null {
  if (actor.kind !== 'human' || !actor.userId) {
    throw new ForbiddenException('Chỉ người dùng đã đăng nhập mới xem được dữ liệu này')
  }

  if (actor.role === 'admin') return null
  if (actor.role === 'sales') return actor.userId

  throw new ForbiddenException(
    'Tài khoản của bạn chưa có vai trò, chưa xác định được phạm vi dữ liệu',
  )
}

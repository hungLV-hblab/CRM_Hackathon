import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'

import type { UserRole } from '@crm/contracts'

import type { AuthenticatedRequest } from './jwt.guard'

const ALLOWED_ROLES_KEY = 'allowed_roles'

/** Use together with `JwtGuard` — this guard assumes `req.user` is already populated. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ALLOWED_ROLES_KEY, roles)

/**
 * The walking skeleton only needs to tell the TWO roles apart, not a full permission matrix:
 * the question "may Admin operate the CRM" (Q-6) is still awaiting an answer from the
 * organisers. Do not guess it here.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowedRoles = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ALLOWED_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    )
    if (!allowedRoles?.length) return true

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>()
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      throw new ForbiddenException('Tài khoản của bạn không có quyền dùng chức năng này')
    }
    return true
  }
}

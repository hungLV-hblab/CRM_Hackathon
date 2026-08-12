import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import type { Request } from 'express'

import { SESSION_COOKIE_NAME, type SessionClaims } from './auth-service'

export interface AuthenticatedRequest extends Request {
  user?: SessionClaims
  cookies: Record<string, string | undefined>
}

/**
 * The session lives in an `httpOnly` cookie — not in `localStorage`, and not in a header the
 * frontend attaches itself. Spec 7.3 demands a real login, and "real" means the session
 * survives a page reload and the page's own JavaScript cannot read the token.
 * Messages stay Vietnamese: Sales reads them.
 */
@Injectable()
export class JwtGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const token = req.cookies?.[SESSION_COOKIE_NAME]

    if (!token) throw new UnauthorizedException('Chưa đăng nhập')

    try {
      req.user = await this.jwt.verifyAsync<SessionClaims>(token)
      return true
    } catch {
      throw new UnauthorizedException('Phiên không hợp lệ hoặc đã hết hạn')
    }
  }
}

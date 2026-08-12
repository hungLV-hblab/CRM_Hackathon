import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'

import type { UserDto, UserRole } from '@crm/contracts'
import { type CrmDatabase, users } from '@crm/db'

import { DRIZZLE_APP } from '../common/db/db.module'

export interface SessionClaims {
  sub: string
  email: string
  role: UserRole
}

export const SESSION_COOKIE_NAME = 'crm_session'

@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE_APP) private readonly db: CrmDatabase,
    private readonly jwt: JwtService,
  ) {}

  /**
   * An unknown email and a wrong password return the SAME error, on purpose: telling them
   * apart turns the login screen into an oracle for which emails exist in the system.
   * The message stays Vietnamese because Sales reads it.
   */
  async login(email: string, password: string): Promise<{ token: string; user: UserDto }> {
    const [user] = await this.db.select().from(users).where(eq(users.email, email))

    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng')
    }

    const claims: SessionClaims = { sub: user.id, email: user.email, role: user.role }

    return {
      token: await this.jwt.signAsync(claims),
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    }
  }
}

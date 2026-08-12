import { Body, Controller, Get, HttpCode, Post, Res, UseGuards } from '@nestjs/common'
import type { Response } from 'express'

import { type LoginDto, loginSchema } from '@crm/contracts'

import { ZodValidationPipe } from '../common/zod-validation.pipe'
import { AuthService, SESSION_COOKIE_NAME } from './auth-service'
import { JwtGuard } from './jwt.guard'
import { getCurrentActor } from '../common/actor/actor-context'

const ONE_DAY_MS = 24 * 60 * 60 * 1000

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token, user } = await this.auth.login(dto.email, dto.password)

    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      // The simulated production stack serves plain HTTP on :8080 behind Caddy, so `secure`
      // must stay off — otherwise the browser silently drops the cookie and login "succeeds"
      // while the user never gets in.
      secure: false,
      path: '/',
      maxAge: ONE_DAY_MS,
    })

    return { user }
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' })
    return { ok: true }
  }

  /** The frontend calls this on load: the cookie is httpOnly, so it cannot read it itself. */
  @Get('me')
  @UseGuards(JwtGuard)
  me() {
    const actor = getCurrentActor()
    return { userId: actor?.userId, role: actor?.role }
  }
}

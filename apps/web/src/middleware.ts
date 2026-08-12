import { NextResponse, type NextRequest } from 'next/server'

const SESSION_COOKIE = 'crm_session'
const LOGIN_PATH = '/dang-nhap'

/**
 * PRESENCE of the cookie only — this middleware never verifies the signature.
 *
 * The signature is checked by `JwtGuard` in the API, which is the only place that holds
 * `JWT_SECRET`. Verifying here too would mean shipping the secret to a second process for
 * no gain: a forged cookie gets someone past this redirect and straight into a 401 with no
 * data attached. The middleware's job is to keep a logged-out user from staring at an empty
 * shell, not to be a security boundary. Treating it as one is the classic mistake.
 */
export function middleware(request: NextRequest) {
  const hasSession = request.cookies.has(SESSION_COOKIE)
  const isLoginPage = request.nextUrl.pathname === LOGIN_PATH

  if (!hasSession && !isLoginPage) {
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url))
  }
  if (hasSession && isLoginPage) {
    return NextResponse.redirect(new URL('/cong-ty', request.url))
  }
  return NextResponse.next()
}

export const config = {
  // Everything except Next's own assets and the API proxy path.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}

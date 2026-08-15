import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { childEnv, resolveAuthMode } from '../claude-cli'

/**
 * Three ways to be authenticated, and the third one is invisible from the environment: running
 * `claude /login` inside the container writes a credential to `$HOME/.claude` and sets no
 * variable at all. A check that reads only the environment refuses a subprocess that would have
 * succeeded — which is exactly what `/run/extract-claims` did, returning `not_authenticated`
 * against a container that could and did reach the model.
 */

const SAVED = {
  HOME: process.env.HOME,
  USERPROFILE: process.env.USERPROFILE,
  CLAUDE_CODE_OAUTH_TOKEN: process.env.CLAUDE_CODE_OAUTH_TOKEN,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
}

/** A home directory with a login in it, without touching the real one on the machine. */
function homeWithLogin(): string {
  const home = mkdtempSync(join(tmpdir(), 'crm-agent-home-'))
  mkdirSync(join(home, '.claude'))
  writeFileSync(join(home, '.claude', '.credentials.json'), '{}')
  return home
}

/** A home directory that exists but was never logged in from. */
function homeWithoutLogin(): string {
  return mkdtempSync(join(tmpdir(), 'crm-agent-home-'))
}

function clearCredentials(): void {
  delete process.env.CLAUDE_CODE_OAUTH_TOKEN
  delete process.env.ANTHROPIC_API_KEY
}

afterEach(() => {
  for (const [key, value] of Object.entries(SAVED)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

describe('đường xác thực', () => {
  it('phiên `claude /login` trong container tính là đã xác thực, dù không có biến môi trường nào', () => {
    clearCredentials()
    process.env.HOME = homeWithLogin()

    expect(resolveAuthMode()).toBe('cli_login')
    expect(() => childEnv()).not.toThrow()
  })

  it('trên đường cli_login, $HOME phải được truyền xuống — nó CHÍNH LÀ credential', () => {
    clearCredentials()
    const home = homeWithLogin()
    process.env.HOME = home

    /**
     * Without HOME the child looks for its session in a directory that does not exist and fails
     * with the very error this fix removes — a failure that would only show up against a real
     * subscription, never in a test that stops at "did it throw".
     */
    expect(childEnv().HOME).toBe(home)
  })

  it('không có biến nào và cũng chưa đăng nhập thì hỏng ngay, không tốn 3,4s khởi động tiến trình', () => {
    clearCredentials()
    process.env.HOME = homeWithoutLogin()

    expect(resolveAuthMode()).toBeNull()
    expect(() => childEnv()).toThrow(/không có đường xác thực nào/i)
  })

  it('biến môi trường thắng phiên trên đĩa — `.env` vẫn là chỗ quyết định', () => {
    clearCredentials()
    process.env.HOME = homeWithLogin()
    process.env.CLAUDE_CODE_OAUTH_TOKEN = 'token-gia-de-test'

    expect(resolveAuthMode()).toBe('oauth')
    expect(childEnv().CLAUDE_CODE_OAUTH_TOKEN).toBe('token-gia-de-test')
  })

  it('chỉ truyền xuống ĐÚNG credential đang dùng, để /health không nói một đằng chạy một nẻo', () => {
    clearCredentials()
    process.env.HOME = homeWithoutLogin()
    process.env.CLAUDE_CODE_OAUTH_TOKEN = 'token-gia-de-test'
    process.env.ANTHROPIC_API_KEY = 'key-gia-de-test'

    const env = childEnv()

    expect(resolveAuthMode()).toBe('oauth')
    expect(env.ANTHROPIC_API_KEY).toBeUndefined()
  })

  it('không bao giờ truyền biến CSDL xuống tiến trình con', () => {
    clearCredentials()
    process.env.HOME = homeWithLogin()

    /**
     * The reason this whole process exists (ADR-0038). Asserted here because the auth change
     * rewrote the function that builds that environment, and an allow-list is only an allow-list
     * for as long as somebody keeps checking that it still is one.
     */
    expect(Object.keys(childEnv()).sort()).toEqual(['HOME', 'PATH', 'USERPROFILE'])
  })
})

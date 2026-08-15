import { createHmac } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { TicketVerifier } from '../auth-ticket'
import { createRouter } from '../http-routes'
import { JobQueue } from '../job-queue'
import { LoginSessionController, type LoginProcessHandle } from '../login-session'
import type { Skill } from '../skill-registry'

/**
 * The routing table, over real HTTP.
 *
 * The point of this file is the NEGATIVE half. `/agent-auth/*` becomes reachable from the public
 * `:8080` in phase 4, and `/run/*` must not — it is the endpoint that spends a real person's Claude
 * quota. Those two families now live in the same module, so "the ticket check did not leak onto
 * /run" stops being obvious the moment somebody edits either one.
 */

const SECRET = 'agent-token-de-test'
const FRAME = '\x1b[?2026l\x1b[?2026h\x1b[2K\x1b[G'
const URL_FRAME = `${FRAME} https://claude.ai/oauth/authorize?code=true&state=abc\r\n`

/** A ticket the way `apps/api` mints them. Expiry far enough out that no test races it. */
function ticket(nonce: string, secret = SECRET, expMs = Date.now() + 300_000): string {
  const payload = `${expMs}.${nonce}`
  return `${payload}.${createHmac('sha256', secret).update(payload).digest('hex')}`
}

/**
 * BUFFERS output produced before anyone is listening, and replays it to the first listener.
 *
 * Not a convenience — it is what a real pipe does, and without it these tests race the HTTP layer:
 * `fetch()` returns before the server has read the request, so a test that emits the URL on the
 * next line is emitting into a session that has not been created yet. The CLI has the same freedom
 * to print before this process gets around to reading, so a fake that drops early output is the
 * less realistic of the two.
 */
class FakeProcess implements LoginProcessHandle {
  private outputListeners: Array<(chunk: string) => void> = []
  private exitListeners: Array<(code: number | null) => void> = []
  private buffered: string[] = []
  private exitedWith: number | null | undefined
  readonly writes: string[] = []
  killCount = 0
  /**
   * When set, the process exits as soon as the code reaches its stdin — which is what the CLI
   * does. Firing `exit()` from the test body instead would race the HTTP round trip: the request
   * carrying the code may not have reached the handler yet.
   */
  exitCodeOnWrite: number | undefined

  onOutput(l: (chunk: string) => void): void {
    this.outputListeners.push(l)
    for (const chunk of this.buffered) l(chunk)
    this.buffered = []
  }
  onExit(l: (code: number | null) => void): void {
    this.exitListeners.push(l)
    if (this.exitedWith !== undefined) l(this.exitedWith)
  }
  write(text: string): void {
    this.writes.push(text)
    /**
     * Exits on the ENTER write specifically, because that is when the real CLI acts: the code
     * arrives as text and does nothing until a separate carriage return submits it.
     */
    if (this.exitCodeOnWrite !== undefined && text === '\r') this.exit(this.exitCodeOnWrite)
  }
  kill(): void {
    this.killCount += 1
  }
  emit(chunk: string): void {
    if (this.outputListeners.length === 0) return void this.buffered.push(chunk)
    for (const l of this.outputListeners) l(chunk)
  }
  exit(code: number | null): void {
    this.exitedWith = code
    for (const l of this.exitListeners) l(code)
  }
}

const skill: Skill = {
  name: 'extract-claims',
  systemPrompt: 'khong dung den trong file nay',
  policy: { name: 'extract-claims', allowedTools: [], maxTurns: 1, timeoutMs: 1000 },
}

let server: Server
let base: string
let proc: FakeProcess

const SAVED_HOME = process.env.HOME

function boot(enabled = true): void {
  proc = new FakeProcess()
  const router = createRouter({
    enabled,
    token: SECRET,
    skills: new Map([['extract-claims', skill]]),
    queue: new JobQueue(1000),
    login: new LoginSessionController({
      spawn: () => proc,
      schedule: () => () => {},
      deadlineMs: 300_000,
      /** No real 300ms pause in a test; the split into two writes is what matters. */
      afterDelay: (fn) => fn(),
    }),
    tickets: new TicketVerifier(enabled ? SECRET : undefined),
  })

  server = createServer((req, res) => {
    void router(req, res).catch(() => {
      res.writeHead(500)
      res.end('{}')
    })
  })
  server.listen(0)
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}

beforeEach(() => {
  /** Never let a test read or write the credential of the machine running it. */
  process.env.HOME = mkdtempSync(join(tmpdir(), 'crm-routes-home-'))
  boot()
})

afterEach(() => {
  server.close()
  if (SAVED_HOME === undefined) delete process.env.HOME
  else process.env.HOME = SAVED_HOME
})

describe('/run vẫn đóng đúng như cũ', () => {
  it('không có Authorization thì 401', async () => {
    const res = await fetch(`${base}/run/extract-claims`, { method: 'POST', body: '{}' })
    expect(res.status).toBe(401)
  })

  it('một cái VÉ hợp lệ KHÔNG mở được /run — hai họ route, hai loại bí mật', async () => {
    /**
     * The regression this whole file exists for. A ticket is something a browser holds; if it ever
     * opened `/run`, every admin's browser session would carry the ability to spend quota, and the
     * separation the ticket scheme was invented to create would be gone.
     */
    const res = await fetch(`${base}/run/extract-claims`, {
      method: 'POST',
      headers: { authorization: `Ticket ${ticket('nonce-run')}` },
      body: JSON.stringify({ userPrompt: 'xin chao' }),
    })
    expect(res.status).toBe(401)
  })

  it('Bearer AGENT_TOKEN vẫn là chìa khoá của /run', async () => {
    const res = await fetch(`${base}/run/extract-claims`, {
      method: 'POST',
      headers: { authorization: `Bearer ${SECRET}` },
      body: JSON.stringify({}),
    })
    /** 400 not 401: it got past the guard and failed on the missing `userPrompt`, as before. */
    expect(res.status).toBe(400)
  })
})

describe('/agent-auth cần vé', () => {
  it('thiếu header thì 401', async () => {
    const res = await fetch(`${base}/agent-auth/login/start`, { method: 'POST' })
    expect(res.status).toBe(401)
  })

  it('Bearer AGENT_TOKEN KHÔNG mở được /agent-auth — chiều ngược lại cũng phải đóng', async () => {
    const res = await fetch(`${base}/agent-auth/login/start`, {
      method: 'POST',
      headers: { authorization: `Bearer ${SECRET}` },
    })
    expect(res.status).toBe(401)
  })

  it('vé dùng lại lần hai thì 401', async () => {
    const once = ticket('nonce-mot-lan')
    const first = fetch(`${base}/agent-auth/login/start`, {
      method: 'POST',
      headers: { authorization: `Ticket ${once}` },
    })
    proc.emit(URL_FRAME)
    expect((await first).status).toBe(200)

    const second = await fetch(`${base}/agent-auth/credential`, {
      method: 'DELETE',
      headers: { authorization: `Ticket ${once}` },
    })
    expect(second.status).toBe(401)
  })
})

describe('luồng đăng nhập qua HTTP', () => {
  it('start trả về loginId và URL, không trả gì khác', async () => {
    const pending = fetch(`${base}/agent-auth/login/start`, {
      method: 'POST',
      headers: { authorization: `Ticket ${ticket('nonce-start')}` },
    })
    proc.emit(URL_FRAME)

    const body = (await (await pending).json()) as Record<string, unknown>
    expect(body.url).toBe('https://claude.ai/oauth/authorize?code=true&state=abc')
    expect(typeof body.loginId).toBe('string')
    expect(Object.keys(body).sort()).toEqual(['loginId', 'url'])
  })

  it('phiên thứ hai khi đang mở thì 409, không phải 500', async () => {
    const first = fetch(`${base}/agent-auth/login/start`, {
      method: 'POST',
      headers: { authorization: `Ticket ${ticket('nonce-1')}` },
    })
    proc.emit(URL_FRAME)
    await first

    const second = await fetch(`${base}/agent-auth/login/start`, {
      method: 'POST',
      headers: { authorization: `Ticket ${ticket('nonce-2')}` },
    })
    expect(second.status).toBe(409)
  })

  it('nộp code cho phiên không tồn tại thì 410, không phải 500', async () => {
    const res = await fetch(`${base}/agent-auth/login/00000000-0000-0000-0000-000000000000/code`, {
      method: 'POST',
      headers: { authorization: `Ticket ${ticket('nonce-code')}`, 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'ma-nao-do' }),
    })
    expect(res.status).toBe(410)
  })

  it('thiếu trường code thì 400', async () => {
    const start = fetch(`${base}/agent-auth/login/start`, {
      method: 'POST',
      headers: { authorization: `Ticket ${ticket('nonce-3')}` },
    })
    proc.emit(URL_FRAME)
    const { loginId } = (await (await start).json()) as { loginId: string }

    const res = await fetch(`${base}/agent-auth/login/${loginId}/code`, {
      method: 'POST',
      headers: { authorization: `Ticket ${ticket('nonce-4')}`, 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
    expect(proc.writes).toEqual([])
  })

  it('code đi tới stdin của CLI và KHÔNG quay lại trong response', async () => {
    const start = fetch(`${base}/agent-auth/login/start`, {
      method: 'POST',
      headers: { authorization: `Ticket ${ticket('nonce-5')}` },
    })
    proc.emit(URL_FRAME)
    const { loginId } = (await (await start).json()) as { loginId: string }

    proc.exitCodeOnWrite = 0
    const res = await fetch(`${base}/agent-auth/login/${loginId}/code`, {
      method: 'POST',
      headers: { authorization: `Ticket ${ticket('nonce-6')}`, 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'MA-UY-QUYEN-BI-MAT' }),
    })
    expect(proc.writes).toEqual(['MA-UY-QUYEN-BI-MAT', '\r'])
    expect(await res.text()).not.toContain('MA-UY-QUYEN-BI-MAT')
  })
})

describe('/health', () => {
  it('không cần vé, và nói cả trạng thái đăng nhập', async () => {
    const body = (await (await fetch(`${base}/health`)).json()) as Record<string, unknown>
    expect(body.enabled).toBe(true)
    expect(body.login).toMatchObject({ state: 'idle' })
    /** The shape `agent-runtime-client.ts` already reads must not change underneath it. */
    expect(body.skills).toEqual(['extract-claims'])
    expect(body.grants).toEqual({ 'extract-claims': [] })
  })
})

describe('thiếu AGENT_TOKEN', () => {
  it('cả /run lẫn /agent-auth đều trả 503 "đang tắt", không phải 500', async () => {
    server.close()
    boot(false)

    expect((await fetch(`${base}/run/extract-claims`, { method: 'POST' })).status).toBe(503)
    expect((await fetch(`${base}/agent-auth/login/start`, { method: 'POST' })).status).toBe(503)
    /** Still up, still answering, still saying so — ADR-0041. */
    expect((await fetch(`${base}/health`)).status).toBe(200)
  })
})

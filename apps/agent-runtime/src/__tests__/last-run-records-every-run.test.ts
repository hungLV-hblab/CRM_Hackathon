import { createServer, type Server } from 'node:http'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { TicketVerifier } from '../auth-ticket'
import type { CliRun } from '../claude-cli'
import { AgentRunError } from '../errors'
import { createRouter } from '../http-routes'
import { JobQueue } from '../job-queue'
import { LoginSessionController } from '../login-session'
import { loadSkills } from '../skill-registry'
import { SKILL_TEMPLATE_VARS } from '../skill-template-vars'
import type { Skill } from '../skill-registry'

/**
 * "Có credential" is not "chạy được", and this file is where that difference becomes a fact the
 * outside world can read.
 *
 * `resolveAuthMode()` answers whether a credential EXISTS. It cannot answer whether the credential
 * still works, whether the subscription has quota left, or whether the `claude` binary is even in
 * the image — and all three of those failures used to be indistinguishable from success anywhere
 * outside a container log. `lastRun` is the answer: the outcome of the most recent run, whatever
 * it was, readable from `/health`.
 *
 * WHY EVERY RUN AND NOT JUST THE PROBE: a real `extract-claims` that just succeeded is stronger
 * evidence than a synthetic ping, and a real one that just died of `quota_exhausted` is the single
 * thing an operator most needs to see. The probe skill is only the cheapest way to FORCE a run
 * when none has happened yet.
 */

const SECRET = 'agent-token-de-test'

const skill: Skill = {
  systemPrompt: 'khong dung den trong file nay',
  policy: { name: 'health-check', allowedTools: [], maxTurns: 1, timeoutMs: 1000 },
}

function ok(overrides: Partial<CliRun> = {}): CliRun {
  return {
    text: 'OK',
    elapsedMs: 4200,
    apiMs: 1100,
    sessionId: '4f2a-abc',
    inputTokens: 16_204,
    outputTokens: 3,
    ...overrides,
  }
}

let server: Server
let base: string

const SAVED_HOME = process.env.HOME
const SAVED_KEY = process.env.ANTHROPIC_API_KEY

/** `runner` is injected so a test can produce an outcome without spawning a real CLI. */
function boot(
  runner: (skill: Skill, userPrompt: string) => Promise<CliRun>,
  queue = new JobQueue(1000),
): void {
  const router = createRouter({
    enabled: true,
    token: SECRET,
    skills: new Map([['health-check', skill]]),
    queue,
    login: new LoginSessionController(),
    tickets: new TicketVerifier(SECRET),
    runner,
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

async function health(): Promise<{ lastRun?: Record<string, unknown>; grants: Record<string, string[]> }> {
  const res = await fetch(`${base}/health`)
  return (await res.json()) as { lastRun?: Record<string, unknown>; grants: Record<string, string[]> }
}

function run(): Promise<Response> {
  return fetch(`${base}/run/health-check`, {
    method: 'POST',
    headers: { authorization: `Bearer ${SECRET}` },
    body: JSON.stringify({ userPrompt: 'ping' }),
  })
}

beforeEach(() => {
  /** Never let a test read the credential of the machine running it. */
  process.env.HOME = mkdtempSync(join(tmpdir(), 'crm-lastrun-home-'))
  delete process.env.ANTHROPIC_API_KEY
})

afterEach(() => {
  server.close()
  if (SAVED_HOME === undefined) delete process.env.HOME
  else process.env.HOME = SAVED_HOME
  if (SAVED_KEY === undefined) delete process.env.ANTHROPIC_API_KEY
  else process.env.ANTHROPIC_API_KEY = SAVED_KEY
})

describe('lastRun trên /health', () => {
  it('chưa lượt nào thì không có lastRun — "chưa kiểm tra" là trạng thái thật, không phải hỏng', async () => {
    boot(() => Promise.resolve(ok()))

    expect((await health()).lastRun).toBeUndefined()
  })

  it('lượt thành công ghi lại đủ bằng chứng để người đọc tự kiểm', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test'
    boot(() => Promise.resolve(ok()))

    expect((await run()).status).toBe(200)

    const { lastRun } = await health()
    expect(lastRun).toMatchObject({
      ok: true,
      skill: 'health-check',
      text: 'OK',
      elapsedMs: 4200,
      apiMs: 1100,
      inputTokens: 16_204,
      outputTokens: 3,
      sessionId: '4f2a-abc',
      /**
       * The credential that ACTUALLY ran, resolved at run time. With `CLAUDE_CODE_OAUTH_TOKEN`
       * in `.env` a fresh login writes its credential and still loses to the variable, so a panel
       * that reported the configured mode would say the login had taken effect when it had not.
       */
      authMode: 'api_key',
    })
    expect(typeof lastRun?.at).toBe('number')
  })

  it('lượt hỏng CŨNG được ghi, kèm lý do — đây là lý do cả tính năng này tồn tại', async () => {
    boot(() => Promise.reject(new AgentRunError('quota_exhausted', 'Hết lượt')))

    expect((await run()).status).toBe(502)

    const { lastRun } = await health()
    expect(lastRun).toMatchObject({ ok: false, reason: 'quota_exhausted', skill: 'health-check' })
    expect(lastRun?.text).toBeUndefined()
  })

  it('hết credential và hết quota là HAI lý do khác nhau, không phải một badge chung', async () => {
    boot(() => Promise.reject(new AgentRunError('not_authenticated', 'Bị từ chối')))

    await run()

    expect((await health()).lastRun).toMatchObject({ reason: 'not_authenticated' })
  })

  it('bị hàng đợi bỏ vì quá hạn chờ cũng là một lượt hỏng có tên', async () => {
    /**
     * The deadline is on WAITING, not on running: a job that reaches the front too late is
     * dropped before the subprocess starts. Driven by an injected clock rather than by real
     * time — `job-queue.ts` put that seam there precisely so this rule can be checked exactly.
     */
    const ticks = [0, 5_000]
    boot(
      () => Promise.resolve(ok()),
      new JobQueue(1_000, () => ticks.shift() ?? 5_000),
    )

    await run()

    expect((await health()).lastRun).toMatchObject({ ok: false, reason: 'timeout' })
  })

  it('giữ lượt GẦN NHẤT, không phải lượt đầu tiên', async () => {
    let first = true
    boot(() => {
      if (first) {
        first = false
        return Promise.resolve(ok({ sessionId: 'cu' }))
      }
      return Promise.reject(new AgentRunError('quota_exhausted', 'Hết lượt'))
    })

    await run()
    await run()

    const { lastRun } = await health()
    expect(lastRun).toMatchObject({ ok: false, reason: 'quota_exhausted' })
    expect(lastRun?.sessionId).toBeUndefined()
  })

  it('cắt ngắn văn bản model trả về — /health không phải chỗ đổ nội dung', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test'
    boot(() => Promise.resolve(ok({ text: 'x'.repeat(5000) })))

    await run()

    expect(String((await health()).lastRun?.text).length).toBeLessThanOrEqual(210)
  })

  it('/run vẫn 401 khi thiếu Bearer — thêm chẩn đoán không được nới cổng gác', async () => {
    boot(() => Promise.resolve(ok()))

    const res = await fetch(`${base}/run/health-check`, {
      method: 'POST',
      body: JSON.stringify({ userPrompt: 'ping' }),
    })

    expect(res.status).toBe(401)
    expect((await health()).lastRun).toBeUndefined()
  })
})

describe('skill health-check trong thư mục skills thật', () => {
  it('nạp được và KHÔNG với tới công cụ nào — soi được từ ngoài qua /health.grants', async () => {
    const skills = loadSkills(join(__dirname, '..', '..', 'skills'), SKILL_TEMPLATE_VARS)
    boot(() => Promise.resolve(ok()))

    expect(skills.get('health-check')?.policy.allowedTools).toEqual([])

    const router = createRouter({
      enabled: true,
      token: SECRET,
      skills,
      queue: new JobQueue(1000),
      login: new LoginSessionController(),
      tickets: new TicketVerifier(SECRET),
    })
    const probe = createServer((req, res) => void router(req, res))
    probe.listen(0)
    const url = `http://127.0.0.1:${(probe.address() as AddressInfo).port}/health`

    const grants = ((await (await fetch(url)).json()) as { grants: Record<string, string[]> }).grants
    expect(grants['health-check']).toEqual([])

    probe.close()
  })
})

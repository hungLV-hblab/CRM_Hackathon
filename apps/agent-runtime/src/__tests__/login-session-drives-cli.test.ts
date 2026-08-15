import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  LoginSessionController,
  LoginSessionError,
  clearStoredCredential,
  hydrateStoredOauthToken,
  loginEnv,
  storedTokenPath,
  type LoginProcessHandle,
} from '../login-session'

/**
 * The state machine that drives `claude setup-token` under a PTY, tested against the BYTES the
 * CLI really emits rather than a tidied-up idea of them.
 *
 * The samples below were captured from `script -qec "claude setup-token" /dev/null` inside the
 * running `agent-runtime` image (claude-code 2.0.76) and transcribed escape for escape. That
 * matters: the spinner repaints itself on every frame and wraps each one in the synchronised
 * output pair `\x1b[?2026h` / `\x1b[?2026l`, so a scraper written against imagined output passes
 * its tests and finds nothing in production.
 *
 * No test here starts a real process. The subprocess and the timer are both injected.
 */

/** The escape prefix every repainted frame carries: sync off/on, clear line, cursor up, home. */
const FRAME = '\x1b[?2026l\x1b[?2026h\x1b[2K\x1b[1A\x1b[2K\x1b[G'

/** One spinner frame, exactly as captured. Repainted dozens of times before the URL appears. */
const SPINNER_FRAME = `${FRAME} · Opening browser to sign in…\r\n`

const REAL_URL =
  'https://claude.ai/oauth/authorize?code=true&client_id=9d1c250a-e61b-44d9-88ed-5944d1962f5e' +
  '&response_type=code&redirect_uri=https%3A%2F%2Fconsole.anthropic.com%2Foauth%2Fcode%2Fcallback' +
  '&scope=user%3Ainference&code_challenge=Nkkcfpf1S5R09ayyXAAmPiYmOvD-kKvXGrPCL_ETTuc' +
  '&code_challenge_method=S256&state=TCilo-oDmAXuhvhsPduU7IE49pM_esNyo_8wsUfQIbU'

/** The frame that carries the URL, again exactly as captured. */
const URL_FRAME =
  `${FRAME} ` +
  "Browser didn't open? Use the url below to sign in:\r\n\r\n" +
  `${REAL_URL}\r\n\r\n\r\n Paste code here if prompted >\r\n`

class FakeProcess implements LoginProcessHandle {
  private outputListeners: Array<(chunk: string) => void> = []
  private exitListeners: Array<(code: number | null) => void> = []
  readonly writes: string[] = []
  killCount = 0

  onOutput(listener: (chunk: string) => void): void {
    this.outputListeners.push(listener)
  }

  onExit(listener: (code: number | null) => void): void {
    this.exitListeners.push(listener)
  }

  write(text: string): void {
    this.writes.push(text)
  }

  kill(): void {
    this.killCount += 1
  }

  emit(chunk: string): void {
    for (const listener of this.outputListeners) listener(chunk)
  }

  exit(code: number | null): void {
    for (const listener of this.exitListeners) listener(code)
  }
}

/** Captures the deadline callback instead of arming a real timer, so the test fires it exactly. */
function fakeSchedule() {
  const state: { fire: (() => void) | null; cancelled: number } = { fire: null, cancelled: 0 }
  const schedule = (fn: () => void): (() => void) => {
    state.fire = fn
    return () => {
      state.cancelled += 1
      state.fire = null
    }
  }
  return { state, schedule }
}

function controllerWith(proc: FakeProcess, schedule: (fn: () => void, ms: number) => () => void) {
  return new LoginSessionController({
    spawn: () => proc,
    schedule,
    deadlineMs: 300_000,
    /** Fire the Enter write immediately; the delay is a production concern, the split is not. */
    afterDelay: (fn) => fn(),
  })
}

const SAVED = {
  HOME: process.env.HOME,
  USERPROFILE: process.env.USERPROFILE,
  CLAUDE_CODE_OAUTH_TOKEN: process.env.CLAUDE_CODE_OAUTH_TOKEN,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
}

/** A throwaway `$HOME` so no test can touch the credential on the machine running it. */
function scratchHome(withCliLogin: boolean): string {
  const home = mkdtempSync(join(tmpdir(), 'crm-login-home-'))
  if (withCliLogin) {
    mkdirSync(join(home, '.claude'))
    writeFileSync(join(home, '.claude', '.credentials.json'), '{}')
  }
  return home
}

beforeEach(() => {
  delete process.env.CLAUDE_CODE_OAUTH_TOKEN
  delete process.env.ANTHROPIC_API_KEY
  process.env.HOME = scratchHome(false)
})

afterEach(() => {
  vi.restoreAllMocks()
  for (const [key, value] of Object.entries(SAVED)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

describe('bóc URL uỷ quyền ra khỏi luồng ANSI', () => {
  it('bóc đúng URL từ mẫu stdout thật của CLI, spinner và tất cả', async () => {
    const proc = new FakeProcess()
    const { schedule } = fakeSchedule()
    const controller = controllerWith(proc, schedule)

    const started = controller.start()
    for (let i = 0; i < 20; i += 1) proc.emit(SPINNER_FRAME)
    proc.emit(URL_FRAME)

    const { url, loginId } = await started
    expect(url).toBe(REAL_URL)
    expect(loginId).not.toBe('')
    expect(controller.status().state).toBe('awaiting_code')
  })

  it('URL đến làm hai chunk vẫn bóc được — TCP không tôn trọng ranh giới dòng', async () => {
    const proc = new FakeProcess()
    const { schedule } = fakeSchedule()
    const controller = controllerWith(proc, schedule)

    const started = controller.start()
    const split = Math.floor(URL_FRAME.length / 2)
    proc.emit(URL_FRAME.slice(0, split))
    proc.emit(URL_FRAME.slice(split))

    expect((await started).url).toBe(REAL_URL)
  })

  it('không khớp nửa vời: URL cụt vì chunk chưa tới thì chưa resolve', async () => {
    const proc = new FakeProcess()
    const { schedule } = fakeSchedule()
    const controller = controllerWith(proc, schedule)

    const started = controller.start()
    /**
     * A prefix with no terminating whitespace is exactly what a mid-URL chunk boundary looks
     * like. Resolving here hands the browser a truncated `state` and the authorisation fails
     * on Anthropic's side, where nothing in this codebase can explain why.
     */
    proc.emit('https://claude.ai/oauth/authorize?code=true&client_id=9d1c250a')
    expect(controller.status().state).toBe('starting')

    proc.emit('-e61b-44d9-88ed-5944d1962f5e&state=abc\r\n')
    expect((await started).url).toBe(
      'https://claude.ai/oauth/authorize?code=true&client_id=9d1c250a-e61b-44d9-88ed-5944d1962f5e&state=abc',
    )
  })
})

describe('một phiên tại một thời điểm', () => {
  it('start() lần hai khi đang có phiên bị từ chối, không spawn thêm tiến trình', async () => {
    const proc = new FakeProcess()
    const { schedule } = fakeSchedule()
    let spawns = 0
    const controller = new LoginSessionController({
      spawn: () => {
        spawns += 1
        return proc
      },
      schedule,
      deadlineMs: 300_000,
    })

    const started = controller.start()
    proc.emit(URL_FRAME)
    await started

    await expect(controller.start()).rejects.toMatchObject({ reason: 'busy' })
    expect(spawns).toBe(1)
  })

  it('phiên hỏng thì mở lại được — thất bại không khoá vĩnh viễn cái nút', async () => {
    const first = new FakeProcess()
    const second = new FakeProcess()
    const { schedule } = fakeSchedule()
    const queue = [first, second]
    const controller = new LoginSessionController({
      spawn: () => queue.shift() as FakeProcess,
      schedule,
      deadlineMs: 300_000,
    })

    const failed = controller.start()
    first.exit(1)
    await expect(failed).rejects.toBeInstanceOf(LoginSessionError)

    const retry = controller.start()
    second.emit(URL_FRAME)
    expect((await retry).url).toBe(REAL_URL)
  })
})

describe('deadline', () => {
  it('hết hạn mà chưa có URL thì kill tiến trình và báo hỏng, không rò tiến trình', async () => {
    const proc = new FakeProcess()
    const { state, schedule } = fakeSchedule()
    const controller = controllerWith(proc, schedule)

    const started = controller.start()
    proc.emit(SPINNER_FRAME)
    state.fire?.()

    await expect(started).rejects.toMatchObject({ reason: 'deadline' })
    expect(proc.killCount).toBe(1)
    expect(controller.status().state).toBe('failed')
  })

  it('hết hạn khi đang chờ code cũng kill — người dùng bỏ đi giữa chừng là trường hợp thường', async () => {
    const proc = new FakeProcess()
    const { state, schedule } = fakeSchedule()
    const controller = controllerWith(proc, schedule)

    const started = controller.start()
    proc.emit(URL_FRAME)
    await started

    state.fire?.()
    expect(proc.killCount).toBe(1)
    expect(controller.status().state).toBe('failed')
  })

  it('phiên xong thì huỷ đồng hồ, không để timer đi kill một tiến trình đã chết', async () => {
    const proc = new FakeProcess()
    const { state, schedule } = fakeSchedule()
    const controller = controllerWith(proc, schedule)

    const started = controller.start()
    proc.emit(URL_FRAME)
    const { loginId } = await started

    const finished = controller.submitCode(loginId, 'ma-uy-quyen')
    proc.exit(0)
    await finished

    expect(state.cancelled).toBe(1)
  })
})

describe('nhận mã uỷ quyền', () => {
  it('ghi code rồi ghi Enter thành HAI lần ghi riêng biệt', async () => {
    const proc = new FakeProcess()
    const { schedule } = fakeSchedule()
    const controller = controllerWith(proc, schedule)

    const started = controller.start()
    proc.emit(URL_FRAME)
    const { loginId } = await started

    const finished = controller.submitCode(loginId, '  ma-uy-quyen-that  ')
    proc.exit(0)
    await finished

    /**
     * TWO writes, not one string with a terminator on the end — and this assertion is the whole
     * point of the test rather than a detail of it.
     *
     * Ink turns one stdin chunk into one input event, so `"code\n"` in a single write is inserted
     * as literal text and no Enter key is ever seen: the CLI shows the code sitting in its field,
     * never finishes, and the caller waits out the full deadline on a login that looked accepted.
     * That is precisely what shipped, because the first version of this test asserted
     * `['ma-uy-quyen-that\n']` — it locked in the bug instead of catching it.
     *
     * Trimmed too: a code pasted out of a browser carries whitespace the CLI will not forgive.
     */
    expect(proc.writes).toEqual(['ma-uy-quyen-that', '\r'])
  })

  it('sai loginId thì từ chối — một tab cũ không được lái phiên của tab đang mở', async () => {
    const proc = new FakeProcess()
    const { schedule } = fakeSchedule()
    const controller = controllerWith(proc, schedule)

    const started = controller.start()
    proc.emit(URL_FRAME)
    await started

    await expect(controller.submitCode('phien-khac', 'ma')).rejects.toMatchObject({
      reason: 'no_session',
    })
    expect(proc.writes).toEqual([])
  })

  it('chưa có phiên nào mà nộp code thì từ chối', async () => {
    const proc = new FakeProcess()
    const { schedule } = fakeSchedule()
    const controller = controllerWith(proc, schedule)

    await expect(controller.submitCode('bat-ky', 'ma')).rejects.toMatchObject({
      reason: 'no_session',
    })
  })

  it('nộp code lần hai bị từ chối — CLI chỉ đọc stdin một lần', async () => {
    const proc = new FakeProcess()
    const { schedule } = fakeSchedule()
    const controller = controllerWith(proc, schedule)

    const started = controller.start()
    proc.emit(URL_FRAME)
    const { loginId } = await started

    const finished = controller.submitCode(loginId, 'ma-thu-nhat')
    await expect(controller.submitCode(loginId, 'ma-thu-hai')).rejects.toMatchObject({
      reason: 'no_session',
    })

    proc.exit(0)
    await finished
    expect(proc.writes).toEqual(['ma-thu-nhat', '\r'])
  })

  it('mã bị Anthropic từ chối thì hỏng NGAY, không chờ hết deadline', async () => {
    const proc = new FakeProcess()
    const { schedule } = fakeSchedule()
    const controller = controllerWith(proc, schedule)

    const started = controller.start()
    proc.emit(URL_FRAME)
    const { loginId } = await started

    const finished = controller.submitCode(loginId, 'ma-sai')
    /**
     * The real CLI's answer to a bad code, captured from the container. Note what is NOT in it:
     * an exit. It offers "Press Enter to retry" and stays alive, so a caller that only watches for
     * process exit waits the full five minutes for a failure that already arrived.
     */
    proc.emit(
      '\x1b[2K\x1b[G Paste code here if prompted > ma-sai\r\n' +
        ' OAuth error: Invalid code. Please make sure the full code was copied\r\n\r\n' +
        ' Press Enter to retry.\r\n',
    )

    await expect(finished).rejects.toMatchObject({ reason: 'code_rejected' })
    expect(controller.status().state).toBe('failed')
    /** And the process is ended rather than left sitting at a retry prompt nobody can reach. */
    expect(proc.killCount).toBe(1)
  })

  it('thoát mã 0 khi CHƯA có URL cũng là hỏng — không được treo lời gọi mãi mãi', async () => {
    const proc = new FakeProcess()
    const { state, schedule } = fakeSchedule()
    const controller = controllerWith(proc, schedule)

    const started = controller.start()
    proc.emit(SPINNER_FRAME)
    /**
     * A clean exit that never printed a URL. Treating exit code 0 as success on its own drops the
     * `start()` rejector, and because the deadline is cancelled on that path there is nothing left
     * to rescue the caller — the admin's HTTP request hangs forever while `/health` cheerfully
     * reports `done` for a session that produced nothing.
     */
    proc.exit(0)

    await expect(started).rejects.toMatchObject({ reason: 'cli_failed' })
    expect(controller.status().state).toBe('failed')
    /** And the slot is free again, rather than held by a session nobody can finish or cancel. */
    expect(state.cancelled).toBe(1)
  })

  it('thoát mã 0 khi đang chờ code cũng là hỏng, không phải đăng nhập thành công', async () => {
    const proc = new FakeProcess()
    const { schedule } = fakeSchedule()
    const controller = controllerWith(proc, schedule)

    const started = controller.start()
    proc.emit(URL_FRAME)
    await started

    proc.exit(0)
    expect(controller.status().state).toBe('failed')
  })

  it('không lưu được credential thì KHÔNG làm sập tiến trình', async () => {
    /**
     * A `$HOME` that does not exist, so `writeFileSync` fails for real (ENOENT) rather than
     * through a mock. Same class of failure as the one that actually threatens this path — a full
     * or read-only `agent-claude-home` volume — and it needs no stubbing of `node:fs`, which ESM
     * does not permit anyway.
     */
    process.env.HOME = join(tmpdir(), 'crm-login-home-khong-ton-tai-9f3a2b')

    const proc = new FakeProcess()
    const { schedule } = fakeSchedule()
    const controller = controllerWith(proc, schedule)

    const started = controller.start()
    proc.emit(URL_FRAME)
    const { loginId } = await started

    /**
     * `onExit` runs inside the child's `close` handler — outside any promise chain — so a throw
     * there is an uncaught exception, and `restart: unless-stopped` bounces the container mid-demo,
     * losing the credential that was just captured.
     */
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const finished = controller.submitCode(loginId, 'ma-uy-quyen')
    proc.emit('sk-ant-oat01-TOKEN-KHONG-GHI-DUOC-0123456789abcdef\r\n')
    proc.exit(0)

    /** Degrades to "could not persist", never takes the service down with it. */
    await expect(finished).resolves.toEqual({ authMode: null })
    expect(warn).toHaveBeenCalled()
    /** And the warning must not carry the token it failed to write. */
    expect(warn.mock.calls.flat().map(String).join(' ')).not.toContain('sk-ant-oat01-TOKEN')
  })

  it('tiến trình thoát mã khác 0 thì báo hỏng, không treo lời gọi', async () => {
    const proc = new FakeProcess()
    const { schedule } = fakeSchedule()
    const controller = controllerWith(proc, schedule)

    const started = controller.start()
    proc.emit(URL_FRAME)
    const { loginId } = await started

    const finished = controller.submitCode(loginId, 'ma-nao-do')
    /** A crash rather than a refused code — the refusal path is its own test above. */
    proc.emit('\x1b[2K Error: connect ETIMEDOUT\r\n')
    proc.exit(1)

    await expect(finished).rejects.toMatchObject({ reason: 'cli_failed' })
    expect(controller.status().state).toBe('failed')
  })
})

describe('kết quả đăng nhập', () => {
  it('CLI ghi .credentials.json thì chỉ cần hỏi lại resolveAuthMode()', async () => {
    const home = scratchHome(false)
    process.env.HOME = home

    const proc = new FakeProcess()
    const { schedule } = fakeSchedule()
    const controller = controllerWith(proc, schedule)

    const started = controller.start()
    proc.emit(URL_FRAME)
    const { loginId } = await started

    const finished = controller.submitCode(loginId, 'ma-uy-quyen')
    /** What the CLI does on the way out on this path: writes the file, prints nothing secret. */
    mkdirSync(join(home, '.claude'))
    writeFileSync(join(home, '.claude', '.credentials.json'), '{}')
    proc.exit(0)

    expect(await finished).toEqual({ authMode: 'cli_login' })
  })

  it('CLI in ra token thì bắt lấy, ghi đĩa quyền 600 và nạp vào môi trường', async () => {
    const home = scratchHome(false)
    process.env.HOME = home

    const proc = new FakeProcess()
    const { schedule } = fakeSchedule()
    const controller = controllerWith(proc, schedule)

    const started = controller.start()
    proc.emit(URL_FRAME)
    const { loginId } = await started

    const finished = controller.submitCode(loginId, 'ma-uy-quyen')
    proc.emit(
      '\x1b[2K\x1b[G Success! Your token is below.\r\n\r\n' +
        'sk-ant-oat01-KHONGPHAITOKENTHAT-chi-de-test-0123456789abcdef\r\n\r\n',
    )
    proc.exit(0)

    /**
     * `setup-token` and `/login` do not necessarily land in the same place, and which one this
     * build does cannot be settled without a real browser round trip. So BOTH are handled: a
     * printed token is captured and stored where boot can find it again, and the answer is
     * still read back out of `resolveAuthMode()` rather than asserted from here.
     */
    expect(await finished).toEqual({ authMode: 'oauth' })
    expect(readFileSync(storedTokenPath() as string, 'utf8')).toBe(
      'sk-ant-oat01-KHONGPHAITOKENTHAT-chi-de-test-0123456789abcdef',
    )
    expect(process.env.CLAUDE_CODE_OAUTH_TOKEN).toBe(
      'sk-ant-oat01-KHONGPHAITOKENTHAT-chi-de-test-0123456789abcdef',
    )
  })

  it('token đã lưu được nạp lại lúc boot, nhưng KHÔNG đè biến môi trường đang có', () => {
    const home = scratchHome(false)
    process.env.HOME = home
    writeFileSync(join(home, '.claude-oauth-token'), 'sk-ant-oat01-tren-dia\n')

    process.env.CLAUDE_CODE_OAUTH_TOKEN = 'sk-ant-oat01-trong-env'
    hydrateStoredOauthToken()
    /** ADR-0042: `.env` decides. A file written by this feature does not get to overrule it. */
    expect(process.env.CLAUDE_CODE_OAUTH_TOKEN).toBe('sk-ant-oat01-trong-env')

    delete process.env.CLAUDE_CODE_OAUTH_TOKEN
    hydrateStoredOauthToken()
    expect(process.env.CLAUDE_CODE_OAUTH_TOKEN).toBe('sk-ant-oat01-tren-dia')
  })
})

describe('đăng xuất', () => {
  it('xoá cả hai đường credential và trả authMode về null', () => {
    const home = scratchHome(true)
    process.env.HOME = home
    writeFileSync(join(home, '.claude-oauth-token'), 'sk-ant-oat01-tren-dia')
    process.env.CLAUDE_CODE_OAUTH_TOKEN = 'sk-ant-oat01-tren-dia'

    expect(clearStoredCredential()).toEqual({ authMode: null })

    expect(existsSync(join(home, '.claude', '.credentials.json'))).toBe(false)
    expect(existsSync(join(home, '.claude-oauth-token'))).toBe(false)
    expect(process.env.CLAUDE_CODE_OAUTH_TOKEN).toBeUndefined()
  })

  it('chưa từng đăng nhập mà bấm Đăng xuất thì không nổ', () => {
    process.env.HOME = scratchHome(false)
    expect(() => clearStoredCredential()).not.toThrow()
  })

  it('KHÔNG xoá được credential đến từ .env — nút này không sửa file cấu hình của ai', () => {
    const home = scratchHome(false)
    process.env.HOME = home
    process.env.ANTHROPIC_API_KEY = 'key-trong-env'

    /**
     * Logging out clears what this feature created. An `ANTHROPIC_API_KEY` in `.env` outlives
     * it by design — the panel says so instead of pretending the button did something.
     */
    expect(clearStoredCredential()).toEqual({ authMode: 'api_key' })
    expect(process.env.ANTHROPIC_API_KEY).toBe('key-trong-env')
  })

  it('CLAUDE_CODE_OAUTH_TOKEN của người vận hành sống sót qua Đăng xuất', () => {
    const home = scratchHome(false)
    process.env.HOME = home
    process.env.CLAUDE_CODE_OAUTH_TOKEN = 'sk-ant-oat01-token-cua-nguoi-van-hanh'

    /**
     * The failure this locks down is one admin click taking the WHOLE system's Claude access down
     * until a restart: `resolveAuthMode()` reads the environment first, so deleting this variable
     * unconditionally makes every `/run` answer `not_authenticated` for a stack that was configured
     * correctly — and nothing puts it back before boot.
     *
     * The sibling test above passes for `ANTHROPIC_API_KEY`, which the code never touched. That is
     * why it did not catch this: the assertion was narrower than the promise above it.
     */
    expect(clearStoredCredential()).toEqual({ authMode: 'oauth' })
    expect(process.env.CLAUDE_CODE_OAUTH_TOKEN).toBe('sk-ant-oat01-token-cua-nguoi-van-hanh')
  })

  it('nhưng token do CHÍNH màn này tạo ra thì xoá — phân biệt bằng giá trị đã lưu trên đĩa', () => {
    const home = scratchHome(false)
    process.env.HOME = home
    writeFileSync(join(home, '.claude-oauth-token'), 'sk-ant-oat01-do-panel-tao')
    process.env.CLAUDE_CODE_OAUTH_TOKEN = 'sk-ant-oat01-do-panel-tao'

    expect(clearStoredCredential()).toEqual({ authMode: null })
    expect(process.env.CLAUDE_CODE_OAUTH_TOKEN).toBeUndefined()
    expect(existsSync(join(home, '.claude-oauth-token'))).toBe(false)
  })
})

describe('bí mật không được rò ra ngoài', () => {
  it('không lời gọi log nào chứa mã uỷ quyền hay token', async () => {
    process.env.HOME = scratchHome(false)
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    const proc = new FakeProcess()
    const { schedule } = fakeSchedule()
    const controller = controllerWith(proc, schedule)

    const started = controller.start()
    proc.emit(URL_FRAME)
    const { loginId } = await started

    const finished = controller.submitCode(loginId, 'MA-UY-QUYEN-BI-MAT')
    proc.emit('sk-ant-oat01-TOKEN-BI-MAT-0123456789abcdefghij\r\n')
    proc.exit(0)
    await finished

    const everythingLogged = [...log.mock.calls, ...warn.mock.calls, ...error.mock.calls]
      .flat()
      .map(String)
      .join(' ')

    expect(everythingLogged).not.toContain('MA-UY-QUYEN-BI-MAT')
    expect(everythingLogged).not.toContain('sk-ant-oat01-TOKEN-BI-MAT')
  })

  it('trạng thái phơi ra ngoài không mang code lẫn token', async () => {
    process.env.HOME = scratchHome(false)
    const proc = new FakeProcess()
    const { schedule } = fakeSchedule()
    const controller = controllerWith(proc, schedule)

    const started = controller.start()
    proc.emit(URL_FRAME)
    const { loginId } = await started
    const finished = controller.submitCode(loginId, 'MA-UY-QUYEN-BI-MAT')
    proc.emit('sk-ant-oat01-TOKEN-BI-MAT-0123456789abcdefghij\r\n')
    proc.exit(0)
    await finished

    const serialised = JSON.stringify(controller.status())
    expect(serialised).not.toContain('MA-UY-QUYEN-BI-MAT')
    expect(serialised).not.toContain('sk-ant-oat01')
  })
})

describe('môi trường tiến trình đăng nhập', () => {
  it('chỉ ba khoá, và KHÔNG có biến CSDL nào — ADR-0038 vẫn đứng trong lúc đăng nhập', () => {
    process.env.HOME = scratchHome(false)
    expect(Object.keys(loginEnv()).sort()).toEqual(['HOME', 'PATH', 'USERPROFILE'])
  })

  it('không mang credential cũ xuống: đăng nhập chính là lúc chưa có credential nào', () => {
    process.env.HOME = scratchHome(false)
    process.env.CLAUDE_CODE_OAUTH_TOKEN = 'token-cu'
    process.env.ANTHROPIC_API_KEY = 'key-cu'

    const env = loginEnv()
    expect(env.CLAUDE_CODE_OAUTH_TOKEN).toBeUndefined()
    expect(env.ANTHROPIC_API_KEY).toBeUndefined()
  })
})

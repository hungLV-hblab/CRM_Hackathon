import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { homeDir, resolveAuthMode, type AuthMode } from './claude-cli'

/**
 * Driving an INTERACTIVE `claude setup-token` from a process that has no terminal.
 *
 * Three facts decided this file, all four established by running the thing rather than reasoning
 * about it:
 *
 *   1. `claude setup-token` has NO flags at all — there is no non-interactive path to ask for.
 *   2. Without a TTY it dies immediately with `Raw mode is not supported on the current
 *      process.stdin, which Ink uses`. A PTY is not an optimisation here, it is the only way in.
 *   3. `node-pty` is a dead end in this image: it is a native module and the runtime layer has no
 *      `python3`, `make` or `g++`. Building a musl toolchain to obtain a PTY is a lot of Dockerfile
 *      for something `util-linux` ships as a 40-year-old binary.
 *   4. `script -qec "claude setup-token" /dev/null` allocates that PTY and works, verified inside
 *      this very image.
 *
 * So: spawn `script`, read the repainting TUI, pull the authorisation URL out of it, push the code
 * the person pasted back in. It is scraping, and scraping a TUI is a contract nobody signed — which
 * is why the CLI version is pinned in the Dockerfile and why the URL is matched by its protocol
 * prefix rather than by the English sentence above it.
 *
 * WHAT THIS FILE MUST NEVER DO: log the authorisation code, log a token, or put either in a
 * response body. The URL is not a secret and is logged; everything after it is.
 */

/**
 * The subprocess, reduced to the four things this state machine needs. It exists so the tests can
 * drive a login end to end without spawning anything — the alternative is tests that need a real
 * PTY, a real browser and a real Anthropic account, i.e. no tests.
 */
export interface LoginProcessHandle {
  /** stdout and stderr merged. `script` funnels the whole PTY onto one stream anyway. */
  onOutput(listener: (chunk: string) => void): void
  onExit(listener: (code: number | null) => void): void
  write(text: string): void
  kill(): void
}

export type LoginState = 'idle' | 'starting' | 'awaiting_code' | 'finishing' | 'done' | 'failed'

export type LoginFailureReason =
  /** A session is already open. One at a time, same reasoning as `JobQueue`. */
  | 'busy'
  /** No session, wrong `loginId`, or the code was already submitted for this one. */
  | 'no_session'
  /** The person walked away, or the CLI never printed a URL. Process killed. */
  | 'deadline'
  /** The person pressed Cancel. Same mechanics as a deadline, different story on /health. */
  | 'aborted'
  /** Anthropic refused the code. The CLI stays alive offering a retry, so we end it ourselves. */
  | 'code_rejected'
  /** `script` or the CLI under it exited non-zero. */
  | 'cli_failed'

export class LoginSessionError extends Error {
  constructor(
    readonly reason: LoginFailureReason,
    message: string,
  ) {
    super(message)
    this.name = 'LoginSessionError'
  }
}

export interface LoginStatus {
  state: LoginState
  /** Present from `awaiting_code` onwards. Safe to expose — an OAuth request URL is not secret. */
  url?: string
  loginId?: string
  /** Why the last session failed, for the panel to show. Never carries CLI output. */
  failure?: LoginFailureReason
}

export interface LoginSessionOptions {
  spawn?: () => LoginProcessHandle
  /** Returns its own canceller. Injected so the deadline is fired exactly, not raced. */
  schedule?: (fn: () => void, ms: number) => () => void
  deadlineMs?: number
  /**
   * The pause between writing the code and writing Enter. Separate from `schedule` because it is
   * not cancellable and must not disturb the deadline timer the tests drive by hand.
   */
  afterDelay?: (fn: () => void, ms: number) => void
}

/**
 * Five minutes: long enough to open a tab, sign in, approve and paste; short enough that a
 * forgotten session does not hold the one slot for the rest of the demo.
 */
const DEFAULT_DEADLINE_MS = 300_000

/**
 * The tail we keep of the PTY stream. The spinner repaints ~10 times a second, so the whole
 * transcript of a five minute session is megabytes of frames that say the same thing. Only two
 * things are ever read out of it — the URL in the middle and a possible token at the very end —
 * and both survive a tail window this size.
 */
const OUTPUT_TAIL_LIMIT = 32_768

/**
 * Matched by protocol prefix, deliberately NOT by the sentence "Browser didn't open? Use the url
 * below to sign in:" that precedes it. Prose is a CLI author's to reword in a patch release; the
 * authorize endpoint is OAuth's and cannot move without the flow itself changing.
 *
 * The trailing `(?=\s)` is load-bearing and was not obvious: a chunk boundary can land in the
 * middle of the query string, and `\S+` alone matches the fragment that arrived so far. The URL is
 * ~250 characters over a pipe, so that is not an edge case — it is the common case. Demanding that
 * whitespace has already arrived after the URL is what proves the whole of it is in the buffer.
 *
 * Without it the browser gets a truncated `state`, authorisation fails at Anthropic, and nothing in
 * this codebase is in a position to explain why.
 */
const AUTHORIZE_URL = /https:\/\/claude\.ai\/oauth\/authorize\?\S+(?=\s)/

/**
 * CSI and OSC. `script` hands over the raw PTY stream, cursor moves and all.
 *
 * `no-control-regex` is disabled here rather than worked around: the escape and bell characters
 * ARE the thing being matched. A rule that exists to catch a control character typed by accident
 * has nothing to say about a terminal parser, and rewriting these as anything other than what the
 * terminal actually emits would make the pattern harder to check against a capture.
 */
// eslint-disable-next-line no-control-regex
const ANSI = /\x1b\[[0-9;?]*[a-zA-Z]|\x1b\][^\x07]*\x07/g

/** The shape `setup-token` prints IF this build prints one rather than writing the credential. */
const OAUTH_TOKEN = /sk-ant-oat[0-9A-Za-z_-]{20,}/

/**
 * Anthropic refused the code. The CLI does NOT exit on this — it prints the error and offers
 * "Press Enter to retry", so the process sits there and the caller's promise would wait out the
 * full deadline for a failure that is already known. Matched so the person is told in seconds.
 */
const CODE_REJECTED = /OAuth error:/

/**
 * CARRIAGE RETURN, and it must be written SEPARATELY from the code itself.
 *
 * This is not a style choice, it is the difference between the feature working and hanging. Ink
 * turns each stdin chunk into ONE input event: a single write of `"the-code\r"` is delivered as one
 * read, so Ink inserts the whole string — trailing control character and all — as text, and never
 * sees an Enter keypress. The code then sits in the input field forever, `setup-token` never
 * finishes, and the browser waits out the five minute deadline while the CLI shows the code
 * apparently accepted.
 *
 * Verified against the real CLI inside this image: same code with the terminator in the same write
 * → no reaction at all after 8 seconds. Written as its own chunk after a pause → the CLI answers
 * immediately. `\n` behaves no differently from `\r` here; the separation is what matters, and CR
 * is what a terminal actually sends for Enter once Ink has put the tty in raw mode.
 */
const ENTER_KEY = '\r'

/**
 * Long enough that the pipe is drained between the two writes rather than coalescing them into a
 * single read, which would put us straight back into the bug above. 300ms is the value verified to
 * work against the real CLI, kept rather than shaved to a rounder-looking number.
 */
const ENTER_DELAY_MS = 300

/**
 * Where a printed token is kept. Its own file, NOT `.claude/.credentials.json` — that file's
 * format belongs to the CLI, and writing our own guess of it would be this process forging a
 * credential it cannot read back.
 *
 * `undefined` when there is no `$HOME` at all, which on this image cannot happen (the Dockerfile
 * sets it) but on a developer machine can.
 */
export function storedTokenPath(): string | undefined {
  const home = homeDir()
  return home === undefined ? undefined : join(home, '.claude-oauth-token')
}

/**
 * Load a previously captured token into the environment at boot, so a container restart does not
 * silently lose a login somebody performed through the panel.
 *
 * Deliberately does NOT overwrite an existing variable: ADR-0042 says `.env` is what decides, and
 * a file this feature wrote does not get to overrule the operator. It also means `resolveAuthMode()`
 * stays the single source of truth — this fills the environment it reads, it does not become a
 * fourth authentication path with its own opinion.
 */
export function hydrateStoredOauthToken(): void {
  if (process.env.CLAUDE_CODE_OAUTH_TOKEN?.trim()) return

  const path = storedTokenPath()
  if (path === undefined || !existsSync(path)) return

  const token = readFileSync(path, 'utf8').trim()
  if (token !== '') process.env.CLAUDE_CODE_OAUTH_TOKEN = token
}

/**
 * The "log out" half of this feature, and it is not optional: a way to create a credential with no
 * way to destroy it makes ADR-0041's "missing configuration is a disabled feature" unverifiable —
 * you could never get back to the state it describes to check it.
 *
 * Clears only what a login through this panel can create. A key sitting in `.env` survives, because
 * this button is not allowed to edit somebody's configuration file; the panel says so rather than
 * pretending the click did something.
 */
export function clearStoredCredential(): { authMode: AuthMode | null } {
  const home = homeDir()
  const path = storedTokenPath()

  /**
   * Read the stored token BEFORE deleting the file, because it is the only way to tell our own
   * credential apart from the operator's.
   *
   * `process.env.CLAUDE_CODE_OAUTH_TOKEN` has two possible origins: `.env`, or `hydrateStoredOauthToken()`
   * loading the file this feature wrote. Deleting it unconditionally is how one click by an admin
   * takes the WHOLE system's Claude access down until the container restarts — `resolveAuthMode()`
   * reads the environment first, so an operator token that came from `.env` would simply vanish
   * from the running process, and nothing puts it back until boot.
   *
   * Matching on the value is exact: if the variable holds what we stored, it is ours to remove.
   * Anything else came from `.env` and stays, which is what this function's contract and the panel
   * both promise.
   */
  const ourStoredToken =
    path !== undefined && existsSync(path) ? readFileSync(path, 'utf8').trim() : undefined

  if (home !== undefined) {
    rmSync(join(home, '.claude', '.credentials.json'), { force: true })
    rmSync(join(home, '.claude-oauth-token'), { force: true })
  }

  if (ourStoredToken !== undefined && process.env.CLAUDE_CODE_OAUTH_TOKEN?.trim() === ourStoredToken) {
    delete process.env.CLAUDE_CODE_OAUTH_TOKEN
  }

  return { authMode: resolveAuthMode() }
}

/**
 * The environment for the login subprocess — and NOT `childEnv()` from `claude-cli.ts`, which
 * throws `not_authenticated` when no credential exists. Logging in is by definition the moment no
 * credential exists, so reusing that function makes the feature refuse to run exactly when it is
 * needed.
 *
 * Same allow-list discipline though, and the same reason (ADR-0038): built, never inherited, so no
 * database URL can reach a process the model's CLI is about to run. No credential is passed down
 * either — an old token in the environment would let `setup-token` take a different branch than the
 * person clicking the button asked for.
 */
export function loginEnv(): NodeJS.ProcessEnv {
  const home = homeDir()
  return {
    PATH: process.env.PATH,
    ...(home ? { HOME: home, USERPROFILE: home } : {}),
  }
}

/** The real subprocess: `script` allocates the PTY that Ink refuses to start without. */
function spawnUnderPty(): LoginProcessHandle {
  const cli = process.env.CLAUDE_CLI_PATH?.trim() || 'claude'
  /**
   * `-q` no start/stop banner · `-e` exit with the child's status, so a failed login is a non-zero
   * exit rather than a success that produced nothing · `-c` the command · `/dev/null` throws the
   * typescript away, because that file would be a verbatim copy of the session including the token.
   */
  const child = spawn('script', ['-qec', `${cli} setup-token`, '/dev/null'], {
    env: loginEnv(),
    shell: false,
    /**
     * Its own process GROUP, so the whole tree can be killed at once.
     *
     * `script` is not the process doing the work — `claude` runs underneath it. Killing only the
     * pid we hold leaves that grandchild orphaned, reparented to pid 1 (which is this Node process
     * inside the container) and never reaped: observed in production as two `claude` zombies after
     * two abandoned logins. Each one held an in-flight OAuth attempt while it was still alive.
     */
    detached: true,
  })

  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')

  return {
    onOutput(listener) {
      child.stdout.on('data', (chunk: string) => listener(chunk))
      child.stderr.on('data', (chunk: string) => listener(chunk))
    },
    onExit(listener) {
      child.on('close', (code) => listener(code))
      child.on('error', () => listener(-1))
    },
    write(text) {
      child.stdin.write(text)
    },
    kill() {
      /**
       * NEGATIVE pid: signal the whole process group, so `claude` dies with the `script` that
       * wraps it. `child.kill()` alone reaches only `script` and leaves the grandchild behind.
       *
       * Falls back to the plain kill if the group is already gone (ESRCH) — a race with a process
       * that exited on its own is normal here, not an error worth surfacing.
       */
      try {
        if (child.pid !== undefined) process.kill(-child.pid, 'SIGTERM')
      } catch {
        child.kill()
      }
    },
  }
}

function defaultSchedule(fn: () => void, ms: number): () => void {
  const timer = setTimeout(fn, ms)
  /** Never hold the process open for a login nobody is waiting on. */
  timer.unref?.()
  return () => clearTimeout(timer)
}

interface ActiveSession {
  loginId: string
  proc: LoginProcessHandle
  cancelDeadline: () => void
  /** Rolling tail of the PTY stream, ANSI stripped. NEVER logged, never returned. */
  output: string
  url?: string
  /** Resolved when the URL appears; rejected on deadline or early exit. */
  onUrl?: { resolve: (value: { loginId: string; url: string }) => void; reject: (error: Error) => void }
  /** Resolved when the process exits after the code went in. */
  onFinish?: { resolve: (value: { authMode: AuthMode | null }) => void; reject: (error: Error) => void }
}

export class LoginSessionController {
  private state: LoginState = 'idle'
  private session: ActiveSession | null = null
  private lastUrl: string | undefined
  private lastFailure: LoginFailureReason | undefined

  private readonly spawnProcess: () => LoginProcessHandle
  private readonly schedule: (fn: () => void, ms: number) => () => void
  private readonly deadlineMs: number
  private readonly afterDelay: (fn: () => void, ms: number) => void

  constructor(options: LoginSessionOptions = {}) {
    this.spawnProcess = options.spawn ?? spawnUnderPty
    this.schedule = options.schedule ?? defaultSchedule
    this.deadlineMs = options.deadlineMs ?? DEFAULT_DEADLINE_MS
    this.afterDelay =
      options.afterDelay ??
      ((fn, ms) => {
        const timer = setTimeout(fn, ms)
        timer.unref?.()
      })
  }

  /**
   * Everything the panel is allowed to see. No output, no code, no token — a status endpoint is
   * the easiest place to leak a secret, because it looks like diagnostics rather than data.
   */
  status(): LoginStatus {
    return {
      state: this.state,
      ...(this.lastUrl ? { url: this.lastUrl } : {}),
      ...(this.session ? { loginId: this.session.loginId } : {}),
      ...(this.lastFailure ? { failure: this.lastFailure } : {}),
    }
  }

  /**
   * Resolves only once the URL has been scraped, NOT when the process starts.
   *
   * Having the URL in hand is the proof that the CLI really came up under its PTY. Resolving at
   * spawn time would answer 200 to the browser and surface the actual failure one step later, as
   * "the code you pasted was rejected" — a message pointing at the wrong half of the flow.
   */
  start(): Promise<{ loginId: string; url: string }> {
    if (this.session !== null) {
      return Promise.reject(
        new LoginSessionError(
          'busy',
          'Đang có một phiên đăng nhập khác — chờ nó xong hoặc bấm Huỷ rồi thử lại',
        ),
      )
    }

    const loginId = randomUUID()
    const proc = this.spawnProcess()
    const session: ActiveSession = {
      loginId,
      proc,
      cancelDeadline: () => {},
      output: '',
    }

    this.session = session
    this.state = 'starting'
    this.lastUrl = undefined
    this.lastFailure = undefined

    session.cancelDeadline = this.schedule(() => {
      this.fail(
        session,
        'deadline',
        `Phiên đăng nhập quá ${this.deadlineMs}ms mà chưa xong — đã kết thúc tiến trình`,
      )
    }, this.deadlineMs)

    /**
     * The promise is WIRED UP BEFORE the listeners are attached, and the order is load-bearing.
     *
     * A `Promise` executor runs synchronously, so building the promise first is what guarantees
     * `session.onUrl` exists by the time any output can arrive. Attaching the listeners first and
     * constructing the promise afterwards loses every chunk delivered in the same tick — the
     * resolver simply is not there yet — and `start()` then hangs until the deadline for a login
     * that actually succeeded. Rare against a real subprocess, certain against a fast one.
     */
    const urlArrived = new Promise<{ loginId: string; url: string }>((resolve, reject) => {
      session.onUrl = { resolve, reject }
    })

    proc.onOutput((chunk) => this.absorb(session, chunk))
    proc.onExit((code) => this.onExit(session, code))

    return urlArrived
  }

  /**
   * The code goes to the CLI's stdin and nowhere else: never logged, never returned, never stored
   * on the session object.
   *
   * It is NOT true that no copy survives — a PTY echoes its input, so the pasted code comes back
   * in the output buffer. Nothing exposes that buffer (`status()` whitelists four fields and the
   * exit path reports a code rather than output), which is what makes it harmless, and saying so
   * plainly is better than a tidier claim that does not hold.
   */
  submitCode(loginId: string, code: string): Promise<{ authMode: AuthMode | null }> {
    const session = this.session
    if (session === null || session.loginId !== loginId || this.state !== 'awaiting_code') {
      return Promise.reject(
        new LoginSessionError(
          'no_session',
          'Không có phiên đăng nhập nào đang chờ mã này — bắt đầu lại từ nút Đăng nhập',
        ),
      )
    }

    this.state = 'finishing'

    /** Same ordering rule as `start()`: the resolver must exist before the process can exit. */
    const finished = new Promise<{ authMode: AuthMode | null }>((resolve, reject) => {
      session.onFinish = { resolve, reject }
    })

    /** Trimmed: a code copied out of a browser carries whitespace the CLI will not forgive. */
    session.proc.write(code.trim())
    /** Then Enter, on its own — see `ENTER_KEY`. Sending it in the write above does nothing at all. */
    this.afterDelay(() => session.proc.write(ENTER_KEY), ENTER_DELAY_MS)

    return finished
  }

  /**
   * The Cancel button. Same mechanics as the deadline, but a DIFFERENT reason on the way out — a
   * cancelled session reported as `deadline` tells an operator reading `/health` that the login
   * timed out, which sends them looking for a slow container instead of a person who changed
   * their mind.
   */
  abort(): void {
    const session = this.session
    if (session === null) return
    this.fail(session, 'aborted', 'Phiên đăng nhập đã bị huỷ')
  }

  private absorb(session: ActiveSession, chunk: string): void {
    if (this.session !== session) return

    /**
     * Accumulate THEN search. Searching each chunk alone misses every URL that straddles a chunk
     * boundary, which for a ~250 character URL arriving over a pipe is most of them.
     */
    session.output = (session.output + chunk.replace(ANSI, '').replace(/\r/g, '')).slice(
      -OUTPUT_TAIL_LIMIT,
    )

    /**
     * A refused code does NOT end the process — the CLI prints the error and waits at
     * "Press Enter to retry", so without this the caller would sit through the whole deadline for
     * an answer that already arrived. Ends the session instead and says what to do about it.
     */
    if (this.state === 'finishing' && CODE_REJECTED.test(session.output)) {
      return this.fail(
        session,
        'code_rejected',
        'Mã uỷ quyền bị từ chối — copy lại TOÀN BỘ mã rồi bấm Đăng nhập để thử lại',
      )
    }

    if (session.url !== undefined) return

    const found = session.output.match(AUTHORIZE_URL)
    if (found === null) return

    session.url = found[0]
    this.lastUrl = found[0]
    this.state = 'awaiting_code'
    session.onUrl?.resolve({ loginId: session.loginId, url: found[0] })
    session.onUrl = undefined
  }

  private onExit(session: ActiveSession, code: number | null): void {
    if (this.session !== session) return

    /**
     * A ZERO exit is only a success if the code had actually been submitted. Exiting cleanly while
     * still `starting` or `awaiting_code` means the CLI gave up without ever completing the flow —
     * and treating that as success is worse than treating it as an error, in three separate ways:
     * the pending `start()` promise would be dropped with its rejector, leaving the admin's request
     * hanging forever with the deadline already cancelled; `/health` would report `done` for a
     * session that never produced a URL; and the closure would be retained.
     *
     * The exit code is reported, NOT the CLI's output. The tail of that output is exactly where a
     * printed token lives, and an error message is the one place nobody thinks to check for a
     * secret before forwarding it to a browser.
     */
    if (code !== 0 || this.state !== 'finishing') {
      return this.fail(
        session,
        'cli_failed',
        `Tiến trình đăng nhập kết thúc sớm (mã ${code}) — chưa lấy được credential`,
      )
    }

    session.cancelDeadline()
    this.session = null
    this.state = 'done'

    const resolve = session.onFinish?.resolve
    session.onFinish = undefined
    session.onUrl = undefined

    /**
     * Guarded because this runs inside the child's `close` handler — OUTSIDE any promise chain, so
     * the router's `.catch()` cannot see a throw here and the process would go down. A full or
     * read-only `agent-claude-home` volume is enough to trigger it, and `restart: unless-stopped`
     * would then bounce the container mid-demo, losing the credential just captured.
     *
     * A storage failure degrades to "we could not persist it" rather than taking the service with
     * it. The message only — never `session.output`.
     */
    let authMode: AuthMode | null = null
    try {
      authMode = this.captureCredential(session.output)
    } catch (error) {
      console.warn(`[agent] không lưu được credential vừa tạo: ${(error as Error).message}`)
      authMode = resolveAuthMode()
    }

    resolve?.({ authMode })
  }

  /**
   * The one branch this feature could not settle before writing it: `setup-token` either writes
   * `$HOME/.claude/.credentials.json` the way `claude /login` does, or prints an `sk-ant-oat…`
   * token for the caller to store. Settling it needs a real browser authorisation, which is the
   * user's to perform, not this process's to guess at.
   *
   * So both are handled, and the answer is READ BACK from `resolveAuthMode()` rather than asserted:
   * whichever path the CLI took, the reported mode is the one the next `/run` will actually use.
   */
  private captureCredential(output: string): AuthMode | null {
    const token = output.match(OAUTH_TOKEN)?.[0]
    const path = storedTokenPath()

    if (token !== undefined && path !== undefined) {
      /** 0600: this file is the credential. Group-readable would undo the point of ADR-0038. */
      writeFileSync(path, token, { encoding: 'utf8', mode: 0o600 })
      process.env.CLAUDE_CODE_OAUTH_TOKEN = token
    }

    return resolveAuthMode()
  }

  private fail(session: ActiveSession, reason: LoginFailureReason, message: string): void {
    if (this.session !== session) return

    session.cancelDeadline()
    session.proc.kill()
    this.session = null
    this.state = 'failed'
    this.lastFailure = reason

    const error = new LoginSessionError(reason, message)
    const rejectUrl = session.onUrl?.reject
    const rejectFinish = session.onFinish?.reject
    session.onUrl = undefined
    session.onFinish = undefined

    rejectUrl?.(error)
    rejectFinish?.(error)
  }
}

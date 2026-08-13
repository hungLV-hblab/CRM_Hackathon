import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ClaudeCliError, resolveCliPath } from './claude-cli.ts'

/**
 * A conversation held over ONE long-lived `claude` process, instead of one process per request.
 *
 * `claude-cli.ts` spawns per call, which costs ~3.4s of startup every time and forgets the
 * previous turn. Here the CLI is put in bidirectional stream-json mode: JSON lines go in on
 * stdin, events come out on stdout, and the process stays alive between turns. Measured on this
 * machine: turn 1 ≈ 5.8s (2.4s of it startup), turn 2 ≈ 2.9s with the startup gone.
 *
 * Cost behaves differently from what a live channel suggests, and the numbers are worth stating
 * because the intuition is wrong. The CLI injects ~15.9k tokens of its own preamble; the tool
 * schemas are loaded even under `--allowed-tools none`, which blocks CALLING a tool, not
 * declaring it. Keeping the process alive does NOT buy that preamble once — measured here, every
 * turn still reports ~15.5–16.3k `cache_read_input_tokens`. What the channel buys is that the
 * read stays a cache HIT (~10% of input price) instead of a fresh write, and that the ~3.4s
 * startup is not repeated. Roughly $0.10 on a cold first call, ~$0.01–0.02 per turn after.
 *
 * Those dollar figures are NOT a bill. The CLI reports `total_cost_usd` whatever the auth mode;
 * under a subscription login there is no per-token charge, so the number is a notional
 * equivalent-API cost. What it actually measures is consumption against the session rate limit —
 * which is the constraint worth designing around, and the reason the queue below exists.
 */

export interface TurnResult {
  text: string
  /**
   * For THIS turn. The CLI reports `total_cost_usd` and `duration_api_ms` as RUNNING SESSION
   * TOTALS, not per-message values — on a live channel they only ever grow. Both are
   * differenced against the previous turn below; reading them raw makes every turn look
   * progressively slower and more expensive than it was.
   */
  costUsd: number
  apiMs: number
  sessionTotalUsd: number
  elapsedMs: number
  inputTokens: number
  cacheReadTokens: number
  outputTokens: number
  sessionId: string
  model: string
  turn: number
}

interface Pending {
  onDelta: (text: string) => void
  resolve: (result: TurnResult) => void
  reject: (error: Error) => void
  startedAt: number
}

export class ClaudeChannel {
  private child: ChildProcessWithoutNullStreams | null = null
  private buffer = ''
  private pending: Pending | null = null
  private queue: Promise<unknown> = Promise.resolve()
  private sessionTotalUsd = 0
  private sessionApiMs = 0
  private turns = 0
  readonly cwd = mkdtempSync(join(tmpdir(), 'claude-channel-'))

  // Written out rather than declared as constructor parameter properties: Node runs this file
  // by stripping types only, and a parameter property would need real transpilation.
  private readonly systemPrompt: string
  private readonly model: string | undefined

  constructor(systemPrompt: string, model?: string) {
    this.systemPrompt = systemPrompt
    this.model = model
  }

  get alive(): boolean {
    return this.child !== null && this.child.exitCode === null
  }

  get turnCount(): number {
    return this.turns
  }

  /** Turns are serialised: the CLI answers one user message at a time on a single session. */
  send(text: string, onDelta: (chunk: string) => void): Promise<TurnResult> {
    const turn = this.queue.then(() => this.sendOne(text, onDelta))
    this.queue = turn.catch(() => undefined)
    return turn
  }

  close(): void {
    this.child?.stdin.end()
    this.child?.kill()
    this.child = null
  }

  private sendOne(text: string, onDelta: (chunk: string) => void): Promise<TurnResult> {
    if (!this.alive) this.start()
    const child = this.child
    if (!child) return Promise.reject(new ClaudeCliError('Không mở được kênh tới Claude CLI'))

    return new Promise<TurnResult>((resolve, reject) => {
      this.pending = { onDelta, resolve, reject, startedAt: Date.now() }
      child.stdin.write(
        JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'text', text }] } }) + '\n',
      )
    })
  }

  private start(): void {
    const args = [
      '-p',
      '--input-format',
      'stream-json',
      '--output-format',
      'stream-json',
      // Without this the CLI only emits whole messages; the deltas are what make the screen
      // show an answer being written rather than appearing all at once.
      '--include-partial-messages',
      '--verbose',
      '--allowed-tools',
      'none',
      '--strict-mcp-config',
      '--no-session-persistence',
      '--system-prompt',
      this.systemPrompt,
    ]
    if (this.model) args.push('--model', this.model)

    const child = spawn(resolveCliPath(), args, { cwd: this.cwd, shell: false })
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => this.consume(chunk))
    child.on('error', (error) => this.failPending(new ClaudeCliError(`Kênh lỗi: ${error.message}`)))
    child.on('close', (code) => {
      this.child = null
      // A turn in flight when the process dies must reject, or the browser waits forever.
      this.failPending(new ClaudeCliError(`Kênh đóng bất ngờ (mã ${code})`))
    })

    this.child = child
    this.buffer = ''
  }

  /** stdout is newline-delimited JSON; a chunk can split a line, so the tail is carried over. */
  private consume(chunk: string): void {
    this.buffer += chunk
    const lines = this.buffer.split('\n')
    this.buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (line.trim().length === 0) continue
      try {
        this.handle(JSON.parse(line) as CliEvent)
      } catch {
        // A line we cannot parse is not worth killing a live conversation over.
      }
    }
  }

  private handle(event: CliEvent): void {
    if (event.type === 'stream_event' && event.event?.type === 'content_block_delta') {
      const delta = event.event.delta
      if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
        this.pending?.onDelta(delta.text)
      }
      return
    }

    if (event.type !== 'result') return

    const pending = this.pending
    this.pending = null
    if (!pending) return

    if (event.is_error === true || typeof event.result !== 'string') {
      return pending.reject(new ClaudeCliError(`Claude CLI báo lỗi: ${JSON.stringify(event).slice(0, 300)}`))
    }

    const sessionTotalUsd = event.total_cost_usd ?? this.sessionTotalUsd
    const costUsd = Math.max(0, sessionTotalUsd - this.sessionTotalUsd)
    this.sessionTotalUsd = sessionTotalUsd

    const sessionApiMs = event.duration_api_ms ?? this.sessionApiMs
    const apiMs = Math.max(0, sessionApiMs - this.sessionApiMs)
    this.sessionApiMs = sessionApiMs

    this.turns += 1

    const usage = event.usage ?? {}
    pending.resolve({
      text: event.result,
      costUsd,
      sessionTotalUsd,
      elapsedMs: Date.now() - pending.startedAt,
      apiMs,
      inputTokens: (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0),
      cacheReadTokens: usage.cache_read_input_tokens ?? 0,
      outputTokens: usage.output_tokens ?? 0,
      sessionId: event.session_id ?? '(không rõ)',
      model: this.model ?? Object.keys(event.modelUsage ?? {})[0] ?? '(mặc định)',
      turn: this.turns,
    })
  }

  private failPending(error: Error): void {
    const pending = this.pending
    this.pending = null
    pending?.reject(error)
  }
}

interface CliEvent {
  type?: string
  event?: { type?: string; delta?: { type?: string; text?: string } }
  is_error?: boolean
  result?: string
  session_id?: string
  duration_api_ms?: number
  total_cost_usd?: number
  modelUsage?: Record<string, unknown>
  usage?: {
    input_tokens?: number
    cache_creation_input_tokens?: number
    cache_read_input_tokens?: number
    output_tokens?: number
  }
}

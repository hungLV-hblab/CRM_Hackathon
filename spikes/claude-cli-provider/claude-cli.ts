import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Thin wrapper around `claude -p` (headless mode), used to answer ONE question in this spike:
 * can the backend get a model answer with no ANTHROPIC_API_KEY, by driving the locally
 * installed Claude Code CLI as a subprocess?
 *
 * Everything here is about making that subprocess behave like an API call rather than like a
 * coding agent — see the flags below, each of which removes a capability we do not want a
 * backend to hand to a model.
 */

export interface CliRun {
  /** The model's answer as plain text — the `result` field of the CLI's JSON envelope. */
  text: string
  costUsd: number
  /** Wall clock as measured by us, i.e. including process startup, not just the API call. */
  elapsedMs: number
  /** What the CLI itself reports for the API round trip. The gap between the two is spawn cost. */
  apiMs: number
  sessionId: string
  model: string
  inputTokens: number
  outputTokens: number
}

export class ClaudeCliError extends Error {}

/**
 * The CLI installs itself outside PATH on Windows often enough that resolving it by name alone
 * fails. An explicit env var wins so a server can be pointed at a specific build.
 */
const CANDIDATES = [
  process.env.CLAUDE_CLI_PATH,
  join(homedir(), '.local', 'bin', 'claude.exe'),
  join(homedir(), '.local', 'bin', 'claude'),
  join(homedir(), 'AppData', 'Roaming', 'npm', 'claude.cmd'),
].filter((path): path is string => typeof path === 'string' && path.length > 0)

export function resolveCliPath(): string {
  const found = CANDIDATES.find((path) => existsSync(path))
  if (!found) {
    throw new ClaudeCliError(
      `Không tìm thấy Claude CLI. Đặt biến môi trường CLAUDE_CLI_PATH trỏ tới file thực thi. Đã thử: ${CANDIDATES.join(', ')}`,
    )
  }
  return found
}

/**
 * The CLI reads CLAUDE.md, .claude/ and MCP config from its working directory. Run it inside
 * the repo and every call silently prepends the whole project context: measured at ~31k input
 * tokens per call versus ~16k from an empty directory. So it gets an empty scratch directory,
 * and the prompt is the only thing it is told.
 */
const SANDBOX_CWD = mkdtempSync(join(tmpdir(), 'claude-cli-spike-'))

export function sandboxPath(): string {
  return SANDBOX_CWD
}

/**
 * Serialised on purpose. A Claude subscription is rate limited per session, not per request,
 * and a watch cycle that fans out over companies would exhaust it in seconds. One in flight at
 * a time is the crudest possible mitigation and the honest one for a spike — a real adapter
 * would need a queue with a visible depth.
 */
let chain: Promise<unknown> = Promise.resolve()

export function runClaude(systemPrompt: string, userPrompt: string, timeoutMs = 180_000): Promise<CliRun> {
  const run = chain.then(() => spawnOnce(systemPrompt, userPrompt, timeoutMs))
  chain = run.catch(() => undefined)
  return run
}

function spawnOnce(systemPrompt: string, userPrompt: string, timeoutMs: number): Promise<CliRun> {
  const args = [
    '-p',
    '--output-format',
    'json',
    // A backend asks one question and wants one answer. Without this the CLI may keep working
    // agentically, and the caller cannot bound what it will do or spend.
    '--max-turns',
    '1',
    // There is no tool named "none", which is the point: the whitelist matches nothing, so the
    // subprocess cannot read files, run shell commands or reach the network on its own.
    '--allowed-tools',
    'none',
    // Ignore whatever MCP servers the developer happens to have connected. Their tool schemas
    // would otherwise be loaded into every backend call.
    '--strict-mcp-config',
    '--no-session-persistence',
    // Replaces the Claude Code agent system prompt rather than appending to it: the backend
    // wants an extractor, not a coding assistant that has also been told to extract.
    '--system-prompt',
    systemPrompt,
  ]

  const model = process.env.CLAUDE_CLI_MODEL?.trim()
  if (model) args.push('--model', model)

  return new Promise<CliRun>((resolve, reject) => {
    const startedAt = Date.now()
    const child = spawn(resolveCliPath(), args, { cwd: SANDBOX_CWD, shell: false })

    let stdout = ''
    let stderr = ''
    let timedOut = false

    const timer = setTimeout(() => {
      timedOut = true
      child.kill()
    }, timeoutMs)

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => (stdout += chunk))
    child.stderr.on('data', (chunk: string) => (stderr += chunk))
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(new ClaudeCliError(`Không chạy được Claude CLI: ${error.message}`))
    })

    child.on('close', (code) => {
      clearTimeout(timer)
      if (timedOut) return reject(new ClaudeCliError(`Claude CLI quá ${timeoutMs}ms, đã bị kết thúc`))
      if (code !== 0) return reject(new ClaudeCliError(`Claude CLI thoát với mã ${code}: ${stderr.trim() || stdout.trim()}`))
      try {
        resolve(readEnvelope(stdout, Date.now() - startedAt))
      } catch (error) {
        reject(error)
      }
    })

    // Sent over stdin rather than as an argument: a snapshot easily exceeds the Windows
    // command line limit, and an argument would put the whole document into the process table.
    child.stdin.end(userPrompt, 'utf8')
  })
}

interface CliEnvelope {
  is_error?: boolean
  result?: string
  session_id?: string
  duration_api_ms?: number
  total_cost_usd?: number
  usage?: { input_tokens?: number; cache_creation_input_tokens?: number; output_tokens?: number }
  modelUsage?: Record<string, unknown>
}

function readEnvelope(stdout: string, elapsedMs: number): CliRun {
  let envelope: CliEnvelope
  try {
    envelope = JSON.parse(stdout) as CliEnvelope
  } catch {
    throw new ClaudeCliError(`Claude CLI trả về không phải JSON: ${stdout.slice(0, 300)}`)
  }

  if (envelope.is_error === true || typeof envelope.result !== 'string') {
    throw new ClaudeCliError(`Claude CLI báo lỗi: ${JSON.stringify(envelope).slice(0, 300)}`)
  }

  const usage = envelope.usage ?? {}
  return {
    text: envelope.result,
    costUsd: envelope.total_cost_usd ?? 0,
    elapsedMs,
    apiMs: envelope.duration_api_ms ?? 0,
    sessionId: envelope.session_id ?? '(không rõ)',
    model: Object.keys(envelope.modelUsage ?? {})[0] ?? '(không rõ)',
    // Cache creation is where the CLI's own preamble lands, and it is charged. Folding it in
    // keeps the number on screen honest about what a call actually costs.
    inputTokens: (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0),
    outputTokens: usage.output_tokens ?? 0,
  }
}

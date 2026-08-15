import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { AgentRunError, classifyCliFailure } from './errors'
import type { SkillPolicy } from './skill-registry'

/**
 * Driving `claude -p` as a subprocess — grown up from `spikes/claude-cli-provider/claude-cli.ts`,
 * which proved the transport works. Two things changed on the way in:
 *
 *   1. The flags that bound what the model may do are no longer hard-coded. They come from the
 *      calling skill's `policy.json`, so "what this skill is allowed to reach for" is declared
 *      next to the prompt that needs it rather than compiled into the transport.
 *   2. The environment handed to the subprocess is BUILT, never inherited — inheriting it would
 *      hand a model-driven process every database URL this one happens to hold. The spike
 *      inherited everything and relied on `~/.claude` existing on the machine.
 *
 * What did NOT change, and must not: the working directory is an empty scratch folder. The CLI
 * reads `CLAUDE.md` and `.claude/` from wherever it runs, so running it inside the repo silently
 * prepends the entire project context to every call (measured in the spike: ~31k input tokens
 * per call against ~16k from an empty directory).
 */

export interface CliRun {
  /** The model's answer as plain text — the `result` field of the CLI's JSON envelope. */
  text: string
  /** Wall clock measured by us: includes process startup, unlike `apiMs`. */
  elapsedMs: number
  /** What the CLI reports for the API round trip. `elapsedMs - apiMs` is the spawn cost. */
  apiMs: number
  sessionId: string
  inputTokens: number
  outputTokens: number
}

/**
 * One empty directory for the lifetime of the process, not one per call. Creating a temp dir
 * per run would add a filesystem round trip to a path already paying ~3.4s of process startup,
 * and there is nothing in it to keep separate — no skill writes files.
 */
const SANDBOX_CWD = mkdtempSync(join(tmpdir(), 'crm-agent-'))

export function sandboxPath(): string {
  return SANDBOX_CWD
}

/**
 * The binary is on PATH inside the container (the Dockerfile installs it globally). The env var
 * exists so the same code runs on a developer machine where the CLI lives somewhere else.
 */
function cliPath(): string {
  return process.env.CLAUDE_CLI_PATH?.trim() || 'claude'
}

/**
 * Where the CLI keeps its own state, including the credential written by an interactive
 * `claude /login`. `USERPROFILE` is the fallback so a developer machine on Windows resolves to
 * the same directory the CLI itself would pick.
 *
 * Exported because `login-session.ts` writes into that same directory, and a second copy of this
 * three-line fallback is a second answer to "where does the credential live" — the kind of split
 * that already cost this file one bug when `/health` and `/run` each decided auth for themselves.
 */
export function homeDir(): string | undefined {
  return process.env.HOME?.trim() || process.env.USERPROFILE?.trim() || undefined
}

/**
 * The credential file an interactive login leaves behind. Its mere presence is what we check —
 * not its contents. An expired session looks identical from here and is supposed to: judging a
 * credential is the API's job, and the CLI already reports a rejected one as a non-zero exit
 * that `classifyCliFailure` turns back into `not_authenticated`. Parsing it here would mean
 * this process reading a secret it has no reason to read.
 */
function hasCliLogin(): boolean {
  const home = homeDir()
  return home !== undefined && existsSync(join(home, '.claude', '.credentials.json'))
}

/** Which credential this process is actually running on, in the order the CLI resolves them. */
export type AuthMode = 'oauth' | 'api_key' | 'cli_login'

/**
 * THREE ways to be authenticated, not two — and the third is the one a container acquires by
 * itself. `claude /login` inside the running container writes `$HOME/.claude/.credentials.json`;
 * no environment variable appears anywhere, and a check that only reads the environment refuses
 * a subprocess that would have succeeded.
 *
 * Order matters and matches the CLI's own: an explicit token in the environment wins over
 * whatever session happens to be lying on disk, so `.env` stays the thing that decides.
 *
 * `null` means no path at all — the run cannot happen, and saying so here costs nothing while
 * finding out from the CLI costs the ~3.4s of process startup first.
 */
export function resolveAuthMode(): AuthMode | null {
  if (process.env.CLAUDE_CODE_OAUTH_TOKEN?.trim()) return 'oauth'
  if (process.env.ANTHROPIC_API_KEY?.trim()) return 'api_key'
  if (hasCliLogin()) return 'cli_login'
  return null
}

/**
 * The subprocess gets an environment we BUILD, never the one we inherit.
 *
 * `apps/api` holds `DATABASE_URL_SYSTEM`; this process does not, and this function is the
 * reason it stays that way even if that ever changes — a subprocess that inherited it would
 * have the AI identity's database credentials and none of the domain code that constrains how
 * they may be used.
 *
 * `HOME` is passed for the same reason the other two are: on the `cli_login` path it IS the
 * credential — drop it and the child looks for its session in a directory that does not exist.
 */
export function childEnv(): NodeJS.ProcessEnv {
  const mode = resolveAuthMode()

  if (mode === null) {
    throw new AgentRunError(
      'not_authenticated',
      'Không có đường xác thực nào: thiếu CLAUDE_CODE_OAUTH_TOKEN, thiếu ANTHROPIC_API_KEY, ' +
        'và cũng chưa đăng nhập bằng `claude /login` trong container',
    )
  }

  const home = homeDir()

  return {
    PATH: process.env.PATH,
    ...(home ? { HOME: home, USERPROFILE: home } : {}),
    ...(mode === 'oauth' ? { CLAUDE_CODE_OAUTH_TOKEN: process.env.CLAUDE_CODE_OAUTH_TOKEN?.trim() } : {}),
    ...(mode === 'api_key' ? { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY?.trim() } : {}),
  }
}

export function runSkill(policy: SkillPolicy, systemPrompt: string, userPrompt: string): Promise<CliRun> {
  const env = childEnv()

  const args = [
    '-p',
    '--output-format',
    'json',
    /**
     * From the skill, not from here. `extract-claims` reads a string we already hold and needs
     * no tools at all; a skill that searches needs exactly one. There is no tool named "none",
     * which is what makes it a safe default: the whitelist matches nothing.
     */
    '--allowed-tools',
    policy.allowedTools.length > 0 ? policy.allowedTools.join(',') : 'none',
    '--max-turns',
    String(policy.maxTurns),
    /**
     * Ignore whatever MCP servers happen to be configured on the machine. Without this a
     * developer's connected servers load their tool schemas into every backend call, which both
     * costs tokens and widens what the model can reach for without anyone deciding to widen it.
     */
    '--strict-mcp-config',
    '--no-session-persistence',
    /**
     * REPLACES the Claude Code system prompt rather than appending to it. The backend wants an
     * extractor, not a coding assistant that has additionally been told to extract.
     */
    '--system-prompt',
    systemPrompt,
    /**
     * Headless: there is no terminal to answer a permission prompt, so a run that stops to ask
     * would hang until the timeout. Safe only because `--allowed-tools` above is a whitelist —
     * never pair this with a permissive tool list.
     */
    '--permission-mode',
    'dontAsk',
  ]

  if (policy.model) args.push('--model', policy.model)

  return new Promise<CliRun>((resolve, reject) => {
    const startedAt = Date.now()
    const child = spawn(cliPath(), args, { cwd: SANDBOX_CWD, shell: false, env })

    let stdout = ''
    let stderr = ''
    let timedOut = false

    const timer = setTimeout(() => {
      timedOut = true
      child.kill()
    }, policy.timeoutMs)

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => (stdout += chunk))
    child.stderr.on('data', (chunk: string) => (stderr += chunk))

    child.on('error', (error) => {
      clearTimeout(timer)
      reject(new AgentRunError('spawn_failed', `Không chạy được Claude CLI: ${error.message}`))
    })

    child.on('close', (code) => {
      clearTimeout(timer)

      if (timedOut) {
        return reject(
          new AgentRunError('timeout', `Skill "${policy.name}" quá ${policy.timeoutMs}ms, đã bị kết thúc`),
        )
      }
      if (code !== 0) {
        const reason = classifyCliFailure(stderr, stdout)
        return reject(
          new AgentRunError(reason, `Claude CLI thoát mã ${code}: ${(stderr || stdout).trim().slice(0, 300)}`),
        )
      }

      try {
        resolve(readEnvelope(stdout, Date.now() - startedAt))
      } catch (error) {
        reject(error)
      }
    })

    /**
     * Over stdin, never as an argument: a snapshot easily exceeds the command line length limit
     * on Windows, and an argument would put the whole document into the process table where
     * anything with `ps` can read it.
     */
    child.stdin.end(userPrompt, 'utf8')
  })
}

interface CliEnvelope {
  is_error?: boolean
  result?: string
  session_id?: string
  duration_api_ms?: number
  usage?: { input_tokens?: number; cache_creation_input_tokens?: number; output_tokens?: number }
}

function readEnvelope(stdout: string, elapsedMs: number): CliRun {
  let envelope: CliEnvelope
  try {
    envelope = JSON.parse(stdout) as CliEnvelope
  } catch {
    throw new AgentRunError('parse_failed', `Claude CLI trả về không phải JSON: ${stdout.slice(0, 300)}`)
  }

  if (envelope.is_error === true || typeof envelope.result !== 'string') {
    throw new AgentRunError(
      'parse_failed',
      `Claude CLI báo lỗi trong envelope: ${JSON.stringify(envelope).slice(0, 300)}`,
    )
  }

  const usage = envelope.usage ?? {}
  return {
    text: envelope.result,
    elapsedMs,
    apiMs: envelope.duration_api_ms ?? 0,
    sessionId: envelope.session_id ?? '(không rõ)',
    /**
     * Cache creation folded in on purpose: it is where the CLI's own ~16k preamble lands, and
     * leaving it out makes every call look four times cheaper than it is.
     */
    inputTokens: (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0),
    outputTokens: usage.output_tokens ?? 0,
  }
}

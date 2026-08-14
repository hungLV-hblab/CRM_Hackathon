import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
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
 *   2. Auth is passed EXPLICITLY through the environment. The spike relied on `~/.claude`
 *      existing on the machine; a container has no such directory, and inheriting the parent's
 *      whole environment would also hand the subprocess every database URL in the process.
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
 * The subprocess gets an environment we BUILD, never the one we inherit.
 *
 * `apps/api` holds `DATABASE_URL_SYSTEM`; this process does not, and this function is the
 * reason it stays that way even if that ever changes — a subprocess that inherited it would
 * have the AI identity's database credentials and none of the domain code that constrains how
 * they may be used.
 */
function childEnv(): NodeJS.ProcessEnv {
  const token = process.env.CLAUDE_CODE_OAUTH_TOKEN?.trim()
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()

  if (!token && !apiKey) {
    throw new AgentRunError(
      'not_authenticated',
      'Thiếu cả CLAUDE_CODE_OAUTH_TOKEN và ANTHROPIC_API_KEY — không có đường xác thực nào',
    )
  }

  return {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    ...(token ? { CLAUDE_CODE_OAUTH_TOKEN: token } : {}),
    ...(apiKey ? { ANTHROPIC_API_KEY: apiKey } : {}),
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

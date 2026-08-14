import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { AgentRunError } from './errors'

/**
 * A skill is a DIRECTORY, not a string constant in a `.ts` file.
 *
 * That is the whole point of this file. `AnthropicClaimExtractor` keeps its prompt as a compiled
 * constant, so changing a single word of the extraction rules means editing TypeScript and
 * rebuilding an image. Here the prompt is `SKILL.md` and the safety envelope is `policy.json`,
 * both read at boot — which is what lets the rules be reviewed by someone who does not read
 * TypeScript, and diffed as prose rather than as an escaped string literal.
 *
 * The policy sits NEXT TO the prompt on purpose. "Which tools may this prompt reach for" is a
 * property of the task, and keeping it here means nobody can widen a skill's reach without
 * touching the directory that explains why it needs it.
 */

export interface SkillPolicy {
  name: string
  /** Empty means the whitelist matches nothing — see `claude-cli.ts`. The safe default. */
  allowedTools: string[]
  maxTurns: number
  timeoutMs: number
  /** Omitted → whatever the CLI defaults to for the logged-in account. */
  model?: string
}

export interface Skill {
  policy: SkillPolicy
  /** Contents of `SKILL.md`, passed verbatim as `--system-prompt`. */
  systemPrompt: string
}

/**
 * `{{NAME}}` placeholders in `SKILL.md`, filled from `@crm/contracts` at boot.
 *
 * The alternative — typing the enum values into the markdown — puts a second copy of
 * `SIGNAL_TYPE` and `PROPOSAL_TARGET_FIELDS` in the repository, and the copy that drifts is
 * always the one nobody is looking at. A prompt that offers the model a signal type the
 * database rejects produces findings that parse and then vanish, which is the worst kind of
 * bug to diagnose because nothing errors.
 *
 * An unknown placeholder is a boot failure, not a blank: shipping a prompt with a literal
 * `{{SIGNAL_TYPES}}` in it would ask the model to answer rules it was never shown.
 */
const PLACEHOLDER = /\{\{([A-Z_]+)\}\}/g

function render(template: string, vars: Record<string, string>, skillName: string): string {
  return template.replace(PLACEHOLDER, (_match, key: string) => {
    const value = vars[key]
    if (value === undefined) {
      throw new Error(`Skill "${skillName}": SKILL.md dùng {{${key}}} nhưng không có giá trị nào được cấp`)
    }
    return value
  })
}

/**
 * Read once at boot rather than per call: a skill that changes under a running process would
 * make two calls a minute apart answer to different rules with nothing in the log saying so.
 * Restart the container to pick up an edit — the restart IS the audit trail.
 */
export function loadSkills(skillsDir: string, vars: Record<string, string> = {}): Map<string, Skill> {
  const skills = new Map<string, Skill>()

  for (const entry of readdirSync(skillsDir)) {
    const dir = join(skillsDir, entry)
    if (!statSync(dir).isDirectory()) continue

    const policy = JSON.parse(readFileSync(join(dir, 'policy.json'), 'utf8')) as Partial<SkillPolicy>
    const systemPrompt = readFileSync(join(dir, 'SKILL.md'), 'utf8').trim()

    /**
     * Validated here rather than trusted, because every field is a bound on what a subprocess
     * may do. A policy missing `maxTurns` must not quietly become "unbounded" — the directory
     * name is the skill's identity, so a malformed policy is a boot failure, not a default.
     */
    if (!Array.isArray(policy.allowedTools)) {
      throw new Error(`Skill "${entry}": policy.json thiếu mảng allowedTools`)
    }
    if (typeof policy.maxTurns !== 'number' || policy.maxTurns < 1) {
      throw new Error(`Skill "${entry}": policy.json thiếu maxTurns hợp lệ`)
    }
    if (typeof policy.timeoutMs !== 'number' || policy.timeoutMs < 1000) {
      throw new Error(`Skill "${entry}": policy.json thiếu timeoutMs hợp lệ (≥1000)`)
    }
    if (systemPrompt.length === 0) {
      throw new Error(`Skill "${entry}": SKILL.md rỗng`)
    }

    skills.set(entry, {
      systemPrompt: render(systemPrompt, vars, entry),
      policy: {
        name: entry,
        allowedTools: policy.allowedTools,
        maxTurns: policy.maxTurns,
        timeoutMs: policy.timeoutMs,
        model: policy.model,
      },
    })
  }

  return skills
}

export function requireSkill(skills: Map<string, Skill>, name: string): Skill {
  const skill = skills.get(name)
  if (!skill) {
    throw new AgentRunError(
      'unknown_skill',
      `Không có skill tên "${name}". Đang nạp: ${[...skills.keys()].join(', ') || '(rỗng)'}`,
    )
  }
  return skill
}

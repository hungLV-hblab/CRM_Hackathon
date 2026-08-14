/**
 * Every way a run can fail, named. The names are not decoration: `agent-claim-extractor.ts`
 * on the API side logs the reason and returns an EMPTY list for all of them, so the only way
 * anybody can tell a quota wall apart from a malformed answer is this field.
 *
 * Rule 4 of CLAUDE.md decides the shape: a failure produces nothing, never a guess. None of
 * these ever becomes a 500 that takes a watch cycle or a Sales screen down.
 */
export type AgentFailureReason =
  /** The CLI binary is missing, or refused to start. */
  | 'spawn_failed'
  /** Killed after the skill's own `timeoutMs`. */
  | 'timeout'
  /** The subscription hit its session limit. Retrying immediately makes it worse. */
  | 'quota_exhausted'
  /** OAuth token absent, expired or rejected. */
  | 'not_authenticated'
  /** The CLI answered, but not with the JSON the skill's schema describes. */
  | 'parse_failed'
  /** No skill by that name is registered. A caller bug, not a model failure. */
  | 'unknown_skill'

export class AgentRunError extends Error {
  constructor(
    readonly reason: AgentFailureReason,
    message: string,
  ) {
    super(message)
    this.name = 'AgentRunError'
  }
}

/**
 * The CLI reports both of these as an ordinary non-zero exit with prose on stderr, so the
 * distinction has to be recovered from the text. Matching is deliberately loose — a wrong
 * guess here costs a mislabelled log line, while no guess at all costs the ability to tell
 * "we are rate limited" from "the code is broken", which is the one thing an operator needs
 * at 3am and the one thing a judge asks about in round 2.
 */
export function classifyCliFailure(stderr: string, stdout: string): AgentFailureReason {
  const text = `${stderr} ${stdout}`.toLowerCase()

  if (/rate limit|usage limit|quota|too many requests|429/.test(text)) return 'quota_exhausted'
  if (/unauthor|authentication|not logged in|invalid.*token|expired/.test(text)) {
    return 'not_authenticated'
  }
  return 'spawn_failed'
}

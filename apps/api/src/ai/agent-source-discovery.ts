import { Injectable, Logger } from '@nestjs/common'

import {
  MAX_CANDIDATES_PER_COMPANY,
  type SourceCandidate,
  type SourceDiscovery,
  type SourceDiscoveryInput,
} from '@crm/contracts'

import { AgentRuntimeClient, AgentRuntimeError } from './agent-runtime-client'
import { parseSourceCandidates, sourceUrlKey } from './parse-source-candidates'
import type { VerifyCandidates } from './verify-candidates-reachable'

/**
 * The second adapter behind `SOURCE_DISCOVERY`, reaching the model through the Claude CLI in
 * `apps/agent-runtime` instead of through the Anthropic SDK — the same move `AgentClaimExtractor`
 * made for the other port, with ONE difference that is not cosmetic.
 *
 * `AgentClaimExtractor` was a pure transport swap: the gates that make a finding trustworthy (I-1,
 * I-2, the verbatim quote check) all live on the `api` side already, so a finding that arrived over
 * the CLI faces exactly the same checks as one that arrived over the SDK. Nothing had to be
 * replaced.
 *
 * THIS ADAPTER CANNOT BE A PURE TRANSPORT SWAP, because the SDK adapter's own guarantee lives in
 * the transport. `AnthropicSourceDiscovery` compares every URL the model names against the
 * `web_search_tool_result` blocks of the same call and drops the ones that were not there; the CLI
 * returns only final text, so those blocks do not exist here. Deleting the check and shipping the
 * model's list unverified would put an address of the model's own invention in front of a Sales
 * person about to tick it — rule 1, failed in the quiet direction where nothing errors.
 *
 * So the guarantee is replaced rather than dropped: every candidate is FETCHED before anyone sees
 * it, and one that does not answer is discarded. `verify-candidates-reachable.ts` states exactly
 * what that is worth and where it is weaker than the search comparison (ADR-0039).
 *
 * Unchanged from the SDK adapter, and load-bearing: this class returns candidates and never page
 * content, never writes `company_sources`, and never decides a candidate is worth keeping. A person
 * ticking a row is still the only thing that puts a URL where the crawler will see it.
 */

/**
 * Verified with headroom, then capped. Verifying only six would leave a person with four rows
 * whenever two addresses are dead, while verifying everything a model felt like naming would let
 * the model choose how many sockets we open. Twelve is two dead candidates' worth of slack.
 */
const MAX_TO_VERIFY = MAX_CANDIDATES_PER_COMPANY * 2

@Injectable()
export class AgentSourceDiscovery implements SourceDiscovery {
  private readonly logger = new Logger('AgentSourceDiscovery')

  constructor(
    private readonly client: AgentRuntimeClient,
    private readonly verify: VerifyCandidates,
  ) {}

  async discover(input: SourceDiscoveryInput): Promise<SourceCandidate[]> {
    const context = `tìm nguồn "${input.companyName}"`
    let text: string

    try {
      const result = await this.client.run('discover-sources', describeCompany(input))

      /**
       * Startup kept apart from the model round trip, as `AgentClaimExtractor` does: the gap is
       * what this transport costs, and it sits on a button somebody is waiting on (rule 6).
       */
      this.logger.log(
        `${context}: ${result.telemetry.elapsedMs}ms tổng ` +
          `(${result.telemetry.apiMs}ms gọi model) · ${result.telemetry.inputTokens} token vào / ` +
          `${result.telemetry.outputTokens} ra`,
      )
      text = result.text
    } catch (error) {
      /**
       * Every failure becomes ZERO candidates, never a thrown request. An unreachable container, an
       * expired token and a spent quota are three lines in the log and one outcome on screen: no
       * suggestions, and nothing wrong written down (rule 4).
       */
      const reason = error instanceof AgentRuntimeError ? error.reason : 'unknown'
      this.logger.warn(`Không tìm được nguồn cho ${context} (${reason}): ${(error as Error).message}`)
      return []
    }

    const parsed = parseSourceCandidates(text, this.logger, context)
    return this.keepReachable(dedupe(parsed), input)
  }

  private async keepReachable(
    candidates: readonly SourceCandidate[],
    input: SourceDiscoveryInput,
  ): Promise<SourceCandidate[]> {
    const shortlist = candidates.slice(0, MAX_TO_VERIFY)
    if (shortlist.length === 0) return []

    const verdicts = await this.verify(shortlist.map((candidate) => candidate.url))

    const kept: SourceCandidate[] = []
    /** Counted by reason, because "the model invented it" and "the site was down" are different
     * stories about the same empty list, and only the log can tell them apart afterwards. */
    const dropped = new Map<string, number>()

    for (const [index, candidate] of shortlist.entries()) {
      const verdict = verdicts[index]

      if (verdict?.reachable !== true) {
        const reason = verdict?.reason ?? 'unreachable'
        dropped.set(reason, (dropped.get(reason) ?? 0) + 1)
        continue
      }

      kept.push(candidate)
      if (kept.length === MAX_CANDIDATES_PER_COMPANY) break
    }

    const droppedSummary =
      [...dropped.entries()].map(([reason, count]) => `${reason}×${count}`).join(', ') || 'không có'

    this.logger.log(
      `Tìm nguồn "${input.companyName}": ${kept.length} ứng viên giữ lại trên ${shortlist.length} ` +
        `đã xác minh · bỏ vì không mở được: ${droppedSummary}`,
    )

    return kept
  }
}

/**
 * Same shape of description the SDK adapter sends. It stays a plain sentence rather than JSON
 * because the skill's rules are prose too, and a model reads the pair as one instruction.
 */
function describeCompany(input: SourceDiscoveryInput): string {
  return [
    `Tên công ty: ${input.companyName}`,
    `Loại hình: ${input.companyType}`,
    `Website đang lưu: ${input.companyWebsite ?? '(chưa có)'}`,
    '',
    `Tìm tối đa ${MAX_CANDIDATES_PER_COMPANY} trang công khai nói về đúng công ty này.`,
  ].join('\n')
}

/**
 * Dropped before any socket opens: a duplicate would spend a verification fetch to learn the same
 * fact twice, and an address that is not a web URL at all has nothing to verify.
 */
function dedupe(candidates: readonly SourceCandidate[]): SourceCandidate[] {
  const seen = new Set<string>()
  const unique: SourceCandidate[] = []

  for (const candidate of candidates) {
    const key = sourceUrlKey(candidate.url)
    if (key === null || seen.has(key)) continue
    seen.add(key)
    unique.push(candidate)
  }

  return unique
}

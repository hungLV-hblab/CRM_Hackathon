import { Injectable, Logger } from '@nestjs/common'

import type { ClaimDraft, ClaimExtractor, ObservationInput } from '@crm/contracts'

import { AgentRuntimeClient, AgentRuntimeError } from './agent-runtime-client'
import { buildObservationPrompt } from './build-observation-prompt'
import { parseClaimDrafts } from './parse-claim-drafts'

/**
 * The third adapter behind `CLAIM_EXTRACTOR`, reaching the model through the Claude CLI running
 * in `apps/agent-runtime` instead of through the Anthropic SDK.
 *
 * What changes: the transport, and the credential it runs on — an OAuth subscription token
 * rather than an API key.
 *
 * What deliberately does NOT change: this class returns `ClaimDraft[]` and nothing else. It
 * computes no offsets, touches no database, and never decides a finding is good enough to keep.
 * `ClaimService` still does all three, so a finding that arrived through the CLI faces exactly
 * the same I-1 and I-2 gates as one that arrived through the SDK. The transport is not allowed
 * to change who is trusted.
 *
 * Rate limits are why this adapter is NOT wired into the watch cycle: a subscription is limited
 * per session, and the runtime runs one job at a time, so a timed scan across companies would
 * queue behind itself and exhaust the quota. Sales pressing a button is what comes through here.
 */
@Injectable()
export class AgentClaimExtractor implements ClaimExtractor {
  private readonly logger = new Logger('AgentClaimExtractor')

  constructor(private readonly client: AgentRuntimeClient) {}

  async extract(observation: ObservationInput): Promise<ClaimDraft[]> {
    let text: string

    try {
      const result = await this.client.run('extract-claims', buildObservationPrompt(observation))

      /**
       * Logged per call, with startup separated from the model round trip, because that gap is
       * the cost of this transport and the number that decides whether it stays. A single
       * duration figure would hide it (rule 6: measurable from day one).
       */
      this.logger.log(
        `observation ${observation.id}: ${result.telemetry.elapsedMs}ms tổng ` +
          `(${result.telemetry.apiMs}ms gọi model) · ${result.telemetry.inputTokens} token vào / ` +
          `${result.telemetry.outputTokens} ra`,
      )
      text = result.text
    } catch (error) {
      /**
       * Every failure becomes ZERO findings, never a thrown request — the same contract the SDK
       * adapter honours. An unreachable container, an expired token and a spent quota are three
       * different lines in the log and one identical outcome on screen: nothing was found, and
       * nothing wrong was written (rule 4).
       */
      const reason = error instanceof AgentRuntimeError ? error.reason : 'unknown'
      this.logger.warn(
        `Không rút được phát hiện cho observation ${observation.id} (${reason}): ${(error as Error).message}`,
      )
      return []
    }

    return parseClaimDrafts(text, this.logger, `observation ${observation.id}`)
  }
}

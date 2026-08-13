import { Injectable } from '@nestjs/common'

import { AutoNextStepService } from '../opportunity/auto-next-step-service'
import { ProposalService } from '../proposal/proposal-service'
import { SYSTEM_ACTOR } from '../../common/actor/actor-context'
import type { SavedClaim } from './claim-service'

/**
 * The single seam between "a source was read" and everything the product does about it
 * (ADR-0023).
 *
 * `ObservationService` calls this once and knows nothing else. Three feature groups need to
 * react to a new finding — group 3 (suggestions), group 4 (auto next step), group 5 (the watch
 * cycle writing timeline entries) — and without this file each of them would add a branch to
 * the same method in `observation-service.ts`, which three people are editing on the last two
 * days before freeze.
 *
 * THE ORDER IS PART OF THE CONTRACT, not a coincidence:
 *
 *   1. group 4 first. It decides whether it may write the next step at all. Where the current
 *      next step was typed by a human it refuses (I-7) and hands the case back as a suggestion.
 *   2. group 3 second, so those refusals arrive in the same call and become `next_step`
 *      proposals in the same transaction-shaped unit of work as the rest of the queue.
 *
 * Deliberately a plain sequential call rather than an event emitter: fire-and-forget would make
 * the order above unobservable, and a test that cannot observe the order cannot prove I-7.
 *
 * Group 4 runs under `SYSTEM_ACTOR`, hard-coded here rather than passed in from the caller, and
 * that is the honest identity: setting a next step off the back of a source read is the AI
 * acting, whether a person pressed "Đọc lại nguồn" or the watch cycle came round. Passing the
 * clicking user's identity down would hand the write `crm_app`'s privileges — every column of
 * every table — for an act no person asked for.
 */

export interface ClaimReactionInput {
  companyId: string
  observationId: string
  savedClaims: SavedClaim[]
}

@Injectable()
export class ClaimReactionService {
  constructor(
    private readonly autoNextSteps: AutoNextStepService,
    private readonly proposals: ProposalService,
  ) {}

  async react(input: ClaimReactionInput): Promise<void> {
    if (input.savedClaims.length === 0) return

    // ── step 1: feature group 4 (auto next step), autonomy zone 3 ───────────────────────────
    const autoNextStep = await this.autoNextSteps.react(SYSTEM_ACTOR, {
      companyId: input.companyId,
      savedClaims: input.savedClaims,
    })

    // ── step 2: feature group 3 (the review queue), autonomy zone 2 ─────────────────────────
    // I-7 refusals arrive here as `next_step` suggestions, in the same unit of work.
    await this.proposals.generate({
      companyId: input.companyId,
      observationId: input.observationId,
      savedClaims: input.savedClaims,
      blockedNextSteps: autoNextStep.blocked,
    })
  }
}

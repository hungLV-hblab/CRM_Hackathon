import { Injectable } from '@nestjs/common'

import { ProposalService } from '../proposal/proposal-service'
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
 * Group 4 is NOT wired in yet — phase 6 adds its step here, above the proposals call. Nothing
 * is stubbed for it in the meantime: an empty interface waiting for an implementation is a
 * guess about a design that has not been written.
 */

export interface ClaimReactionInput {
  companyId: string
  observationId: string
  savedClaims: SavedClaim[]
}

@Injectable()
export class ClaimReactionService {
  constructor(private readonly proposals: ProposalService) {}

  async react(input: ClaimReactionInput): Promise<void> {
    if (input.savedClaims.length === 0) return

    // ── step 1: feature group 4 (auto next step) — added in phase 6 ─────────────────────────
    // Its refusals (I-7) will be passed to `generate` below as `blockedNextSteps`.

    // ── step 2: feature group 3 (the review queue) ──────────────────────────────────────────
    await this.proposals.generate({
      companyId: input.companyId,
      observationId: input.observationId,
      savedClaims: input.savedClaims,
    })
  }
}

import { Injectable, Logger } from '@nestjs/common'

import type { SourceKind } from '@crm/contracts'

import { AutoNextStepService } from '../opportunity/auto-next-step-service'
import { ProposalService } from '../proposal/proposal-service'
import { SYSTEM_ACTOR } from '../../common/actor/actor-context'
import { SystemTimelineEntryService } from '../../watch/system-timeline-entry-service'
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
 *   3. group 5 last, and last for three separate reasons. It is the mirror of group 3's
 *      timeline branch (I-5: a finding is news for review OR news the system writes, never
 *      both), so the pair is only provable when both have run. Its failure must not undo the
 *      writes groups 4 and 3 already made, hence the try/catch below rather than a throw. And
 *      putting it here rather than in `WatchCycleService` is what ADR-0028 requires: the write
 *      is conditional on the COMPANY being watched, so a person re-reading a watched company's
 *      source has to reach it too, and that call never goes near the worker.
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
  /**
   * When the snapshot behind these findings was captured. Group 5 dates its timeline entries
   * from it, so the row carries the moment the evidence describes rather than the moment the
   * cycle happened to run. `ObservationService` already has it from its own `.returning()`.
   */
  observationCapturedAt: Date
  /**
   * Which kind of source these findings came from — the input that sets the autonomy ceiling
   * (I-15, ADR-0035 · ADR-0036). Required rather than optional: a caller that forgets it would
   * silently get the snapshot ceiling for a live page, which is the one mistake this parameter
   * exists to make impossible.
   */
  sourceKind: SourceKind
}

export interface ClaimReactionResult {
  /** How many `system_entry` rows group 5 wrote. One of the four numbers a cycle logs. */
  systemEntriesAdded: number
}

@Injectable()
export class ClaimReactionService {
  private readonly logger = new Logger('ClaimReaction')

  constructor(
    private readonly autoNextSteps: AutoNextStepService,
    private readonly proposals: ProposalService,
    private readonly systemTimelineEntries: SystemTimelineEntryService,
  ) {}

  async react(input: ClaimReactionInput): Promise<ClaimReactionResult> {
    if (input.savedClaims.length === 0) return { systemEntriesAdded: 0 }

    /**
     * I-15 in one line, read three times below. An unvetted public page lowers the ceiling to
     * zone 2 for EVERY branch — what changes per branch is only how each one steps down:
     * group 4 proposes instead of writing, group 3 flips its watched-company gate, group 5 does
     * not run. Computing it once here keeps the three from drifting apart.
     */
    const fromLiveSource = input.sourceKind === 'live_crawl'

    // ── step 1: feature group 4 (auto next step), zone 3 → zone 2 for a live source ─────────
    const autoNextStep = await this.autoNextSteps.react(SYSTEM_ACTOR, {
      companyId: input.companyId,
      savedClaims: input.savedClaims,
      proposeOnly: fromLiveSource,
    })

    // ── step 2: feature group 3 (the review queue), autonomy zone 2 ─────────────────────────
    // I-7 refusals arrive here as `next_step` suggestions, in the same unit of work. For a live
    // source EVERY open deal arrives that way, which is what keeps the implication reachable.
    await this.proposals.generate({
      companyId: input.companyId,
      observationId: input.observationId,
      savedClaims: input.savedClaims,
      blockedNextSteps: autoNextStep.blocked,
      fromLiveSource,
    })

    // ── step 3: feature group 5 (the watch cycle's own entry), autonomy zone 4 ──────────────
    /**
     * I-15. Zone 4 is the one branch with no zone-2 equivalent to step down to — its whole
     * content is "write without asking" — so for a live source it simply does not run, and
     * step 2 above has already taken over by flipping its gate.
     */
    if (fromLiveSource) {
      this.logger.log(
        `Công ty ${input.companyId}: nguồn thật nên không thêm mục dòng thời gian nào — ` +
          'phát hiện đi vào hàng đợi duyệt (I-15)',
      )
      return { systemEntriesAdded: 0 }
    }

    /**
     * Wrapped, and the swallow is the decision rather than laziness. Steps 1 and 2 have already
     * committed by now; letting a zone-4 failure propagate would abort `ingest()` after those
     * writes landed, so the caller would report "reading the source failed" about a read that
     * largely succeeded. The count returned is the honest signal: `entries_added = 0` while
     * `new_content_count > 0` is exactly the shape the watch log is built to make visible.
     */
    let systemEntriesAdded = 0
    try {
      systemEntriesAdded = await this.systemTimelineEntries.react({
        companyId: input.companyId,
        savedClaims: input.savedClaims,
        observationCapturedAt: input.observationCapturedAt,
      })
    } catch (error) {
      this.logger.error(
        `Không thêm được mục dòng thời gian cho công ty ${input.companyId}: ` +
          `${(error as Error).message} — nhóm 3 và nhóm 4 vẫn giữ nguyên kết quả`,
      )
    }

    return { systemEntriesAdded }
  }
}

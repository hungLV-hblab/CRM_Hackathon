/**
 * ONE run at a time, with a visible queue depth and a deadline per job.
 *
 * A Claude subscription is rate limited PER SESSION, not per request. Fan out over companies
 * and the limit is gone in seconds — which is why the watch cycle deliberately does not come
 * through here at all (it stays on the SDK adapter). What does come through is a person
 * pressing a button, and two people pressing at once must queue rather than race.
 *
 * The deadline is the half that is easy to leave out and expensive to miss. Without it a queue
 * under load keeps accepting work that nobody is waiting for any more: the HTTP request that
 * asked for it timed out minutes ago, but the job still reaches the front and still spends
 * quota. So a job that has waited past its deadline is dropped BEFORE the subprocess starts.
 */

export interface QueueStats {
  /** Jobs waiting, not counting the one running. */
  depth: number
  running: boolean
  /** Since boot. The ratio to `accepted` is what says whether the queue is sized right. */
  droppedPastDeadline: number
  accepted: number
}

export class QueueDeadlineError extends Error {
  constructor(waitedMs: number) {
    super(`Đã chờ ${waitedMs}ms trong hàng đợi, quá hạn — bỏ lượt này thay vì tiêu quota`)
    this.name = 'QueueDeadlineError'
  }
}

export class JobQueue {
  private chain: Promise<unknown> = Promise.resolve()
  private depth = 0
  private running = false
  private droppedPastDeadline = 0
  private accepted = 0

  /**
   * @param deadlineMs how long a job may sit waiting before it is no longer worth running.
   * @param now the clock. Injected for ONE reason: the deadline is the only rule in this class,
   *        and testing it against the real clock means racing the event loop. A test that has to
   *        pick a deadline small enough to trip the second job ends up small enough to trip the
   *        FIRST one too, because the check below runs a microtask after `run()` returns and that
   *        hop measures more than 0ms on a loaded machine. That is a flaky test, and a flaky test
   *        on the one guard standing between a button and a spent quota is worse than none — it
   *        gets muted. With a clock in hand the rule is checked exactly, load or no load.
   */
  constructor(
    private readonly deadlineMs = 120_000,
    private readonly now: () => number = Date.now,
  ) {}

  stats(): QueueStats {
    return {
      depth: this.depth,
      running: this.running,
      droppedPastDeadline: this.droppedPastDeadline,
      accepted: this.accepted,
    }
  }

  run<T>(job: () => Promise<T>): Promise<T> {
    const queuedAt = this.now()
    this.depth += 1
    this.accepted += 1

    const result = this.chain.then(async () => {
      this.depth -= 1

      const waited = this.now() - queuedAt
      if (waited > this.deadlineMs) {
        this.droppedPastDeadline += 1
        throw new QueueDeadlineError(waited)
      }

      this.running = true
      try {
        return await job()
      } finally {
        this.running = false
      }
    })

    /**
     * The chain swallows failures so one failed job does not poison every job behind it. The
     * caller still sees the rejection through `result`; only the ordering link is neutralised.
     */
    this.chain = result.catch(() => undefined)
    return result
  }
}

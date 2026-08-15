import { describe, expect, it } from 'vitest'

import { JobQueue, QueueDeadlineError } from '../job-queue'

/**
 * The queue is the only thing standing between a button and a spent subscription quota, so the
 * two properties that matter are asserted directly rather than assumed from reading it.
 */
describe('JobQueue', () => {
  it('chạy tuần tự — không bao giờ có hai job cùng lúc', async () => {
    const queue = new JobQueue()
    let concurrent = 0
    let peak = 0

    const job = async () => {
      concurrent += 1
      peak = Math.max(peak, concurrent)
      await new Promise((resolve) => setTimeout(resolve, 10))
      concurrent -= 1
    }

    await Promise.all([queue.run(job), queue.run(job), queue.run(job)])

    expect(peak).toBe(1)
  })

  it('một job hỏng không chặn job phía sau', async () => {
    const queue = new JobQueue()

    const failed = queue.run(() => Promise.reject(new Error('bùm')))
    const after = queue.run(() => Promise.resolve('vẫn chạy'))

    await expect(failed).rejects.toThrow('bùm')
    await expect(after).resolves.toBe('vẫn chạy')
  })

  it('job chờ quá hạn bị bỏ TRƯỚC khi chạy, không tiêu quota', async () => {
    /**
     * Driven by a HAND-WOUND clock, not by `setTimeout`.
     *
     * This test used to say `new JobQueue(0)` — "anything that waited at all is too late" — and it
     * flaked under a full suite run. Zero is too sharp: `run()` checks the deadline a microtask
     * after it returns, so on a loaded machine that hop alone measures more than 0ms and the FIRST
     * job, with nothing ahead of it, was dropped too. `await first` then rejected and the failure
     * looked like the queue misbehaving instead of the test being unable to express itself.
     *
     * With the clock in hand the wait is stated rather than raced: job one waits 0, job two waits
     * 500 against a 100 deadline. No sleeping, and the same answer on any machine.
     */
    let clock = 0
    const queue = new JobQueue(100, () => clock)
    let firstJobRan = false
    let secondJobRan = false

    const first = queue.run(async () => {
      firstJobRan = true
      /** Time passes while job one holds the queue — this is what makes job two late. */
      clock = 500
    })
    const second = queue.run(async () => {
      secondJobRan = true
    })

    await expect(first).resolves.toBeUndefined()
    await expect(second).rejects.toBeInstanceOf(QueueDeadlineError)

    /** Job one is NOT collateral damage: it waited nothing and had to run. */
    expect(firstJobRan).toBe(true)
    /** The point of the deadline: dropped BEFORE the subprocess starts, so no quota is spent. */
    expect(secondJobRan).toBe(false)
    expect(queue.stats().droppedPastDeadline).toBe(1)
  })

  it('chờ đúng bằng hạn thì VẪN chạy — hạn là "quá", không phải "tới"', async () => {
    let clock = 0
    const queue = new JobQueue(100, () => clock)
    let secondJobRan = false

    const first = queue.run(async () => {
      clock = 100
    })
    const second = queue.run(async () => {
      secondJobRan = true
    })

    await first
    await expect(second).resolves.toBeUndefined()

    /**
     * `waited > deadlineMs`, not `>=`. Worth pinning: flipping it silently throws away a job that
     * was still inside its budget, and the only visible symptom is a Sales person told "không tìm
     * được" for no reason anyone can reconstruct.
     */
    expect(secondJobRan).toBe(true)
    expect(queue.stats().droppedPastDeadline).toBe(0)
  })
})

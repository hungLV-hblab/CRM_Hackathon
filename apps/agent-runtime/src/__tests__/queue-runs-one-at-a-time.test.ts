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
    /** Zero deadline: anything that had to wait at all is already too late. */
    const queue = new JobQueue(0)
    let secondJobRan = false

    const first = queue.run(() => new Promise((resolve) => setTimeout(resolve, 20)))
    const second = queue.run(async () => {
      secondJobRan = true
    })

    await first
    await expect(second).rejects.toBeInstanceOf(QueueDeadlineError)
    expect(secondJobRan).toBe(false)
    expect(queue.stats().droppedPastDeadline).toBe(1)
  })
})

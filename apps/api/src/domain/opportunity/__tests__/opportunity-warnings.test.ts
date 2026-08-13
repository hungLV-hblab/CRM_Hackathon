import { describe, expect, it } from 'vitest'

import { isOverdue, opportunityWarnings, type WarningSource } from '../opportunity-warnings'

/**
 * The warning rules of feature group 1, tested at the only place they are defined.
 *
 * Every case below pins one of the two trade-offs the design accepted, so read the comment
 * before "fixing" a case that looks wrong: the fixed stage set and "complete = all four
 * cells" are choices, not oversights.
 */

const TODAY = '2026-08-13'

/** A clean, fully-filled open opportunity. Each test blanks exactly what it is about. */
function opportunity(overrides: Partial<WarningSource> = {}): WarningSource {
  return {
    stage: 'qualified',
    needSignal: 'Đang thiếu 12 kỹ sư Java cho dự án ngân hàng',
    needSignalSource: 'Ghi chú cuộc gọi 10/08 với CTO',
    budgetSignal: 'Ngân sách 2026 đã duyệt 500k USD',
    budgetSignalSource: 'Email của CFO 11/08',
    lostReason: null,
    nextStepText: 'Gửi bản đề xuất kỹ thuật',
    nextStepDueDate: '2026-08-20',
    ...overrides,
  }
}

describe('missing_qualification_signals · complete means ALL FOUR cells', () => {
  it('1 · qualified with all four cells filled carries no warning', () => {
    expect(opportunityWarnings(opportunity())).toEqual([])
  })

  it('2 · the signal sentence without its source STILL warns', () => {
    // The Specs' qualify gate is "kiểm được cả hai chiều". A sentence with nobody behind it
    // has not been checked in either direction, so three cells out of four is not enough.
    const warnings = opportunityWarnings(opportunity({ budgetSignalSource: null }))

    expect(warnings).toContain('missing_qualification_signals')
  })

  it('3 · jumping prospecting → negotiation warns: the gate was never passed', () => {
    const warnings = opportunityWarnings(
      opportunity({ stage: 'negotiation', needSignal: null, needSignalSource: null }),
    )

    expect(warnings).toContain('missing_qualification_signals')
  })

  it('4 · stepping back to prospecting clears it — the gate is ahead again', () => {
    const warnings = opportunityWarnings(
      opportunity({ stage: 'prospecting', needSignal: null, needSignalSource: null }),
    )

    expect(warnings).not.toContain('missing_qualification_signals')
  })

  it('5 · on_hold carries no signal warning but is still an OPEN stage for next step', () => {
    const warnings = opportunityWarnings(
      opportunity({
        stage: 'on_hold',
        needSignal: null,
        needSignalSource: null,
        nextStepText: null,
        nextStepDueDate: null,
      }),
    )

    expect(warnings).not.toContain('missing_qualification_signals')
    expect(warnings).toContain('missing_next_step')
  })
})

describe('missing_next_step · only while the deal is open', () => {
  it('6 · an open opportunity missing only the due date still warns', () => {
    // Half a next step cannot be chased: "gọi lại" with no date never reaches a to-do list.
    expect(opportunityWarnings(opportunity({ nextStepDueDate: null }))).toContain(
      'missing_next_step',
    )
  })

  it('7 · won is closed, so no next step is expected', () => {
    const warnings = opportunityWarnings(
      opportunity({ stage: 'won', nextStepText: null, nextStepDueDate: null }),
    )

    expect(warnings).not.toContain('missing_next_step')
  })
})

describe('missing_lost_reason · lost never carries two flags at once', () => {
  it('8 · lost with no reason warns about the reason ONLY', () => {
    const warnings = opportunityWarnings(
      opportunity({
        stage: 'lost',
        lostReason: null,
        needSignal: null,
        needSignalSource: null,
        budgetSignal: null,
        budgetSignalSource: null,
        nextStepText: null,
        nextStepDueDate: null,
      }),
    )

    expect(warnings).toEqual(['missing_lost_reason'])
  })

  it('9 · lost with a reason carries nothing', () => {
    expect(opportunityWarnings(opportunity({ stage: 'lost', lostReason: 'Giá cao hơn đối thủ' })))
      .toEqual([])
  })
})

describe('isOverdue · one proposition, so a missing next step can never be overdue', () => {
  it('10 · a past due date on an open opportunity is overdue', () => {
    expect(isOverdue(opportunity({ nextStepDueDate: '2026-08-12' }), TODAY)).toBe(true)
  })

  it('11 · today is not yet overdue', () => {
    expect(isOverdue(opportunity({ nextStepDueDate: TODAY }), TODAY)).toBe(false)
  })

  it('12 · no due date at all is NOT overdue — it warns instead, and stays off the to-do list', () => {
    const missing = opportunity({ nextStepText: null, nextStepDueDate: null })

    expect(isOverdue(missing, TODAY)).toBe(false)
    expect(opportunityWarnings(missing)).toContain('missing_next_step')
  })

  it('13 · a closed opportunity with a stale date is not overdue', () => {
    expect(isOverdue(opportunity({ stage: 'won', nextStepDueDate: '2026-01-01' }), TODAY)).toBe(
      false,
    )
  })
})

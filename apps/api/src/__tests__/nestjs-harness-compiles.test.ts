import { Inject, Injectable } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { describe, expect, it } from 'vitest'

import { STAGE, type Stage } from '@crm/contracts'

/**
 * Infrastructure test, not a business one. It proves the two most fragile things about a
 * NestJS × Vitest setup, and proves them AT PHASE 1 instead of letting them surface at phase 3:
 *
 * 1. `emitDecoratorMetadata` survives SWC, so type-based dependency injection works
 *    (Vite's default esbuild would leave `StageProvider` as `undefined` here).
 * 2. `apps/api` can import `@crm/contracts` — a phase 1 acceptance criterion.
 */

@Injectable()
class StageProvider {
  default(): Stage {
    return 'prospecting'
  }
}

const LABELS_TOKEN = 'LABELS_TOKEN'

@Injectable()
class LabelLookupService {
  constructor(
    private readonly stages: StageProvider,
    @Inject(LABELS_TOKEN) private readonly labels: Record<string, string>,
  ) {}

  labelOfDefaultStage(): string | undefined {
    return this.labels[this.stages.default()]
  }
}

describe('the NestJS harness compiles and injects under Vitest', () => {
  it('injects by type (decorator metadata is not lost)', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [StageProvider, LabelLookupService, { provide: LABELS_TOKEN, useValue: STAGE }],
    }).compile()

    expect(moduleRef.get(LabelLookupService).labelOfDefaultStage()).toBe('Tiếp cận')
  })

  it('can import @crm/contracts from apps/api', () => {
    expect(STAGE.drafting).toBe('Soạn đề xuất')
  })
})

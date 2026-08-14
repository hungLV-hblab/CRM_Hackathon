import { z } from 'zod'

/**
 * ontology 3.4 — the two system parameters, and the two shapes they are read through.
 *
 * There are TWO read contracts on purpose (ADR-0032). `SystemParametersDto` is the admin
 * payload of `GET /settings`; `AiStatusDto` is the ONE bit every logged-in account may read
 * from `GET /settings/ai-status`. Sales is the person T-9 requires to see that the machine
 * is off, and Sales gets a 403 on `/settings` — a status the product needs on every screen
 * cannot hang off an admin-only endpoint.
 *
 * Widening `GET /settings` to all roles was the alternative and was rejected: it deletes
 * acceptance check 2 of the walking skeleton ("Sales → 403 on an admin endpoint").
 */
export interface SystemParametersDto {
  aiEnabled: boolean
  watchCycleSeconds: number
}

/** Exactly one field. A payload that leaked `watchCycleSeconds` would hand Sales admin data. */
export interface AiStatusDto {
  aiEnabled: boolean
}

/**
 * The floor is 5 SECONDS, not 60, and that is load-bearing: `e2e/t8-watch-cycle-writes-timeline`
 * runs the cycle at 10s so two rounds fit inside a test instead of two minutes. A floor of 60
 * would make the admin screen unable to express the state the acceptance suite runs in.
 */
export const WATCH_CYCLE_SECONDS_MIN = 5
export const WATCH_CYCLE_SECONDS_MAX = 3600

export const updateSystemSettingsSchema = z
  .object({
    aiEnabled: z.boolean().optional(),
    watchCycleSeconds: z
      .number()
      .int('Chu kỳ quét là số nguyên giây')
      .min(WATCH_CYCLE_SECONDS_MIN, `Chu kỳ quét tối thiểu ${WATCH_CYCLE_SECONDS_MIN} giây`)
      .max(WATCH_CYCLE_SECONDS_MAX, `Chu kỳ quét tối đa ${WATCH_CYCLE_SECONDS_MAX} giây`)
      .optional(),
  })
  /** An empty PATCH would write nothing and record nothing while answering 200 — say so instead. */
  .refine((dto) => dto.aiEnabled !== undefined || dto.watchCycleSeconds !== undefined, {
    message: 'Phải gửi ít nhất một tham số cần đổi',
  })

export type UpdateSystemSettingsDto = z.infer<typeof updateSystemSettingsSchema>

/** The audit actions the dashboard and round 2 read. Renaming one silently empties a trail. */
export const TOGGLE_AI_ACTION = 'toggle_ai'
export const UPDATE_WATCH_CYCLE_SECONDS_ACTION = 'update_watch_cycle_seconds'

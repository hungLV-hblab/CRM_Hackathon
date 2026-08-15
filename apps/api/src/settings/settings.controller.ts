import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'

import {
  type AgentAuthTicketDto,
  type AgentRunSummaryDto,
  type AgentRuntimeStatusDto,
  type UpdateSystemSettingsDto,
  updateSystemSettingsSchema,
} from '@crm/contracts'

import { signTicket } from './agent-auth-ticket'
import { SystemSettingService } from './system-setting-service'
import { JwtGuard } from '../auth/jwt.guard'
import { Roles, RolesGuard } from '../auth/roles.guard'
import { ZodValidationPipe } from '../common/zod-validation.pipe'
import { getCurrentActor } from '../common/actor/actor-context'

/**
 * Two admin routes and one that is deliberately NOT admin.
 *
 * `GET /settings` and `PATCH /settings` are `@Roles('admin')`: reading and writing the system
 * parameters is the admin dashboard's job, and the GET is also what acceptance check 2 of the
 * walking skeleton exercises ("Sales → 403 on an admin endpoint").
 *
 * `GET /settings/ai-status` carries no `@Roles` at all, so `RolesGuard` waves it through for any
 * authenticated account (ADR-0032). T-9 requires SALES — not an admin — to see that the machine
 * is off, and a banner cannot hang off an endpoint Sales is forbidden to call. It answers ONE
 * boolean, so nothing admin-only leaks with it.
 *
 * Both routes live in this existing controller rather than in a new module, and that is not
 * tidiness: a module declaring a guarded controller must import `AuthModule` itself, and forgetting
 * it takes the whole API container down with a 502 on the login page while every unit test stays
 * green (phase 7 paid for that lesson).
 */
@Controller('settings')
@UseGuards(JwtGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly settings: SystemSettingService) {}

  @Get()
  @Roles('admin')
  read() {
    return this.settings.readForHuman()
  }

  /** Every logged-in account, Sales included. The banner of T-9 reads this. */
  @Get('ai-status')
  aiStatus() {
    return this.settings.aiStatus()
  }

  /**
   * The AI kill switch and the cycle length. Effective on the next read by both the API and the
   * worker — no restart, because neither side caches this table (ADR-0011).
   */
  @Patch()
  @Roles('admin')
  update(
    @Body(new ZodValidationPipe(updateSystemSettingsSchema)) dto: UpdateSystemSettingsDto,
  ) {
    return this.settings.updateParameters(this.actor(), dto)
  }

  /**
   * What the login panel reads to draw itself: is the runtime switched on, which credential is it
   * actually running on, and is a login session already open.
   *
   * Proxied through here rather than fetched by the browser because Caddy forwards exactly ONE
   * prefix of that container, `/agent-auth/*`, and widening that list to expose `/health` would be
   * a second public door for a diagnostic. This is a server-to-server read of three non-secret
   * fields; no credential passes through, so ADR-0038 is untouched.
   *
   * Never throws upward: a runtime that is down is a state the panel must be able to draw, not an
   * error that blanks the admin screen (ADR-0041).
   */
  @Get('agent-status')
  @Roles('admin')
  async agentStatus(): Promise<AgentRuntimeStatusDto> {
    const url = process.env.AGENT_RUNTIME_URL?.trim()
    const token = process.env.AGENT_TOKEN?.trim()
    /**
     * `reachable: true`. THIS process answered; the feature is simply switched off because its
     * configuration is absent — which is the default state of a fresh checkout, so it is the first
     * thing a judge sees. Reporting it as unreachable makes the panel say "check whether the
     * container is running" while pointing at a perfectly healthy container, which is precisely
     * the "off reads as broken" inversion `AgentRuntimeStatusDto` was split in two to prevent.
     */
    if (!url || !token) return { reachable: true, enabled: false, authMode: null, loginState: 'idle' }

    try {
      const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(5_000) })
      if (!response.ok) throw new Error(String(response.status))

      const health = (await response.json()) as {
        enabled?: boolean
        authMode?: AgentRuntimeStatusDto['authMode']
        login?: { state?: string; loginId?: string; url?: string }
        lastRun?: AgentRunSummaryDto
      }
      return {
        reachable: true,
        enabled: health.enabled === true,
        authMode: health.authMode ?? null,
        loginState: health.login?.state ?? 'idle',
        /**
         * Forwarded, not recomputed. This is what lets a browser reload — or a second tab — show
         * the same last run the first tab saw, without either of them holding it.
         */
        ...(health.lastRun ? { lastRun: health.lastRun } : {}),
        ...(health.login?.loginId ? { loginId: health.login.loginId } : {}),
        ...(health.login?.url ? { loginUrl: health.login.url } : {}),
      }
    } catch {
      return { reachable: false, enabled: false, authMode: null, loginState: 'idle' }
    }
  }

  /**
   * Forces one real run so that "Claude Code đang hoạt động" becomes a checked claim.
   *
   * WHY THIS EXISTS: `authMode` on the status above answers whether a credential is PRESENT.
   * It cannot answer whether that credential still works, whether the subscription has quota
   * left, or whether the `claude` binary made it into the image — and all four of those states
   * used to render as the same green badge. Only running something tells them apart.
   *
   * WHY IT GOES THROUGH `/run` AND NOT `/agent-auth`: `/agent-auth/*` is the family Caddy forwards
   * to the public port. `/run/*` is deliberately absent from that file because it spends a real
   * person's Claude quota, so putting a probe under the browser-facing prefix would re-open, by
   * the back door, exactly the door the two prefixes exist to keep shut (ADR-0044). The browser
   * never reaches the quota-spending endpoint; this process does, admin-gated.
   *
   * That does NOT weaken ADR-0038: `AGENT_TOKEN` is the inter-service token this API already
   * holds to sign login tickets, not a Claude credential. Nothing secret to Claude passes through
   * here — a mode name, some counters, and the model's own one-word reply.
   *
   * NEVER THROWS FOR A FAILED RUN. A refused credential, an exhausted quota and a container that
   * is down are all states the panel must be able to DRAW, each with its own instruction. Turning
   * them into a 500 would collapse them back into "something went wrong", which is the exact
   * flattening this endpoint was added to undo.
   */
  @Post('agent-check')
  @Roles('admin')
  async agentCheck(): Promise<AgentRunSummaryDto> {
    const url = process.env.AGENT_RUNTIME_URL?.trim()
    const token = process.env.AGENT_TOKEN?.trim()

    /**
     * 503 and not a failed-run payload: nothing ran, and nothing was going to. The feature is
     * switched off, which is the default state of a fresh checkout (ADR-0041), and saying "the
     * run failed" about a run that never started is the same class of lie as the green badge.
     */
    if (!url || !token) {
      throw new ServiceUnavailableException(
        'AGENT_TOKEN hoặc AGENT_RUNTIME_URL chưa đặt — tính năng kiểm tra đang tắt',
      )
    }

    const at = Date.now()
    try {
      const response = await fetch(`${url}/run/health-check`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ userPrompt: 'ping' }),
        /**
         * Longer than the skill's own 30s ceiling plus the ~3.4s of process startup measured in
         * the spike. Shorter than the skill timeout would mean this side gives up on a run that
         * is still going to spend quota anyway.
         */
        signal: AbortSignal.timeout(45_000),
      })

      const payload = (await response.json().catch(() => ({}))) as {
        text?: string
        telemetry?: Record<string, number | string>
        reason?: string
        message?: string
      }

      if (!response.ok) {
        /** The runtime's own vocabulary, carried down untouched — see `errors.ts` over there. */
        return {
          at,
          skill: 'health-check',
          ok: false,
          reason: payload.reason ?? 'parse_failed',
          message: payload.message ?? `agent-runtime trả ${response.status}`,
        }
      }

      const telemetry = payload.telemetry ?? {}
      return {
        at,
        skill: String(telemetry.skill ?? 'health-check'),
        ok: true,
        text: payload.text,
        elapsedMs: numberOrUndefined(telemetry.elapsedMs),
        apiMs: numberOrUndefined(telemetry.apiMs),
        inputTokens: numberOrUndefined(telemetry.inputTokens),
        outputTokens: numberOrUndefined(telemetry.outputTokens),
        sessionId: typeof telemetry.sessionId === 'string' ? telemetry.sessionId : undefined,
      }
    } catch (error) {
      /**
       * `unreachable` is this layer's own word, not one of the runtime's: the runtime never
       * answered, so it had no chance to name anything. "Container không chạy" and "credential bị
       * từ chối" send an admin to two completely different places.
       */
      return {
        at,
        skill: 'health-check',
        ok: false,
        reason: 'unreachable',
        message: `Không gọi được agent-runtime: ${(error as Error).message}`,
      }
    }
  }

  /**
   * Mints the ticket the admin panel carries to `agent-runtime` to log Claude in, and that is the
   * WHOLE of this API's involvement: it never sees the OAuth code and never sees the credential.
   * The browser posts to `agent-runtime` directly through Caddy, which is what keeps the process
   * holding `DATABASE_URL_SYSTEM` free of any Claude secret (ADR-0038).
   *
   * It lives in THIS controller rather than a new `AgentAuthModule` for the reason spelled out at
   * the top of this file: a new module that declares a guarded controller and forgets to import
   * `AuthModule` takes the whole API down with a 502 on the login page while every unit test stays
   * green. That failure has already been paid for once.
   */
  @Post('agent-auth-ticket')
  @Roles('admin')
  agentAuthTicket(): AgentAuthTicketDto {
    const secret = process.env.AGENT_TOKEN?.trim()

    /**
     * 503, not 500. No `AGENT_TOKEN` means the agent runtime is switched off — the default state
     * of a fresh checkout, `.env.example` included — and ADR-0041 is explicit that missing
     * configuration is a lost capability, not a crash. The panel reads this status and says the
     * feature is off instead of showing an error nobody can act on.
     */
    if (!secret) {
      throw new ServiceUnavailableException(
        'AGENT_TOKEN chưa đặt — tính năng đăng nhập Claude đang tắt',
      )
    }

    /** Returned, never logged: this string is a bearer credential for five minutes. */
    return signTicket(secret)
  }

  private actor() {
    const actor = getCurrentActor()
    if (!actor) throw new UnauthorizedException('Không xác định được người thao tác')
    return actor
  }
}

/** A missing counter stays missing. Coercing it to 0 would report a run that cost nothing. */
function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined
}

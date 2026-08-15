/**
 * The API's side of the wire to `apps/agent-runtime`.
 *
 * Small on purpose: this file knows how to ask for a skill run and how to fail. It does not
 * know what any skill means, and it never parses the model's answer — that stays with the
 * adapter that asked, next to the gates the domain owns.
 */

export interface AgentTelemetry {
  skill: string
  /** Wall clock including process startup on the runtime side. */
  elapsedMs: number
  /** The model round trip alone. `elapsedMs - apiMs` is what the subprocess cost us. */
  apiMs: number
  inputTokens: number
  outputTokens: number
  sessionId: string
}

export interface AgentRunResult {
  text: string
  telemetry: AgentTelemetry
}

export class AgentRuntimeError extends Error {
  constructor(
    /** Mirrors `AgentFailureReason` on the runtime side; `unreachable` is added here. */
    readonly reason: string,
    message: string,
  ) {
    super(message)
    this.name = 'AgentRuntimeError'
  }
}

interface ErrorBody {
  reason?: string
  message?: string
}

export class AgentRuntimeClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    /**
     * Longer than any skill's own timeout so the runtime is the one that decides a run is over.
     * If this fires first the subprocess keeps burning quota with nobody left to receive it.
     */
    private readonly timeoutMs = 240_000,
  ) {}

  async run(skill: string, userPrompt: string): Promise<AgentRunResult> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)

    let response: Response
    try {
      response = await fetch(`${this.baseUrl}/run/${skill}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({ userPrompt }),
        signal: controller.signal,
      })
    } catch (error) {
      /**
       * The container is down, DNS did not resolve, or we aborted. All three mean the same
       * thing to the caller — no answer — and all three must stay distinguishable in the log
       * from "the model returned nothing", which is a legitimate result.
       */
      throw new AgentRuntimeError(
        'unreachable',
        `Không gọi được agent-runtime tại ${this.baseUrl}: ${(error as Error).message}`,
      )
    } finally {
      clearTimeout(timer)
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as ErrorBody
      throw new AgentRuntimeError(
        body.reason ?? `http_${response.status}`,
        body.message ?? `agent-runtime trả mã ${response.status}`,
      )
    }

    return (await response.json()) as AgentRunResult
  }

  /**
   * Used at boot to say in the log which brain is actually running (ADR-0014).
   *
   * `authMode` is nullable because "no credential at all" is a real state of that container and
   * a different one from any of the three ways of being authenticated — it answers /health with
   * `null` there rather than naming a credential it does not have.
   */
  async health(): Promise<{ skills: string[]; authMode: string | null }> {
    const response = await fetch(`${this.baseUrl}/health`)
    if (!response.ok) throw new AgentRuntimeError('unreachable', `health trả mã ${response.status}`)
    return (await response.json()) as { skills: string[]; authMode: string | null }
  }
}

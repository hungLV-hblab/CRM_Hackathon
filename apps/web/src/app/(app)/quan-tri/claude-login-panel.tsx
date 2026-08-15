'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ErrorState } from '@/components/ui/error-state'
import { api } from '@/lib/api-client'

import { ClaudeRunEvidence } from './claude-run-evidence'

/**
 * Logging Claude into the `agent-runtime` container WITHOUT opening a terminal.
 *
 * The flow has three legs and only the first one touches the API:
 *
 *   1. `POST /api/settings/agent-auth-ticket`  — admin-only, returns a five-minute HMAC ticket
 *   2. `POST /agent-auth/login/start`          — straight to `agent-runtime` through Caddy
 *   3. `POST /agent-auth/login/:id/code`       — same, carrying the code the person pasted
 *
 * LEGS 2 AND 3 DO NOT GO THROUGH `api-client.ts`, AND THAT IS NOT AN OVERSIGHT. `api-client.ts` is
 * "everything that talks to the API", and these do not talk to the API — they talk to a different
 * container on a different prefix. Moving them in there for consistency would be one refactor away
 * from routing the OAuth code through the process that holds `DATABASE_URL_SYSTEM`, which is the
 * single thing ADR-0038 exists to prevent.
 *
 * Colour follows the design guidelines: violet (`machine-*`) for what the machine produced — the
 * authorisation URL, the current credential — and the brand button for what the person is about to
 * press. The code input is a person's action, so it is not violet.
 */

async function postToRuntime<T>(path: string, ticket: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: path.endsWith('/credential') ? 'DELETE' : 'POST',
    headers: {
      /** `Ticket`, not `Bearer`. `Bearer` on this container means `AGENT_TOKEN`, which a browser must never hold. */
      Authorization: `Ticket ${ticket}`,
      'Content-Type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const payload = (await res.json().catch(() => ({}))) as { message?: string }
  if (!res.ok) throw new Error(payload.message ?? `agent-runtime trả ${res.status}`)
  return payload as T
}

const AUTH_LABEL: Record<'oauth' | 'api_key' | 'cli_login', string> = {
  oauth: 'Token OAuth (CLAUDE_CODE_OAUTH_TOKEN)',
  api_key: 'API key (ANTHROPIC_API_KEY)',
  cli_login: 'Phiên đăng nhập trong container',
}

export function ClaudeLoginPanel() {
  const queryClient = useQueryClient()
  const [code, setCode] = useState('')

  /**
   * Read through `api`, not from the browser to `agent-runtime`. Caddy forwards exactly one prefix
   * of that container and `/health` is not it — widening that list for a diagnostic would be a
   * second public door onto the process that holds the Claude credential.
   */
  const status = useQuery({
    queryKey: ['agent-status'],
    queryFn: () => api.agentStatus(),
    retry: false,
  })

  const start = useMutation({
    mutationFn: async () => {
      const { ticket } = await api.agentAuthTicket()
      return postToRuntime<{ loginId: string; url: string }>('/agent-auth/login/start', ticket)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agent-status'] }),
  })

  /**
   * SPENDS QUOTA, so it is a mutation and never a query. Wiring it into `useQuery` would make it
   * fire on mount, and every admin opening this page would cost a real run.
   *
   * Errors are not surfaced through `ErrorState`: a failed RUN is a successful REQUEST carrying a
   * reason, and the reason is the whole product here — `ClaudeRunEvidence` turns each one into its
   * own instruction. Only a 503 (feature switched off) throws, and that lands in the block below.
   */
  const check = useMutation({
    mutationFn: () => api.agentCheck(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agent-status'] }),
  })

  const submit = useMutation({
    mutationFn: async (pasted: string) => {
      const { ticket } = await api.agentAuthTicket()
      const loginId = start.data?.loginId ?? status.data?.loginId
      if (!loginId) throw new Error('Phiên đăng nhập đã hết hạn — bấm Huỷ rồi đăng nhập lại')
      return postToRuntime<{ authMode: string | null }>(
        `/agent-auth/login/${loginId}/code`,
        ticket,
        { code: pasted },
      )
    },
    onSuccess: async () => {
      setCode('')
      start.reset()
      await queryClient.invalidateQueries({ queryKey: ['agent-status'] })
      /**
       * The answer to "did that actually work". A login writes a credential; it does not prove the
       * credential is accepted, that quota remains, or that the CLI runs in this image. Without
       * this line the admin's only feedback is a badge that would look exactly the same if the
       * credential were dead — which is the state this whole feature exists to make visible.
       */
      check.mutate()
    },
  })

  /**
   * A real mutation, not fire-and-forget. Resetting the local state first and letting the request
   * fail silently is how the panel ends up showing "start a login" while the server still holds an
   * open session — the next click then answers 409 and the admin has no way to read why. Local
   * state is cleared only after the server has agreed.
   */
  const abort = useMutation({
    mutationFn: async () => {
      const { ticket } = await api.agentAuthTicket()
      return postToRuntime<{ state: string }>('/agent-auth/login/abort', ticket)
    },
    onSuccess: async () => {
      setCode('')
      start.reset()
      await queryClient.invalidateQueries({ queryKey: ['agent-status'] })
    },
    /**
     * A refused code ends the session on the runtime side, so the panel has to come back to the
     * start rather than leave the person typing into a field wired to a session that is gone.
     */
    onError: async () => {
      start.reset()
      await queryClient.invalidateQueries({ queryKey: ['agent-status'] })
    },
  })

  const logout = useMutation({
    mutationFn: async () => {
      const { ticket } = await api.agentAuthTicket()
      return postToRuntime<{ authMode: string | null }>('/agent-auth/credential', ticket)
    },
    onSuccess: async () => {
      start.reset()
      await queryClient.invalidateQueries({ queryKey: ['agent-status'] })
    },
  })

  const authMode = status.data?.authMode ?? null

  /**
   * Derived from the SERVER's state, not just from this component's mutation result.
   *
   * The session lives in `agent-runtime`, not in this tab. Keying the code input off `start.data`
   * alone means a browser reload — or a second tab — shows the "Đăng nhập" button for a session
   * that is already open, and clicking it answers 409 with no way back: the Cancel button lives
   * inside the block that is not being rendered. Five minutes of a stuck panel, in the middle of
   * exactly the demo this feature exists for.
   */
  const awaitingCode = start.data !== undefined || status.data?.loginState === 'awaiting_code'
  const authorizeUrl = start.data?.url ?? status.data?.loginUrl
  /**
   * DISABLED is not BROKEN, and the panel says which (ADR-0041). `enabled: false` means somebody
   * started the stack without `AGENT_TOKEN` — the default state of a fresh checkout — while
   * `reachable: false` means the container is not answering. A red error box on a feature nobody
   * switched on reads as "their stack does not work", which is the misreading that costs a demo.
   */
  const disabled = status.data !== undefined && !status.data.enabled
  const unreachable = status.data !== undefined && !status.data.reachable

  /**
   * The NEWER of the two, not simply the local one. `check.data` is what this tab just produced;
   * `status.data.lastRun` is what the runtime holds, and it is the only one of the two that
   * survives a reload, exists in a second tab, or carries the credential that actually ran. Which
   * is newer flips depending on whether a run came from this tab or somewhere else, so compare
   * their clocks rather than guessing.
   */
  const serverRun = status.data?.lastRun
  const lastRun =
    check.data && (!serverRun || check.data.at >= serverRun.at) ? check.data : serverRun

  return (
    <section className="flex flex-col gap-4 rounded-card border border-ink-200 bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-section font-semibold text-ink-900">Đăng nhập Claude</h2>
        {authMode ? (
          <Badge tone="system">
            <span aria-hidden className="mr-1">
              ●
            </span>
            {AUTH_LABEL[authMode]}
          </Badge>
        ) : (
          <Badge tone="warning">
            <span aria-hidden className="mr-1">
              ■
            </span>
            Chưa có credential
          </Badge>
        )}
      </div>

      {status.isPending && <p className="text-sm text-ink-500">Đang hỏi trạng thái…</p>}

      {disabled && !unreachable && (
        <p className="rounded-card border border-warning/30 bg-warning-surface p-3 text-sm text-warning">
          <code className="rounded bg-ink-100 px-1 py-0.5 text-xs">AGENT_TOKEN</code> chưa đặt trong{' '}
          <code className="rounded bg-ink-100 px-1 py-0.5 text-xs">.env</code> — tính năng này đang
          tắt, không phải hỏng. Đặt biến rồi khởi động lại stack thì nút bên dưới hiện ra.
        </p>
      )}

      {unreachable && (
        <p className="rounded-card border border-warning/30 bg-warning-surface p-3 text-sm text-warning">
          Không gọi được <code className="rounded bg-ink-100 px-1 py-0.5 text-xs">agent-runtime</code>.
          Kiểm tra container có đang chạy không, và{' '}
          <code className="rounded bg-ink-100 px-1 py-0.5 text-xs">AGENT_RUNTIME_URL</code> đã đặt
          chưa. Đây là <strong>không liên lạc được</strong>, khác với đang tắt.
        </p>
      )}

      {/**
       * The trap that makes a successful login look like a broken one. `resolveAuthMode()` reads
       * the environment BEFORE the session on disk (ADR-0042), so with `CLAUDE_CODE_OAUTH_TOKEN`
       * set in `.env` the login below completes, writes its credential, and `authMode` still says
       * `oauth`. Without this notice the only visible outcome is "I logged in and nothing changed".
       */}
      {authMode === 'oauth' && (
        <p className="rounded-card border border-machine-200 bg-machine-50 p-3 text-sm text-machine-700">
          Đang chạy bằng biến môi trường trong <code className="rounded bg-ink-100 px-1 py-0.5 text-xs">.env</code>.
          Biến môi trường <strong>thắng</strong> phiên đăng nhập trên đĩa, nên nếu đăng nhập lại ở
          đây thì credential mới chỉ có hiệu lực sau khi bỏ{' '}
          <code className="rounded bg-ink-100 px-1 py-0.5 text-xs">CLAUDE_CODE_OAUTH_TOKEN</code>{' '}
          khỏi <code className="rounded bg-ink-100 px-1 py-0.5 text-xs">.env</code>.
        </p>
      )}

      {!disabled && (
        <ClaudeRunEvidence
          run={lastRun}
          pending={check.isPending}
          onCheck={() => check.mutate()}
        />
      )}

      {!disabled && !awaitingCode && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              disabled={start.isPending}
              data-testid="claude-login-start"
              onClick={() => start.mutate()}
            >
              {start.isPending ? 'Đang mở phiên…' : 'Đăng nhập Claude'}
            </Button>
            {authMode !== null && (
              <Button
                variant="secondary"
                disabled={logout.isPending}
                data-testid="claude-logout"
                onClick={() => logout.mutate()}
              >
                Đăng xuất
              </Button>
            )}
          </div>
          <p className="text-sm text-ink-600">
            Mở một phiên uỷ quyền với Anthropic ngay trong container — <strong>không cần mở
            terminal</strong>. Mã uỷ quyền đi thẳng tới{' '}
            <code className="rounded bg-ink-100 px-1 py-0.5 text-xs">agent-runtime</code>, không đi
            qua API và không bao giờ được ghi log. Đăng xuất xoá credential do màn này tạo ra; khoá
            đặt sẵn trong <code className="rounded bg-ink-100 px-1 py-0.5 text-xs">.env</code> thì
            không đụng tới.
          </p>
        </div>
      )}

      {awaitingCode && (
        <div className="flex flex-col gap-3 rounded-card border border-machine-200 bg-machine-50 p-4">
          <p className="text-sm text-machine-700">
            <strong>Bước 1.</strong> Mở đường dẫn dưới đây, đăng nhập Anthropic và bấm đồng ý. Trang
            sẽ hiện một mã — copy nó.
          </p>
          <a
            href={authorizeUrl}
            target="_blank"
            rel="noreferrer"
            data-testid="claude-login-url"
            className="flex min-h-[44px] items-center break-all rounded-card bg-surface px-3 py-2 text-sm text-machine-700 underline underline-offset-2"
          >
            {authorizeUrl}
          </a>
          <p className="text-sm text-machine-700">
            <strong>Bước 2.</strong> Dán mã vào đây. Phiên hết hạn sau 5 phút, và{' '}
            <strong>khởi động lại container là mất phiên</strong> — phải bấm Đăng nhập lại từ đầu.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[16rem] flex-1">
              <Input
                label="Mã uỷ quyền"
                value={code}
                autoComplete="off"
                data-testid="claude-login-code"
                onChange={(event) => setCode(event.target.value)}
              />
            </div>
            <Button
              variant="primary"
              disabled={submit.isPending || code.trim() === ''}
              data-testid="claude-login-submit"
              onClick={() => submit.mutate(code)}
            >
              {submit.isPending ? 'Đang xác thực…' : 'Xong'}
            </Button>
            <Button
              variant="ghost"
              disabled={submit.isPending || abort.isPending}
              data-testid="claude-login-abort"
              onClick={() => abort.mutate()}
            >
              {abort.isPending ? 'Đang huỷ…' : 'Huỷ'}
            </Button>
          </div>
        </div>
      )}

      {start.isError && <ErrorState error={start.error} fallback="Không mở được phiên đăng nhập" />}
      {/**
       * Rendered OUTSIDE the `awaitingCode` block on purpose: a refused code ends the session, so
       * that block disappears at the same moment — and an error message that unmounts itself is
       * how somebody ends up staring at a panel that silently went back to the start.
       */}
      {submit.isError && (
        <ErrorState error={submit.error} fallback="Mã uỷ quyền không được chấp nhận" />
      )}
      {abort.isError && <ErrorState error={abort.error} fallback="Không huỷ được phiên đăng nhập" />}
      {logout.isError && <ErrorState error={logout.error} fallback="Không xoá được credential" />}
      {/**
       * Only reached when the endpoint itself refuses — a 503 because the feature is switched off.
       * A failed RUN comes back as a successful response carrying a reason and is rendered inside
       * the evidence block above, where it can be paired with the instruction that matches it.
       */}
      {check.isError && <ErrorState error={check.error} fallback="Không chạy được lượt kiểm tra" />}
    </section>
  )
}

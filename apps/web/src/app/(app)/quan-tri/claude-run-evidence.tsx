'use client'

import type { AgentRunSummaryDto } from '@crm/contracts'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

/**
 * The block that turns "Claude Code đang hoạt động" from an assertion into something a person can
 * check.
 *
 * The badge above this block reports which credential EXISTS. It cannot report whether that
 * credential still works, whether the subscription has quota left, or whether the `claude` binary
 * made it into the image — `claude-cli.ts` says so outright, and correctly, because judging a
 * credential is not its job. The cost was that four unrelated failures all rendered as the same
 * green dot. This block shows the LAST RUN instead, so the claim carries its own evidence: the
 * model's own words, the clock, the token counts, the session.
 *
 * THREE STATES, NOT TWO. "Chưa kiểm tra lần nào" is drawn neutral, never red — a container that
 * was just rebuilt genuinely has not run anything, and painting an unknown as a failure is the
 * same lie as painting an expired credential green.
 *
 * Colour follows the design guidelines: violet (`machine-*`) for what the machine produced, the
 * brand button for what the person is about to press.
 */

const AUTH_LABEL: Record<string, string> = {
  oauth: 'Token OAuth trong .env',
  api_key: 'API key trong .env',
  cli_login: 'Phiên đăng nhập trong container',
}

/**
 * Every failure gets its own sentence AND its own instruction, because the instructions genuinely
 * conflict: a refused credential means log in again, an exhausted quota means specifically do NOT
 * press the button again. One shared "đã xảy ra lỗi" would put an admin on the wrong path half
 * the time, which is the whole reason this feature was built.
 */
const FAILURE: Record<string, { title: string; action: string }> = {
  not_authenticated: {
    title: 'Có credential nhưng bị từ chối — hết hạn hoặc đã bị thu hồi',
    action: 'Bấm Đăng nhập Claude ở trên để lấy credential mới.',
  },
  quota_exhausted: {
    title: 'Hết lượt của gói đăng ký',
    action: 'Chờ tới lúc reset. Bấm lại ngay chỉ làm giới hạn siết chặt thêm.',
  },
  spawn_failed: {
    title: 'Không chạy được lệnh claude trong container',
    action: 'Đây là lỗi image, không phải lỗi đăng nhập — dựng lại agent-runtime.',
  },
  timeout: {
    title: 'Không kịp trả lời trong hạn cho phép',
    action: 'Thử lại một lần. Nếu lặp lại thì xem mạng của container.',
  },
  parse_failed: {
    title: 'Claude CLI trả về thứ không đọc được',
    action: 'Xem docker compose logs agent-runtime để biết nó in ra gì.',
  },
  unreachable: {
    title: 'Không gọi được agent-runtime',
    action: 'Kiểm tra container có chạy không, và AGENT_RUNTIME_URL đã đặt chưa.',
  },
  disabled: {
    title: 'Tính năng đang tắt',
    action: 'Đặt AGENT_TOKEN trong .env rồi khởi động lại stack.',
  },
}

function clock(at: number): string {
  return new Date(at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`
}

export function ClaudeRunEvidence({
  run,
  pending,
  onCheck,
}: {
  run: AgentRunSummaryDto | undefined
  pending: boolean
  onCheck: () => void
}) {
  const failure = run && !run.ok ? (FAILURE[run.reason ?? ''] ?? null) : null

  return (
    <div
      data-testid="claude-check-result"
      className="flex flex-col gap-3 rounded-card border border-ink-200 bg-ink-50 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-ink-900">Lượt chạy gần nhất</h3>
          {run === undefined && <Badge tone="neutral">Chưa kiểm tra lần nào</Badge>}
          {run?.ok === true && <Badge tone="success">Đã chạy thật · {clock(run.at)}</Badge>}
          {run?.ok === false && <Badge tone="warning">Không chạy được · {clock(run.at)}</Badge>}
        </div>
        <Button
          variant="primary"
          disabled={pending}
          data-testid="claude-check-run"
          onClick={onCheck}
        >
          {pending ? 'Đang kiểm tra…' : 'Kiểm tra ngay'}
        </Button>
      </div>

      {run === undefined && (
        <p className="text-sm text-ink-600">
          Có credential <strong>không có nghĩa là chạy được</strong>: credential hết hạn, bị thu
          hồi, hết lượt hay thiếu lệnh trong container đều trông giống hệt nhau ở phần trạng thái
          bên trên. Bấm để chạy thật một lượt và xem kết quả.
        </p>
      )}

      {run?.ok === true && (
        <dl className="flex flex-col gap-1 text-sm text-machine-700">
          <div className="flex flex-wrap gap-2">
            <dt className="text-ink-600">Model trả lời:</dt>
            <dd className="font-medium">“{run.text}”</dd>
          </div>
          {run.authMode && (
            <div className="flex flex-wrap gap-2">
              <dt className="text-ink-600">Chạy bằng:</dt>
              <dd>{AUTH_LABEL[run.authMode] ?? run.authMode}</dd>
            </div>
          )}
          {run.elapsedMs !== undefined && (
            <div className="flex flex-wrap gap-2">
              <dt className="text-ink-600">Thời gian:</dt>
              {/**
               * Split, never summed. The gap between the two IS the process startup cost, which is
               * the one number worth watching for this transport — `http-routes.ts` keeps them
               * apart in its own log for the same reason.
               */}
              <dd>
                {seconds(run.elapsedMs)} tổng
                {run.apiMs !== undefined && (
                  <>
                    {' '}
                    — {seconds(run.apiMs)} gọi model, {seconds(run.elapsedMs - run.apiMs)} khởi động
                  </>
                )}
              </dd>
            </div>
          )}
          {run.inputTokens !== undefined && (
            <div className="flex flex-wrap gap-2">
              <dt className="text-ink-600">Chi phí:</dt>
              <dd>
                {run.inputTokens.toLocaleString('vi-VN')} token vào / {run.outputTokens ?? 0} ra
                {run.sessionId && ` · session ${run.sessionId.slice(0, 8)}…`}
              </dd>
            </div>
          )}
          <p className="pt-1 text-xs text-ink-500">
            Skill <code className="rounded bg-ink-100 px-1 py-0.5">{run.skill}</code> — bất kỳ lượt
            chạy nào cũng được ghi ở đây, không riêng lượt bấm tay.
          </p>
        </dl>
      )}

      {run?.ok === false && (
        <div data-testid="claude-check-error" className="flex flex-col gap-1 text-sm">
          <p className="font-medium text-warning">{failure?.title ?? 'Lượt chạy thất bại'}</p>
          <p className="text-ink-700">{failure?.action ?? run.message}</p>
          {/**
           * The raw message stays visible under the translated one. The mapping above covers the
           * reasons that exist today; an unrecognised one must still leave something an operator
           * can act on rather than a polished sentence that says nothing.
           */}
          {failure && run.message && <p className="text-xs text-ink-500">{run.message}</p>}
        </div>
      )}
    </div>
  )
}

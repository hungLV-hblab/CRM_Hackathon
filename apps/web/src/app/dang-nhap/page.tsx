'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'

import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '@crm/contracts'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ErrorState } from '@/components/ui/error-state'
import { api, ApiError } from '@/lib/api-client'
import { cn } from '@/lib/utils'

/**
 * Two tabs, one login flow. The demo tab exists for judging: one press signs in as one of the
 * handed-out accounts. It does NOT bypass anything — the buttons call the same `api.login`
 * with the organizer-published default password, so the cookie, the middleware and the audit
 * story are identical to a typed login. Remove the tab after the hackathon and nothing else
 * changes.
 */
export default function LoginPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'password' | 'demo'>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function doLogin(loginEmail: string, loginPassword: string) {
    setError(null)
    setPending(true)
    try {
      await api.login(loginEmail, loginPassword)
      /**
       * `refresh()` after `push()` is not redundant. The middleware decided this request
       * before the login call set the cookie, so the router cache still holds the pre-login
       * answer; without the refresh the user lands on a page the middleware would now allow
       * but the cache still redirects away from.
       */
      router.push('/cong-ty')
      router.refresh()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Không đăng nhập được')
      setPending(false)
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    void doLogin(email, password)
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-card border border-ink-200 bg-surface p-6">
        <h1 className="text-xl font-semibold">Đăng nhập</h1>

        <div role="tablist" aria-label="Cách đăng nhập" className="flex rounded-control border border-ink-200 p-1">
          <TabButton selected={tab === 'password'} onClick={() => setTab('password')}>
            Mật khẩu
          </TabButton>
          <TabButton selected={tab === 'demo'} onClick={() => setTab('demo')}>
            Tài khoản demo
          </TabButton>
        </div>

        {tab === 'password' ? (
          <form onSubmit={onSubmit} role="tabpanel" className="flex flex-col gap-4">
            <Input
              label="Email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Input
              label="Mật khẩu"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Button type="submit" disabled={pending}>
              {pending ? 'Đang đăng nhập…' : 'Đăng nhập'}
            </Button>
          </form>
        ) : (
          <div role="tabpanel" className="flex flex-col gap-2">
            <p className="text-sm text-ink-600">
              Danh sách tài khoản BTC phát cho việc chấm — bấm là vào thẳng.
            </p>
            {DEMO_ACCOUNTS.map((account) => (
              <Button
                key={account.email}
                variant="secondary"
                disabled={pending}
                onClick={() => void doLogin(account.email, DEMO_PASSWORD)}
                className="justify-between"
              >
                <span>{account.name}</span>
                <span className="text-xs text-ink-600">
                  {account.role === 'admin' ? 'Quản trị' : 'Sales'}
                </span>
              </Button>
            ))}
          </div>
        )}

        {/* `role="alert"` so the failure is announced, not just drawn in red. */}
        {error && <ErrorState error={error} fallback="Không đăng nhập được" />}
      </div>
    </main>
  )
}

function TabButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={cn(
        'min-h-11 flex-1 cursor-pointer rounded-control text-sm font-medium transition-colors',
        selected ? 'bg-brand-400 text-ink-900' : 'text-ink-600 hover:bg-ink-100',
      )}
    >
      {children}
    </button>
  )
}

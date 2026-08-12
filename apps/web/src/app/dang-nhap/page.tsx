'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api, ApiError } from '@/lib/api-client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setPending(true)
    try {
      await api.login(email, password)
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

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form
        onSubmit={onSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6"
      >
        <h1 className="text-xl font-semibold">Đăng nhập</h1>

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

        {/* `role="alert"` so the failure is announced, not just drawn in red. */}
        {error && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <Button type="submit" disabled={pending}>
          {pending ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </Button>
      </form>
    </main>
  )
}

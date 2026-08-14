import { AiDisabledBanner } from '@/components/ai-disabled-banner'
import { AppShell } from '@/components/shell/app-shell'

/**
 * Everything inside `(app)` shares the shell. The group's parentheses keep it out of the URL,
 * so `/cong-ty` is still `/cong-ty` — that is the whole reason this indirection exists rather
 * than a `usePathname()` branch in the root layout.
 *
 * The AI banner is mounted HERE, once, above the shell, and that placement is what T-9 leans on:
 * put it on the four screens that show AI output instead and the day one of them is forgotten the
 * acceptance check fails for the screen nobody remembered rather than for the product. It sits
 * outside the login route for the same reason the shell does — there is no session to read yet.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AiDisabledBanner />
      <AppShell>{children}</AppShell>
    </>
  )
}

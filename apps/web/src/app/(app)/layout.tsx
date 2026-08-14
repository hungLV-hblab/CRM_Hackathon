import { AppShell } from '@/components/shell/app-shell'

/**
 * Everything inside `(app)` shares the shell. The group's parentheses keep it out of the URL,
 * so `/cong-ty` is still `/cong-ty` — that is the whole reason this indirection exists rather
 * than a `usePathname()` branch in the root layout.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}

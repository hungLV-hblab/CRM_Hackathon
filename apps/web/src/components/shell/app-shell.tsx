import { AppFooter } from './app-footer'
import { AppHeader } from './app-header'
import { AppSidebar } from './app-sidebar'

/**
 * Header on top, sidebar beside, page in the middle. Applied by `app/(app)/layout.tsx`, so
 * every route inside the group gets it and `/dang-nhap`, which sits outside the group, does
 * not — a login screen must not offer navigation to someone who has not authenticated.
 *
 * The skip link is first in the tab order on purpose: without it, a keyboard user tabs
 * through the whole navigation on every single screen before reaching the content.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#noi-dung-chinh"
        className="sr-only rounded-control bg-brand-400 px-4 py-2 font-medium text-ink-900 focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[var(--z-toast)]"
      >
        Bỏ qua điều hướng
      </a>
      <AppHeader />
      <div className="flex flex-1">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <div id="noi-dung-chinh" className="flex-1">
            {children}
          </div>
          <AppFooter />
        </div>
      </div>
    </div>
  )
}

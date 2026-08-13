import { NavList } from './nav-list'

/**
 * Desktop navigation. Below 1024px it is gone entirely and the header's drawer takes over —
 * the same `NavList`, so there is no second list to keep in sync.
 *
 * No collapse-to-icon-rail. A rail is icon-only navigation, which design-guidelines rules
 * out: six unlabelled glyphs make Sales guess. The width it would have saved is not worth
 * the guessing.
 */
export function AppSidebar() {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-ink-200 bg-card lg:block">
      <div className="sticky top-14" data-tour="sidebar">
        <NavList />
      </div>
    </aside>
  )
}

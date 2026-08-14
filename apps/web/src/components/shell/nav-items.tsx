import {
  Bell,
  BookOpen,
  Building2,
  Eye,
  Inbox,
  LayoutDashboard,
  ScrollText,
  Target,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  /** Set for the item that carries the pending-proposal count. */
  showsPendingCount?: boolean
}

/**
 * THE navigation list. One array, read by the sidebar and by the mobile drawer, so the two
 * cannot drift apart — before this file existed, three screens each drew their own set of
 * links and no two agreed.
 *
 * Every entry must point at a route that EXISTS. An item aimed at an unbuilt route renders
 * Next's 404 inside the shell, which reads as a broken shell rather than as a missing screen,
 * and `e2e/app-shell-navigation.spec.ts` fails the build for it on purpose.
 *
 * "Quản trị" points straight at `/quan-tri/nhat-ky-vong-quet` because that is the only screen
 * living under `/quan-tri` — there is no index page there, and aiming the item at the bare
 * segment would 404. When the admin dashboard adds `/quan-tri/page.tsx`, this href moves up to
 * it and the log becomes a link inside that screen rather than a second top-level item.
 *
 * Icons carry labels, never replace them. Eight unlabelled glyphs is a guessing game, and
 * design-guidelines forbids icon-only navigation outright.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: '/cong-ty', label: 'Công ty', icon: Building2 },
  { href: '/dang-theo-doi', label: 'Đang theo dõi', icon: Eye },
  { href: '/co-hoi', label: 'Cơ hội', icon: Target },
  { href: '/hang-doi', label: 'Hàng đợi', icon: Inbox, showsPendingCount: true },
  { href: '/tong-quan', label: 'Tổng quan', icon: LayoutDashboard },
  { href: '/thong-bao', label: 'Thông báo', icon: Bell },
  { href: '/quan-tri/nhat-ky-vong-quet', label: 'Nhật ký vòng quét', icon: ScrollText },
  { href: '/huong-dan', label: 'Hướng dẫn', icon: BookOpen },
]

/**
 * Longest-prefix match, so `/cong-ty/<id>` still lights up "Công ty". A plain equality check
 * would leave the sidebar with nothing marked on every detail screen — precisely where a
 * reader most needs to know where they are.
 */
export function activeHref(pathname: string): string | undefined {
  return NAV_ITEMS.map((item) => item.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0]
}

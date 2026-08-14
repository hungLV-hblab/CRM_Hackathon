'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { NAV_ITEMS } from './nav-items'

/**
 * Where am I, and what is one level up. This replaces the hand-rolled "← Công ty" links that
 * three screens had each invented for themselves — none of which agreed on where "up" was.
 *
 * A detail route (`/cong-ty/<id>`) shows its section and then a generic "Chi tiết" rather
 * than the record's name: the name lives in the page's own `<h1>`, and the shell has no way
 * to know it without a second fetch. Rule 4 again — better a truthful generic word than a
 * confident wrong one.
 */
export function Breadcrumbs() {
  const pathname = usePathname()
  const section = NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  )
  if (!section) return null

  const isDetail = pathname !== section.href

  return (
    <nav aria-label="Đường dẫn" className="min-w-0">
      <ol className="flex items-center gap-2 text-sm">
        <li className="truncate">
          {isDetail ? (
            <Link href={section.href} className="text-ink-600 hover:text-ink-900">
              {section.label}
            </Link>
          ) : (
            <span className="font-medium text-ink-900">{section.label}</span>
          )}
        </li>
        {isDetail && (
          <>
            <li aria-hidden className="text-ink-400">
              /
            </li>
            <li className="truncate font-medium text-ink-900">Chi tiết</li>
          </>
        )}
      </ol>
    </nav>
  )
}

'use client'

import { useQueryClient } from '@tanstack/react-query'
import { LogOut, Menu, UserRound } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { api } from '@/lib/api-client'

import { AiStatusPill } from './ai-status-pill'
import { Breadcrumbs } from './breadcrumbs'
import { NavList } from './nav-list'

/**
 * Sticky header: brand, where-you-are, machine status, and the account menu.
 *
 * The hamburger is the ONLY way to the navigation below 1024px — deliberately a drawer and
 * not a bottom bar, because the nav has more entries than the five a bottom bar can hold, and
 * mixing a bottom bar with a sidebar gives one product two navigation patterns.
 */
export function AppHeader() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [isDrawerOpen, setDrawerOpen] = useState(false)

  async function onLogout() {
    await api.logout()
    // The next user of this browser must not inherit the previous one's cached rows.
    queryClient.clear()
    router.push('/dang-nhap')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-[var(--z-sticky)] border-b border-ink-200 bg-card">
      <div className="flex h-14 items-center gap-3 px-3 sm:px-4">
        <Sheet open={isDrawerOpen} onOpenChange={setDrawerOpen}>
          <SheetTrigger
            aria-label="Mở điều hướng"
            className="inline-flex size-11 items-center justify-center rounded-pill text-ink-700 transition-colors hover:bg-ink-100 lg:hidden"
          >
            <Menu className="size-5" aria-hidden />
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            {/* Radix requires a title for the dialog's accessible name; it is visually the
                drawer's own heading rather than a hidden string nobody maintains. */}
            <SheetTitle className="px-4 pt-4 text-base">Điều hướng</SheetTitle>
            <NavList onNavigate={() => setDrawerOpen(false)} />
          </SheetContent>
        </Sheet>

        {/* Amber is a SURFACE here, never text: brand-400 on white is 1.62:1. */}
        <span className="hidden items-center gap-2 sm:inline-flex">
          <span className="rounded-control bg-brand-400 px-2 py-1 text-sm font-bold text-ink-900">
            HBLAB
          </span>
          <span className="text-sm font-semibold text-ink-700">CRM</span>
        </span>

        <span aria-hidden className="hidden h-5 w-px bg-ink-200 sm:block" />

        <Breadcrumbs />

        {/* Anchored on the header row, not on the pill: the pill is absent for a Sales
            session (see AiStatusPill), and a tour step anchored to a missing element is
            skipped in silence. */}
        <div data-tour="ai-status" className="ml-auto flex items-center gap-2">
          <AiStatusPill />

          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Tài khoản"
              className="inline-flex size-11 items-center justify-center rounded-pill text-ink-700 transition-colors hover:bg-ink-100"
            >
              <UserRound className="size-5" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Tài khoản</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onLogout} className="min-h-11">
                <LogOut className="size-4" aria-hidden />
                Đăng xuất
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}

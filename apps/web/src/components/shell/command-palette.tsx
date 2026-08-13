'use client'

import { useQuery } from '@tanstack/react-query'
import { Command } from 'cmdk'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { Dialog } from '@/components/ui/dialog'
import { api } from '@/lib/api-client'

import { NAV_ITEMS } from './nav-items'

/**
 * ⌘K / Ctrl+K — jump to a screen, a company, or a deal without reaching for the sidebar.
 *
 * It adds NO endpoint. Companies and deals come from the `['companies']` and
 * `['opportunities']` query keys the screens already fill, so opening the palette usually
 * costs nothing and never invents a second source for a list that already exists.
 *
 * Written by hand rather than pulled from `shadcn add command`: the CLI writes into
 * `components/ui/` and asked to overwrite `dialog.tsx`, which now carries the Radix migration
 * and its reasoning. Accepting that prompt would have silently undone it.
 */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()

  // `enabled: open` — the palette never triggers a fetch for a panel nobody opened. If a
  // screen already loaded these, the cache answers instantly.
  const companies = useQuery({
    queryKey: ['companies', {}],
    queryFn: () => api.listCompanies(),
    enabled: open,
  })
  const opportunities = useQuery({
    queryKey: ['opportunities'],
    queryFn: () => api.listOpportunities(),
    enabled: open,
  })

  function go(href: string) {
    onOpenChange(false)
    router.push(href)
  }

  return (
    <Dialog open={open} onClose={() => onOpenChange(false)} title="Đi nhanh tới">
      <Command label="Đi nhanh tới" className="flex flex-col gap-3">
        <Command.Input
          autoFocus
          placeholder="Gõ tên màn hình, công ty hoặc cơ hội…"
          className="w-full rounded-control border border-ink-300 bg-card px-3 py-2 text-sm outline-none focus:border-ink-900"
        />
        <Command.List className="max-h-80 overflow-y-auto">
          <Command.Empty className="px-2 py-6 text-center text-sm text-ink-500">
            Không có kết quả nào khớp.
          </Command.Empty>

          <PaletteGroup heading="Màn hình">
            {NAV_ITEMS.map((item) => (
              <PaletteItem key={item.href} value={item.label} onSelect={() => go(item.href)}>
                {item.label}
              </PaletteItem>
            ))}
          </PaletteGroup>

          {(companies.data ?? []).length > 0 && (
            <PaletteGroup heading="Công ty">
              {(companies.data ?? []).map((company) => (
                <PaletteItem
                  key={company.id}
                  value={company.name}
                  onSelect={() => go(`/cong-ty/${company.id}`)}
                >
                  {company.name}
                </PaletteItem>
              ))}
            </PaletteGroup>
          )}

          {(opportunities.data ?? []).length > 0 && (
            <PaletteGroup heading="Cơ hội">
              {(opportunities.data ?? []).map((opportunity) => (
                <PaletteItem
                  key={opportunity.id}
                  value={`${opportunity.name} ${opportunity.companyName}`}
                  onSelect={() => go(`/cong-ty/${opportunity.companyId}`)}
                >
                  <span>{opportunity.name}</span>
                  <span className="text-ink-500"> · {opportunity.companyName}</span>
                </PaletteItem>
              ))}
            </PaletteGroup>
          )}
        </Command.List>
      </Command>
    </Dialog>
  )
}

function PaletteGroup({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <Command.Group
      heading={heading}
      className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-ink-500 [&_[cmdk-group-heading]]:uppercase"
    >
      {children}
    </Command.Group>
  )
}

function PaletteItem({
  value,
  onSelect,
  children,
}: {
  value: string
  onSelect: () => void
  children: React.ReactNode
}) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="flex min-h-11 cursor-pointer items-center rounded-control px-2 text-sm text-ink-800 data-[selected=true]:bg-ink-100 data-[selected=true]:text-ink-900"
    >
      {children}
    </Command.Item>
  )
}

/** Cmd/Ctrl+K from anywhere. Returns the open state so the header can also open it by click. */
export function useCommandPaletteShortcut() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== 'k' || !(event.metaKey || event.ctrlKey)) return
      // Chrome puts the address bar on this chord; the app is claiming it deliberately, which
      // is the near-universal convention for a command palette.
      event.preventDefault()
      setOpen((previous) => !previous)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return [open, setOpen] as const
}

import type { Metadata } from 'next'
import { Be_Vietnam_Pro } from 'next/font/google'

import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import { QueryProvider } from '@/lib/query-provider'

/**
 * Self-hosted at build time by `next/font`, so the running app makes no request to Google —
 * one less thing to fail on a demo machine behind a corporate proxy. `swap` keeps text
 * readable while the face loads instead of flashing invisible.
 */
const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['vietnamese', 'latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-be-vietnam-pro',
})

export const metadata: Metadata = {
  title: 'CRM HBLAB',
  description: 'CRM nội bộ cho đội Sales ITO',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={beVietnamPro.variable}>
      <body>
        <QueryProvider>{children}</QueryProvider>
        {/* Outside the route group on purpose: a failed login is worth a toast too. */}
        <Toaster />
      </body>
    </html>
  )
}

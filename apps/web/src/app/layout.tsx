import type { Metadata } from 'next'

import './globals.css'
import { QueryProvider } from '@/lib/query-provider'

export const metadata: Metadata = {
  title: 'CRM HBLAB',
  description: 'CRM nội bộ cho đội Sales ITO',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  )
}

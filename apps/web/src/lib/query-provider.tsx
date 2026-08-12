'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

/**
 * Created inside `useState` rather than at module scope: a module-level client is shared by
 * every request on the server and would leak one user's cached data into another's page.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // A 401 means the session is gone; retrying it just delays the redirect.
            retry: false,
            refetchOnWindowFocus: false,
          },
        },
      }),
  )

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

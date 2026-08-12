import { fileURLToPath } from 'node:url'

import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /**
   * Set from the very start, never switched on late: `standalone` changes how Next bundles
   * and how it resolves static assets. Enabling it late tends to produce a blank page with
   * 404s on CSS and no obvious cause. It is also what lets the production image ship only
   * `.next/standalone` instead of the whole `node_modules` (spec 7.3 wants a real build, not
   * a dev server).
   */
  output: 'standalone',
  /**
   * Monorepo: Next needs the workspace root to trace the right files into the standalone
   * build. Via `fileURLToPath`, not `URL.pathname` — on Windows the latter yields
   * `/D:/WorkSpace/...` with a leading slash, which is not a path any tool can open.
   */
  outputFileTracingRoot: fileURLToPath(new URL('../..', import.meta.url)),
  transpilePackages: ['@crm/contracts'],
}

export default nextConfig

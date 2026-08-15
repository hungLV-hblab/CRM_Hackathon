import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { parseZipDataset } from './parse-zip-dataset'
import type { SeedDataset } from './seed-dataset'

const ZIP_PATH = resolve(__dirname, '../../seed-assets/hackathon-1-data.zip')

let cached: SeedDataset | null = null

/**
 * The dataset checked into the repo — used by `pnpm seed` (CLI) and by
 * `resolve-observation-source.ts` to compute I-16's `SEED_COMPANY_IDS`. Synchronous and cached
 * on purpose: `resolve-observation-source.ts` calls this at MODULE LOAD time, and that has to
 * stay a pure, DB-free computation (found during `/ck:plan validate` — see the comment on
 * `SEED_COMPANY_IDS`). `parseZipDataset` is fully synchronous for exactly this reason.
 */
export function loadDefaultDataset(): SeedDataset {
  if (!cached) {
    cached = parseZipDataset(readFileSync(ZIP_PATH))
  }
  return cached
}

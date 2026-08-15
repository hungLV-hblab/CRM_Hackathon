import { Injectable, Logger } from '@nestjs/common'

import type { ImportSummaryDto } from '@crm/contracts'
import { parseZipDataset, seed, type SeedDataset } from '@crm/db'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable ${name}`)
  return value
}

/**
 * Spec 7 condition 5 — nạp bộ dữ liệu BTC qua giao diện, không gõ tay, không sửa mã, nạp lại
 * cùng file thì về đúng trạng thái ban đầu.
 *
 * Reads `DATABASE_URL_OWNER` directly and opens a connection ONLY for the duration of this one
 * call, via the exact same `seed()` the CLI uses — no persistent DI token holding a `crm_owner`
 * pool open for the process lifetime (a deliberate change from the original brainstorm design,
 * made during planning: a short-lived connection is a smaller privilege surface than a
 * long-lived one). `DATABASE_URL_OWNER` is already present in this container's environment
 * (`infra/docker-compose.yml`'s `&database-urls` anchor, shared with `migrate`/`worker`) — this
 * is the ONE file in `apps/api` allowed to read it (enforced by
 * `owner-credential-scoped-to-import.test.ts`).
 *
 * This is a human admin action, same class as running `pnpm seed` from a terminal — not an AI
 * write. See ADR-0042 for why this exception to "the API never uses `crm_owner`" is safe.
 */
@Injectable()
export class AdminImportService {
  private readonly logger = new Logger('AdminImportService')

  async importZip(buffer: Buffer): Promise<ImportSummaryDto> {
    const dataset: SeedDataset = parseZipDataset(buffer)
    await seed(requireEnv('DATABASE_URL_OWNER'), dataset)

    if (dataset.warnings.length > 0) {
      this.logger.warn(`Cảnh báo lúc nạp dữ liệu:\n${dataset.warnings.map((w) => `  - ${w}`).join('\n')}`)
    }
    this.logger.log(
      `Nạp xong: ${dataset.companies.length} công ty, ${dataset.contacts.length} liên hệ, ` +
        `${dataset.opportunities.length} cơ hội, ${dataset.snapshotPages.length} trang bản chụp.`,
    )

    return {
      companies: dataset.companies.length,
      contacts: dataset.contacts.length,
      opportunities: dataset.opportunities.length,
      snapshotPages: dataset.snapshotPages.length,
      warnings: dataset.warnings,
    }
  }
}

/**
 * The HTML content that used to live in `apps/api/src/ai/demo-snapshots.ts` as hand-typed
 * TypeScript constants (ADR-0021), before that class became DB-backed (`snapshot_pages`,
 * migration 0013). A handful of integration tests build their own throwaway company fixtures
 * via raw SQL and rely on this exact content — messy HTML on purpose (nested tags, `&nbsp;`,
 * a `<script>` block) because `normalizeSnapshotText` has to survive it, and the shared
 * funding paragraph because the company-type lens test needs the SAME news read under two
 * different lenses.
 *
 * Not used by the product or by `pnpm seed` — test-only, kept in one place so the 6+ test
 * files that need it do not each retype their own copy.
 */

export const SAKURA = 'aaaaaaaa-0001-4000-8000-000000000001'
export const NIMBUS = 'aaaaaaaa-0002-4000-8000-000000000002'
export const KITEFIN = 'aaaaaaaa-0003-4000-8000-000000000003'
export const OHARA = 'aaaaaaaa-0004-4000-8000-000000000004'
export const MARLIN = 'aaaaaaaa-0005-4000-8000-000000000005'

function fundingParagraph(companyName: string): string {
  return `<p>${companyName} vừa hoàn tất vòng Series B huy động 20 triệu USD do Mizuho Capital dẫn dắt.</p>`
}

function factsBlock(facts: {
  industry: string
  headquarters: string
  size: string
  website: string
}): string {
  return `<ul class="facts">
        <li>Ngành: ${facts.industry}</li>
        <li>Trụ sở chính: ${facts.headquarters}</li>
        <li>Quy mô: ${facts.size} nhân viên</li>
        <li>Website: ${facts.website}</li>
        </ul>`
}

export interface LegacyPage {
  sourceUrl: string
  before: string
  after: string
}

export const LEGACY_SNAPSHOTS: Record<string, LegacyPage> = {
  [SAKURA]: {
    sourceUrl: 'https://sakura-mfg.example.jp/news',
    before: `<html><head><title>Tin công ty</title><script>track('pageview')</script></head>
        <body><div class="news">
        <h1>Sakura Manufacturing KK</h1>
        <p>Chúng tôi là nhà sản xuất linh kiện chính xác phục vụ ngành ô tô từ năm 1978.</p>
        ${factsBlock({
          industry: 'Sản xuất linh kiện',
          headquarters: 'Aichi, Nhật Bản',
          size: '500-1000',
          website: 'https://sakura-mfg.example.jp',
        })}
        <p>Nhà máy tại Aichi hiện vận hành ba dây chuyền&nbsp;lắp ráp.</p>
        </div></body></html>`,
    after: `<html><head><title>Tin công ty</title><script>track('pageview')</script></head>
        <body><div class="news">
        <h1>Sakura Manufacturing KK</h1>
        <p>Chúng tôi là nhà sản xuất linh kiện chính xác phục vụ ngành ô tô từ năm 1978.</p>
        ${fundingParagraph('Sakura')}
        ${factsBlock({
          industry: 'Sản xuất linh kiện',
          headquarters: 'Aichi, Nhật Bản',
          size: '1000+',
          website: 'https://sakura-mfg.example.jp',
        })}
        <p>Nhà máy tại Aichi hiện vận hành ba dây chuyền&nbsp;lắp ráp.</p>
        </div></body></html>`,
  },

  [NIMBUS]: {
    sourceUrl: 'https://nimbus.example.sg/press',
    before: `<html><body><article>
        <h2>Nimbus Cloud Solutions</h2>
        <p>Nimbus cung cấp dịch vụ tích hợp hệ thống cho khách hàng khu vực ASEAN.</p>
        ${factsBlock({
          industry: 'Tích hợp hệ thống',
          headquarters: 'Singapore',
          size: '100-500',
          website: 'https://nimbus.example.sg',
        })}
        </article></body></html>`,
    after: `<html><body><article>
        <h2>Nimbus Cloud Solutions</h2>
        <p>Nimbus cung cấp dịch vụ tích hợp hệ thống cho khách hàng khu vực ASEAN.</p>
        <p>Nimbus bổ nhiệm bà Tan Wei Ling làm Giám đốc Công nghệ mới từ tháng này.</p>
        <ul><li>Công ty cũng đang tuyển thêm 40 kỹ sư nền tảng trong năm nay.</li></ul>
        ${factsBlock({
          industry: 'Tích hợp hệ thống',
          headquarters: 'Singapore',
          size: '100-500',
          website: 'https://nimbus.example.sg',
        })}
        </article></body></html>`,
  },

  [KITEFIN]: {
    sourceUrl: 'https://kitefin.example.com/blog',
    before: `<html><body><p>Kitefin Analytics giúp doanh nghiệp đo lường hiệu quả vận hành.</p>
        ${factsBlock({
          industry: 'Phân tích dữ liệu',
          headquarters: 'Boston, Hoa Kỳ',
          size: '50-100',
          website: 'https://kitefin.example.com',
        })}
        </body></html>`,
    after: `<html><body>
        <p>Kitefin Analytics giúp doanh nghiệp đo lường hiệu quả vận hành.</p>
        <p>Kitefin mở rộng sang thị trường Nhật Bản với văn phòng đầu tiên tại Tokyo.</p>
        ${factsBlock({
          industry: 'Phân tích dữ liệu',
          headquarters: 'Boston, Hoa Kỳ',
          size: '50-100',
          website: 'https://kitefin.example.com',
        })}
        </body></html>`,
  },

  [MARLIN]: {
    sourceUrl: 'https://marlin-labs.example.com/news',
    before: `<html><body><section>
        <h1>Marlin Product Labs</h1>
        <p>Marlin phát triển bộ công cụ quản lý kho theo mô hình thuê bao cho ngành bán lẻ.</p>
        ${factsBlock({
          industry: 'Phần mềm đóng gói',
          headquarters: 'Singapore',
          size: '50-100',
          website: 'https://marlin-labs.example.com',
        })}
        </section></body></html>`,
    after: `<html><body><section>
        <h1>Marlin Product Labs</h1>
        <p>Marlin phát triển bộ công cụ quản lý kho theo mô hình thuê bao cho ngành bán lẻ.</p>
        ${fundingParagraph('Marlin')}
        ${factsBlock({
          industry: 'Phần mềm đóng gói',
          headquarters: 'Singapore',
          size: '50-100',
          website: 'https://marlin-labs.example.com',
        })}
        </section></body></html>`,
  },

  /** Ohara: NO readable snapshot in either variant — the `fetch_status = 'failed'` path. */
  [OHARA]: {
    sourceUrl: 'https://ohara-retail.example.jp/news',
    before: '',
    after: '',
  },
}

/**
 * Inserts one `snapshot_pages` row per company that has a fixture above. Call this in
 * `beforeEach`, right after inserting the matching `companies` rows, for any test that used to
 * rely on the old hardcoded `SNAPSHOTS` map.
 */
export async function insertLegacySnapshotPages(
  query: (sql: string, params: unknown[]) => Promise<unknown>,
  companyIds: string[] = Object.keys(LEGACY_SNAPSHOTS),
): Promise<void> {
  for (const companyId of companyIds) {
    const page = LEGACY_SNAPSHOTS[companyId]
    if (!page) continue
    await query(
      `INSERT INTO snapshot_pages (company_id, page_slug, source_url, before_html, after_html)
       VALUES ($1, 'homepage', $2, $3, $4)
       ON CONFLICT (company_id, page_slug) DO UPDATE
         SET source_url = EXCLUDED.source_url, before_html = EXCLUDED.before_html, after_html = EXCLUDED.after_html`,
      [companyId, page.sourceUrl, page.before || null, page.after || null],
    )
  }
}

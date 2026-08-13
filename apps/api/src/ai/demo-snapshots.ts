import { Injectable } from '@nestjs/common'

/**
 * Stored snapshots of company pages, two per company: `before` and `after`.
 *
 * Crawling live sites is out of scope for this module (plan, "Ngoài phạm vi"), so "reading a
 * source" means reading one of these. Two variants rather than one because the acceptance
 * script turns on switching them: T-6 flips a company to `after` and expects the next step to
 * change, T-8 flips two of three watched companies and expects exactly two new timeline
 * entries.
 *
 * These are NOT fixtures smuggled into production to make a check pass — they are the demo
 * dataset, and they are the only source this module has. Seed data proper stays in
 * `packages/db/src/seed/`; what lives here is the page CONTENT, which the seed does not model.
 *
 * The HTML is deliberately messy — nested tags, `&nbsp;`, a `<script>` block, inconsistent
 * whitespace — because that is what `normalizeSnapshotText` has to survive. Clean HTML here
 * would make the normaliser look correct without testing it.
 */

export type SnapshotVariant = 'before' | 'after'

export interface Snapshot {
  sourceUrl: string
  rawHtml: string
}

const SAKURA = 'aaaaaaaa-0001-4000-8000-000000000001'
const NIMBUS = 'aaaaaaaa-0002-4000-8000-000000000002'
const KITEFIN = 'aaaaaaaa-0003-4000-8000-000000000003'
const OHARA = 'aaaaaaaa-0004-4000-8000-000000000004'
const MARLIN = 'aaaaaaaa-0005-4000-8000-000000000005'

/**
 * The funding paragraph, once, used by TWO companies of different types.
 *
 * Only the company name differs between the two pages, so `company_type` is the ONLY variable
 * left: the same funding news read under `traditional` (Sakura) and under `it_product`
 * (Marlin) has to produce different findings, and if it does not, the lens is decoration.
 * Keeping the sentence in one constant is what makes that comparison honest — two hand-typed
 * paragraphs would drift and the difference could then come from the wording.
 */
function fundingParagraph(companyName: string): string {
  return `<p>${companyName} vừa hoàn tất vòng Series B huy động 20 triệu USD do Mizuho Capital dẫn dắt.</p>`
}

const SNAPSHOTS: Record<string, Record<SnapshotVariant, Snapshot>> = {
  [SAKURA]: {
    before: {
      sourceUrl: 'https://sakura-mfg.example.jp/news',
      rawHtml: `<html><head><title>Tin công ty</title><script>track('pageview')</script></head>
        <body><div class="news">
        <h1>Sakura Manufacturing KK</h1>
        <p>Chúng tôi là nhà sản xuất linh kiện chính xác phục vụ ngành ô tô từ năm 1978.</p>
        <p>Nhà máy tại Aichi hiện vận hành ba dây chuyền&nbsp;lắp ráp.</p>
        </div></body></html>`,
    },
    after: {
      sourceUrl: 'https://sakura-mfg.example.jp/news',
      rawHtml: `<html><head><title>Tin công ty</title><script>track('pageview')</script></head>
        <body><div class="news">
        <h1>Sakura Manufacturing KK</h1>
        <p>Chúng tôi là nhà sản xuất linh kiện chính xác phục vụ ngành ô tô từ năm 1978.</p>
        ${fundingParagraph('Sakura')}
        <p>Nhà máy tại Aichi hiện vận hành ba dây chuyền&nbsp;lắp ráp.</p>
        </div></body></html>`,
    },
  },

  [NIMBUS]: {
    before: {
      sourceUrl: 'https://nimbus.example.sg/press',
      rawHtml: `<html><body><article>
        <h2>Nimbus Cloud Solutions</h2>
        <p>Nimbus cung cấp dịch vụ tích hợp hệ thống cho khách hàng khu vực ASEAN.</p>
        </article></body></html>`,
    },
    after: {
      sourceUrl: 'https://nimbus.example.sg/press',
      rawHtml: `<html><body><article>
        <h2>Nimbus Cloud Solutions</h2>
        <p>Nimbus cung cấp dịch vụ tích hợp hệ thống cho khách hàng khu vực ASEAN.</p>
        <p>Nimbus bổ nhiệm bà Tan Wei Ling làm Giám đốc Công nghệ mới từ tháng này.</p>
        <ul><li>Công ty cũng đang tuyển thêm 40 kỹ sư nền tảng trong năm nay.</li></ul>
        </article></body></html>`,
    },
  },

  [KITEFIN]: {
    before: {
      sourceUrl: 'https://kitefin.example.com/blog',
      rawHtml: `<html><body><p>Kitefin Analytics giúp doanh nghiệp đo lường hiệu quả vận hành.</p></body></html>`,
    },
    after: {
      sourceUrl: 'https://kitefin.example.com/blog',
      rawHtml: `<html><body>
        <p>Kitefin Analytics giúp doanh nghiệp đo lường hiệu quả vận hành.</p>
        <p>Kitefin mở rộng sang thị trường Nhật Bản với văn phòng đầu tiên tại Tokyo.</p>
        </body></html>`,
    },
  },

  /**
   * Marlin exists for ONE comparison: its `after` carries the same funding paragraph as
   * Sakura's, and the two companies are `it_product` and `traditional`. Read the two findings
   * side by side and the company-type lens either changed the reading or it did not.
   *
   * It is deliberately NOT watched and NOT part of T-1…T-10 — it is a product point, so it is
   * also the first thing to cut if the schedule slips.
   */
  [MARLIN]: {
    before: {
      sourceUrl: 'https://marlin-labs.example.com/news',
      rawHtml: `<html><body><section>
        <h1>Marlin Product Labs</h1>
        <p>Marlin phát triển bộ công cụ quản lý kho theo mô hình thuê bao cho ngành bán lẻ.</p>
        </section></body></html>`,
    },
    after: {
      sourceUrl: 'https://marlin-labs.example.com/news',
      rawHtml: `<html><body><section>
        <h1>Marlin Product Labs</h1>
        <p>Marlin phát triển bộ công cụ quản lý kho theo mô hình thuê bao cho ngành bán lẻ.</p>
        ${fundingParagraph('Marlin')}
        </section></body></html>`,
    },
  },

  /**
   * Ohara has NO readable snapshot in either variant, on purpose: it is the company the
   * `fetch_status = 'failed'` path is demonstrated on. Without a source that genuinely cannot
   * be read, that branch would only ever be exercised by a test.
   */
  [OHARA]: {
    before: { sourceUrl: 'https://ohara-retail.example.jp/news', rawHtml: '' },
    after: { sourceUrl: 'https://ohara-retail.example.jp/news', rawHtml: '' },
  },
}

/**
 * The port the observation service reads through. A class rather than a bare function so the
 * watch cycle (group 5) and a future real crawler can be swapped in without touching the
 * service.
 */
@Injectable()
export class DemoSnapshotSource {
  /** `null` means this source cannot be read — the caller records `failed`, never guesses. */
  read(companyId: string, variant: SnapshotVariant): Snapshot | null {
    const perCompany = SNAPSHOTS[companyId]
    if (!perCompany) return null

    const snapshot = perCompany[variant]
    if (!snapshot || snapshot.rawHtml.trim().length === 0) return null

    return snapshot
  }

  /** Used by the UI to show the source URL even when the read failed. */
  sourceUrlFor(companyId: string): string | null {
    const perCompany = SNAPSHOTS[companyId]
    return perCompany?.before?.sourceUrl ?? null
  }
}

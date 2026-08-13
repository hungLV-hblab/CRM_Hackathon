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

/**
 * The facts block every company page carries — and the reason feature group 3 can propose a
 * profile edit at all (ADR-0024).
 *
 * Without it a `field_update` proposal has no source: a `Claim` records what a page SAYS, and
 * no page here said anything about industry, country, size or website. The choice made in
 * ADR-0024 is that the LLM decides which field a line implies, while code checks the proposed
 * value is a verbatim substring of the quoted line. That check is only satisfiable if the value
 * is literally on the page, which is what these lines provide.
 *
 * Each value is therefore written so it can be QUOTED, not paraphrased: `Quy mô: 1000+ nhân
 * viên` yields `1000+`, `Trụ sở chính: Aichi, Nhật Bản` yields `Nhật Bản`. A line reading
 * "khoảng một nghìn người" would force a paraphrase and the proposal would be dropped —
 * correctly, and invisibly, which is why the wording here is not cosmetic.
 */
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

const SNAPSHOTS: Record<string, Record<SnapshotVariant, Snapshot>> = {
  /**
   * Sakura is the "stale cell" case: its `before` facts match the seeded profile exactly, so
   * nothing is proposed; its `after` block reports a larger headcount after the funding round,
   * so `size` differs and one `field_update` appears. Sakura is also `is_watched = true`, which
   * makes it the proof that I-5 blocks only the `timeline_entry` kind, not this one.
   */
  [SAKURA]: {
    before: {
      sourceUrl: 'https://sakura-mfg.example.jp/news',
      rawHtml: `<html><head><title>Tin công ty</title><script>track('pageview')</script></head>
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
    },
    after: {
      sourceUrl: 'https://sakura-mfg.example.jp/news',
      rawHtml: `<html><head><title>Tin công ty</title><script>track('pageview')</script></head>
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
  },

  /**
   * Nimbus' facts match its seeded profile in BOTH variants, deliberately: it is the T-6/T-7
   * company (empty next step → the system fills it in), and a profile proposal in its queue
   * would put a second thing on screen during that demo. It is also the case that proves the
   * G3 gate fires — same value as the profile, so nothing is proposed.
   */
  [NIMBUS]: {
    before: {
      sourceUrl: 'https://nimbus.example.sg/press',
      rawHtml: `<html><body><article>
        <h2>Nimbus Cloud Solutions</h2>
        <p>Nimbus cung cấp dịch vụ tích hợp hệ thống cho khách hàng khu vực ASEAN.</p>
        ${factsBlock({
          industry: 'Tích hợp hệ thống',
          headquarters: 'Singapore',
          size: '100-500',
          website: 'https://nimbus.example.sg',
        })}
        </article></body></html>`,
    },
    after: {
      sourceUrl: 'https://nimbus.example.sg/press',
      rawHtml: `<html><body><article>
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
  },

  /**
   * Kitefin is the "empty cell" case: its seeded `website` is NULL while the page states one,
   * so the queue gets a proposal that FILLS a blank rather than overwriting a value — the other
   * half of what Specs group 3 asks for. Watched, like Sakura, so both halves are demonstrated
   * on companies the watch cycle covers and neither depends on Marlin, which is first to be cut.
   *
   * Its `after` also carries an expansion into Japan while the company is headquartered in the
   * United States — the trap that made ADR-0024 necessary. Nothing may read that sentence as a
   * `country` change, and the facts block is what keeps `country` anchored to `Hoa Kỳ`.
   */
  [KITEFIN]: {
    before: {
      sourceUrl: 'https://kitefin.example.com/blog',
      rawHtml: `<html><body><p>Kitefin Analytics giúp doanh nghiệp đo lường hiệu quả vận hành.</p>
        ${factsBlock({
          industry: 'Phân tích dữ liệu',
          headquarters: 'Boston, Hoa Kỳ',
          size: '50-100',
          website: 'https://kitefin.example.com',
        })}
        </body></html>`,
    },
    after: {
      sourceUrl: 'https://kitefin.example.com/blog',
      rawHtml: `<html><body>
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
        ${factsBlock({
          industry: 'Phần mềm đóng gói',
          headquarters: 'Singapore',
          size: '50-100',
          website: 'https://marlin-labs.example.com',
        })}
        </section></body></html>`,
    },
    after: {
      sourceUrl: 'https://marlin-labs.example.com/news',
      rawHtml: `<html><body><section>
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

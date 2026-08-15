import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { deterministicUuid } from '../deterministic-uuid'
import { parseZipDataset, unzipDataset } from '../parse-zip-dataset'

const ZIP_PATH = resolve(__dirname, '../../../seed-assets/hackathon-1-data.zip')
const zipBuffer = readFileSync(ZIP_PATH)

describe('parseZipDataset — chạy trên hackathon-1-data.zip thật, không phải fixture giả', () => {
  it('1 · unzipDataset đọc được Account.csv và ít nhất 1 file snapshot', () => {
    const files = unzipDataset(zipBuffer)
    expect(files.has('Account.csv')).toBe(true)
    expect(files.has('Contacts.csv')).toBe(true)
    expect(files.has('Opps.csv')).toBe(true)
    const snapshotFiles = Array.from(files.keys()).filter((k) => k.startsWith('snapshot/'))
    expect(snapshotFiles.length).toBeGreaterThan(100)
  })

  it('2 · đúng 25 công ty, 38 liên hệ', () => {
    const dataset = parseZipDataset(zipBuffer)
    expect(dataset.companies).toHaveLength(25)
    expect(dataset.contacts).toHaveLength(38)
  })

  it('3 · đúng 15 cơ hội thật, cảnh báo đúng 8 mã rác O1-O8 bị lọc', () => {
    const dataset = parseZipDataset(zipBuffer)
    expect(dataset.opportunities).toHaveLength(15)
    expect(dataset.warnings.join('\n')).toMatch(/8 cơ hội/)
    for (const code of ['O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7', 'O8']) {
      expect(dataset.warnings.join('\n')).toContain(code)
    }
  })

  it('4 · mỗi công ty có đúng một liên hệ isPrimary=true', () => {
    const dataset = parseZipDataset(zipBuffer)
    const byCompany = new Map<string, number>()
    for (const contact of dataset.contacts) {
      if (!contact.isPrimary) continue
      byCompany.set(contact.companyId, (byCompany.get(contact.companyId) ?? 0) + 1)
    }
    // Every company with at least one contact must have exactly one primary.
    const companiesWithContacts = new Set(dataset.contacts.map((c) => c.companyId))
    for (const companyId of companiesWithContacts) {
      expect(byCompany.get(companyId)).toBe(1)
    }
  })

  it('5 · company_type là text tự do — không dòng nào bị loại, 6 dòng trống dùng industry làm fallback + cảnh báo', () => {
    const dataset = parseZipDataset(zipBuffer)
    expect(dataset.companies).toHaveLength(25)
    expect(dataset.companies.every((c) => c.companyType.trim().length > 0)).toBe(true)

    const fallbackWarnings = dataset.warnings.filter((w) => w.includes('company_type trống'))
    expect(fallbackWarnings).toHaveLength(6)

    const stages = new Set(dataset.opportunities.map((o) => o.stage))
    expect(stages.size).toBeGreaterThan(0)
  })

  it('6 · C32 (không có website thật) có 0 trang bản chụp; công ty khác có >= 1', () => {
    const dataset = parseZipDataset(zipBuffer)
    const c32Id = deterministicUuid('company', 'C32')
    const c32Pages = dataset.snapshotPages.filter((p) => p.companyId === c32Id)
    expect(c32Pages).toHaveLength(0)

    const c18Id = deterministicUuid('company', 'C18')
    const c18Pages = dataset.snapshotPages.filter((p) => p.companyId === c18Id)
    expect(c18Pages.length).toBeGreaterThan(0)
  })

  it('7 · tổng số trang bản chụp khớp số cặp before/after nhóm được từ 172 file', () => {
    const dataset = parseZipDataset(zipBuffer)
    // 172 files, mostly paired (before+after) into one page — so total pages is well under 172
    // and each page has at least one of the two variants filled.
    expect(dataset.snapshotPages.length).toBeGreaterThan(50)
    expect(dataset.snapshotPages.length).toBeLessThan(172)
    for (const page of dataset.snapshotPages) {
      expect(page.beforeHtml !== null || page.afterHtml !== null).toBe(true)
    }
  })

  it('8 · gọi hai lần trên cùng bytes ra đúng cùng kết quả (đồng bộ, tất định)', () => {
    const first = parseZipDataset(zipBuffer)
    const second = parseZipDataset(zipBuffer)
    expect(first.companies.map((c) => c.id)).toEqual(second.companies.map((c) => c.id))
    expect(first.opportunities.map((o) => o.id)).toEqual(second.opportunities.map((o) => o.id))
  })
})

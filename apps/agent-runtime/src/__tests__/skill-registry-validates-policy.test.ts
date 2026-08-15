import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { PROPOSAL_TARGET_FIELDS, SIGNAL_TYPE, SOURCE_TIER, enumCodes } from '@crm/contracts'
import { describe, expect, it } from 'vitest'

import { loadSkills, requireSkill } from '../skill-registry'
import { SKILL_TEMPLATE_VARS } from '../skill-template-vars'

/**
 * A skill directory declares what a subprocess may reach for. Every assertion here is about a
 * way that declaration could silently become weaker than it looks.
 */

function writeSkill(name: string, policy: unknown, prompt: string): string {
  const root = mkdtempSync(join(tmpdir(), 'skills-test-'))
  const dir = join(root, name)
  mkdirSync(dir)
  writeFileSync(join(dir, 'policy.json'), JSON.stringify(policy))
  writeFileSync(join(dir, 'SKILL.md'), prompt)
  return root
}

describe('loadSkills', () => {
  it('nạp được skill hợp lệ và giữ nguyên trần tự chủ đã khai báo', () => {
    const root = writeSkill('demo', { allowedTools: [], maxTurns: 1, timeoutMs: 5000 }, 'Xin chào')

    const skill = requireSkill(loadSkills(root), 'demo')

    expect(skill.policy.allowedTools).toEqual([])
    expect(skill.policy.maxTurns).toBe(1)
    expect(skill.systemPrompt).toBe('Xin chào')
  })

  it('policy thiếu maxTurns là lỗi boot, không phải mặc định im lặng', () => {
    const root = writeSkill('demo', { allowedTools: [], timeoutMs: 5000 }, 'Xin chào')

    expect(() => loadSkills(root)).toThrow(/maxTurns/)
  })

  it('policy thiếu allowedTools là lỗi boot — không được ngầm hiểu là cho phép tất cả', () => {
    const root = writeSkill('demo', { maxTurns: 1, timeoutMs: 5000 }, 'Xin chào')

    expect(() => loadSkills(root)).toThrow(/allowedTools/)
  })

  it('placeholder không có giá trị là lỗi boot, không được gửi {{...}} cho model', () => {
    const root = writeSkill('demo', { allowedTools: [], maxTurns: 1, timeoutMs: 5000 }, 'Loại: {{KHONG_CO}}')

    expect(() => loadSkills(root, {})).toThrow(/KHONG_CO/)
  })

  it('SKILL.md rỗng là lỗi boot', () => {
    const root = writeSkill('demo', { allowedTools: [], maxTurns: 1, timeoutMs: 5000 }, '   ')

    expect(() => loadSkills(root)).toThrow(/rỗng/)
  })
})

/**
 * Loaded with the SAME map boot uses, not a copy of it. A second list here was how adding
 * `discover-sources` broke this file — see `skill-template-vars.ts`.
 */
const shippedSkills = loadSkills(join(__dirname, '..', '..', 'skills'), SKILL_TEMPLATE_VARS)

describe('skill extract-claims đi kèm sản phẩm', () => {
  const skills = shippedSkills

  it('không được cấp tool nào — nó chỉ đọc chuỗi ta đưa vào', () => {
    expect(requireSkill(skills, 'extract-claims').policy.allowedTools).toEqual([])
  })

  it('prompt đã thay hết placeholder bằng enum thật của contracts', () => {
    const prompt = requireSkill(skills, 'extract-claims').systemPrompt

    expect(prompt).not.toMatch(/\{\{/)
    for (const signal of enumCodes(SIGNAL_TYPE)) expect(prompt).toContain(signal)
    for (const field of PROPOSAL_TARGET_FIELDS) expect(prompt).toContain(field)
  })

  it('giữ nguyên luật câu trích nguyên văn — I-2 đứng hay đổ ở dòng này', () => {
    expect(requireSkill(skills, 'extract-claims').systemPrompt).toContain('NGUYÊN VĂN')
  })
})

describe('skill discover-sources đi kèm sản phẩm', () => {
  const skills = shippedSkills

  /**
   * ĐÚNG MỘT tool. Nó cần tìm kiếm, nên whitelist không thể rỗng như `extract-claims`; mọi tool
   * thêm vào đây là quyền một tiến trình con có mà không ai quyết định cho nó có — đặc biệt là
   * `WebFetch`, thứ `ports/source-discovery.ts` cấm vì nó trả về nội dung trang đã đọc hộ.
   */
  it('chỉ được cấp WebSearch, không gì khác', () => {
    expect(requireSkill(skills, 'discover-sources').policy.allowedTools).toEqual(['WebSearch'])
  })

  it('maxTurns phải > 1 — một lượt thì không đủ để tìm rồi trả lời', () => {
    expect(requireSkill(skills, 'discover-sources').policy.maxTurns).toBeGreaterThan(1)
  })

  it('prompt đã thay hết placeholder bằng enum thật của contracts', () => {
    const prompt = requireSkill(skills, 'discover-sources').systemPrompt

    expect(prompt).not.toMatch(/\{\{/)
    for (const tier of enumCodes(SOURCE_TIER)) expect(prompt).toContain(tier)
  })

  it('vẫn nói với model rằng hệ thống sẽ tự mở từng địa chỉ — bịa là mất trắng', () => {
    expect(requireSkill(skills, 'discover-sources').systemPrompt).toMatch(/TỰ MỞ/)
  })
})

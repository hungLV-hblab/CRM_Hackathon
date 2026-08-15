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

const BASE = 'Luật nền: không bịa, rỗng là hợp lệ.'

function writeSkill(name: string, policy: unknown, prompt: string, base: string | null = BASE): string {
  const root = mkdtempSync(join(tmpdir(), 'skills-test-'))
  if (base !== null) writeFileSync(join(root, '_base.md'), base)
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
    expect(skill.systemPrompt).toContain('Xin chào')
  })

  /**
   * The three parts, in the order `compose()` promises. Order is not cosmetic: the skill body
   * has to be the last thing the model reads, and the base has to be the first.
   */
  it('ghép luật nền trước, khai báo công cụ giữa, thân skill cuối', () => {
    const root = writeSkill('demo', { allowedTools: ['WebSearch'], maxTurns: 4, timeoutMs: 5000 }, 'Việc riêng')

    const prompt = requireSkill(loadSkills(root), 'demo').systemPrompt

    expect(prompt.indexOf(BASE)).toBeLessThan(prompt.indexOf('WebSearch'))
    expect(prompt.indexOf('WebSearch')).toBeLessThan(prompt.indexOf('Việc riêng'))
  })

  /**
   * The case this whole mechanism exists for. `extract-claims` ships with an empty whitelist,
   * and a model that does not know it has no tools plans around having them.
   */
  it('skill không được cấp tool nào phải được NÓI là không có tool', () => {
    const root = writeSkill('demo', { allowedTools: [], maxTurns: 1, timeoutMs: 5000 }, 'Việc riêng')

    expect(requireSkill(loadSkills(root), 'demo').systemPrompt).toContain('không có công cụ nào')
  })

  it('khai báo công cụ sinh từ policy, không phải chép tay trong markdown', () => {
    const root = writeSkill('demo', { allowedTools: ['WebSearch'], maxTurns: 4, timeoutMs: 5000 }, 'Việc riêng')

    const prompt = requireSkill(loadSkills(root), 'demo').systemPrompt

    expect(prompt).toContain('CÔNG CỤ Ở LƯỢT NÀY: WebSearch')
    expect(prompt).not.toContain('không có công cụ nào')
  })

  /**
   * Same class of failure as a policy missing `maxTurns`: the base carries "do not invent" and
   * "empty is a valid answer", so losing it silently makes every skill weaker with nothing
   * erroring on the way.
   */
  it('thiếu _base.md là lỗi boot, không phải chuỗi rỗng', () => {
    const root = writeSkill('demo', { allowedTools: [], maxTurns: 1, timeoutMs: 5000 }, 'Xin chào', null)

    expect(() => loadSkills(root)).toThrow(/_base\.md/)
  })

  it('_base.md rỗng cũng là lỗi boot', () => {
    const root = writeSkill('demo', { allowedTools: [], maxTurns: 1, timeoutMs: 5000 }, 'Xin chào', '   ')

    expect(() => loadSkills(root)).toThrow(/rỗng/)
  })

  it('_base.md là file nên không bị nhầm thành một skill chạy được', () => {
    const root = writeSkill('demo', { allowedTools: [], maxTurns: 1, timeoutMs: 5000 }, 'Xin chào')

    expect([...loadSkills(root).keys()]).toEqual(['demo'])
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

/**
 * Asserted across EVERY shipped skill rather than once per skill, so that a skill added later
 * cannot ship without the floor. Rule 4 of CLAUDE.md is the thing being defended: a model that
 * treats an empty answer as failure fills the gap with a guess.
 */
describe('luật nền đi kèm mọi skill', () => {
  it.each([...shippedSkills.keys()])('%s có luật nền và biết công cụ mình có', (name) => {
    const skill = requireSkill(shippedSkills, name)

    expect(skill.systemPrompt).toContain('KHÔNG BỊA')
    expect(skill.systemPrompt).toContain('RỖNG LÀ CÂU TRẢ LỜI HỢP LỆ')
    expect(skill.systemPrompt).toContain('CÔNG CỤ Ở LƯỢT NÀY')
  })

  it('nạp đúng hai skill đang ship, _base.md không thành skill thứ ba', () => {
    expect([...shippedSkills.keys()].sort()).toEqual(['discover-sources', 'extract-claims'])
  })
})

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

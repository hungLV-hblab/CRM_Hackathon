import Anthropic from '@anthropic-ai/sdk'
import { Injectable, Logger } from '@nestjs/common'
import { z } from 'zod'

import {
  CONFIDENCE,
  PROPOSAL_TARGET_FIELDS,
  SIGNAL_TYPE,
  type ClaimDraft,
  type ClaimExtractor,
  type ObservationInput,
  enumCodes,
} from '@crm/contracts'

/**
 * The real adapter behind `CLAIM_EXTRACTOR` (ADR-0014).
 *
 * The split this class obeys, and the reason it is so short: **where the Specs ask for
 * understanding context, the LLM decides; where they ask for a guarantee, code decides.**
 *
 *   LLM  → `statement`, `signalType`, `confidence`, which passage to quote
 *   code → is `quoteText` a verbatim substring, the offsets, whether to save at all
 *
 * So this file returns `ClaimDraft[]` and NOTHING else. It does not compute offsets (the
 * `ClaimDraft` type has no fields for them), it does not touch the database, and it never
 * decides that a claim is good enough to keep. `ClaimService` does all three.
 *
 * `company_type` goes into the prompt because a finding is read under the lens of the company
 * type (ontology section 4): "hiring 200 engineers" means something different for an IT
 * outsourcing prospect than for a traditional manufacturer.
 */

const DEFAULT_MODEL = 'claude-sonnet-5'

/**
 * Applied to the model's JSON before anything else looks at it. A malformed response must
 * fail loudly here rather than reach the domain as a half-built object — and note this
 * schema has no offset fields, so an LLM that volunteers them cannot smuggle them past.
 */
const claimDraftSchema = z.object({
  statement: z.string().trim().min(1),
  signalType: z.enum(enumCodes(SIGNAL_TYPE)),
  confidence: z.enum(enumCodes(CONFIDENCE)),
  quoteText: z.string().trim().min(1),
  /**
   * ADR-0024. Optional, and `targetField` is validated against the I-11 whitelist by
   * `ProposalService`, not here: a model naming a field it may not touch must show up as a
   * refusal that is counted, not as a parse failure that silently drops the whole finding.
   */
  fieldSuggestion: z
    .object({
      targetField: z.enum(PROPOSAL_TARGET_FIELDS),
      proposedValue: z.string().trim().min(1),
    })
    .optional(),
})

const responseSchema = z.object({ claims: z.array(claimDraftSchema) })

const SYSTEM_PROMPT = `Bạn đọc bản chụp trang web của một công ty B2B và rút ra các phát hiện đáng chú ý cho đội Sales ITO.

QUY TẮC TUYỆT ĐỐI về câu trích:
- "quoteText" PHẢI là một đoạn COPY NGUYÊN VĂN, cắt trực tiếp từ nội dung được cung cấp.
- KHÔNG viết lại, KHÔNG rút gọn, KHÔNG sửa dấu câu, KHÔNG dịch, KHÔNG ghép hai đoạn rời nhau.
- Nếu không tìm được đoạn nguyên văn nào chứng minh được phát hiện thì BỎ phát hiện đó.
Một câu trích diễn giải sẽ bị hệ thống loại bỏ cùng toàn bộ phát hiện, nên viết lại là mất trắng.

"statement" viết bằng TIẾNG VIỆT, kể cả khi nguồn bằng tiếng Anh hay tiếng Nhật — người đọc là Sales Việt Nam.
Câu trích thì giữ nguyên ngôn ngữ của nguồn, vì nó phải khớp từng ký tự với bản lưu.

"confidence":
- certain: phát hiện gần như chép lại nguồn, mọi con số và tên riêng trong statement đều có trong câu trích
- likely: suy ra một bước từ nguồn
- speculative: phải đoán thêm

GỢI Ý SỬA Ô HỒ SƠ (không bắt buộc, thêm "fieldSuggestion" vào phát hiện):
- Chỉ khi bản chụp nói rõ một trong bốn ô: ${PROPOSAL_TARGET_FIELDS.join(' | ')}.
- CHỈ đề xuất khi ô đó đang TRỐNG hoặc giá trị hiện tại KHÁC với điều bản chụp ghi. Giá trị hiện tại được cung cấp bên dưới.
- "proposedValue" PHẢI là một đoạn CẮT NGUYÊN VĂN từ chính "quoteText" của phát hiện đó. Viết lại là mất trắng: hệ thống bỏ phần đề xuất.
- Không đề xuất tên công ty và không đề xuất loại hình công ty — hệ thống từ chối cả hai.
- Tin mở rộng sang một thị trường KHÔNG phải là đổi quốc gia trụ sở. Chỉ đổi "country" khi bản chụp ghi trụ sở chính.

Chỉ trả JSON: {"claims":[{"statement","signalType","confidence","quoteText","fieldSuggestion":{"targetField","proposedValue"}}]}
signalType ∈ ${enumCodes(SIGNAL_TYPE).join(' | ')}
Không có phát hiện nào thì trả {"claims":[]} — trả về rỗng là câu trả lời hợp lệ và tốt hơn là bịa.`

@Injectable()
export class AnthropicClaimExtractor implements ClaimExtractor {
  private readonly logger = new Logger('AnthropicClaimExtractor')
  private readonly client: Anthropic
  private readonly model: string

  constructor(apiKey: string, model: string = DEFAULT_MODEL) {
    this.client = new Anthropic({ apiKey })
    this.model = model
  }

  async extract(observation: ObservationInput): Promise<ClaimDraft[]> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            `Loại hình công ty: ${observation.companyType}`,
            `Ngữ cảnh sinh phát hiện: ${observation.triggerContext}`,
            '',
            'Giá trị hiện tại của bốn ô hồ sơ (dùng để biết ô nào trống hoặc đã cũ):',
            ...PROPOSAL_TARGET_FIELDS.map(
              (field) => `- ${field}: ${observation.currentProfile[field] ?? '(trống)'}`,
            ),
            '',
            'Nội dung bản chụp:',
            observation.rawContent,
          ].join('\n'),
        },
      ],
    })

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')

    return this.parse(text, observation)
  }

  /**
   * A response we cannot parse yields ZERO findings, not a thrown request. Rule 4 of
   * CLAUDE.md: an empty row beats a wrong one — and the caller records the count, so an LLM
   * that starts answering in prose shows up as a drop in findings rather than as a 500 that
   * takes the whole watch cycle down with it.
   */
  private parse(text: string, observation: ObservationInput): ClaimDraft[] {
    const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
    if (json.length === 0) {
      this.logger.warn(`Model trả về không phải JSON cho observation ${observation.id}`)
      return []
    }

    const parsed = responseSchema.safeParse(safeJsonParse(json))
    if (!parsed.success) {
      this.logger.warn(
        `Model trả JSON sai hình dạng cho observation ${observation.id}: ${parsed.error.message}`,
      )
      return []
    }

    return parsed.data.claims
  }
}

function safeJsonParse(json: string): unknown {
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

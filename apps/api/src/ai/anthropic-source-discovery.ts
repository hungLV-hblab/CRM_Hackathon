import Anthropic from '@anthropic-ai/sdk'
import { Logger } from '@nestjs/common'
import { z } from 'zod'

import {
  SOURCE_TIER,
  type SourceCandidate,
  type SourceDiscovery,
  type SourceDiscoveryInput,
  enumCodes,
} from '@crm/contracts'

/**
 * The real adapter behind `SOURCE_DISCOVERY`: Anthropic's `web_search` server tool finds candidate
 * pages, and this class turns the response into a list a person can tick.
 *
 * It returns URLs and snippets. It never returns page content — see `ports/source-discovery.ts`
 * for why that boundary is load-bearing rather than stylistic, and why `web_fetch` is not an
 * option here however convenient it looks.
 *
 * Three things about this API break naive parsers, and all three are handled below because all
 * three arrive as a normal, successful response:
 *
 *   1. `stop_reason: "pause_turn"` — the server-side search loop hit its own iteration cap. The
 *      turn is UNFINISHED. Resume by sending the assistant turn back; adding a "Continue" user
 *      message re-opens the conversation instead of completing the one in flight.
 *   2. `web_search_tool_result.content` is a LIST on success and an ERROR OBJECT on failure, on
 *      the same HTTP 200 with nothing thrown. Branch on the shape BEFORE indexing.
 *   3. The model can name a URL no search returned. The prompt asks it not to; rule 1 does not
 *      accept an instruction as a guarantee, so every returned URL is checked against the search
 *      results of the same call and dropped if it was not there.
 */

const DEFAULT_MODEL = 'claude-sonnet-5'

/** Bounded twice: the model may search at most this many times... */
const MAX_SEARCHES = 3
/** ...and a turn that keeps pausing is abandoned after this many continuations. */
const MAX_CONTINUATIONS = 4
/** A person has to read and tick every row. Six is a decision; a dozen is a chore. */
const MAX_CANDIDATES = 6

/** Only the transport is injected, so the tests can script responses without a network. */
export type MessageCreate = (params: Anthropic.MessageCreateParams) => Promise<Anthropic.Message>

const candidateSchema = z.object({
  url: z.string().trim().min(1),
  sourceTier: z.enum(enumCodes(SOURCE_TIER)),
  snippet: z.string().trim().default(''),
  reason: z.string().trim().default(''),
})

const responseSchema = z.object({ candidates: z.array(candidateSchema) })

const SYSTEM_PROMPT = `Bạn giúp đội Sales ITO tìm các trang web công khai nói về MỘT công ty cụ thể.

CÁCH LÀM:
- Dùng công cụ tìm kiếm để tìm trang thật. KHÔNG được tự nghĩ ra địa chỉ.
- Mỗi ứng viên PHẢI là một URL xuất hiện trong kết quả tìm kiếm. Hệ thống đối chiếu lại và sẽ BỎ mọi URL không có trong kết quả, nên bịa là mất trắng.
- Ưu tiên: trang chính thức của công ty (tin tức, thông cáo), rồi bài báo, rồi mạng xã hội.
- Cẩn thận công ty TRÙNG TÊN: chỉ giữ trang thật sự nói về công ty được mô tả bên dưới. Không chắc thì bỏ.

"sourceTier":
- company_website: trang thuộc tên miền của chính công ty
- news: báo, trang tin, thông cáo đăng trên trang khác
- social: LinkedIn, Facebook, X và tương tự

"snippet": đoạn trích ngắn lấy từ kết quả tìm kiếm, giữ nguyên ngôn ngữ gốc.
"reason": MỘT câu TIẾNG VIỆT nói vì sao trang này đúng là của công ty đó — người dùng đọc câu này để quyết định tick hay không.

Chỉ trả JSON, không thêm lời nào khác:
{"candidates":[{"url","sourceTier","snippet","reason"}]}
Không tìm được trang nào chắc chắn thì trả {"candidates":[]} — rỗng là câu trả lời hợp lệ và tốt hơn là đoán.`

export class AnthropicSourceDiscovery implements SourceDiscovery {
  private readonly logger = new Logger('AnthropicSourceDiscovery')

  constructor(
    private readonly createMessage: MessageCreate,
    private readonly model: string = DEFAULT_MODEL,
  ) {}

  /** Production entry point. The tests build the class directly with a scripted transport. */
  static fromApiKey(apiKey: string, model?: string): AnthropicSourceDiscovery {
    const client = new Anthropic({ apiKey })
    return new AnthropicSourceDiscovery(
      (params) => client.messages.create(params) as Promise<Anthropic.Message>,
      model,
    )
  }

  async discover(input: SourceDiscoveryInput): Promise<SourceCandidate[]> {
    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: describeCompany(input) },
    ]

    /** Every result block seen across the whole turn, continuations included. */
    const searched = new Set<string>()
    let answer = ''

    for (let attempt = 0; attempt <= MAX_CONTINUATIONS; attempt += 1) {
      const response = await this.createMessage({
        model: this.model,
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages,
        /**
         * Dynamic filtering is built into this tool version — it runs code server-side on our
         * behalf. Declaring `code_execution` alongside it would hand the model a second execution
         * environment and muddle which one it should reach for.
         */
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: MAX_SEARCHES }],
      } as Anthropic.MessageCreateParams)

      for (const url of searchResultUrls(response.content)) searched.add(url)
      answer += textOf(response.content)

      if (response.stop_reason !== 'pause_turn') {
        return this.parse(answer, searched, input)
      }

      /**
       * Resume: hand the assistant turn back and add NOTHING. The API sees the trailing
       * server-tool block and continues the same turn on its own.
       */
      messages.push({ role: 'assistant', content: response.content as Anthropic.ContentBlockParam[] })
    }

    this.logger.warn(
      `Tìm nguồn cho "${input.companyName}" không kết thúc sau ${MAX_CONTINUATIONS} lần nối tiếp — bỏ lượt này`,
    )
    return []
  }

  /**
   * An answer we cannot parse yields ZERO candidates, never a thrown request — the same rule as
   * `anthropic-claim-extractor.ts:143-148`. A model that starts writing prose shows up as an
   * empty list a person can see, not as a 500 that takes the page down.
   */
  private parse(
    text: string,
    searched: ReadonlySet<string>,
    input: SourceDiscoveryInput,
  ): SourceCandidate[] {
    const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
    if (json.length === 0) {
      this.logger.warn(`Model trả về không phải JSON khi tìm nguồn cho "${input.companyName}"`)
      return []
    }

    const parsed = responseSchema.safeParse(safeJsonParse(json))
    if (!parsed.success) {
      this.logger.warn(
        `Model trả JSON sai hình dạng khi tìm nguồn cho "${input.companyName}": ${parsed.error.message}`,
      )
      return []
    }

    const seen = new Set<string>()
    const kept: SourceCandidate[] = []
    let invented = 0

    for (const candidate of parsed.data.candidates) {
      const key = normaliseUrl(candidate.url)
      if (key === null) continue

      /**
       * The check that makes this adapter trustworthy: a URL that appeared in no search result of
       * this call is one nobody can vouch for, and keeping it would put a page of the model's own
       * invention in front of someone about to tick it.
       */
      if (!searched.has(key)) {
        invented += 1
        continue
      }
      if (seen.has(key)) continue

      seen.add(key)
      kept.push({
        url: candidate.url,
        sourceTier: candidate.sourceTier,
        snippet: candidate.snippet,
        reason: candidate.reason,
      })
      if (kept.length === MAX_CANDIDATES) break
    }

    this.logger.log(
      `Tìm nguồn "${input.companyName}": ${kept.length} ứng viên giữ lại, ` +
        `${invented} bỏ vì không có trong kết quả tìm kiếm, ${searched.size} URL đã tìm thấy`,
    )
    return kept
  }
}

function describeCompany(input: SourceDiscoveryInput): string {
  return [
    `Tên công ty: ${input.companyName}`,
    `Loại hình: ${input.companyType}`,
    `Website đang lưu: ${input.companyWebsite ?? '(chưa có)'}`,
    '',
    'Tìm tối đa 6 trang công khai nói về đúng công ty này.',
  ].join('\n')
}

/**
 * Every URL the search actually returned, across all result blocks.
 *
 * The shape branch lives here. On success `content` is an array of results; on failure it is a
 * single error object — `{type: 'web_search_tool_result_error', error_code: 'max_uses_exceeded'}`
 * — carried on an ordinary 200. Mapping over that object yields characters of the error code, so
 * `Array.isArray` is checked before anything is read out of it, and a failed search simply
 * contributes nothing while its siblings still count.
 */
function searchResultUrls(content: unknown[]): string[] {
  const urls: string[] = []

  for (const block of content) {
    if (!isRecord(block) || block.type !== 'web_search_tool_result') continue
    if (!Array.isArray(block.content)) continue

    for (const result of block.content) {
      if (!isRecord(result) || typeof result.url !== 'string') continue
      const key = normaliseUrl(result.url)
      if (key !== null) urls.push(key)
    }
  }

  return urls
}

function textOf(content: unknown[]): string {
  return content
    .filter((block): block is { type: 'text'; text: string } =>
      isRecord(block) && block.type === 'text' && typeof block.text === 'string',
    )
    .map((block) => block.text)
    .join('')
}

/**
 * The comparison key for "is this the address the search returned". A trailing slash and a
 * lower-case host are the same page; rejecting a candidate over punctuation would throw away good
 * sources, while comparing raw strings loosely would throw away the guarantee.
 */
function normaliseUrl(url: string): string | null {
  try {
    const parsed = new URL(url.trim())
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    const path = parsed.pathname.replace(/\/+$/, '')
    return `${parsed.protocol}//${parsed.host.toLowerCase()}${path}${parsed.search}`
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function safeJsonParse(json: string): unknown {
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

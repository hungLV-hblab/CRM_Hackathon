import { CONFIDENCE, SIGNAL_TYPE, enumCodes } from '../../packages/contracts/src/enums.ts'
import { locateVerbatimQuote, normalizeSnapshotText } from '../../apps/api/src/ai/normalize-snapshot-text.ts'
import { type CliRun, runClaude } from './claude-cli.ts'

/**
 * Snapshot text in, findings out — the same shape `ClaimExtractor` has in the product, but
 * driven by the CLI subprocess instead of the Anthropic SDK.
 *
 * The split the product enforces is kept intact here, because it is the part of the design a
 * transport change must NOT be allowed to weaken: the model chooses what to assert and which
 * passage to quote; code decides whether the quote is real and therefore whether the finding
 * survives. Swapping API key for subprocess changes who delivers the answer, not who is
 * trusted with it.
 */

const SIGNAL_CODES = enumCodes(SIGNAL_TYPE)
const CONFIDENCE_CODES = enumCodes(CONFIDENCE)

const SYSTEM_PROMPT = `Bạn đọc bản chụp trang web của một công ty B2B và rút ra các phát hiện đáng chú ý cho đội Sales ITO.

QUY TẮC TUYỆT ĐỐI về câu trích:
- "quoteText" PHẢI là đoạn COPY NGUYÊN VĂN, cắt trực tiếp từ nội dung được cung cấp.
- KHÔNG viết lại, KHÔNG rút gọn, KHÔNG sửa dấu câu, KHÔNG dịch, KHÔNG ghép hai đoạn rời nhau.
- Không tìm được đoạn nguyên văn chứng minh được phát hiện thì BỎ phát hiện đó.
Câu trích diễn giải sẽ bị hệ thống loại bỏ cùng toàn bộ phát hiện.

"statement" viết bằng TIẾNG VIỆT kể cả khi nguồn là tiếng Anh. Câu trích giữ nguyên ngôn ngữ nguồn.

"confidence":
- certain: mọi con số và tên riêng trong statement đều có trong câu trích
- likely: suy ra một bước từ nguồn
- speculative: phải đoán thêm

Chỉ trả JSON, không giải thích gì thêm:
{"claims":[{"statement":"...","signalType":"...","confidence":"...","quoteText":"..."}]}
signalType ∈ ${SIGNAL_CODES.join(' | ')}
confidence ∈ ${CONFIDENCE_CODES.join(' | ')}
Không có phát hiện nào thì trả {"claims":[]} — rỗng là câu trả lời hợp lệ và tốt hơn là bịa.`

export interface KeptClaim {
  statement: string
  signalType: string
  confidence: string
  quoteText: string
  quoteStart: number
  quoteEnd: number
}

export interface DroppedClaim {
  statement: string
  quoteText: string
  reason: string
}

export interface ExtractionResult {
  /** What every offset below is measured against, and what the screen renders. */
  normalized: string
  kept: KeptClaim[]
  dropped: DroppedClaim[]
  run: CliRun
}

export async function extractClaims(rawSnapshot: string): Promise<ExtractionResult> {
  const normalized = normalizeSnapshotText(rawSnapshot)
  const run = await runClaude(SYSTEM_PROMPT, `Nội dung bản chụp:\n${normalized}`)

  const kept: KeptClaim[] = []
  const dropped: DroppedClaim[] = []

  for (const candidate of parseClaims(run.text)) {
    const statement = text(candidate.statement)
    const quoteText = text(candidate.quoteText)

    if (statement.length === 0 || quoteText.length === 0) {
      dropped.push({ statement, quoteText, reason: 'Thiếu nhận định hoặc thiếu câu trích' })
      continue
    }

    // The gate. `locateVerbatimQuote` is imported from the product, not reimplemented, so a
    // quote that passes here passes for the same reason it would in the real pipeline.
    const span = locateVerbatimQuote(normalized, quoteText)
    if (!span) {
      dropped.push({ statement, quoteText, reason: 'Câu trích không khớp nguyên văn với bản chụp' })
      continue
    }

    kept.push({
      statement,
      signalType: SIGNAL_CODES.includes(candidate.signalType as never) ? String(candidate.signalType) : 'other',
      confidence: CONFIDENCE_CODES.includes(candidate.confidence as never)
        ? String(candidate.confidence)
        : 'speculative',
      quoteText,
      quoteStart: span.quoteStart,
      quoteEnd: span.quoteEnd,
    })
  }

  return { normalized, kept, dropped, run }
}

interface RawClaim {
  statement?: unknown
  signalType?: unknown
  confidence?: unknown
  quoteText?: unknown
}

/**
 * A response we cannot read yields zero findings rather than a thrown request: an empty row
 * beats a wrong one, and a model that starts answering in prose should show up as a drop in
 * findings, not as a 500.
 */
function parseClaims(answer: string): RawClaim[] {
  const start = answer.indexOf('{')
  const end = answer.lastIndexOf('}')
  if (start === -1 || end <= start) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(answer.slice(start, end + 1))
  } catch {
    return []
  }

  const claims = (parsed as { claims?: unknown })?.claims
  return Array.isArray(claims) ? (claims as RawClaim[]) : []
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

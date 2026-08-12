import { Badge } from '@/components/ui/badge'

/**
 * NAMING RENDEZVOUS, not a feature. Rule 1 of CLAUDE.md — no provenance, no display — is
 * enforced at the COMPONENT layer, which only works if every feature group renders evidence
 * through the same component instead of three groups inventing three different ones.
 *
 * Groups 2 and 3 fill in the behaviour (jump to source, highlight the offset range). What
 * matters today is that the component, its name and its props exist before three people
 * start work in parallel.
 */
export interface QuoteBlockProps {
  /** The source sentence, VERBATIM. A claim with no verbatim quote must not be storable. */
  quote: string
  /** Character offsets into the observation's `raw_content` — see open question I-2. */
  quoteStart?: number
  quoteEnd?: number
  sourceLabel: string
  onOpenSource?: () => void
}

export function QuoteBlock({ quote, sourceLabel, onOpenSource }: QuoteBlockProps) {
  return (
    <figure className="border-l-4 border-slate-300 pl-3">
      <blockquote className="text-sm text-fact">“{quote}”</blockquote>
      <figcaption className="mt-1 text-xs text-slate-500">
        <button type="button" onClick={onOpenSource} className="underline underline-offset-2">
          {sourceLabel}
        </button>
      </figcaption>
    </figure>
  )
}

/**
 * Confidence is shown as a WORD, never as a bare percentage: "82%" reads as a measurement
 * the system does not actually have. Ontology 3.5 gives three levels, and those are the
 * three the user sees.
 */
export function ConfidenceBadge({ confidence }: { confidence: 'certain' | 'likely' | 'speculative' }) {
  const LABELS = { certain: 'Chắc', likely: 'Có thể', speculative: 'Đoán' } as const
  return <Badge tone="inference">{LABELS[confidence]}</Badge>
}

/** Autonomy zone 4: anything the watch cycle wrote must say so on its face. */
export function SystemAddedLabel() {
  return <Badge tone="system">Do hệ thống thêm</Badge>
}

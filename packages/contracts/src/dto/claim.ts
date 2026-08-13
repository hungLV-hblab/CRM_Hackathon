import type { Confidence, SignalType, TriggerContext } from '../enums'

/**
 * ontology 3.2 — "phát hiện". An INFERENCE, which is why the UI must show it differently from
 * a fact (CLAUDE.md rule 2) and why every field needed to reach the source is REQUIRED here.
 *
 * `observationId`, `quoteText`, `quoteStart` and `quoteEnd` are deliberately NOT optional.
 * CLAUDE.md rule 1 says provenance is enforced at the component layer, not by programmer
 * goodwill — a component that cannot be handed a source-less claim is that enforcement,
 * because the type stops it before rendering does. Anything optional here would let a claim
 * with no reachable source compile.
 */
export interface ClaimDto {
  id: string
  companyId: string
  observationId: string
  statement: string
  signalType: SignalType
  confidence: Confidence
  /** Verbatim substring of `ObservationDto.rawContent` — never a paraphrase (I-2). */
  quoteText: string
  /** Offsets into `rawContent`, computed by the API. Used to highlight the source span. */
  quoteStart: number
  quoteEnd: number
  /** I-4: a `manual_ingest` claim may never become a timeline entry. */
  triggerContext: TriggerContext
  createdAt: string
}

import type { ReactNode } from 'react'

type Tone = 'neutral' | 'fact' | 'inference' | 'system'

/**
 * `fact` / `inference` are not decoration. Rule 2 of CLAUDE.md requires a reader to tell
 * data apart from something the AI concluded WITHOUT reading any explanation, so the
 * distinction is carried by colour and by the label — never by colour alone, which would
 * disappear for a colour-blind judge.
 */
const TONES: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  fact: 'bg-slate-200 text-fact',
  inference: 'bg-amber-100 text-suy-luan',
  system: 'bg-indigo-100 text-indigo-800',
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}
    >
      {children}
    </span>
  )
}

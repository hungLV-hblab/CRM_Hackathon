import type { ReactNode } from 'react'

type Tone = 'neutral' | 'fact' | 'inference' | 'system' | 'warning' | 'success'

/**
 * `fact` / `inference` / `system` are not decoration. Rule 2 of CLAUDE.md requires a reader to
 * tell data apart from something the AI concluded WITHOUT reading any explanation, so the
 * distinction is carried by the machine hue AND by the label the caller passes — never by
 * colour alone, which would disappear for a colour-blind judge or a greyscale printout.
 *
 * Note what is missing: there is no brand-amber tone. Amber marks what a human should click
 * (docs/design-guidelines.md); a badge is read, not clicked, so it never wears the brand.
 */
const TONES: Record<Tone, string> = {
  neutral: 'bg-ink-100 text-ink-700',
  fact: 'bg-ink-200 text-fact',
  inference: 'bg-machine-100 text-machine-700',
  system: 'bg-machine-100 text-machine-700 ring-1 ring-machine-200',
  warning: 'bg-warning-surface text-warning',
  success: 'bg-success-surface text-success',
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}
    >
      {children}
    </span>
  )
}

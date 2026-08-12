import type { ButtonHTMLAttributes } from 'react'

/**
 * Hand-written rather than pulled from shadcn/ui, and deliberately kept at the SAME import
 * path shadcn would use (`@/components/ui/button`). The walking skeleton only needs the
 * pipeline to work, so an interactive `shadcn init` was not worth the time it costs; when a
 * feature group wants the real component library, dropping the generated file in this exact
 * place is the whole migration.
 */
type Variant = 'primary' | 'secondary' | 'ghost'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-slate-900 text-white hover:bg-slate-700 disabled:bg-slate-400',
  secondary: 'border border-slate-300 bg-white text-slate-900 hover:bg-slate-100',
  ghost: 'text-slate-600 hover:bg-slate-100',
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
    />
  )
}

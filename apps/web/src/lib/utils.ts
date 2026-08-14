import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merges class names so a caller's class can override a component's default instead of
 * landing in the same class list and losing to source order. `clsx` flattens conditionals,
 * `twMerge` then drops the earlier of any two conflicting Tailwind utilities.
 *
 * This matters more here than in a stock shadcn project: the primitives in `components/ui/`
 * carry rules that must survive a caller's className (a 44px touch target, an ink-on-amber
 * pairing). Merging keeps those rules expressible as defaults rather than as `!important`.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

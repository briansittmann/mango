import type { CSSProperties } from 'react'
import type { CategoryColor } from '@/lib/data/dashboard'

/**
 * A card face in miniature (`upcoming-charges` → *Expanded state lists pending charges first*): the
 * gradient and inner rim of `wallet-card.tsx`, no text. Hidden from assistive technology; the row
 * names the card in text.
 */
export function CardThumb({ color }: { color: CategoryColor }) {
  return (
    <span
      aria-hidden
      data-card-thumb={color}
      className="card-thumb"
      style={{ '--card-from': `var(--card-from-${color})`, '--card-to': `var(--card-to-${color})` } as CSSProperties}
    />
  )
}

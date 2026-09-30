import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// Adapted from React Bits' Star Border: two brand-colored glows sweep along the top and bottom edges,
// showing through a `thickness`-px gap around the child card.
export function StarBorder({
  children,
  className,
  speed = '6s',
  thickness = 1,
}: {
  children: ReactNode
  className?: string
  speed?: string
  thickness?: number
}) {
  const glow = { background: 'radial-gradient(circle, var(--brand), transparent 10%)', animationDuration: speed }
  return (
    <div className={cn('relative overflow-hidden rounded-card', className)} style={{ padding: `${thickness}px 0` }}>
      <div aria-hidden style={glow} className="absolute -right-[250%] -bottom-[11px] h-6 w-[300%] animate-star-bottom rounded-full opacity-70 motion-reduce:hidden" />
      <div aria-hidden style={glow} className="absolute -top-[10px] -left-[250%] h-6 w-[300%] animate-star-top rounded-full opacity-70 motion-reduce:hidden" />
      <div className="relative">{children}</div>
    </div>
  )
}

import type { CategoryColor } from '@/lib/data/dashboard'
import { cn } from '@/lib/utils'

type CategoryDotProps = {
  color: CategoryColor
  className?: string
}

export function CategoryDot({ color, className }: CategoryDotProps) {
  return (
    <span
      aria-hidden
      className={cn('inline-block size-2.5 shrink-0 rounded-full', className)}
      style={{ background: `var(--cat-${color})` }}
    />
  )
}

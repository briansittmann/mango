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
      style={{
        background: `radial-gradient(circle at 30% 30%, color-mix(in srgb, var(--cat-${color}) 70%, white), var(--cat-${color}) 70%, color-mix(in srgb, var(--cat-${color}) 70%, black))`,
      }}
    />
  )
}

import type { CategoryColor } from '@/lib/data/dashboard'

type CategoryDotProps = {
  color: CategoryColor
  className?: string
}

export function CategoryDot({ color, className }: CategoryDotProps) {
  return (
    <span
      aria-hidden
      className={`inline-block size-2.5 shrink-0 rounded-full ${className ?? ''}`}
      style={{ backgroundColor: `var(--cat-${color})` }}
    />
  )
}

import { Plus } from 'lucide-react'
import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

type AddCategoryTileProps = {
  label: string
  onClick?: () => void
}

// Reads as a hole in the list, not a card: no surface, a dashed hairline border, shorter than a
// collapsed CategoryCard. Hover is gated to fine pointers (design-system's `hover-fine`), since a
// touch tap must never leave the hover look behind; press is a plain scale, gated to
// `motion-safe` so reduced motion drops the movement while the colour states still change.
export const AddCategoryTile = forwardRef<HTMLButtonElement, AddCategoryTileProps>(function AddCategoryTile(
  { label, onClick },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'group flex min-h-12 w-full items-center justify-center gap-2 rounded-card border border-dashed border-muted-foreground/50 bg-transparent text-body-lg font-medium text-muted-foreground',
        'transition-[border-color,background-color,color] duration-200 ease-out',
        'hover-fine:hover:border-foreground/60 hover-fine:hover:bg-foreground/[0.04] hover-fine:hover:text-foreground',
        'motion-safe:transition-[border-color,background-color,color,scale] motion-safe:active:scale-[0.98]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring outline-none',
        'disabled:pointer-events-none disabled:opacity-50',
      )}
    >
      <Plus
        aria-hidden
        strokeWidth={2.5}
        className="size-4 motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out motion-safe:hover-fine:group-hover:rotate-90"
      />
      {label}
    </button>
  )
})

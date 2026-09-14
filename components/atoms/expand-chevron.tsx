import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

type ExpandChevronProps = {
  open: boolean
  className?: string
}

export function ExpandChevron({ open, className }: ExpandChevronProps) {
  return (
    <ChevronDown
      aria-hidden
      className={cn(
        'size-5 shrink-0 transition-transform',
        open ? 'rotate-180 text-brand-ink' : 'text-muted-foreground',
        className,
      )}
    />
  )
}

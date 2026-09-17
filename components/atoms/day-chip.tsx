import { cn } from '@/lib/utils'

type DayChipProps = {
  day: number
  className?: string
}

export function DayChip({ day, className }: DayChipProps) {
  return (
    <span
      className={cn(
        'inline-flex h-6 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-label-ui text-muted-foreground',
        className,
      )}
      style={{ fontVariantNumeric: 'tabular-nums' }}
    >
      {day}
    </span>
  )
}

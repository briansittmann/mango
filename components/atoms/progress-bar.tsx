import type { BudgetStatus } from '@/lib/data/dashboard'

type ProgressBarProps = {
  usage: number
  level: BudgetStatus['level']
}

const LEVEL_CLASSES: Record<BudgetStatus['level'], string> = {
  ok: 'bg-brand',
  warning: 'bg-warning',
  exceeded: 'bg-destructive',
}

export function ProgressBar({ usage, level }: ProgressBarProps) {
  const width = Math.min(1, Math.max(0, usage)) * 100

  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className={`h-full rounded-full ${LEVEL_CLASSES[level]}`} style={{ width: `${width}%` }} />
    </div>
  )
}

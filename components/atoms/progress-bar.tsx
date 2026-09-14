import type { BudgetStatus } from '@/lib/data/dashboard'

type ProgressBarProps = {
  usage: number
  level: BudgetStatus['level']
  valueText?: string
}

const LEVEL_VARS: Record<BudgetStatus['level'], string> = {
  ok: '--brand',
  warning: '--warning',
  exceeded: '--destructive',
}

export function ProgressBar({ usage, level, valueText }: ProgressBarProps) {
  const width = Math.min(1, Math.max(0, usage)) * 100
  const colorVar = LEVEL_VARS[level]

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(width * 10) / 10}
      aria-valuetext={valueText}
      className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/10"
    >
      <div
        className="h-full rounded-full"
        style={{ width: `${width}%`, background: `var(${colorVar})` }}
      />
    </div>
  )
}

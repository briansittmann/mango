import type { BudgetStatus } from '@/lib/data/dashboard'

type ProgressBarProps = {
  usage: number
  level: BudgetStatus['level']
}

const LEVEL_VARS: Record<BudgetStatus['level'], string> = {
  ok: '--brand',
  warning: '--warning',
  exceeded: '--destructive',
}

export function ProgressBar({ usage, level }: ProgressBarProps) {
  const width = Math.min(1, Math.max(0, usage)) * 100
  const colorVar = LEVEL_VARS[level]

  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
      <div
        className="h-full rounded-full"
        style={{
          width: `${width}%`,
          background: `linear-gradient(90deg, color-mix(in srgb, var(${colorVar}) 70%, white), var(${colorVar}))`,
        }}
      />
    </div>
  )
}

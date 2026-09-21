import { useEffect, useState } from 'react'
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
  const target = Math.min(1, Math.max(0, usage)) * 100
  const colorVar = LEVEL_VARS[level]
  // Starts at 0 and springs to `target` right after mount, so the fill (and value changes
  // afterwards) always animate in instead of snapping straight to their final width.
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setWidth(target))
    return () => cancelAnimationFrame(frame)
  }, [target])

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(target * 10) / 10}
      aria-valuetext={valueText}
      className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/10"
    >
      <div
        className="progress-fill h-full rounded-full"
        style={{
          width: `${width}%`,
          background: `linear-gradient(90deg, color-mix(in oklab, var(${colorVar}) 88%, black) 0%, var(${colorVar}) 60%, color-mix(in oklab, var(${colorVar}) 90%, white) 100%)`,
        }}
      />
    </div>
  )
}

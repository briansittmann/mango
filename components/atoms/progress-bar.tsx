import { useEffect, useRef, useState } from 'react'
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
  const ref = useRef<HTMLDivElement>(null)
  // Holds at 0 until the bar is actually on screen, so a card below the fold is scrolled to and
  // then springs to `target` instead of arriving already full. Once revealed, later value changes
  // follow `target` straight away and animate through the same transition.
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setRevealed(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setRevealed(true)
        observer.disconnect()
      },
      // Waits until the bar clears the bottom edge, so the fill plays in view and not under it.
      { rootMargin: '0px 0px -15% 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
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
          width: revealed ? `${target}%` : 0,
          background: `linear-gradient(90deg, color-mix(in oklab, var(${colorVar}) 88%, black) 0%, var(${colorVar}) 60%, color-mix(in oklab, var(${colorVar}) 90%, white) 100%)`,
        }}
      />
    </div>
  )
}

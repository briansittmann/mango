import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { BudgetStatus } from '@/lib/data/dashboard'

type ProgressBarProps = {
  usage: number
  level: BudgetStatus['level']
  valueText?: string
  /** Fraction (0-1) where a second, hatched segment ends, drawn after the solid fill. Omit for a plain bar. */
  hatchedTo?: number
}

const LEVEL_VARS: Record<BudgetStatus['level'], string> = {
  ok: '--brand',
  warning: '--warning',
  exceeded: '--destructive',
}

export function ProgressBar({ usage, level, valueText, hatchedTo }: ProgressBarProps) {
  const target = Math.min(1, Math.max(0, usage)) * 100
  const hatchEnd = hatchedTo !== undefined ? Math.min(1, Math.max(0, hatchedTo)) * 100 : null
  const colorVar = LEVEL_VARS[level]
  const ref = useRef<HTMLDivElement>(null)
  // Holds at 0 until the bar is actually on screen, so a card below the fold is scrolled to and
  // then springs to `target` instead of arriving already full. Once revealed, later value changes
  // follow `target` straight away and animate through the same transition.
  const [revealed, setRevealed] = useState(false)
  const prefersReducedMotion = useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false,
  )
  const isRevealed = revealed || prefersReducedMotion

  useEffect(() => {
    if (prefersReducedMotion) return
    const el = ref.current
    if (!el) return
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
  }, [prefersReducedMotion])

  return (
    <div
      ref={ref}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(target * 10) / 10}
      aria-valuetext={valueText}
      className="relative h-1.5 w-full overflow-hidden rounded-full bg-foreground/10"
    >
      <div
        className="progress-fill h-full rounded-full"
        style={{
          width: isRevealed ? `${target}%` : 0,
          background: `linear-gradient(90deg, color-mix(in oklab, var(${colorVar}) 88%, black) 0%, var(${colorVar}) 60%, color-mix(in oklab, var(${colorVar}) 90%, white) 100%)`,
        }}
      />
      {hatchEnd !== null && hatchEnd > target ? (
        <div
          aria-hidden
          className="progress-hatch absolute inset-y-0 rounded-r-full"
          style={{
            left: isRevealed ? `${target}%` : 0,
            width: isRevealed ? `${hatchEnd - target}%` : 0,
            backgroundImage:
              'repeating-linear-gradient(45deg, color-mix(in oklab, var(--muted-foreground) 45%, transparent) 0 3px, transparent 3px 6px)',
          }}
        />
      ) : null}
    </div>
  )
}

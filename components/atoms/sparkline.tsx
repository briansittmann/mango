import { cn } from '@/lib/utils'

type SparklineProps = {
  /** Oldest first; the last point is the shown cycle. */
  points: number[]
  /** Draws the line from left to right the first time this turns true (design D9); false keeps it undrawn. */
  revealed?: boolean
  className?: string
}

const WIDTH = 100
const HEIGHT = 24
/** Keeps the 8px end dot and the 2px stroke inside the box at both extremes. */
const PAD = 4

/**
 * A decorative six-point line (design D6): 2px round-joined stroke in the de-emphasis tone and an
 * 8px dot on the last point in the brand colour, no axis, no label, hidden from assistive
 * technology. The line stretches to its box; `vector-effect` keeps the stroke 2px and the dot is
 * HTML so neither distorts. `pathLength` normalises the dash so the draw is independent of geometry.
 */
export function Sparkline({ points, revealed = true, className }: SparklineProps) {
  if (points.length < 2) return null
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min || 1
  const x = (index: number) => (index / (points.length - 1)) * WIDTH
  const y = (value: number) => HEIGHT - PAD - ((value - min) / span) * (HEIGHT - PAD * 2)
  const coordinates = points.map((value, index) => `${x(index).toFixed(2)},${y(value).toFixed(2)}`).join(' ')
  const lastY = y(points[points.length - 1])

  return (
    <span aria-hidden className={cn('relative block h-6 w-full', className)} data-sparkline>
      {/* Inset by the dot's radius on both sides, so the end dot sits inside the box. */}
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className="absolute inset-y-0 left-1 right-1 h-full w-[calc(100%-8px)] overflow-visible">
        <polyline
          points={coordinates}
          fill="none"
          stroke="var(--chart-muted)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          pathLength={1}
          className="sparkline-stroke"
          data-revealed={revealed ? '' : undefined}
        />
      </svg>
      <span
        className="sparkline-dot absolute size-2 rounded-full bg-brand"
        data-revealed={revealed ? '' : undefined}
        style={{ left: 'calc(100% - 8px)', top: `calc(${((lastY / HEIGHT) * 100).toFixed(2)}% - 4px)` }}
      />
    </span>
  )
}

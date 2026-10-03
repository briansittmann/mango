'use client'

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/utils'

type Anchor = {
  key: string
  content: ReactNode
  /** The trigger's box, relative to the container. */
  left: number
  top: number
  width: number
  height: number
}

type Placement = { left: number; top: number; below: boolean; originX: number }

type TriggerOptions = {
  /** A tap toggles the tooltip (cells, strip segments: marks with no other action). Off, a tap does nothing here. */
  touchToggle?: boolean
}

export type ChartTooltipState = {
  containerRef: (node: HTMLElement | null) => void
  /** The props a mark takes to show its tooltip on hover, focus and (optionally) tap, and to close it with Escape. */
  trigger: (key: string, content: ReactNode, options?: TriggerOptions) => TriggerProps
  /** Whether `key` is the mark whose tooltip is showing. */
  activeKey: string | null
  hide: () => void
  /** For `<ChartTooltip>` only. */
  internal: { id: string; anchor: Anchor | null; open: boolean; instant: boolean; container: HTMLElement | null }
}

type TriggerProps = {
  'aria-describedby': string | undefined
  onPointerEnter: (event: ReactPointerEvent<Element>) => void
  onPointerLeave: (event: ReactPointerEvent<Element>) => void
  onPointerDown: (event: ReactPointerEvent<Element>) => void
  onFocus: (event: FocusEvent<Element>) => void
  onBlur: (event: FocusEvent<Element>) => void
  onKeyDown: (event: KeyboardEvent<Element>) => void
}

/** Opening another tooltip within this window of closing one skips the delay and the motion (recipies.md → Tooltip). */
const INSTANT_WINDOW_MS = 400
const EXIT_MS = 120
const GAP_PX = 6

/**
 * One tooltip per chart (design D6): a small popover positioned over the hovered or focused mark,
 * inside the chart's own container. Mount `<ChartTooltip state={…} />` once inside the container
 * and spread `state.trigger(key, content)` on each mark.
 */
export function useChartTooltip(): ChartTooltipState {
  const id = useId()
  const [container, setContainer] = useState<HTMLElement | null>(null)
  const [anchor, setAnchor] = useState<Anchor | null>(null)
  const [open, setOpen] = useState(false)
  const [instant, setInstant] = useState(false)
  const closedAtRef = useRef(0)
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeElementRef = useRef<Element | null>(null)
  const touchOpenRef = useRef(false)

  const containerRef = useCallback((node: HTMLElement | null) => setContainer(node), [])

  const show = useCallback(
    (element: Element, key: string, content: ReactNode) => {
      if (!container) return
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current)
        exitTimerRef.current = null
      }
      const c = container.getBoundingClientRect()
      const r = element.getBoundingClientRect()
      activeElementRef.current = element
      setInstant(performance.now() - closedAtRef.current < INSTANT_WINDOW_MS)
      setAnchor({ key, content, left: r.left - c.left, top: r.top - c.top, width: r.width, height: r.height })
      setOpen(true)
    },
    [container],
  )

  const hide = useCallback(() => {
    if (!activeElementRef.current) return
    activeElementRef.current = null
    touchOpenRef.current = false
    closedAtRef.current = performance.now()
    setOpen(false)
    exitTimerRef.current = setTimeout(() => setAnchor(null), EXIT_MS)
  }, [])

  // A tap elsewhere closes a tooltip a tap opened.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!touchOpenRef.current) return
      const active = activeElementRef.current
      if (active && event.target instanceof Node && active.contains(event.target)) return
      hide()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [open, hide])

  useEffect(
    () => () => {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
    },
    [],
  )

  const trigger = useCallback(
    (key: string, content: ReactNode, options: TriggerOptions = {}): TriggerProps => ({
      'aria-describedby': open && anchor?.key === key ? id : undefined,
      onPointerEnter: (event) => {
        if (event.pointerType === 'touch') return
        show(event.currentTarget, key, content)
      },
      onPointerLeave: (event) => {
        if (event.pointerType === 'touch') return
        if (document.activeElement === event.currentTarget) return
        hide()
      },
      onPointerDown: (event) => {
        if (event.pointerType !== 'touch' || !options.touchToggle) return
        if (activeElementRef.current === event.currentTarget) {
          hide()
          return
        }
        show(event.currentTarget, key, content)
        touchOpenRef.current = true
      },
      onFocus: (event) => show(event.currentTarget, key, content),
      onBlur: () => hide(),
      onKeyDown: (event) => {
        if (event.key !== 'Escape' || activeElementRef.current !== event.currentTarget) return
        event.stopPropagation()
        hide()
      },
    }),
    [show, hide, open, anchor?.key, id],
  )

  return {
    containerRef,
    trigger,
    activeKey: open ? (anchor?.key ?? null) : null,
    hide,
    internal: { id, anchor, open, instant, container },
  }
}

/** The popover itself: mount once inside the container `state.containerRef` was given. */
export function ChartTooltip({ state, className }: { state: ChartTooltipState; className?: string }) {
  const { id, anchor, open, instant, container } = state.internal
  const ref = useRef<HTMLDivElement>(null)
  const [placement, setPlacement] = useState<Placement | null>(null)

  // Centred over the mark, kept inside the container, flipped under the mark when there is no
  // room above; the origin stays at the mark so the popover comes out of what was pointed at.
  useLayoutEffect(() => {
    const node = ref.current
    if (!node || !anchor || !container) {
      setPlacement(null)
      return
    }
    const width = node.offsetWidth
    const height = node.offsetHeight
    const centre = anchor.left + anchor.width / 2
    const left = Math.max(0, Math.min(centre - width / 2, container.clientWidth - width))
    const below = anchor.top - height - GAP_PX < 0
    const top = below ? anchor.top + anchor.height + GAP_PX : anchor.top - height - GAP_PX
    setPlacement({ left, top, below, originX: centre - left })
  }, [anchor, container])

  if (!anchor) return null

  return (
    <div
      ref={ref}
      id={id}
      role="tooltip"
      data-open={open && placement ? '' : undefined}
      data-instant={instant ? '' : undefined}
      className={cn(
        'chart-tooltip pointer-events-none absolute z-10 max-w-[220px] rounded-lg bg-tooltip-bg px-2.5 py-1.5 text-body-sm text-tooltip-fg shadow-[0_6px_20px_-8px_rgba(0,0,0,0.45)]',
        className,
      )}
      style={{
        left: placement?.left ?? 0,
        top: placement?.top ?? 0,
        transformOrigin: placement ? `${placement.originX}px ${placement.below ? '0%' : '100%'}` : undefined,
        visibility: placement ? undefined : 'hidden',
      }}
    >
      {anchor.content}
    </div>
  )
}

/** Value first, label after (dataviz → *Values lead, labels follow*). */
export function TooltipValue({ value, label }: { value: ReactNode; label?: ReactNode }) {
  return (
    <span className="flex flex-col">
      <span className="font-semibold tabular-nums">{value}</span>
      {label ? <span className="text-tooltip-fg/70">{label}</span> : null}
    </span>
  )
}

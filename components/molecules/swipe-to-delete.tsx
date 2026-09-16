import { useEffect, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import { Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Collapsible } from '@/components/atoms/collapsible'
import { cn } from '@/lib/utils'

type SwipeToDeleteProps = {
  onDelete: () => Promise<void>
  children: ReactNode
}

const LOCK_THRESHOLD_PX = 10
const PANEL_RATIO = 0.25
const MIN_PANEL_PX = 44
const ARM_RATIO = 0.6

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

export function SwipeToDelete({ onDelete, children }: SwipeToDeleteProps) {
  const t = useTranslations('hojaGasto')
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [armed, setArmed] = useState(false)
  const [removing, setRemoving] = useState(false)

  const offsetRef = useRef(0)
  const widthRef = useRef(0)
  const draggedRef = useRef(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const gestureRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    startOffset: number
    locked: 'horizontal' | 'vertical' | null
  } | null>(null)

  function updateOffset(value: number) {
    offsetRef.current = value
    setOffset(value)
  }

  useEffect(() => {
    if (dragging || removing || offset === 0) return

    function close(event: Event) {
      // A press on the row itself is handled by handleClickCapture (which also swallows the
      // resulting click); only an outside press should close it here.
      if (event.target instanceof Node && contentRef.current?.contains(event.target)) return
      offsetRef.current = 0
      setOffset(0)
    }

    document.addEventListener('pointerdown', close)
    window.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('pointerdown', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [dragging, removing, offset])

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (removing) return
    widthRef.current = event.currentTarget.getBoundingClientRect().width
    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startOffset: offsetRef.current,
      locked: null,
    }
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return

    const dx = event.clientX - gesture.startX
    const dy = event.clientY - gesture.startY

    if (gesture.locked === null) {
      if (Math.hypot(dx, dy) < LOCK_THRESHOLD_PX) return
      gesture.locked = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical'
      if (gesture.locked !== 'horizontal') {
        gestureRef.current = null
        return
      }
      event.currentTarget.setPointerCapture(event.pointerId)
      draggedRef.current = true
      setDragging(true)
    }

    const width = widthRef.current
    const next = Math.min(0, Math.max(-width, gesture.startOffset + dx))
    updateOffset(next)
    setArmed(next < -width * ARM_RATIO)
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    gestureRef.current = null
    if (gesture.locked !== 'horizontal') return

    setDragging(false)
    setArmed(false)
    const width = widthRef.current
    const panel = Math.max(width * PANEL_RATIO, MIN_PANEL_PX)
    const current = offsetRef.current

    if (current < -width * ARM_RATIO) {
      void runDelete()
    } else if (current < -panel / 2) {
      updateOffset(-panel)
    } else {
      updateOffset(0)
    }
  }

  async function runDelete() {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reducedMotion) {
      setRemoving(true)
      try {
        await onDelete()
      } catch {
        setRemoving(false)
        updateOffset(0)
      }
      return
    }

    updateOffset(-widthRef.current)
    await wait(220)
    setRemoving(true)
    await wait(250)
    try {
      await onDelete()
    } catch {
      setRemoving(false)
      updateOffset(0)
    }
  }

  function handleClickCapture(event: MouseEvent<HTMLDivElement>) {
    if (offsetRef.current !== 0) {
      event.preventDefault()
      event.stopPropagation()
      updateOffset(0)
      return
    }
    if (draggedRef.current) {
      draggedRef.current = false
      event.preventDefault()
      event.stopPropagation()
    }
  }

  const panel = Math.max(widthRef.current * PANEL_RATIO, MIN_PANEL_PX)
  const panelWidth = Math.max(panel, -offset)

  return (
    <Collapsible open={!removing} className="motion-safe:starting:grid-rows-[0fr]">
      <div className="relative overflow-hidden">
        <div
          className="absolute inset-y-0 right-0 flex items-center bg-destructive-fill"
          style={{ width: `${panelWidth}px` }}
          inert={offset === 0}
          aria-hidden={offset === 0}
        >
          <button
            type="button"
            onClick={() => void runDelete()}
            className={cn(
              'flex h-full items-center gap-1.5 px-4 text-label-ui font-medium text-destructive-fill-foreground',
              armed ? 'ml-auto' : 'mx-auto',
            )}
          >
            <Trash2 aria-hidden className="size-4" />
            {t('eliminar')}
          </button>
        </div>
        <div
          ref={contentRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClickCapture={handleClickCapture}
          style={{ transform: `translateX(${offset}px)` }}
          className={cn(
            'relative touch-pan-y bg-card',
            !dragging && 'transition-transform motion-reduce:transition-none',
            removing ? 'duration-[220ms] ease-in' : 'duration-[450ms] ease-spring',
            offset !== 0 && 'shadow-[12px_0_24px_-12px_var(--sheet-shadow)]',
          )}
        >
          {children}
        </div>
      </div>
    </Collapsible>
  )
}

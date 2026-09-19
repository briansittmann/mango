import { useEffect, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import { Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Collapsible } from '@/components/atoms/collapsible'
import { cn } from '@/lib/utils'

type SwipeToDeleteProps = {
  onDelete: () => Promise<void>
  children: ReactNode
}

// Un desliz corto basta para abrir: el umbral es bajo y el eje se decide con sesgo horizontal.
const LOCK_THRESHOLD_PX = 6
const HORIZONTAL_BIAS = 0.7
const ACTION_SIZE_PX = 44
const ACTION_GUTTER_PX = 12
const PANEL_PX = ACTION_SIZE_PX + ACTION_GUTTER_PX * 2
const OPEN_RATIO = 0.4
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
  const actionRef = useRef<HTMLDivElement>(null)
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
      // resulting click); only an outside press should close it here. El boton de eliminar
      // tambien queda fuera: cerrarlo al presionarlo mataria su propio click.
      if (event.target instanceof Node && contentRef.current?.contains(event.target)) return
      if (event.target instanceof Node && actionRef.current?.contains(event.target)) return
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
    draggedRef.current = false
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
      gesture.locked = Math.abs(dx) > Math.abs(dy) * HORIZONTAL_BIAS ? 'horizontal' : 'vertical'
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
    const width = widthRef.current
    const current = offsetRef.current

    // Desliz completo: borra directo. Desliz corto: queda abierto con el boton a la vista.
    if (current < -width * ARM_RATIO) {
      void runDelete()
      return
    }

    setArmed(false)
    updateOffset(current < -PANEL_PX * OPEN_RATIO ? -PANEL_PX : 0)
  }

  async function runDelete() {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reducedMotion) {
      setRemoving(true)
      try {
        await onDelete()
      } catch {
        setRemoving(false)
        setArmed(false)
        updateOffset(0)
      }
      return
    }

    // El circulo se estira a panel completo mientras la fila termina de salir.
    setArmed(true)
    updateOffset(-(widthRef.current || contentRef.current?.getBoundingClientRect().width || 0))
    await wait(220)
    setRemoving(true)
    await wait(250)
    try {
      await onDelete()
    } catch {
      setRemoving(false)
      setArmed(false)
      updateOffset(0)
    }
  }

  function handleClickCapture(event: MouseEvent<HTMLDivElement>) {
    // El click que sigue a un arrastre se traga sin tocar el estado: si no, el panel recien
    // abierto se cerraria solo. Un click limpio con el panel abierto si lo cierra.
    if (draggedRef.current) {
      draggedRef.current = false
      event.preventDefault()
      event.stopPropagation()
      return
    }
    if (offsetRef.current !== 0) {
      event.preventDefault()
      event.stopPropagation()
      updateOffset(0)
    }
  }

  const panelWidth = Math.max(PANEL_PX, -offset)
  // El circulo entra a escala con el desliz y, al armarse, se estira a panel completo.
  const actionScale = armed ? 1 : Math.min(1, Math.max(0, -offset / (PANEL_PX * 0.7)))

  return (
    <Collapsible open={!removing} className="motion-safe:starting:grid-rows-[0fr]">
      <div className="relative overflow-hidden">
        <div
          ref={actionRef}
          className="absolute inset-y-0 right-0 flex items-center justify-end"
          style={{ width: `${panelWidth}px`, paddingRight: armed ? 0 : `${ACTION_GUTTER_PX}px` }}
          inert={offset === 0}
          aria-hidden={offset === 0}
        >
          <button
            type="button"
            onClick={() => void runDelete()}
            aria-label={t('eliminar')}
            className="grid shrink-0 place-items-center bg-destructive-fill text-destructive-fill-foreground transition-[width,height,border-radius,transform] duration-[260ms] ease-spring motion-reduce:transition-none"
            style={{
              width: armed ? `${panelWidth}px` : `${ACTION_SIZE_PX}px`,
              height: armed ? '100%' : `${ACTION_SIZE_PX}px`,
              borderRadius: armed ? 0 : '9999px',
              transform: `scale(${actionScale})`,
            }}
          >
            <Trash2 aria-hidden className="size-5" />
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

import { Check } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { cn } from '@/lib/utils'
import type { CategoryColor } from '@/lib/data/dashboard'

export const CATEGORY_COLORS: CategoryColor[] = [
  'granate',
  'rojo',
  'coral',
  'rosa',
  'naranja_calido',
  'violeta_metalico',
  'azul_electrico',
  'azul_apagado',
  'celeste',
  'turquesa',
  'verde_menta',
  'verde_profundo',
  'gris_calido',
  'gris_oscuro',
  'blanco',
]

type ColorSwatchPickerProps = {
  value: CategoryColor
  onChange: (color: CategoryColor) => void
  labelledBy: string
  disabled?: boolean
}

export function ColorSwatchPicker({ value, onChange, labelledBy, disabled }: ColorSwatchPickerProps) {
  const t = useTranslations('hojaCategoria.colores')
  const selectedRef = useRef<HTMLButtonElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  // Arrastre con mouse: el touch ya tiene su propio scroll nativo.
  const dragRef = useRef<{ x: number; left: number } | null>(null)
  const movedRef = useRef(false)
  const [dragging, setDragging] = useState(false)
  // La manito solo aparece si los swatches no entran en una fila: sin desborde no hay que arrastrar.
  const [scrollable, setScrollable] = useState(false)

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' })
    // solo al abrir: centrar el color actual dentro del carrusel
  }, [])

  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const measure = () => setScrollable(track.scrollWidth > track.clientWidth + 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(track)
    return () => observer.disconnect()
  }, [])

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || !scrollable || event.pointerType !== 'mouse' || event.button !== 0 || !trackRef.current) return
    dragRef.current = { x: event.clientX, left: trackRef.current.scrollLeft }
    movedRef.current = false
    setDragging(true)
  }

  // El drawer captura el puntero al apoyarlo sobre la hoja, asi que los `pointermove` ya no
  // llegan a la pista: se escuchan en window, donde igual burbujean.
  useEffect(() => {
    if (!dragging) return
    const move = (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag || !trackRef.current) return
      const dx = event.clientX - drag.x
      if (!movedRef.current && Math.abs(dx) < 4) return
      movedRef.current = true
      trackRef.current.scrollLeft = drag.left - dx
    }
    const end = () => {
      dragRef.current = null
      setDragging(false)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }
  }, [dragging])

  return (
    <div
      ref={trackRef}
      role="radiogroup"
      aria-labelledby={labelledBy}
      onPointerDown={startDrag}
      // Soltar tras arrastrar no debe elegir el swatch que quedó bajo el cursor.
      onClickCapture={(event) => {
        if (!movedRef.current) return
        movedRef.current = false
        event.preventDefault()
        event.stopPropagation()
      }}
      className={cn(
        'no-scrollbar flex select-none gap-1 overflow-x-auto px-3',
        dragging ? 'cursor-grabbing' : 'snap-x snap-mandatory',
        scrollable && !dragging && 'hover-fine:cursor-grab',
      )}
    >
      {CATEGORY_COLORS.map((color) => {
        const selected = value === color
        return (
          <button
            key={color}
            ref={selected ? selectedRef : undefined}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={t(color)}
            disabled={disabled}
            onClick={() => onChange(color)}
            className="pressable relative grid size-11 shrink-0 snap-center place-items-center rounded-full cursor-[inherit] [--press-scale:0.94] disabled:opacity-50"
          >
            <span
              aria-hidden
              className={cn('size-7 rounded-full ring-1 ring-border', selected && 'ring-2 ring-foreground')}
              style={{ background: `var(--cat-${color})` }}
            />
            {selected ? (
              <span aria-hidden className="absolute bottom-1 right-1 grid size-4 place-items-center rounded-full bg-card ring-1 ring-border">
                <Check className="size-2.5 text-foreground" strokeWidth={3} />
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

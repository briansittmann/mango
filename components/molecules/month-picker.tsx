'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

type MonthPickerProps = {
  month: string
  inProgress: boolean
  open: boolean
  onSelect?: (month: string) => void
  onClose: () => void
  align?: 'start' | 'center'
}

export function MonthPicker({ month, inProgress, open, onSelect, onClose, align = 'center' }: MonthPickerProps) {
  const t = useTranslations('dashboard')
  const format = useFormatter()
  const currentYear = Number(month.slice(0, 4))
  const [year, setYear] = useState(currentYear)
  const [wasOpen, setWasOpen] = useState(open)
  const dialogRef = useRef<HTMLDivElement>(null)

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setYear(currentYear)
  }

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Element | null
      if (dialogRef.current?.contains(target)) return
      if (target?.closest('[data-month-picker-trigger]')) return
      onClose()
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-label={t('seleccionarMes')}
      inert={!open}
      className={cn(
        'liquid-glass absolute top-full z-40 mt-3 w-[min(320px,calc(100vw-32px))] origin-top rounded-[28px] p-2.5 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none',
        align === 'center' ? 'left-1/2 -translate-x-1/2' : 'left-0',
        open ? 'visible scale-100 opacity-100' : 'invisible -translate-y-2 scale-95 opacity-0',
      )}
    >
      <div className="flex items-center justify-between rounded-full bg-foreground/[0.04] p-0.5">
        <button
          type="button"
          onClick={() => setYear((y) => y - 1)}
          aria-label={t('anioAnterior')}
          className="grid size-10 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
        >
          <ChevronLeft aria-hidden className="size-4" />
        </button>
        <span className="font-display text-headline-sm tabular-nums text-foreground">{year}</span>
        <button
          type="button"
          onClick={() => setYear((y) => y + 1)}
          disabled={inProgress && year >= currentYear}
          aria-label={t('anioSiguiente')}
          className="grid size-10 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronRight aria-hidden className="size-4" />
        </button>
      </div>

      <div className="mt-2.5 grid grid-cols-3 gap-1.5">
        {Array.from({ length: 12 }, (_, index) => {
          const value = `${year}-${String(index + 1).padStart(2, '0')}`
          const selected = value === month
          const future = inProgress && value > month
          return (
            <button
              key={value}
              type="button"
              disabled={!onSelect || future}
              aria-current={selected ? 'date' : undefined}
              onClick={() => onSelect?.(value)}
              className={cn(
                'h-11 rounded-2xl text-label-ui capitalize transition-all duration-200 disabled:pointer-events-none',
                selected
                  ? 'bg-primary font-semibold text-primary-foreground shadow-[0_6px_18px_-4px_color-mix(in_oklab,var(--primary)_55%,transparent)]'
                  : 'text-foreground hover:bg-foreground/[0.06] active:scale-95',
                future && 'opacity-30',
              )}
            >
              {format.dateTime(new Date(Date.UTC(year, index, 1)), { month: 'short', timeZone: 'UTC' })}
            </button>
          )
        })}
      </div>
    </div>
  )
}

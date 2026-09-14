'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

type MonthSelectorProps = {
  month: string
  inProgress: boolean
  onPrevious?: () => void
  onNext?: () => void
  onSelect?: (month: string) => void
}

export function MonthSelector({ month, inProgress, onPrevious, onNext, onSelect }: MonthSelectorProps) {
  const t = useTranslations('dashboard')
  const format = useFormatter()
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(() => Number(month.slice(0, 4)))
  const rootRef = useRef<HTMLDivElement>(null)
  const monthName = format.dateTime(new Date(`${month}-01T00:00:00Z`), { month: 'long', timeZone: 'UTC' })
  const currentYear = Number(month.slice(0, 4))

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function toggle() {
    if (!open) setYear(currentYear)
    setOpen((prev) => !prev)
  }

  return (
    <div ref={rootRef} className="relative flex justify-center">
      <div className="liquid-glass flex h-10 items-center rounded-full px-0.5">
        <button
          type="button"
          onClick={onPrevious}
          disabled={!onPrevious}
          aria-label={t('cicloAnterior')}
          className="grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronLeft aria-hidden className="size-4" />
        </button>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={t('seleccionarMes')}
          className="flex h-8 min-w-[120px] items-center justify-center gap-2 rounded-full px-3 transition-colors hover:bg-foreground/[0.05]"
        >
          {inProgress ? (
            <span className="relative flex size-2">
              <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-brand opacity-60" />
              <span className="relative size-2 rounded-full bg-brand" />
              <span className="sr-only">{t('enCurso')}</span>
            </span>
          ) : null}
          <span className="font-display text-label-ui font-semibold capitalize text-foreground">{monthName}</span>
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!onNext}
          aria-label={t('cicloSiguiente')}
          className="grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronRight aria-hidden className="size-4" />
        </button>
      </div>

      <div
        role="dialog"
        aria-label={t('seleccionarMes')}
        inert={!open}
        className={cn(
          'liquid-glass absolute left-1/2 top-full z-40 mt-3 w-[min(320px,calc(100vw-32px))] origin-top -translate-x-1/2 rounded-[28px] p-2.5 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
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
                onClick={() => {
                  onSelect?.(value)
                  setOpen(false)
                }}
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
    </div>
  )
}

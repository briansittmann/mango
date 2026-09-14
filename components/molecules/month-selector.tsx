'use client'

import { useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { MonthPicker } from '@/components/molecules/month-picker'

type MonthSelectorProps = {
  variant: 'title' | 'compact'
  month: string
  start: string
  end: string
  inProgress: boolean
  onPrevious?: () => void
  onNext?: () => void
  onSelect?: (month: string) => void
}

export function MonthSelector({ variant, month, start, end, inProgress, onPrevious, onNext, onSelect }: MonthSelectorProps) {
  const t = useTranslations('dashboard')
  const format = useFormatter()
  const [open, setOpen] = useState(false)
  const monthName = format.dateTime(new Date(`${month}-01T00:00:00Z`), { month: 'long', timeZone: 'UTC' })

  function handleSelect(value: string) {
    onSelect?.(value)
    setOpen(false)
  }

  if (variant === 'compact') {
    return (
      <div className="relative flex items-center justify-center gap-1">
        <button
          type="button"
          onClick={onPrevious}
          disabled={!onPrevious}
          aria-label={t('cicloAnterior')}
          className="pressable grid size-target place-items-center rounded-full text-muted-foreground [--press-scale:0.9] disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronLeft aria-hidden className="size-4" />
        </button>
        <button
          type="button"
          data-month-picker-trigger
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-haspopup="dialog"
          className="pressable flex min-h-target items-center gap-1 rounded-full px-2"
        >
          <span className="font-display text-headline-sm capitalize text-foreground">{monthName}</span>
          <span className="sr-only"> {t('seleccionarMes')}</span>
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!onNext}
          aria-label={t('cicloSiguiente')}
          className="pressable grid size-target place-items-center rounded-full text-muted-foreground [--press-scale:0.9] disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronRight aria-hidden className="size-4" />
        </button>
        <MonthPicker
          month={month}
          inProgress={inProgress}
          open={open}
          onSelect={handleSelect}
          onClose={() => setOpen(false)}
          align="center"
        />
      </div>
    )
  }

  const range = format.dateTimeRange(new Date(`${start}T00:00:00Z`), new Date(`${end}T00:00:00Z`), {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })

  return (
    <div className="relative">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          data-month-picker-trigger
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-haspopup="dialog"
          className="pressable -ml-2 flex min-h-target items-center gap-1 rounded-full px-2"
        >
          <span className="font-display text-headline-lg font-bold capitalize text-foreground">{monthName}</span>
          <ChevronDown
            aria-hidden
            className={cn('size-5 text-muted-foreground transition-transform duration-200', open && 'rotate-180')}
          />
          <span className="sr-only"> {t('seleccionarMes')}</span>
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onPrevious}
            disabled={!onPrevious}
            aria-label={t('cicloAnterior')}
            className="pressable grid size-target place-items-center rounded-full text-muted-foreground [--press-scale:0.9] disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronLeft aria-hidden className="size-5" />
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={!onNext}
            aria-label={t('cicloSiguiente')}
            className="pressable grid size-target place-items-center rounded-full text-muted-foreground [--press-scale:0.9] disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronRight aria-hidden className="size-5" />
          </button>
        </div>
      </div>
      <p className="mt-1 flex items-center gap-1.5 text-body-sm">
        {inProgress ? (
          <span className="flex items-center gap-1.5 text-brand-ink">
            <span aria-hidden className="size-1.5 rounded-full bg-brand-ink" />
            {t('enCurso')}
          </span>
        ) : null}
        {inProgress ? (
          <span aria-hidden className="text-muted-foreground">
            ·
          </span>
        ) : null}
        <span className="text-muted-foreground">{range}</span>
      </p>
      <MonthPicker
        month={month}
        inProgress={inProgress}
        open={open}
        onSelect={handleSelect}
        onClose={() => setOpen(false)}
        align="start"
      />
    </div>
  )
}

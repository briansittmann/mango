import { useEffect, useId, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { useAmountFormatter } from '@/components/atoms/amount-format'
import { Collapsible } from '@/components/atoms/collapsible'
import type { DayTotal } from '@/lib/data/weekly-spend'
import { HEAT_STEP_CLASS } from '@/lib/ui/heat-step'
import { cn } from '@/lib/utils'

type DaySelectorProps = {
  /** The day shown, `YYYY-MM-DD`. */
  date: string
  /** Every day of the cycle with its heat step (`dailyTotals`); days after today are not selectable. */
  days: DayTotal[]
  currency: string
  onChange: (date: string) => void
}

/**
 * The day detail's top (`spend-insights` → *Day detail*): arrows around the day's name, laid out like
 * the compact `MonthSelector`. The name unfolds the cycle's days in place, on the calendar's heat
 * ramp — in place, not as a popover, because the sheet clips what overflows it.
 */
export function DaySelector({ date, days, currency, onChange }: DaySelectorProps) {
  const t = useTranslations('graficos')
  const format = useFormatter()
  const { money } = useAmountFormatter()
  const [open, setOpen] = useState(false)
  const gridId = useId()

  const selectable = days.filter((day) => !day.future)
  const index = selectable.findIndex((day) => day.date === date)
  const label = (value: string, options: Pick<Intl.DateTimeFormatOptions, 'weekday' | 'day' | 'month'>) => format.dateTime(new Date(`${value}T12:00:00Z`), { ...options, timeZone: 'UTC' })

  // Escape folds the grid without closing the sheet. On `window` in the capture phase: it runs
  // before the sheet's own dismissal, and Safari does not focus a clicked button, so a listener on
  // the selector would not hear it.
  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [open])

  function pick(value: string) {
    onChange(value)
    setOpen(false)
  }

  return (
    <div data-day-selector>
      <div className="flex items-center justify-center gap-1">
        <button
          type="button"
          onClick={() => onChange(selectable[index - 1].date)}
          disabled={index <= 0}
          aria-label={t('diaAnterior')}
          className="pressable grid size-target place-items-center rounded-full text-muted-foreground [--press-scale:0.9] disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronLeft aria-hidden className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-controls={gridId}
          className="pressable flex min-h-target items-center gap-1 rounded-full px-2"
          data-day-selector-trigger
        >
          <span className="inline-block font-display text-headline-sm text-foreground first-letter:uppercase">{label(date, { weekday: 'long', day: 'numeric', month: 'short' })}</span>
          <span className="sr-only"> {t('seleccionarDia')}</span>
        </button>
        <button
          type="button"
          onClick={() => onChange(selectable[index + 1].date)}
          disabled={index < 0 || index >= selectable.length - 1}
          aria-label={t('diaSiguiente')}
          className="pressable grid size-target place-items-center rounded-full text-muted-foreground [--press-scale:0.9] disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronRight aria-hidden className="size-4" />
        </button>
      </div>
      <Collapsible open={open} id={gridId}>
        <div
          role="group"
          aria-label={t('seleccionarDia')}
          className={cn(
            'mx-auto mt-2 w-[min(320px,100%)] origin-top rounded-[28px] bg-foreground/[0.04] p-2.5 transition-[scale] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none',
            open ? 'scale-100' : 'scale-95',
          )}
          data-day-grid
        >
          <div className="grid grid-cols-7 gap-0.5">
            {days.map((day) => {
              const selected = day.date === date
              return (
                <button
                  key={day.date}
                  type="button"
                  disabled={day.future}
                  aria-current={selected ? 'date' : undefined}
                  aria-label={`${label(day.date, { weekday: 'long', day: 'numeric', month: 'long' })}${day.today ? ` (${t('hoy')})` : ''} · ${day.total > 0 ? money(day.total, currency) : t('sinGastos')}`}
                  onClick={() => pick(day.date)}
                  data-day-option={day.date}
                  className={cn(
                    'grid aspect-square place-items-center rounded-md text-label-ui tabular-nums transition-[scale,outline-color] duration-200 ease-[var(--ease-out)] active:scale-[0.92] disabled:pointer-events-none motion-reduce:transition-none',
                    HEAT_STEP_CLASS[day.step],
                    day.future && 'bg-transparent text-muted-foreground/60 ring-1 ring-inset ring-border',
                    day.today && 'shadow-[inset_0_0_0_2px_var(--foreground)]',
                    // A ring, not a fill: the fill is the day's figure.
                    selected && 'font-semibold outline-2 outline-offset-2 outline-primary',
                  )}
                >
                  <span aria-hidden>{day.day}</span>
                </button>
              )
            })}
          </div>
        </div>
      </Collapsible>
    </div>
  )
}

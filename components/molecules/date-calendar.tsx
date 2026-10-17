import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useFormatter, useLocale, useTranslations } from 'next-intl'
import { Collapsible } from '@/components/atoms/collapsible'
import { cn } from '@/lib/utils'

type DateCalendarProps = {
  id: string
  open: boolean
  /** The selected day, `YYYY-MM-DD`. */
  value: string
  min?: string
  max?: string
  onSelect: (date: string) => void
  onClose: () => void
}

function localToday() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function shiftMonth(month: string, delta: number) {
  const date = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + delta, 1))
  return date.toISOString().slice(0, 7)
}

/**
 * The entry sheet's date picker: a month of days that unfolds under the "Fecha" row. In place, not
 * as a popover, because the sheet clips what overflows it (same reason as `DaySelector`). Days
 * outside `min`–`max` are disabled, and so are the arrows past them.
 */
export function DateCalendar({ id, open, value, min, max, onSelect, onClose }: DateCalendarProps) {
  const t = useTranslations('hojaMovimiento')
  const format = useFormatter()
  const locale = useLocale()
  const [wasOpen, setWasOpen] = useState(open)
  // Nothing renders until the first open: the sheet is mounted on the server too, and the weekday
  // initials and "today" come from the browser.
  const [shown, setShown] = useState(open)
  const [today, setToday] = useState<string | null>(null)
  const [month, setMonth] = useState(value.slice(0, 7))
  const [direction, setDirection] = useState<'next' | 'prev' | null>(null)

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setShown(true)
      setToday(localToday())
      setMonth(value.slice(0, 7))
      setDirection(null)
    }
  }

  // Escape folds the calendar without closing the sheet: capture phase, ahead of the drawer.
  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [open, onClose])

  const weekStart = locale === 'en' ? 0 : 1
  const year = Number(month.slice(0, 4))
  const monthIndex = Number(month.slice(5, 7)) - 1
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
  const offset = (new Date(Date.UTC(year, monthIndex, 1)).getUTCDay() - weekStart + 7) % 7
  const canGoBack = !min || month > min.slice(0, 7)
  const canGoForward = !max || month < max.slice(0, 7)

  function go(delta: number) {
    setDirection(delta > 0 ? 'next' : 'prev')
    setMonth((prev) => shiftMonth(prev, delta))
  }

  return (
    <Collapsible open={open} id={id}>
      {shown ? (
        <div
          role="group"
          aria-label={t('elegirFecha')}
          data-base-ui-swipe-ignore
          data-date-calendar
          className={cn(
            'mx-inset mb-3 origin-top rounded-[28px] bg-foreground/[0.04] p-2.5 transition-[scale] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none',
            open ? 'scale-100' : 'scale-95',
          )}
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => go(-1)}
              disabled={!canGoBack}
              aria-label={t('mesAnterior')}
              className="pressable grid size-target place-items-center rounded-full text-muted-foreground [--press-scale:0.9] hover:bg-foreground/[0.06] hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronLeft aria-hidden className="size-4" />
            </button>
            <span aria-live="polite" className="font-display text-headline-sm text-foreground first-letter:uppercase">
              {format.dateTime(new Date(Date.UTC(year, monthIndex, 1)), { month: 'long', year: 'numeric', timeZone: 'UTC' })}
            </span>
            <button
              type="button"
              onClick={() => go(1)}
              disabled={!canGoForward}
              aria-label={t('mesSiguiente')}
              className="pressable grid size-target place-items-center rounded-full text-muted-foreground [--press-scale:0.9] hover:bg-foreground/[0.06] hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronRight aria-hidden className="size-4" />
            </button>
          </div>

          <div aria-hidden className="mt-1 grid grid-cols-7 text-center text-label-ui text-muted-foreground">
            {Array.from({ length: 7 }, (_, index) => (
              <span key={index} className="py-1.5 capitalize">
                {/* 7 Jan 2024 was a Sunday. */}
                {format.dateTime(new Date(Date.UTC(2024, 0, 7 + ((weekStart + index) % 7))), { weekday: 'narrow', timeZone: 'UTC' })}
              </span>
            ))}
          </div>

          <div
            key={month}
            className={cn(
              'grid grid-cols-7 gap-y-0.5 motion-reduce:animate-none',
              direction === 'next' && 'animate-[calendar-in-next_250ms_var(--ease-out)_both]',
              direction === 'prev' && 'animate-[calendar-in-prev_250ms_var(--ease-out)_both]',
            )}
          >
            {Array.from({ length: offset }, (_, index) => (
              <span key={`blank-${index}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, index) => {
              const date = `${month}-${String(index + 1).padStart(2, '0')}`
              const selected = date === value
              const isToday = date === today
              const outside = (min !== undefined && date < min) || (max !== undefined && date > max)
              return (
                <button
                  key={date}
                  type="button"
                  disabled={outside}
                  aria-pressed={selected}
                  aria-current={isToday ? 'date' : undefined}
                  aria-label={format.dateTime(new Date(`${date}T12:00:00Z`), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}
                  onClick={() => onSelect(date)}
                  data-date-option={date}
                  className={cn(
                    'mx-auto grid size-10 place-items-center rounded-full text-body-md tabular-nums transition-[scale,background-color,color] duration-200 ease-[var(--ease-out)] active:scale-[0.9] disabled:pointer-events-none disabled:opacity-30 motion-reduce:transition-none',
                    selected
                      ? 'bg-primary font-semibold text-primary-foreground shadow-[0_6px_18px_-4px_color-mix(in_oklab,var(--primary)_55%,transparent)]'
                      : isToday
                        ? 'font-semibold text-primary shadow-[inset_0_0_0_1.5px_currentColor] hover:bg-foreground/[0.06]'
                        : 'text-foreground hover:bg-foreground/[0.06]',
                  )}
                >
                  {index + 1}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </Collapsible>
  )
}

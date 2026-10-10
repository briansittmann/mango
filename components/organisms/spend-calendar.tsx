'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { useAmountFormatter } from '@/components/atoms/amount-format'
import { useFirstReveal } from '@/components/hooks/use-first-reveal'
import { ChartTooltip, TooltipValue, useChartTooltip } from '@/components/molecules/chart-tooltip'
import { WidgetHeader } from '@/components/molecules/widget-header'
import { SpotlightCard } from '@/components/ui/spotlight-card'
import type { DashboardData, ExpenseGroup } from '@/lib/data/dashboard'
// Pure arithmetic over the rows the dashboard already holds (design D3), not data access.
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { dailyTotals, type DayTotal } from '@/lib/data/weekly-spend'
import { HEAT_STEP_CLASS } from '@/lib/ui/heat-step'
import { cn } from '@/lib/utils'

type SpendCalendarProps = {
  groups: ExpenseGroup[]
  cycle: DashboardData['cycle']
  timeZone: string
  currency: string
  /** Opens a day's detail (`spend-insights` → *Day detail*); days after today have no action. */
  onSelectDay?: (date: string) => void
  /** The widget list's grip, at the end of the header. */
  trailing?: ReactNode
}

const STAGGER_MS = 15
const SETTLE_MS = 900

const STEP_CLASS = HEAT_STEP_CLASS

/**
 * "Gasto por día" (`spend-insights`): one cell per local day of the cycle in rows of seven from the
 * cycle's first day, filled on the brand ramp by quantile of the cycle's spending days; today
 * outlined, future days muted. The grid is HTML (design D7): each cell is a button named with its
 * date and figure, with a tooltip on hover and focus, that opens the day's detail.
 */
export function SpendCalendar({ groups, cycle, timeZone, currency, onSelectDay, trailing }: SpendCalendarProps) {
  const t = useTranslations('graficos')
  const format = useFormatter()
  const { money } = useAmountFormatter()
  const tooltip = useChartTooltip()
  const [revealRef, revealed] = useFirstReveal<HTMLDivElement>()
  const [settled, setSettled] = useState(false)

  const days = useMemo(() => dailyTotals(groups, cycle.start, cycle.end, timeZone, cycle.today), [groups, cycle.start, cycle.end, cycle.today, timeZone])

  useEffect(() => {
    if (!revealed) return
    const timer = setTimeout(() => setSettled(true), SETTLE_MS)
    return () => clearTimeout(timer)
  }, [revealed])

  const longDate = (date: string) => format.dateTime(new Date(`${date}T12:00:00Z`), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
  const dayText = (day: DayTotal) => (day.total > 0 ? `${money(day.total, currency)} · ${t('filas', { n: day.rows })}` : t('sinGastos'))
  const titleId = 'spend-calendar-title'

  return (
    <SpotlightCard
      ref={(node) => {
        revealRef(node)
        tooltip.containerRef(node)
      }}
      role="region"
      aria-labelledby={titleId}
      className="rounded-card border border-border bg-card p-inset"
      data-spend-calendar
    >
      <WidgetHeader title={t('gastoPorDia')} titleId={titleId}>
        {trailing}
      </WidgetHeader>
      {/* Each cell is a button named with its date and figure, so the grid is the text too. */}
      <div className="mt-4 grid grid-cols-7 gap-0.5" data-calendar-grid>
        {days.map((day, index) => (
          <button
            key={day.date}
            type="button"
            aria-disabled={day.future || !onSelectDay ? true : undefined}
            aria-haspopup={day.future || !onSelectDay ? undefined : 'dialog'}
            onClick={() => {
              if (day.future || !onSelectDay) return
              tooltip.hide()
              onSelectDay(day.date)
            }}
            aria-label={`${longDate(day.date)}${day.today ? ` (${t('hoy')})` : ''} · ${dayText(day)}`}
            data-day={day.date}
            data-step={day.step}
            data-today={day.today ? '' : undefined}
            data-future={day.future ? '' : undefined}
            className={cn(
              'chart-fade grid aspect-square min-h-9 place-items-center rounded-md text-label-ui tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card',
              STEP_CLASS[day.step],
              day.future && 'bg-transparent text-muted-foreground/60 ring-1 ring-inset ring-border',
              day.today && 'shadow-[inset_0_0_0_2px_var(--foreground)]',
              !day.future && onSelectDay && 'cursor-pointer active:scale-[0.92] motion-reduce:active:scale-100',
            )}
            data-revealed={revealed ? '' : undefined}
            data-settled={settled ? '' : undefined}
            style={{ ['--fade-delay' as string]: `${Math.min(index, 30) * STAGGER_MS}ms` }}
            // A tap opens the day's detail, so it no longer toggles the tooltip.
            {...tooltip.trigger(day.date, <TooltipValue value={day.total > 0 ? money(day.total, currency) : t('sinGastos')} label={`${longDate(day.date)}${day.total > 0 ? ` · ${t('filas', { n: day.rows })}` : ''}`} />, {
              touchToggle: !onSelectDay,
            })}
          >
            <span aria-hidden>{day.day}</span>
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-label-ui text-muted-foreground" aria-label={t('escalaCalor')} role="img" data-heat-legend>
        <span>{t('menos')}</span>
        <span aria-hidden className="flex gap-0.5">
          <span className={cn('size-3 rounded-sm', STEP_CLASS[0])} />
          <span className="size-3 rounded-sm bg-heat-1" />
          <span className="size-3 rounded-sm bg-heat-2" />
          <span className="size-3 rounded-sm bg-heat-3" />
          <span className="size-3 rounded-sm bg-heat-4" />
        </span>
        <span>{t('mas')}</span>
      </div>
      <ChartTooltip state={tooltip} />
    </SpotlightCard>
  )
}

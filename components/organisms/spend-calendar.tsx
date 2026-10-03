'use client'

import { useEffect, useMemo, useState } from 'react'
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
import { cn } from '@/lib/utils'

type SpendCalendarProps = {
  groups: ExpenseGroup[]
  cycle: DashboardData['cycle']
  timeZone: string
  currency: string
}

const STAGGER_MS = 15
const SETTLE_MS = 900

const STEP_CLASS: Record<DayTotal['step'], string> = {
  0: 'bg-foreground/[0.05] text-muted-foreground',
  1: 'bg-heat-1 text-foreground',
  2: 'bg-heat-2 text-foreground',
  3: 'bg-heat-3 text-heat-ink-high',
  4: 'bg-heat-4 text-heat-ink-high',
}

/**
 * "Gasto por día" (`spend-insights`): one cell per local day of the cycle in rows of seven from the
 * cycle's first day, filled on the brand ramp by quantile of the cycle's spending days; today
 * outlined, future days muted. The grid is HTML (design D7): each cell is a focusable mark with a
 * tooltip, and an sr-only list carries every day's figure.
 */
export function SpendCalendar({ groups, cycle, timeZone, currency }: SpendCalendarProps) {
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
      <WidgetHeader title={t('gastoPorDia')} titleId={titleId} />
      {/* Each cell is focusable and named with its date and figure, so the grid is the text too. */}
      <div role="list" className="mt-4 grid grid-cols-7 gap-0.5" data-calendar-grid>
        {days.map((day, index) => (
          <div
            key={day.date}
            role="listitem"
            tabIndex={0}
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
            )}
            data-revealed={revealed ? '' : undefined}
            data-settled={settled ? '' : undefined}
            style={{ ['--fade-delay' as string]: `${Math.min(index, 30) * STAGGER_MS}ms` }}
            {...tooltip.trigger(day.date, <TooltipValue value={day.total > 0 ? money(day.total, currency) : t('sinGastos')} label={`${longDate(day.date)}${day.total > 0 ? ` · ${t('filas', { n: day.rows })}` : ''}`} />, {
              touchToggle: true,
            })}
          >
            <span aria-hidden>{day.day}</span>
          </div>
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

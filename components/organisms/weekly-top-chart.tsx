'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { useAmountFormatter } from '@/components/atoms/amount-format'
import { CategoryDot } from '@/components/atoms/category-dot'
import { useFirstReveal } from '@/components/hooks/use-first-reveal'
import { ChartTooltip, TooltipValue, useChartTooltip } from '@/components/molecules/chart-tooltip'
import { WidgetHeader } from '@/components/molecules/widget-header'
import { AnimatedAmount } from '@/components/ui/counter/animated-amount'
import { SpotlightCard } from '@/components/ui/spotlight-card'
import type { DashboardData, ExpenseGroup } from '@/lib/data/dashboard'
// Pure arithmetic over the rows the dashboard already holds (design D3), not data access.
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { currentWeekIndex, weeklyTopCategories, weeksOfCycle } from '@/lib/data/weekly-spend'
import { cn } from '@/lib/utils'

type WeeklyTopChartProps = {
  groups: ExpenseGroup[]
  cycle: DashboardData['cycle']
  timeZone: string
  currency: string
  onSelectCategory?: (id: string) => void
}

const STAGGER_MS = 40
/** The first reveal's longest delay: six bars at 40 ms keep the whole draw under 900 ms. */
const SETTLE_MS = 900

/**
 * "Top gastos de la semana" (`spend-insights`): the categories ranked by what left in the selected
 * week of the cycle, walked back week by week. Horizontal bars are a list, not a plot (design D7):
 * every row is a 44px button with the category before the bar and its amount at the tip.
 */
export function WeeklyTopChart({ groups, cycle, timeZone, currency, onSelectCategory }: WeeklyTopChartProps) {
  const t = useTranslations('graficos')
  const format = useFormatter()
  const { money } = useAmountFormatter()
  const tooltip = useChartTooltip()
  const [revealRef, revealed] = useFirstReveal<HTMLDivElement>()
  const [settled, setSettled] = useState(false)

  const weeks = useMemo(() => weeksOfCycle(cycle.start, cycle.end, cycle.today), [cycle.start, cycle.end, cycle.today])
  const current = currentWeekIndex(weeks)
  const [selectedIndex, setSelectedIndex] = useState(current)
  // The widget opens on the current week whenever the shown cycle changes.
  const [shownCycle, setShownCycle] = useState(cycle.month)
  if (shownCycle !== cycle.month) {
    setShownCycle(cycle.month)
    setSelectedIndex(current)
  }
  const week = weeks[Math.min(selectedIndex, weeks.length) - 1] ?? weeks[0]

  const { items, total } = useMemo(
    () => weeklyTopCategories(groups, week, timeZone, { othersName: '' }),
    [groups, week, timeZone],
  )
  const max = items[0]?.amount ?? 0

  useEffect(() => {
    if (!revealed) return
    const timer = setTimeout(() => setSettled(true), SETTLE_MS)
    return () => clearTimeout(timer)
  }, [revealed])

  // Node and WebKit's ICU disagree on the separator's spacing ("29–30 sept" vs "29 – 30 sept"),
  // and a mismatch makes Safari throw away the server HTML and rebuild the page. Normalized as
  // `month-selector.tsx` does, keeping the spaces only between two months ("29 sept – 5 oct").
  const crossesMonths = week.start.slice(0, 7) !== week.end.slice(0, 7)
  const weekName = format
    .dateTimeRange(new Date(`${week.start}T12:00:00Z`), new Date(`${week.end}T12:00:00Z`), {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    })
    .replace(/\s*[–-]\s*/, crossesMonths ? ' – ' : '–')
  const titleId = 'weekly-top-title'
  const statusText = `${t('semana', { n: week.index })}, ${weekName}. ${t('totalSemana', { monto: money(total, currency) })}`

  return (
    <SpotlightCard
      ref={(node) => {
        revealRef(node)
        tooltip.containerRef(node)
      }}
      role="region"
      aria-labelledby={titleId}
      className="rounded-card border border-border bg-card p-inset"
      data-weekly-top
    >
      <WidgetHeader
        title={t('topSemana')}
        titleId={titleId}
        caption={
          <span className="flex items-baseline gap-1.5" data-week-caption>
            <span>{weekName}</span>
            <span aria-hidden>·</span>
            <AnimatedAmount amount={total} currency={currency} className="text-label-ui font-medium text-foreground" />
          </span>
        }
      >
        <button
          type="button"
          onClick={() => setSelectedIndex((index) => Math.max(1, index - 1))}
          disabled={week.index <= 1}
          aria-label={t('semanaAnterior')}
          className="pressable grid size-target place-items-center rounded-full text-muted-foreground [--press-scale:0.9] hover:bg-foreground/[0.06] hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronLeft aria-hidden className="size-5" />
        </button>
        <button
          type="button"
          onClick={() => setSelectedIndex((index) => Math.min(current, index + 1))}
          disabled={week.index >= current}
          aria-label={t('semanaSiguiente')}
          className="pressable grid size-target place-items-center rounded-full text-muted-foreground [--press-scale:0.9] hover:bg-foreground/[0.06] hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronRight aria-hidden className="size-5" />
        </button>
      </WidgetHeader>
      {/* The week's name and total, read when the selection moves. */}
      <p role="status" className="sr-only">
        {statusText}
      </p>
      {items.length === 0 ? (
        <p className="mt-4 flex min-h-row items-center text-body-sm text-muted-foreground" data-weekly-empty>
          {t('semanaVacia')}
        </p>
      ) : (
        <ul className="mt-3 flex flex-col">
          {items.map((item, index) => {
            const isOthers = item.id === null
            const name = isOthers ? t('otras', { n: item.folded ?? 0 }) : item.name
            const amountText = money(item.amount, currency)
            const share = max > 0 ? item.amount / max : 0
            const tip = (
              <TooltipValue
                value={amountText}
                label={`${name} · ${t('delTotal', { porcentaje: format.number(item.share, { style: 'percent', maximumFractionDigits: 0 }) })} · ${t('filas', { n: item.rows })}`}
              />
            )
            const row = (
              <>
                <span className="flex w-[38%] min-w-0 shrink-0 items-center gap-2 pe-2 sm:w-[32%]">
                  {isOthers ? (
                    <span aria-hidden className="inline-block size-2.5 shrink-0 rounded-full bg-chart-muted" />
                  ) : (
                    <CategoryDot color={item.color!} className="size-2.5" />
                  )}
                  <span className={cn('truncate text-body-sm', isOthers ? 'text-muted-foreground' : 'text-foreground')}>{name}</span>
                </span>
                <span className="relative flex min-w-0 flex-1 items-center gap-2">
                  {/* The plot keeps 5rem free at its end for the amount, so every bar is a share of the same width. */}
                  <span className="relative h-5 min-w-0 shrink-0" style={{ width: `calc((100% - 5rem) * ${share.toFixed(4)})` }}>
                    <span
                      className="chart-bar absolute inset-0 rounded-e"
                      data-revealed={revealed ? '' : undefined}
                      data-settled={settled ? '' : undefined}
                      style={{
                        background: isOthers ? 'var(--chart-muted)' : `var(--cat-${item.color})`,
                        ['--bar-delay' as string]: `${index * STAGGER_MS}ms`,
                      }}
                    />
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-body-sm tabular-nums text-foreground">{amountText}</span>
                </span>
              </>
            )
            return (
              <li key={item.id ?? 'others'} className="flex">
                {isOthers || !onSelectCategory ? (
                  <div className="flex min-h-target w-full items-center" data-weekly-bar="others" {...tooltip.trigger('others', tip, { touchToggle: true })} tabIndex={0}>
                    {row}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelectCategory(item.id!)}
                    aria-label={`${name} · ${amountText}`}
                    data-weekly-bar={item.id}
                    className="pressable -mx-1.5 flex min-h-target w-[calc(100%+12px)] items-center rounded-md px-1.5 text-left hover:bg-foreground/[0.04]"
                    {...tooltip.trigger(item.id!, tip)}
                  >
                    {row}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <ChartTooltip state={tooltip} />
    </SpotlightCard>
  )
}

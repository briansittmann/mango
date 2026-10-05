'use client'

import { useState, type ReactNode } from 'react'
import { Bar, BarChart, LabelList, ResponsiveContainer, XAxis } from 'recharts'
import type { BarShapeProps, LabelProps, XAxisTickContentProps } from 'recharts'
import { useFormatter, useTranslations } from 'next-intl'
import { compactFormatOptions } from '@/i18n/formats'
import { useAmountFormatter } from '@/components/atoms/amount-format'
import { TrendDelta } from '@/components/atoms/trend-delta'
import { useFirstReveal } from '@/components/hooks/use-first-reveal'
import { ChartTooltip, TooltipValue, useChartTooltip } from '@/components/molecules/chart-tooltip'
import { WidgetHeader } from '@/components/molecules/widget-header'
import { SpotlightCard } from '@/components/ui/spotlight-card'

type MonthlyBarsChartProps = {
  history: { month: string; total: number }[]
  currentMonth: string
  currency: string
  /** The widget list's grip, at the end of the header. */
  trailing?: ReactNode
}

/** The bar's hit area, wider than the bar itself (dataviz → *The hit target is bigger than the mark*). */
const HIT_WIDTH = 44
const TIP_RADIUS = 4
/** First-reveal stagger between bars (AUDIT.md §7: 30–80 ms). */
const STAGGER_MS = 40
/** The plot's side margins and the axis band under it, shared with the control overlay. */
const SIDE_MARGIN = 8
const AXIS_HEIGHT = 30

function barPath(x: number, y: number, width: number, height: number): string {
  const r = Math.min(TIP_RADIUS, width / 2, height)
  const right = x + width
  const bottom = y + height
  return `M${x},${bottom} V${y + r} Q${x},${y} ${x + r},${y} H${right - r} Q${right},${y} ${right},${y + r} V${bottom} Z`
}

/**
 * The bars are drawn by recharts; the controls over them are HTML buttons laid out on the same
 * category bands (design → Risks: an SVG group never kept keyboard focus across a re-render), so
 * each month has a 44px-wide target with a real focus ring, a tooltip and Enter/Space selection.
 */
export function MonthlyBarsChart({ history, currentMonth, currency, trailing }: MonthlyBarsChartProps) {
  const t = useTranslations('graficos')
  const format = useFormatter()
  const { money } = useAmountFormatter()
  const [selected, setSelected] = useState(currentMonth)
  const tooltip = useChartTooltip()
  const [revealRef, revealed] = useFirstReveal<HTMLDivElement>()
  const [settled, setSettled] = useState(false)

  const monthDate = (month: string) => new Date(`${month}-01T00:00:00Z`)
  const formatMonth = (month: string) => format.dateTime(monthDate(month), { month: 'short', timeZone: 'UTC' })
  const formatMonthLong = (month: string) => format.dateTime(monthDate(month), { month: 'long', timeZone: 'UTC' })

  const last = history[history.length - 1]
  const previous = history[history.length - 2]

  return (
    <SpotlightCard
      ref={(node) => {
        revealRef(node)
        tooltip.containerRef(node)
      }}
      className="rounded-card border border-border bg-card p-inset"
      data-monthly-chart
    >
      <WidgetHeader
        title={t('monthlySpend')}
        caption={
          previous && last && previous.total > 0 ? (
            <>
              <TrendDelta current={last.total} previous={previous.total} upIsGood={false} />
              <span>{t('vsMesAnterior', { mes: formatMonth(previous.month) })}</span>
            </>
          ) : undefined
        }
      >
        {trailing}
      </WidgetHeader>
      <div className="relative mt-4 h-44 lg:h-56" onTransitionEnd={() => setSettled(true)}>
        <div aria-hidden className="absolute inset-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={history} margin={{ top: 20, right: SIDE_MARGIN, bottom: 0, left: SIDE_MARGIN }} accessibilityLayer={false}>
              <XAxis
                dataKey="month"
                height={AXIS_HEIGHT}
                tickLine={false}
                axisLine={{ stroke: 'var(--chart-baseline)', strokeWidth: 1 }}
                interval={0}
                tick={(props: XAxisTickContentProps) => {
                  const isSelected = props.payload.value === selected
                  return (
                    <text
                      x={props.x}
                      y={props.y}
                      dy={16}
                      textAnchor="middle"
                      fontSize={13}
                      fontWeight={isSelected ? 600 : 400}
                      fill={isSelected ? 'var(--foreground)' : 'var(--muted-foreground)'}
                    >
                      {formatMonth(String(props.payload.value))}
                    </text>
                  )
                }}
              />
              <Bar
                dataKey="total"
                maxBarSize={24}
                isAnimationActive={false}
                shape={(props: BarShapeProps) => {
                  const { x, y, width, height, index } = props
                  const month = String(props.payload?.month ?? '')
                  return (
                    <path
                      d={barPath(x, y, width, height)}
                      fill={month === currentMonth ? 'var(--brand)' : 'var(--chart-muted)'}
                      className="chart-bar"
                      data-month-bar={month}
                      data-vertical
                      data-revealed={revealed ? '' : undefined}
                      data-settled={settled ? '' : undefined}
                      style={{
                        ['--bar-delay' as string]: `${index * STAGGER_MS}ms`,
                        ['--bar-clip' as string]: `inset(0 round ${TIP_RADIUS}px ${TIP_RADIUS}px 0 0)`,
                      }}
                    />
                  )
                }}
              >
                <LabelList
                  dataKey="total"
                  position="top"
                  content={(props: LabelProps) => {
                    const isSelected = typeof props.index === 'number' && history[props.index]?.month === selected
                    if (!isSelected) return null
                    const centerX = Number(props.x) + Number(props.width ?? 0) / 2
                    return (
                      <text x={centerX} y={Number(props.y) - 6} textAnchor="middle" fontSize={13} fontWeight={600} fill="var(--foreground)">
                        {format.number(Number(props.value), compactFormatOptions)}
                      </text>
                    )
                  }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {/* One control per band, centred on its bar; the plot is divided as recharts divides it. */}
        <div
          className="absolute inset-y-0 grid"
          style={{ left: SIDE_MARGIN, right: SIDE_MARGIN, bottom: AXIS_HEIGHT, gridTemplateColumns: `repeat(${history.length}, minmax(0, 1fr))` }}
        >
          {history.map((entry) => {
            const isSelected = entry.month === selected
            const label = `${formatMonthLong(entry.month)} · ${money(entry.total, currency)}`
            return (
              <div key={entry.month} className="flex justify-center">
                <button
                  type="button"
                  aria-label={label}
                  aria-pressed={isSelected}
                  data-month-control={entry.month}
                  onClick={() => setSelected(entry.month)}
                  className="h-full rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                  style={{ width: HIT_WIDTH }}
                  {...tooltip.trigger(entry.month, <TooltipValue value={money(entry.total, currency)} label={formatMonthLong(entry.month)} />)}
                />
              </div>
            )
          })}
        </div>
      </div>
      <ChartTooltip state={tooltip} />
      <ul className="sr-only">
        {history.map((entry) => {
          const monthLabel = format.dateTime(monthDate(entry.month), { month: 'long', year: 'numeric', timeZone: 'UTC' })
          const totalLabel = money(entry.total, currency)
          return (
            <li key={entry.month}>
              {monthLabel}
              {' · '}
              {totalLabel}
            </li>
          )
        })}
      </ul>
    </SpotlightCard>
  )
}

'use client'

import { useState, type ReactNode } from 'react'
import { Pie, PieChart, ResponsiveContainer, Sector } from 'recharts'
import type { PieSectorShapeProps } from 'recharts'
import { useFormatter, useTranslations } from 'next-intl'
import { useAmountFormatter } from '@/components/atoms/amount-format'
import { CategoryDot } from '@/components/atoms/category-dot'
import { Money } from '@/components/atoms/money'
import { useFirstReveal } from '@/components/hooks/use-first-reveal'
import { WidgetHeader } from '@/components/molecules/widget-header'
import { SpotlightCard } from '@/components/ui/spotlight-card'
import type { ExpenseGroup } from '@/lib/data/dashboard'
import { cn } from '@/lib/utils'

type CategoryPieChartProps = {
  groups: ExpenseGroup[]
  total: number
  currency: string
  /** Scrolls the page to the category's card (`dashboard-ui` → *Category colour placement*). */
  onSelectCategory?: (id: string) => void
  /** The widget list's grip, at the end of the header. */
  trailing?: ReactNode
}

/** How far the highlighted slice grows past the others. */
const ACTIVE_GROW = 6

export function CategoryPieChart({ groups, total, currency, onSelectCategory, trailing }: CategoryPieChartProps) {
  const tGraficos = useTranslations('graficos')
  const format = useFormatter()
  const { money } = useAmountFormatter()
  const slices = groups.filter((group) => group.total > 0)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [revealRef, revealed] = useFirstReveal()
  // The sweep plays on the first mount that is revealed and never again (design D9).
  const [animated, setAnimated] = useState(false)
  const active = activeId ? slices.find((slice) => slice.id === activeId) ?? null : null

  const share = (value: number) => (total > 0 ? format.number(value / total, { style: 'percent', maximumFractionDigits: 0 }) : '')

  return (
    <SpotlightCard ref={revealRef} className="rounded-card border border-border bg-card p-inset" data-distribution-chart>
      <WidgetHeader title={tGraficos('distribution')}>{trailing}</WidgetHeader>
      {/* The donut on top and the legend under it at every width: the widget column at `lg` is
          320–360px, where a legend beside the donut had no room for its names. */}
      <div className="mt-4 flex flex-col items-center gap-5">
        <div className="relative size-44 shrink-0" data-donut>
          {revealed ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart accessibilityLayer={false}>
                <Pie
                  data={slices}
                  dataKey="total"
                  nameKey="id"
                  innerRadius="68%"
                  outerRadius="92%"
                  stroke="var(--card)"
                  strokeWidth={2}
                  rootTabIndex={-1}
                  isAnimationActive={!animated}
                  animationDuration={600}
                  animationEasing="ease-out"
                  onAnimationEnd={() => setAnimated(true)}
                  shape={(props: PieSectorShapeProps) => {
                    const slice = slices[props.index]
                    const isActive = slice?.id === activeId
                    return (
                      <Sector
                        cx={props.cx}
                        cy={props.cy}
                        innerRadius={props.innerRadius}
                        outerRadius={isActive ? props.outerRadius + ACTIVE_GROW : props.outerRadius}
                        startAngle={props.startAngle}
                        endAngle={props.endAngle}
                        fill={slice ? `var(--cat-${slice.color})` : props.fill}
                        fillOpacity={activeId && !isActive ? 0.5 : 1}
                        stroke="var(--card)"
                        strokeWidth={2}
                        className="donut-slice"
                        data-slice={slice?.id}
                        onPointerEnter={(event) => {
                          if (event.pointerType !== 'touch' && slice) setActiveId(slice.id)
                        }}
                        onPointerLeave={() => setActiveId(null)}
                      />
                    )
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : null}
          {/* Two faces in one cell: the total and the highlighted category cross-fade (design D7). */}
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className={cn('donut-centre col-start-1 row-start-1 flex flex-col items-center px-6 text-center', active && 'opacity-0')} aria-hidden={!!active}>
              <p className="text-body-sm text-muted-foreground">{tGraficos('total')}</p>
              <Money amount={total} currency={currency} className="text-tabular-numeric-md font-semibold text-foreground" />
            </div>
            <div
              className={cn('donut-centre col-start-1 row-start-1 flex flex-col items-center px-6 text-center', !active && 'opacity-0')}
              aria-hidden={!active}
              data-donut-active
            >
              <p className="max-w-full truncate text-body-sm text-muted-foreground">{active?.name}</p>
              {active ? <Money amount={active.total} currency={currency} className="text-tabular-numeric-md font-semibold text-foreground" /> : null}
            </div>
          </div>
        </div>
        <ul className="flex w-full min-w-0 flex-col text-body-sm" onPointerLeave={() => setActiveId(null)}>
          {slices.map((slice) => {
            const isActive = slice.id === activeId
            return (
              <li key={slice.id} className="flex">
                <button
                  type="button"
                  onClick={onSelectCategory ? () => onSelectCategory(slice.id) : undefined}
                  disabled={!onSelectCategory}
                  onPointerEnter={(event) => {
                    if (event.pointerType !== 'touch') setActiveId(slice.id)
                  }}
                  onFocus={() => setActiveId(slice.id)}
                  onBlur={() => setActiveId(null)}
                  data-legend={slice.id}
                  className={cn(
                    'pressable flex min-h-10 w-full items-center gap-2 rounded-md px-1.5 text-left transition-colors duration-150 ease-out disabled:pointer-events-none',
                    isActive && 'bg-foreground/[0.05]',
                  )}
                >
                  <CategoryDot color={slice.color} className="size-2.5" />
                  <span className={cn('min-w-0 flex-1 truncate', isActive ? 'font-medium text-foreground' : 'text-muted-foreground')}>{slice.name}</span>
                  <span className="shrink-0 text-right tabular-nums text-foreground">{money(slice.total, currency)}</span>
                  <span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground">{share(slice.total)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </SpotlightCard>
  )
}

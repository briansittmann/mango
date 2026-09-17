import { useState } from 'react'
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis } from 'recharts'
import type { LabelProps, XAxisTickContentProps } from 'recharts'
import { useFormatter, useTranslations } from 'next-intl'
import { compactFormatOptions, currencyFormatOptions } from '@/i18n/formats'

type MonthlyBarsChartProps = {
  history: { month: string; total: number }[]
  currentMonth: string
  currency: string
}

export function MonthlyBarsChart({ history, currentMonth, currency }: MonthlyBarsChartProps) {
  const t = useTranslations('graficos')
  const format = useFormatter()
  const [selected, setSelected] = useState(currentMonth)

  const monthDate = (month: string) => new Date(`${month}-01T00:00:00Z`)
  const formatMonth = (month: string) => format.dateTime(monthDate(month), { month: 'short', timeZone: 'UTC' })

  return (
    <div className="rounded-card border border-border bg-card p-inset">
      <h3 className="font-display text-headline-sm text-foreground">{t('monthlySpend')}</h3>
      <div aria-hidden className="mt-5 h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={history}
            margin={{ top: 16, right: 16, bottom: 0, left: 16 }}
            accessibilityLayer={false}
          >
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
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
                    fill={isSelected ? 'var(--brand-ink)' : 'var(--foreground)'}
                  >
                    {formatMonth(String(props.payload.value))}
                  </text>
                )
              }}
            />
            <Bar
              dataKey="total"
              maxBarSize={32}
              radius={[8, 8, 0, 0]}
              style={{ cursor: 'pointer' }}
              isAnimationActive={false}
              onClick={(entry) => setSelected(entry.payload.month)}
            >
              <LabelList
                dataKey="total"
                position="top"
                content={(props: LabelProps) => {
                  const isSelected = typeof props.index === 'number' && history[props.index]?.month === selected
                  if (!isSelected) return null
                  const centerX = Number(props.x) + Number(props.width ?? 0) / 2
                  return (
                    <text x={centerX} y={Number(props.y) - 6} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--brand-ink)">
                      {format.number(Number(props.value), compactFormatOptions)}
                    </text>
                  )
                }}
              />
              {history.map((entry) => {
                const isSelected = entry.month === selected
                return (
                  <Cell
                    key={entry.month}
                    fill={isSelected ? 'var(--brand)' : 'var(--muted-foreground)'}
                    fillOpacity={isSelected ? 1 : 0.25}
                    style={{
                      filter: isSelected ? 'drop-shadow(0 0 10px var(--hero-glow))' : 'none',
                      transition: 'fill 150ms var(--ease-out), fill-opacity 150ms var(--ease-out)',
                    }}
                  />
                )
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="sr-only">
        {history.map((entry) => {
          const monthLabel = format.dateTime(monthDate(entry.month), { month: 'long', year: 'numeric', timeZone: 'UTC' })
          const totalLabel = format.number(entry.total, { ...currencyFormatOptions, currency })
          return (
            <li key={entry.month}>
              {monthLabel}
              {' · '}
              {totalLabel}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

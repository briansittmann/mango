import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis } from 'recharts'
import type { LabelProps, XAxisTickContentProps } from 'recharts'
import { useFormatter, useTranslations } from 'next-intl'
import { compactFormatOptions } from '@/i18n/formats'

type MonthlyBarsChartProps = {
  history: { month: string; total: number }[]
  currentMonth: string
}

export function MonthlyBarsChart({ history, currentMonth }: MonthlyBarsChartProps) {
  const t = useTranslations('graficos')
  const format = useFormatter()

  const formatMonth = (month: string) => format.dateTime(new Date(`${month}-01T00:00:00Z`), { month: 'short', timeZone: 'UTC' })

  return (
    <div className="rounded-card border border-border bg-card p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-headline-sm text-foreground">{t('lastMonths')}</h3>
        <span className="text-label-caps uppercase text-muted-foreground">{t('monthlySpend')}</span>
      </div>
      <div className="mt-5 h-40 rounded-inner bg-background px-4 pb-3 pt-5">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={history} margin={{ top: 16, right: 16, bottom: 0, left: 16 }}>
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--brand)" stopOpacity={1} />
                <stop offset="100%" stopColor="var(--brand)" stopOpacity={0.35} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={(props: XAxisTickContentProps) => {
                const isCurrent = props.payload.value === currentMonth
                return (
                  <text
                    x={props.x}
                    y={props.y}
                    dy={16}
                    textAnchor="middle"
                    fontSize={14}
                    fontWeight={isCurrent ? 600 : 400}
                    fill={isCurrent ? 'var(--brand-ink)' : 'var(--muted-foreground)'}
                  >
                    {formatMonth(String(props.payload.value))}
                  </text>
                )
              }}
            />
            <Bar dataKey="total" maxBarSize={32} radius={[8, 8, 0, 0]}>
              <LabelList
                dataKey="total"
                position="top"
                content={(props: LabelProps) => {
                  const isCurrent = typeof props.index === 'number' && history[props.index]?.month === currentMonth
                  const centerX = Number(props.x) + Number(props.width ?? 0) / 2
                  return (
                    <text
                      x={centerX}
                      y={Number(props.y) - 6}
                      textAnchor="middle"
                      fontSize={12}
                      fontWeight={isCurrent ? 600 : 400}
                      fill={isCurrent ? 'var(--brand-ink)' : 'var(--muted-foreground)'}
                    >
                      {format.number(Number(props.value), compactFormatOptions)}
                    </text>
                  )
                }}
              />
              {history.map((entry) => {
                const isCurrent = entry.month === currentMonth
                return (
                  <Cell
                    key={entry.month}
                    fill="url(#barGradient)"
                    fillOpacity={isCurrent ? 1 : 0.35}
                    style={{
                      filter: isCurrent
                        ? 'drop-shadow(0 0 2px var(--brand)) drop-shadow(0 0 8px var(--brand)) drop-shadow(0 0 16px var(--hero-glow))'
                        : 'drop-shadow(0 0 4px var(--hero-glow))',
                    }}
                  />
                )
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

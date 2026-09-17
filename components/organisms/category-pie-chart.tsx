import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import { useFormatter, useTranslations } from 'next-intl'
import { CategoryDot } from '@/components/atoms/category-dot'
import { Money } from '@/components/atoms/money'
import type { ExpenseGroup } from '@/lib/data/dashboard'

type CategoryPieChartProps = {
  groups: ExpenseGroup[]
  total: number
  currency: string
}

export function CategoryPieChart({ groups, total, currency }: CategoryPieChartProps) {
  const tGraficos = useTranslations('graficos')
  const format = useFormatter()
  const slices = groups.filter((group) => group.total > 0)

  return (
    <div className="rounded-card border border-border bg-card p-5">
      <h3 className="font-display text-headline-sm text-foreground">{tGraficos('distribution')}</h3>
      <div className="mt-5 flex items-center gap-5">
        <div className="relative size-28 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart accessibilityLayer={false}>
              <Pie
                data={slices}
                dataKey="total"
                nameKey="id"
                innerRadius="71%"
                outerRadius="100%"
                stroke="var(--card)"
                strokeWidth={2}
                rootTabIndex={-1}
                isAnimationActive={false}
              >
                {slices.map((slice) => (
                  <Cell key={slice.id} fill={`var(--cat-${slice.color})`} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-body-sm text-muted-foreground">{tGraficos('total')}</p>
            <Money amount={total} currency={currency} className="text-tabular-numeric-md font-semibold text-foreground" />
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-2 text-body-sm">
          {slices.map((slice) => (
            <div key={slice.id} className="flex items-center gap-2">
              <CategoryDot color={slice.color} className="size-2.5" />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{slice.name}</span>
              <span>{total > 0 ? format.number(slice.total / total, { style: 'percent', maximumFractionDigits: 0 }) : null}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

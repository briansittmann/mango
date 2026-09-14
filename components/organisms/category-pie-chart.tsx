import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import { useTranslations } from 'next-intl'
import { Money } from '@/components/atoms/money'
import type { ExpenseGroup } from '@/lib/data/dashboard'

type CategoryPieChartProps = {
  groups: ExpenseGroup[]
  total: number
  currency: string
}

export function CategoryPieChart({ groups, total, currency }: CategoryPieChartProps) {
  const t = useTranslations('graficos')
  const slices = groups.filter((group) => group.total > 0)

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="relative mx-auto aspect-square w-full max-w-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="total" nameKey="id" innerRadius="65%" outerRadius="100%" stroke="var(--card)" strokeWidth={2}>
              {slices.map((slice) => (
                <Cell key={slice.id} fill={`var(--cat-${slice.color})`} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-xs font-medium text-muted-foreground">{t('total')}</p>
          <Money amount={total} currency={currency} className="text-lg font-semibold text-foreground" />
        </div>
      </div>
    </div>
  )
}

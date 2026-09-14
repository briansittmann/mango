import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { useFormatter } from 'next-intl'
import { compactFormatOptions } from '@/i18n/formats'

type MonthlyBarsChartProps = {
  history: { month: string; total: number }[]
  currentMonth: string
}

export function MonthlyBarsChart({ history, currentMonth }: MonthlyBarsChartProps) {
  const format = useFormatter()

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={history}>
            <XAxis
              dataKey="month"
              tickFormatter={(month: string) => format.dateTime(new Date(`${month}-01T00:00:00Z`), { month: 'short', timeZone: 'UTC' })}
              tickLine={false}
              axisLine={false}
              stroke="var(--muted-foreground)"
              fontSize={12}
            />
            <YAxis
              tickFormatter={(value: number) => format.number(value, compactFormatOptions)}
              tickLine={false}
              axisLine={false}
              stroke="var(--muted-foreground)"
              fontSize={12}
              width={40}
            />
            <Bar dataKey="total" radius={[4, 4, 0, 0]}>
              {history.map((entry) => (
                <Cell key={entry.month} fill={entry.month === currentMonth ? 'var(--brand)' : 'var(--muted)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

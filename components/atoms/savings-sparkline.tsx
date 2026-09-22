import { Line, LineChart, ResponsiveContainer } from 'recharts'

type SavingsSparklineProps = {
  history: { month: string; accumulated: number }[]
}

export function SavingsSparkline({ history }: SavingsSparklineProps) {
  return (
    <div aria-hidden className="h-6 w-20 shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={history} margin={{ top: 2, right: 2, bottom: 2, left: 2 }} accessibilityLayer={false}>
          <Line
            type="monotone"
            dataKey="accumulated"
            stroke="var(--brand)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

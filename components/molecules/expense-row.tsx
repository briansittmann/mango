import { Money } from '@/components/atoms/money'
import { ShortDate } from '@/components/atoms/short-date'

type ExpenseRowProps = {
  name: string
  date: string
  amount: number
  currency: string
  timeZone: string
}

export function ExpenseRow({ name, date, amount, currency, timeZone }: ExpenseRowProps) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm text-foreground">{name}</p>
        <ShortDate date={date} timeZone={timeZone} className="text-xs text-muted-foreground" />
      </div>
      <Money amount={amount} currency={currency} className="shrink-0 text-sm text-foreground" />
    </div>
  )
}

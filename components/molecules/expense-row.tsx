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
    <div className="relative flex min-h-row items-center gap-3 px-inset py-2.5 before:absolute before:left-4 before:right-0 before:top-0 before:h-px before:bg-border first:before:hidden hover:bg-foreground/[0.04]">
      <div className="min-w-0 flex-1">
        <p className="truncate text-body-lg text-foreground">{name}</p>
        <ShortDate date={date} timeZone={timeZone} className="text-body-sm text-muted-foreground" />
      </div>
      <Money amount={amount} currency={currency} className="shrink-0 text-tabular-numeric-md text-foreground" />
    </div>
  )
}
